-- Returns ONLY the intersection of user_a's and user_b's accepted friends -
-- never either party's full friend list - which is what powers the
-- "3 Mutual Friends: Alex, Sam, Jordan" profile view. The caller must be
-- one of the two parties, so strangers can't probe arbitrary pairs.
create or replace function public.get_mutual_friends(user_a uuid, user_b uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() not in (user_a, user_b) then
    raise exception 'not authorized';
  end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url
  from public.get_friend_ids(user_a) fa
  join public.get_friend_ids(user_b) fb on fa.friend_id = fb.friend_id
  join public.profiles p on p.id = fa.friend_id;
end;
$$;

revoke all on function public.get_mutual_friends(uuid, uuid) from public;
grant execute on function public.get_mutual_friends(uuid, uuid) to authenticated;
