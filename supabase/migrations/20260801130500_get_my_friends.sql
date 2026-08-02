-- Full friends list, but only ever for the caller themselves - unlike
-- get_friend_ids() (internal-only, takes an arbitrary user id) this takes
-- no argument, so it's safe to expose directly: there is no way to use it
-- to enumerate someone else's friends. "Profiles only show mutual
-- connections" governs what you see on OTHER people's profiles; you can
-- always see your own full list.
create or replace function public.get_my_friends()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_close_friend boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    case when f.user_id_1 = auth.uid() then f.user_1_marked_close else f.user_2_marked_close end as is_close_friend
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_id_1 = auth.uid() then f.user_id_2 else f.user_id_1 end
  where f.status = 'accepted'
    and auth.uid() in (f.user_id_1, f.user_id_2)
  order by coalesce(p.display_name, p.username);
$$;

revoke all on function public.get_my_friends() from public;
grant execute on function public.get_my_friends() to authenticated;
