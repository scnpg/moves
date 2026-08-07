-- Minimal public profile preview for shareable profile links/QR codes -
-- reachable while signed out (mirrors get_move_by_share_token() from
-- 20260803140000_private_link_only_moves.sql). Exposes the same
-- non-sensitive fields the "Profiles are viewable by authenticated users"
-- RLS policy already gives any signed-in user - never phone_hash,
-- last_lat/last_lng, or referred_by.
create or replace function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.bio
  from public.profiles p
  where p.id = p_user_id;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;
