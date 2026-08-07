-- Adds a 4th visibility tier: degree_limit = 0 means "only people the host
-- explicitly invited" - not degree-of-separation based at all. Those people
-- are auto-approved members from the moment the host invites them (see
-- invite_friends_to_move below), which doubles as "pull them straight into
-- the group chat" - there's no separate invite/notification record, their
-- move_members row *is* the invite.
alter table public.moves
  drop constraint moves_degree_limit_check;

alter table public.moves
  add constraint moves_degree_limit_check check (degree_limit in (0, 1, 2, 3));

comment on column public.moves.degree_limit is '0 = invite-only (only explicitly invited people), 1 = friends only, 2 = friends-of-friends, 3 = open to anyone.';

-- handle_move_join_request predates invite-only moves and only knew how to
-- compare a numeric degree_limit (1/2/3) against friendship_degree(), which
-- made degree_limit = 0 *stricter* than "friends only" under that
-- comparison - even the host's own invite would be rejected. Invite-only
-- has no self-service join path at all: the only way into move_members is
-- the host calling invite_friends_to_move (or the auto-inserted host row
-- above), so this now just requires the inserting session to be the host.
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

  if v_move.degree_limit = 0 then
    if auth.uid() <> v_move.host_id then
      raise exception 'This move is invite-only';
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

-- Host-only: adds specific friends as already-approved members, i.e. invites
-- them straight into the move (and its chat) without a join request. Silently
-- skips any id that isn't actually an accepted friend, rather than failing
-- the whole batch - callers pass a picker selection, not user-typed ids.
create or replace function public.invite_friends_to_move(p_move_id uuid, p_friend_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_friend_id uuid;
begin
  if not public.is_move_host(p_move_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  foreach v_friend_id in array coalesce(p_friend_ids, array[]::uuid[])
  loop
    if public.are_friends(auth.uid(), v_friend_id) then
      insert into public.move_members (move_id, user_id, status, joined_at)
      values (p_move_id, v_friend_id, 'approved', now())
      on conflict (move_id, user_id)
        do update set status = 'approved', joined_at = now()
        where public.move_members.status <> 'approved';
    end if;
  end loop;
end;
$$;

revoke all on function public.invite_friends_to_move(uuid, uuid[]) from public;
grant execute on function public.invite_friends_to_move(uuid, uuid[]) to authenticated;

-- get_eligible_moves_for_user: invite-only moves are visible to the host and
-- to anyone who already has a move_members row (i.e. was invited) - never
-- discoverable by degree of separation like the other three tiers.
drop function if exists public.get_eligible_moves_for_user(uuid, double precision, double precision, integer);

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
      or coalesce(public.friendship_degree(p_user_id, m.host_id), 99) <= m.degree_limit
    )
    and (
      p_lat is null or p_lng is null or m.location is null
      or ST_DWithin(m.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_m)
    )
  order by m.starts_at asc;
end;
$$;

revoke all on function public.get_eligible_moves_for_user(uuid, double precision, double precision, integer) from public;
grant execute on function public.get_eligible_moves_for_user(uuid, double precision, double precision, integer) to authenticated;
