-- The only way profiles.last_lat/last_lng ever get written - rounds
-- server-side so a client can't opt itself (or anyone) into precise
-- location storage by just passing more decimal places.
create or replace function public.update_my_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  update public.profiles
  set
    last_lat = round(p_lat::numeric, 2)::double precision,
    last_lng = round(p_lng::numeric, 2)::double precision,
    last_location_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.update_my_location(double precision, double precision) from public;
grant execute on function public.update_my_location(double precision, double precision) to authenticated;
