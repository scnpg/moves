-- "People you may know" via shared friends. Only reachable for the caller
-- themselves (no target-user argument), and only ever surfaces people at
-- exactly degree 2 who aren't already friended/pending - never a raw
-- friend list, consistent with the rest of the friendship-privacy design.
create or replace function public.get_friend_of_friend_suggestions(p_limit integer default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  mutual_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with my_friends as (
    select friend_id from public.get_friend_ids(auth.uid())
  ),
  candidates as (
    select fb.friend_id as candidate_id, count(*) as mutual_count
    from my_friends mf
    join public.get_friend_ids(mf.friend_id) fb on true
    group by fb.friend_id
  )
  select p.id, p.username, p.display_name, p.avatar_url, c.mutual_count::integer
  from candidates c
  join public.profiles p on p.id = c.candidate_id
  where c.candidate_id <> auth.uid()
    and not exists (
      select 1 from public.friendships f
      where (f.user_id_1 = auth.uid() and f.user_id_2 = c.candidate_id)
         or (f.user_id_2 = auth.uid() and f.user_id_1 = c.candidate_id)
    )
  order by c.mutual_count desc, p.username
  limit p_limit;
$$;

revoke all on function public.get_friend_of_friend_suggestions(integer) from public;
grant execute on function public.get_friend_of_friend_suggestions(integer) to authenticated;
