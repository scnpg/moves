-- Closes three privilege-escalation gaps found in a security audit, plus
-- rate-limits the one anon-callable RPC that had none.

-- ---------------------------------------------------------------------
-- 1. profiles: blanket `insert, update` (20260801130400_table_grants.sql)
-- was never narrowed - only SELECT was. The RLS policies only check row
-- ownership (id = auth.uid()), not which columns are being written, so any
-- signed-in user could directly PostgREST-update their own row's
-- is_moderator, username_reset_required, last_lat/last_lng, phone_hash, or
-- referred_by - self-granting moderator status, forging their stored
-- location, or rewriting their referral attribution. The app itself only
-- ever writes username/display_name/avatar_url/phone_hash/bio (via
-- updateProfile()) and onboarding_completed (via completeOnboarding()) -
-- see src/features/profile/api.ts. Nothing in the app inserts a profiles
-- row directly either (handle_new_user() does that), so insert is dropped
-- entirely.
revoke insert, update on public.profiles from authenticated;
grant update (username, display_name, avatar_url, phone_hash, bio, onboarding_completed)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 2. move_members: handle_move_join_request() only overwrote `new.status`
-- when the client-supplied value was null or 'pending' - a client that
-- inserted with status: 'approved' directly sailed through untouched,
-- self-approving into a move with requires_approval = true. Status (and
-- the joined_at that follows from it) now always gets computed
-- server-side, ignoring whatever the client/caller supplied - the host
-- special-case (previously implicit, since handle_new_move() inserts the
-- host row with status: 'approved' and that value was never challenged)
-- is now explicit instead of relying on the same bypass this closes.
create or replace function public.handle_move_join_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_move public.moves%rowtype;
  v_degree smallint;
begin
  select * into v_move from public.moves where id = new.move_id;

  if v_move.id is null then
    raise exception 'Move not found';
  end if;

  if v_move.status <> 'active' then
    raise exception 'This move is no longer accepting members';
  end if;

  if public.is_blocked_pair(v_move.host_id, new.user_id) then
    raise exception 'Not eligible to join this move';
  end if;

  if new.user_id <> v_move.host_id and public.is_excluded_from_move(new.move_id, new.user_id) then
    raise exception 'Not eligible to join this move';
  end if;

  if coalesce(current_setting('app.move_join_via_invite_link', true), 'false') = 'true' then
    null;
  elsif v_move.degree_limit = 0 then
    if auth.uid() <> v_move.host_id
      and coalesce(current_setting('app.move_join_via_token', true), 'false') <> 'true' then
      raise exception 'This move is private';
    end if;
  elsif v_move.degree_limit = 4 then
    if new.user_id <> v_move.host_id and not public.is_close_friend_of(v_move.host_id, new.user_id) then
      raise exception 'Not eligible to join this move';
    end if;
  elsif new.user_id <> v_move.host_id and v_move.degree_limit <> 3 then
    v_degree := public.friendship_degree(new.user_id, v_move.host_id);
    if v_degree is null or v_degree > v_move.degree_limit then
      raise exception 'Not eligible to join this move';
    end if;
  end if;

  if new.user_id = v_move.host_id then
    new.status := 'approved';
  elsif v_move.requires_approval then
    new.status := 'pending';
  else
    new.status := 'approved';
  end if;

  new.joined_at := case when new.status = 'approved' then now() else null end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. friendships: blanket `insert, update` was likewise never narrowed.
-- The close-friend flags are meant to be strictly self-scoped - the RPC
-- set_close_friend() only ever writes the caller's own directional column
-- (user_1_marked_close if they're user_id_1, user_2_marked_close if
-- they're user_id_2) - but a direct PostgREST update could set *either*
-- column regardless of which side the caller is on. Since
-- is_close_friend_of() checks the *host's* column, this let a user forge
-- the host's own close-friend flag for themselves and gain unearned access
-- to that host's Close-Friends-only Moves. The app only ever updates
-- `status` directly (accept/decline - see src/features/friends/api.ts);
-- everything else already goes through send_friend_request()/
-- set_close_friend(). No direct insert either - send_friend_request()
-- handles that.
revoke insert, update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;

-- ---------------------------------------------------------------------
-- 4. get_email_for_username: anon-callable (required, pre-auth sign-in
-- flow) with no rate limit at all - a username/account-existence
-- enumeration primitive callable as fast as the caller likes. Can't key a
-- limit on auth.uid() (there isn't one pre-auth), so this tracks by the
-- caller's IP instead, via PostgREST's request.headers GUC (Supabase sets
-- this on every request; no project config needed). Threshold is
-- generous - normal sign-in traffic, including a shared/NAT IP with
-- several people signing in around the same time, should never come close
-- - this only needs to turn an enumeration sweep into a slow trickle, per
-- the function's existing "casual social app" threat model.
create table public.username_lookup_events (
  id bigint generated always as identity primary key,
  client_ip text not null,
  created_at timestamptz not null default now()
);

create index username_lookup_events_ip_created_at_idx on public.username_lookup_events (client_ip, created_at);

alter table public.username_lookup_events enable row level security;
-- No policies - only ever written by get_email_for_username() below
-- (SECURITY DEFINER, runs as the function owner, bypassing RLS).

create or replace function public.get_email_for_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown');
  v_recent_count integer;
  v_email text;
begin
  select count(*) into v_recent_count
  from public.username_lookup_events
  where client_ip = v_ip
    and created_at > now() - interval '10 minutes';

  if v_recent_count >= 20 then
    raise exception 'Too many attempts. Please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  insert into public.username_lookup_events (client_ip) values (v_ip);

  select u.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = lower(p_username)
  limit 1;

  return v_email;
end;
$$;

revoke all on function public.get_email_for_username(text) from public;
grant execute on function public.get_email_for_username(text) to anon, authenticated;

-- Note: check-title's own missing rate limit (also found by this audit)
-- turned out to already be fixed on the live database by a concurrent
-- session - see 20260821100000_check_title_rate_limit.sql, backfilled
-- from the live schema rather than duplicated here.
