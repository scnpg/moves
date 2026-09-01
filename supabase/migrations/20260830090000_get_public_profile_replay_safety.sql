-- get_public_profile() in 20260827090000_ban_users.sql adds is_banned to its
-- RETURNS TABLE via `create or replace function`, which only works against
-- the already-migrated live database (where the shape was already 6
-- columns). Replayed from scratch (supabase db reset, a fresh environment,
-- disaster recovery), that statement fails: Postgres won't let create or
-- replace change a function's RETURNS TABLE shape, only DROP FUNCTION
-- first does. This re-does the same change as an explicit drop + create so
-- the migration history is replay-safe, and re-adds the anon/authenticated
-- grants a DROP wipes (this function backs the signed-out profile preview
-- at /users/:id).
drop function if exists public.get_public_profile(uuid);

create function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  is_banned boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.bio, p.is_banned
  from public.profiles p
  where p.id = p_user_id;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;
