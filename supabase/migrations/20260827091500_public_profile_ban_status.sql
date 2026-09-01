-- Exposes is_banned on the public profile preview so the Ban/Unban button
-- on a profile page (moderator-only in the UI) knows which state to show.
-- Not sensitive the way last_lat/phone_hash are - roughly equivalent to
-- "this account no longer exists" messaging platforms already show
-- publicly, so safe to include even though this RPC is anon-callable.
-- Adding a column to an existing RETURNS TABLE shape isn't something
-- CREATE OR REPLACE allows - drop first (see the identical situation in
-- 20260821090000_more_rate_limits.sql's match_contacts rewrite).
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

-- DROP FUNCTION also drops its grants - re-adding what the original had
-- (anon-callable, for the signed-out share-link/QR preview).
revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- Guards against a moderator accidentally locking themselves out - the
-- original version had no such check.
create or replace function public.ban_user(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot ban yourself';
  end if;
  update public.profiles
  set is_banned = true, banned_at = now(), ban_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_user_id;
end;
$$;
