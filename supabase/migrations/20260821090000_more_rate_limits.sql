-- Extends the rate-limit coverage from 20260818091500_rate_limits.sql
-- (Moves, chat messages) and 20260820110000_support_requests.sql (support
-- requests) to the remaining write paths that are realistic spam/
-- harassment/enumeration vectors: friend requests, reports, move join
-- requests, and contact-hash matching. Read-only discovery RPCs
-- (get_nearby_user_suggestions, search_users, etc.) are left alone - no
-- state change, so no meaningful DoS/harassment vector, and Supabase's
-- own connection/statement limits already bound raw query volume.

-- Friend requests (send_friend_request -> friendships insert). Spamming
-- this is a direct harassment vector - lots of unwanted friend requests
-- landing in someone's inbox. Higher threshold than Move creation since
-- legitimate bursts (importing several contacts at once) are more common.
create or replace function public.enforce_friend_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
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

create trigger friendships_rate_limit
  before insert on public.friendships
  for each row execute function public.enforce_friend_request_rate_limit();

-- Reports (report_user / report_message -> same reports table). Spamming
-- reports is a moderation-queue-flooding and false-accusation vector.
create or replace function public.enforce_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  select count(*) into v_recent_count
  from public.reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '10 minutes';

  if v_recent_count >= 10 then
    raise exception 'Too many reports submitted recently. Please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger reports_rate_limit
  before insert on public.reports
  for each row execute function public.enforce_report_rate_limit();

-- Move join requests (requestToJoin / join_move_via_token /
-- join_move_via_invite_link, and invite_friends_to_move's host-side
-- adds - all insert into move_members). Keyed on the member being added,
-- which covers the far more common self-request-spam case (a bot
-- requesting to join many Moves rapidly) directly.
create or replace function public.enforce_move_join_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
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

create trigger move_members_rate_limit
  before insert on public.move_members
  for each row execute function public.enforce_move_join_rate_limit();

-- match_contacts takes a client-supplied array of phone hashes with no
-- prior size or frequency limit - unbounded, it's a phone-number
-- enumeration vector (repeatedly submit hash guesses to see who's
-- registered). Caps the array size per call and tracks call frequency in
-- a small companion table (the function has to become a write, hence the
-- switch from `language sql stable` to `language plpgsql`).
create table public.contact_sync_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index contact_sync_events_user_id_created_at_idx on public.contact_sync_events (user_id, created_at);

alter table public.contact_sync_events enable row level security;
grant all on public.contact_sync_events to service_role;

-- Postgres won't let CREATE OR REPLACE change a function's row-type
-- representation (even between two RETURNS TABLE defs with identical
-- columns) when the language changes from sql to plpgsql - drop first.
drop function if exists public.match_contacts(text[]);

create function public.match_contacts(p_phone_hashes text[])
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if coalesce(array_length(p_phone_hashes, 1), 0) > 500 then
    raise exception 'Too many contacts submitted at once.';
  end if;

  select count(*) into v_recent_count
  from public.contact_sync_events
  where user_id = auth.uid()
    and created_at > now() - interval '10 minutes';

  if v_recent_count >= 5 then
    raise exception 'Too many contact syncs recently. Please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  insert into public.contact_sync_events (user_id) values (auth.uid());

  return query
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles p
  where p.phone_hash = any(p_phone_hashes)
    and p.id <> auth.uid()
    and not exists (
      select 1 from public.friendships f
      where (f.user_id_1 = auth.uid() and f.user_id_2 = p.id)
         or (f.user_id_2 = auth.uid() and f.user_id_1 = p.id)
    )
    and not public.is_blocked_pair(auth.uid(), p.id)
  limit 100;
end;
$$;

revoke all on function public.match_contacts(text[]) from public;
grant execute on function public.match_contacts(text[]) to authenticated;
