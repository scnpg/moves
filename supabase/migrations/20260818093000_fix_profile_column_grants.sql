-- 20260818090000_lock_down_profile_columns.sql's column-level revoke was
-- a no-op: 20260801130400_table_grants.sql already granted blanket
-- table-level `select` on profiles to authenticated (needed so plain
-- `.from('profiles')` calls don't 403 before RLS even runs), and a
-- broader table-level grant supersedes a narrower column-level revoke.
-- The blanket grant has to come off first, then be replaced with an
-- explicit safe-column list.
--
-- anon never had table-level select here (only authenticated did -
-- unauthenticated reads go through get_public_profile()/
-- get_move_by_share_token() instead), so this only narrows authenticated,
-- it doesn't introduce new anon access.
revoke select on public.profiles from authenticated;
grant select (id, username, display_name, avatar_url, bio, created_at, is_moderator, username_reset_required)
  on public.profiles to authenticated;
