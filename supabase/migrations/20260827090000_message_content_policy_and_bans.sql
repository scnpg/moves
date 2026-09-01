-- Closes two gaps from a store-safety-checklist review:
--
-- 1. move_messages had a rate limit (20260818091500) but no content
--    filtering at all - contains_banned_term() only ever guarded Move
--    titles/descriptions and usernames/display names, so a slur typed
--    directly into chat sailed through untouched.
--
-- 2. "Confirmed threat" against a profile only forced a username reset
--    (username_reset_required) - the account itself stayed fully usable
--    under a new name. There was no actual ban: no column, no enforcement,
--    no moderator-facing way to instantly lock someone out. This adds a
--    real one.
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

-- ---------------------------------------------------------------------
-- Bans
-- ---------------------------------------------------------------------
alter table public.profiles add column is_banned boolean not null default false;
alter table public.profiles add column banned_at timestamptz;
alter table public.profiles add column ban_reason text;

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

-- Checked at the main content-creation choke points - covers a banned
-- account trying to keep operating even if its existing session/JWT is
-- still technically valid (it stays valid until the access token expires
-- and isn't proactively revoked - see ban_user() comment below). The
-- client-side check (AuthProvider, on every profile load) is the fast
-- path; these are the hard backstop.
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

-- Moderator-facing instant ban/unban - independent of the report-
-- threshold/LLM pipeline, for when a moderator wants to act immediately
-- (e.g. from a profile page) rather than wait for report_count to cross
-- a threshold. Doesn't revoke an already-issued access token directly
-- (that needs GoTrue's admin API, not reachable from plain SQL) - it
-- expires on its own within 15 minutes (jwt_expiry) and every refresh
-- and every content-creation attempt in the meantime is blocked by
-- assert_not_banned() above and the client-side check.
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

revoke all on function public.ban_user(uuid, text) from public;
revoke all on function public.unban_user(uuid) from public;
grant execute on function public.ban_user(uuid, text) to authenticated;
grant execute on function public.unban_user(uuid) to authenticated;

-- The automated report-threshold/LLM pipeline now actually bans instead
-- of just forcing a rename - was: username_reset_required = true only.
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
