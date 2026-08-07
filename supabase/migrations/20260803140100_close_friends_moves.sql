-- Adds degree_limit = 4: "Close Friends" - visible only to people the
-- HOST has personally tagged close (see set_close_friend()/
-- user_1_marked_close in the earlier close-friends migration), not a
-- degree-of-separation tier like 1/2/3 and not gated by a share link like
-- 0. No new junction table needed - the directional flags already on
-- friendships are exactly this data.
--
-- Note on RLS: direct SELECT on moves is already restricted to the host
-- and approved members regardless of degree_limit ("Hosts and approved
-- members can view moves" in the RLS migration) - that policy doesn't
-- need to change for this tier. The actual gate that needs to know about
-- close-friends-only is discovery (get_eligible_moves_for_user) and the
-- join trigger, both updated below.
alter table public.moves
  drop constraint moves_degree_limit_check;

alter table public.moves
  add constraint moves_degree_limit_check check (degree_limit in (0, 1, 2, 3, 4));

comment on column public.moves.degree_limit is '0 = private (link/QR only), 1 = friends only, 2 = friends-of-friends, 3 = open to anyone, 4 = close friends only (host-tagged).';

-- True if p_host has personally tagged p_viewer as a close friend -
-- deliberately the reverse direction of get_close_friend_ids() (which is
-- "who have I marked"), used only internally to gate close-friends-only
-- Moves, never exposed as a general "who marked me" query.
create or replace function public.is_close_friend_of(p_host uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(p_host, p_viewer) = f.user_id_1
      and greatest(p_host, p_viewer) = f.user_id_2
      and (
        (f.user_id_1 = p_host and f.user_1_marked_close)
        or (f.user_id_2 = p_host and f.user_2_marked_close)
      )
  );
$$;

revoke all on function public.is_close_friend_of(uuid, uuid) from public;

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
      or (m.degree_limit = 4 and public.is_close_friend_of(m.host_id, p_user_id))
      or (m.degree_limit not in (0, 4) and coalesce(public.friendship_degree(p_user_id, m.host_id), 99) <= m.degree_limit)
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
