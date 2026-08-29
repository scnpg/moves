-- Reconstructed from the live schema, not authored fresh - this and
-- 20260827091500 were applied directly to the remote database with no
-- migration file ever committed for either version (supabase migration
-- list showed both as remote-only). Combined into this one file since
-- there's no way to recover which change belonged to which timestamp;
-- what matters is that the end state matches what's actually live.
-- 20260827091500 itself has no local file and never will - see the repair
-- command in the PR/commit that added this file for clearing that
-- version's tracking entry.
--
-- Adds account-level bans: is_banned/banned_at/ban_reason on profiles,
-- ban_user()/unban_user() (moderator-only, self-checked internally same
-- as the rest of this app's moderation RPCs), and assert_not_banned() -
-- called from the write-path triggers below so a banned account can't
-- send friend requests, send messages, host Moves, or join Moves. Also
-- wires banning into the existing "confirmed_threat" moderation verdict
-- (apply_moderation_verdict) instead of just deleting the offending row,
-- and exposes is_banned via get_public_profile() for a banned-state UI.
--
-- No client code anywhere in src/ references any of this yet - no ban/
-- unban button, no banned-account screen, nothing reads is_banned. This
-- is backend-only until that's built.
alter table public.profiles
  add column is_banned boolean not null default false,
  add column banned_at timestamptz,
  add column ban_reason text;

create index profiles_is_banned_idx on public.profiles (is_banned) where is_banned;

create or replace function public.assert_not_banned(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = p_user_id and is_banned) then
    raise exception 'This account has been suspended.'
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.ban_user(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot ban yourself';
  end if;
  update public.profiles
  set is_banned = true, banned_at = now(), ban_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_user_id;
end;
$$;

create or replace function public.unban_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;
  update public.profiles
  set is_banned = false, banned_at = null, ban_reason = null
  where id = p_user_id;
end;
$$;

revoke all on function public.assert_not_banned(uuid) from public;
grant execute on function public.assert_not_banned(uuid) to anon, authenticated, service_role;

revoke all on function public.ban_user(uuid, text) from public;
grant execute on function public.ban_user(uuid, text) to anon, authenticated, service_role;

revoke all on function public.unban_user(uuid) from public;
grant execute on function public.unban_user(uuid) to anon, authenticated, service_role;

-- New: banned-term filtering for chat messages - the earlier banned-terms
-- migration covered Move titles/descriptions and profile fields, but not
-- move_messages.
create or replace function public.enforce_message_content_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.contains_banned_term(new.content) then
    raise exception 'That message contains language that isn''t allowed here.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger move_messages_content_policy
  before insert on public.move_messages
  for each row execute function public.enforce_message_content_policy();

-- Modified: ban enforcement added to four existing write-path triggers.
create or replace function public.enforce_friend_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  perform public.assert_not_banned(new.requested_by);

  select count(*) into v_recent_count
  from public.friendships
  where requested_by = new.requested_by
    and created_at > now() - interval '10 minutes';

  if v_recent_count >= 20 then
    raise exception 'Too many friend requests sent recently. Please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  perform public.assert_not_banned(new.sender_id);

  select count(*) into v_recent_count
  from public.move_messages
  where sender_id = new.sender_id
    and created_at > now() - interval '30 seconds';

  if v_recent_count >= 15 then
    raise exception 'You are sending messages too quickly. Please slow down.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_move_content_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_not_banned(new.host_id);
  if public.contains_banned_term(new.title) or public.contains_banned_term(coalesce(new.description, '')) then
    raise exception 'That title or description contains language that isn''t allowed here.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_move_join_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  perform public.assert_not_banned(new.user_id);

  select count(*) into v_recent_count
  from public.move_members
  where user_id = new.user_id
    and requested_at > now() - interval '10 minutes';

  if v_recent_count >= 20 then
    raise exception 'Too many join requests sent recently. Please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Modified: a confirmed-threat profile verdict now bans the account
-- (previously it only recorded the verdict - profiles have no row to
-- delete the way a Move or message report does).
create or replace function public.apply_moderation_verdict(p_case_id uuid, p_verdict text, p_reviewer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.moderation_cases%rowtype;
begin
  select * into v_case from public.moderation_cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'case not found';
  end if;

  update public.moderation_cases
  set status = p_verdict, reviewed_by = p_reviewer, reviewed_at = now()
  where id = p_case_id;

  if p_verdict = 'confirmed_threat' then
    if v_case.kind = 'move' then
      delete from public.moves where id = v_case.target_id;
    elsif v_case.kind = 'message' then
      delete from public.move_messages where id = v_case.target_id;
    elsif v_case.kind = 'profile' then
      update public.profiles
      set is_banned = true, banned_at = now(), ban_reason = 'Confirmed threat via moderation review'
      where id = v_case.target_id;
    end if;
  end if;
end;
$$;

-- Modified: exposes is_banned so a client can eventually show a
-- banned-state UI on a profile.
create or replace function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  is_banned boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.is_banned
  from public.profiles p
  where p.id = p_user_id;
$$;
