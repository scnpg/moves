-- The "Profiles are viewable by authenticated users" policy (using(true))
-- is row-level only - it can't distinguish "my own row" from "anyone
-- else's row", so every column it exposes is readable by any signed-in
-- user for every profile, including via a raw PostgREST request that
-- bypasses the app UI entirely. That's fine for username/display_name/
-- avatar_url/bio, but last_lat/last_lng/last_location_at/phone_hash/
-- referred_by are not meant to be broadly readable - last_lat/last_lng
-- give a ~1.1km-precision home location for every user in the app,
-- phone_hash could be used to test/confirm a phone number against the
-- corpus, and referred_by exposes the referral graph.
--
-- Column-level REVOKE closes this regardless of what the client selects,
-- but since it isn't row-aware either, it also blocks reading these
-- columns for *your own* row via a plain table select - get_my_profile()
-- below restores that access through a SECURITY DEFINER function scoped
-- to auth.uid(), which the revoke doesn't apply to (it runs as the
-- function owner, not the calling role).
--
-- NOTE: this narrow column-level revoke turned out to be a no-op in
-- practice - 20260801130400_table_grants.sql already granted blanket
-- table-level SELECT on profiles to authenticated, and a broader
-- table-level grant supersedes a narrower column-level revoke. Left as
-- applied history; see 20260818093000_fix_profile_column_grants.sql for
-- the actual fix (revoke the table-level grant first, then re-grant only
-- the safe columns).
revoke select (last_lat, last_lng, last_location_at, phone_hash, referred_by)
  on public.profiles from authenticated, anon;

create or replace function public.get_my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;
