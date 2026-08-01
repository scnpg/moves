-- The sole discovery path for the Live Map & Feed tab. Combines:
--   * degree-of-separation eligibility (friendship_degree vs. degree_limit,
--     with degree_limit = 3 always open to any authenticated user)
--   * optional proximity filtering via PostGIS ST_DWithin
--   * location redaction: lat/lng are only populated for the host or an
--     approved member - everyone else sees location_visible = false and
--     null coordinates, satisfying "exact address hidden until joined".
--
-- p_user_id must equal the calling user - this RPC only ever answers
-- "what can I see", never "what can they see".
create or replace function public.get_eligible_moves_for_user(
  p_user_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default 5000
)
returns table (
  id uuid,
  host_id uuid,
  title text,
  description text,
  degree_limit smallint,
  requires_approval boolean,
  starts_at timestamptz,
  expires_at timestamptz,
  status text,
  distance_m double precision,
  location_visible boolean,
  lat double precision,
  lng double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'not authorized';
  end if;

  return query
  select
    m.id,
    m.host_id,
    m.title,
    m.description,
    m.degree_limit,
    m.requires_approval,
    m.starts_at,
    m.expires_at,
    m.status,
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
  left join public.move_members mm
    on mm.move_id = m.id and mm.user_id = p_user_id
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
