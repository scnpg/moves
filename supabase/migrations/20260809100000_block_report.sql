-- Block + report: App Store Guideline 1.2 (Safety) / Play Store's UGC
-- safety policy both require apps with user-generated content and chat to
-- offer in-app blocking of abusive users and a way to report objectionable
-- content. Neither existed before this migration.
--
-- Scope decision: blocking is enforced going forward (new discovery, new
-- friend requests, new move joins) but is NOT retroactive - it doesn't
-- kick a blocked pair out of a Move they're already both in together,
-- same as unfriending doesn't. Retroactively tearing down shared
-- membership/chat state on block would be a much bigger change for a
-- marginal safety gain (the ability to block/report at all, not "instant
-- reciprocal removal from every shared context," is what the guideline
-- actually requires) - revisit if real abuse reports show this is
-- insufficient.
create table public.blocked_users (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_no_self check (blocker_id <> blocked_id)
);

comment on table public.blocked_users is 'Directional block edges. blocker_id no longer wants to discover, be discovered by, or be contacted by blocked_id.';

alter table public.blocked_users enable row level security;

create policy "Users can view who they've blocked"
on public.blocked_users for select
to authenticated
using (blocker_id = auth.uid());

-- Insert/delete deliberately NOT granted directly - only block_user() /
-- unblock_user() below can write, so blocking always also runs its
-- unfriend side effect atomically rather than a client being able to
-- insert a block row on its own.
grant select on public.blocked_users to authenticated;
grant all on public.blocked_users to service_role;

-- Reports are write-only from the client's perspective - reviewed out of
-- band (Supabase dashboard / service_role), never read back through the
-- API. content is a category, not free-text moderation state.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  move_id uuid references public.moves (id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate_content', 'fake_profile', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  constraint reports_no_self check (reporter_id <> reported_user_id)
);

comment on table public.reports is 'User-submitted safety reports (App Store Guideline 1.2). Insert-only from the client; reviewed out of band.';

alter table public.reports enable row level security;

create policy "Users can file reports"
on public.reports for insert
to authenticated
with check (reporter_id = auth.uid());

grant insert on public.reports to authenticated;
grant all on public.reports to service_role;

-- Internal-only, like are_friends()/friendship_degree() above - revoked
-- from authenticated so a client can't use it to probe arbitrary pairs.
create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function public.is_blocked_pair(uuid, uuid) from public;

create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not authorized';
  end if;
  if v_me = p_user_id then
    raise exception 'cannot block yourself';
  end if;

  insert into public.blocked_users (blocker_id, blocked_id)
  values (v_me, p_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.friendships
  where least(v_me, p_user_id) = user_id_1
    and greatest(v_me, p_user_id) = user_id_2;
end;
$$;

revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.blocked_users
  where blocker_id = auth.uid() and blocked_id = p_user_id;
$$;

revoke all on function public.unblock_user(uuid) from public;
grant execute on function public.unblock_user(uuid) to authenticated;

create or replace function public.get_blocked_users()
returns table (id uuid, username text, display_name text, avatar_url text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, b.created_at as blocked_at
  from public.blocked_users b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke all on function public.get_blocked_users() from public;
grant execute on function public.get_blocked_users() to authenticated;

create or replace function public.report_user(
  p_reported_user_id uuid,
  p_reason text,
  p_details text default null,
  p_move_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  if auth.uid() = p_reported_user_id then
    raise exception 'cannot report yourself';
  end if;

  insert into public.reports (reporter_id, reported_user_id, reason, details, move_id)
  values (auth.uid(), p_reported_user_id, p_reason, nullif(trim(coalesce(p_details, '')), ''), p_move_id);
end;
$$;

revoke all on function public.report_user(uuid, text, text, uuid) from public;
grant execute on function public.report_user(uuid, text, text, uuid) to authenticated;

-- --- Enforce blocking across existing discovery/contact surfaces ---
-- Each function below is otherwise byte-for-byte identical to its prior
-- definition (see the migrations named in each comment) - only the
-- is_blocked_pair() predicate is new.

-- was: supabase/migrations/20260801130200_search_users.sql
create or replace function public.search_users(p_query text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  friendship_status text,
  is_close_friend boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    coalesce(
      case
        when f.status = 'accepted' then 'accepted'
        when f.status = 'pending' and f.requested_by = auth.uid() then 'pending_sent'
        when f.status = 'pending' and f.requested_by <> auth.uid() then 'pending_received'
      end,
      'none'
    ) as friendship_status,
    coalesce(
      f.status = 'accepted' and (
        (f.user_id_1 = auth.uid() and f.user_1_marked_close)
        or (f.user_id_2 = auth.uid() and f.user_2_marked_close)
      ),
      false
    ) as is_close_friend
  from public.profiles p
  left join public.friendships f
    on f.user_id_1 = least(p.id, auth.uid())
    and f.user_id_2 = greatest(p.id, auth.uid())
  where p.id <> auth.uid()
    and p_query is not null
    and length(trim(p_query)) > 0
    and (p.username ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%')
    and not public.is_blocked_pair(auth.uid(), p.id)
  order by p.username
  limit 25;
$$;

-- was: supabase/migrations/20260803100300_nearby_user_suggestions.sql
create or replace function public.get_nearby_user_suggestions(p_radius_m integer default 5000, p_limit integer default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  distance_m double precision
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_lat double precision;
  v_lng double precision;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select p.last_lat, p.last_lng into v_lat, v_lng from public.profiles p where p.id = auth.uid();

  if v_lat is null or v_lng is null then
    return;
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(p.last_lng, p.last_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography
    ) as distance_m
  from public.profiles p
  where p.id <> auth.uid()
    and p.last_lat is not null
    and p.last_lng is not null
    and p.last_location_at > now() - interval '14 days'
    and not exists (
      select 1 from public.friendships f
      where (f.user_id_1 = auth.uid() and f.user_id_2 = p.id)
         or (f.user_id_2 = auth.uid() and f.user_id_1 = p.id)
    )
    and not public.is_blocked_pair(auth.uid(), p.id)
    and ST_DWithin(
      ST_SetSRID(ST_MakePoint(p.last_lng, p.last_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography,
      p_radius_m
    )
  order by distance_m asc
  limit p_limit;
end;
$$;

-- was: supabase/migrations/20260803100200_friend_of_friend_suggestions.sql
create or replace function public.get_friend_of_friend_suggestions(p_limit integer default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  mutual_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with my_friends as (
    select friend_id from public.get_friend_ids(auth.uid())
  ),
  candidates as (
    select fb.friend_id as candidate_id, count(*) as mutual_count
    from my_friends mf
    join public.get_friend_ids(mf.friend_id) fb on true
    group by fb.friend_id
  )
  select p.id, p.username, p.display_name, p.avatar_url, c.mutual_count::integer
  from candidates c
  join public.profiles p on p.id = c.candidate_id
  where c.candidate_id <> auth.uid()
    and not exists (
      select 1 from public.friendships f
      where (f.user_id_1 = auth.uid() and f.user_id_2 = c.candidate_id)
         or (f.user_id_2 = auth.uid() and f.user_id_1 = c.candidate_id)
    )
    and not public.is_blocked_pair(auth.uid(), c.candidate_id)
  order by c.mutual_count desc, p.username
  limit p_limit;
$$;

-- was: supabase/migrations/20260803100400_match_contacts.sql
create or replace function public.match_contacts(p_phone_hashes text[])
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
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
$$;

-- was: supabase/migrations/20260803140100_close_friends_moves.sql (latest
-- prior definition). Adds one exclusion: a blocked pair's Moves drop out
-- of discovery, unless the caller is already a member of that specific
-- Move (block doesn't retroactively evict existing shared membership).
create or replace function public.get_eligible_moves_for_user(
  p_user_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default 5000
)
returns table (
  id uuid,
  host_id uuid,
  host_username text,
  host_display_name text,
  host_avatar_url text,
  title text,
  description text,
  degree_limit smallint,
  requires_approval boolean,
  starts_at timestamptz,
  expires_at timestamptz,
  status text,
  max_members integer,
  approved_count integer,
  is_full boolean,
  distance_m double precision,
  location_visible boolean,
  lat double precision,
  lng double precision,
  fuzzy_lat double precision,
  fuzzy_lng double precision
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'not authorized';
  end if;

  return query
  select
    m.id,
    m.host_id,
    hp.username as host_username,
    hp.display_name as host_display_name,
    hp.avatar_url as host_avatar_url,
    m.title,
    m.description,
    m.degree_limit,
    m.requires_approval,
    m.starts_at,
    m.expires_at,
    m.status,
    m.max_members,
    mc.approved_count::integer,
    (m.max_members is not null and mc.approved_count >= m.max_members) as is_full,
    case
      when p_lat is not null and p_lng is not null and m.location is not null
        then ST_Distance(m.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
      else null
    end as distance_m,
    (mm.status = 'approved' or m.host_id = p_user_id) as location_visible,
    case
      when (mm.status = 'approved' or m.host_id = p_user_id) and m.location is not null
        then ST_Y(m.location::geometry)
      else null
    end as lat,
    case
      when (mm.status = 'approved' or m.host_id = p_user_id) and m.location is not null
        then ST_X(m.location::geometry)
      else null
    end as lng,
    case
      when m.location is not null then round(ST_Y(m.location::geometry)::numeric, 2)::double precision
      else null
    end as fuzzy_lat,
    case
      when m.location is not null then round(ST_X(m.location::geometry)::numeric, 2)::double precision
      else null
    end as fuzzy_lng
  from public.moves m
  join public.profiles hp on hp.id = m.host_id
  left join public.move_members mm
    on mm.move_id = m.id and mm.user_id = p_user_id
  left join lateral (
    select count(*) as approved_count
    from public.move_members mm2
    where mm2.move_id = m.id and mm2.status = 'approved'
  ) mc on true
  where m.status = 'active'
    and (
      m.host_id = p_user_id
      or m.degree_limit = 3
      or (m.degree_limit = 0 and mm.user_id is not null)
      or (m.degree_limit = 4 and public.is_close_friend_of(m.host_id, p_user_id))
      or (m.degree_limit not in (0, 4) and coalesce(public.friendship_degree(p_user_id, m.host_id), 99) <= m.degree_limit)
    )
    and (mm.user_id is not null or m.host_id = p_user_id or not public.is_blocked_pair(p_user_id, m.host_id))
    and (
      p_lat is null or p_lng is null or m.location is null
      or ST_DWithin(m.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_m)
    )
  order by m.starts_at asc;
end;
$$;

-- was: supabase/migrations/20260803140100_close_friends_moves.sql. Adds
-- one guard at the top: a blocked pair can't join each other's Moves
-- through ANY path (self-service join, host invite, or share-link join),
-- regardless of degree_limit tier.
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

  if v_move.degree_limit = 0 then
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

  if new.status is null or new.status = 'pending' then
    new.status := case when v_move.requires_approval then 'pending' else 'approved' end;
  end if;

  if new.status = 'approved' and new.joined_at is null then
    new.joined_at := now();
  end if;

  return new;
end;
$$;

-- was: supabase/migrations/20260803130000_friend_request_inbox.sql
create or replace function public.send_friend_request(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_user_1 uuid := least(v_me, p_other_user_id);
  v_user_2 uuid := greatest(v_me, p_other_user_id);
  v_existing public.friendships%rowtype;
begin
  if v_me = p_other_user_id then
    raise exception 'Cannot send a friend request to yourself';
  end if;

  if public.is_blocked_pair(v_me, p_other_user_id) then
    raise exception 'Cannot send a friend request to this user';
  end if;

  select * into v_existing from public.friendships
    where user_id_1 = v_user_1 and user_id_2 = v_user_2;

  if v_existing.id is null then
    insert into public.friendships (user_id_1, user_id_2, requested_by, status)
    values (v_user_1, v_user_2, v_me, 'pending');
  elsif v_existing.status = 'declined' then
    update public.friendships
      set status = 'pending', requested_by = v_me, created_at = now()
      where id = v_existing.id;
  elsif v_existing.status = 'accepted' then
    raise exception 'Already friends';
  end if;
end;
$$;
