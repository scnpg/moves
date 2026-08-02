-- People near the caller's own last-reported (rounded) location. Returns
-- nothing until the caller has an approximate location on file - opt-in via
-- update_my_location(), called from the client whenever it already has a
-- location fix for the Public-moves map (no separate permission prompt).
-- Location freshness is capped at 14 days so stale rows don't linger
-- forever as "nearby".
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
    and ST_DWithin(
      ST_SetSRID(ST_MakePoint(p.last_lng, p.last_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography,
      p_radius_m
    )
  order by distance_m asc
  limit p_limit;
end;
$$;

revoke all on function public.get_nearby_user_suggestions(integer, integer) from public;
grant execute on function public.get_nearby_user_suggestions(integer, integer) to authenticated;
