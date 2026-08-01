-- Superseded by a new return shape (adds max_members / approved_count / is_full
-- for the Moves card UI, plus host display info so cards don't need a
-- second round trip). CREATE OR REPLACE can't change a function's output
-- columns, so this migration drops and recreates it.
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
  lng double precision
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
    end as lng
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
