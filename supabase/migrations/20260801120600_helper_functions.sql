-- SECURITY DEFINER helper functions used by RLS policies, triggers, and
-- RPCs. Being SECURITY DEFINER (owned by the migration role, which has
-- BYPASSRLS on Supabase) lets them read across friendships / moves /
-- move_members without tripping those tables' own RLS policies, which is
-- what avoids the recursive-policy trap of moves <-> move_members checking
-- each other directly.
--
-- Grants are deliberately narrow: are_friends / get_friend_ids /
-- friendship_degree are internal-only (revoked from authenticated) because
-- calling them directly would let any user probe arbitrary pairs' friend
-- status or enumerate someone else's full friend list. is_move_host and
-- is_approved_member are safe to expose because they only ever answer
-- "does THIS caller hold THIS role", which is what RLS policies need.

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(a, b) = f.user_id_1
      and greatest(a, b) = f.user_id_2
  );
$$;

create or replace function public.get_friend_ids(p_user_id uuid)
returns table (friend_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select case when f.user_id_1 = p_user_id then f.user_id_2 else f.user_id_1 end as friend_id
  from public.friendships f
  where f.status = 'accepted'
    and p_user_id in (f.user_id_1, f.user_id_2);
$$;

-- 0 = self, 1 = direct friend, 2 = friend-of-friend, null = beyond 2nd degree.
create or replace function public.friendship_degree(p_a uuid, p_b uuid)
returns smallint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_a = p_b then
    return 0;
  end if;

  if public.are_friends(p_a, p_b) then
    return 1;
  end if;

  if exists (
    select 1
    from public.get_friend_ids(p_a) af
    join public.get_friend_ids(p_b) bf on af.friend_id = bf.friend_id
  ) then
    return 2;
  end if;

  return null;
end;
$$;

create or replace function public.is_move_host(p_move_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.moves m
    where m.id = p_move_id and m.host_id = p_user_id
  );
$$;

create or replace function public.is_approved_member(p_move_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.move_members mm
    where mm.move_id = p_move_id
      and mm.user_id = p_user_id
      and mm.status = 'approved'
  );
$$;

revoke all on function public.are_friends(uuid, uuid) from public;
revoke all on function public.get_friend_ids(uuid) from public;
revoke all on function public.friendship_degree(uuid, uuid) from public;

revoke all on function public.is_move_host(uuid, uuid) from public;
grant execute on function public.is_move_host(uuid, uuid) to authenticated;

revoke all on function public.is_approved_member(uuid, uuid) from public;
grant execute on function public.is_approved_member(uuid, uuid) to authenticated;
