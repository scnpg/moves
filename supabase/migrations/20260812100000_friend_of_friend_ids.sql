-- Full set of friend-of-friend ids (degree exactly 2) for the caller, each
-- with how many mutual friends connect the caller to them. Unlike
-- get_friend_of_friend_suggestions (capped, ordered, joined to profiles for
-- a "people you may know" UI), this returns every id with no limit and no
-- profile data - it's meant for membership checks (e.g. "is this Move's
-- host, or one of its members, a friend-of-friend of mine") rather than
-- rendering a list of strangers, so it's safe to expose without the
-- suggestion RPC's ordering/limit/profile-join overhead.
create or replace function public.get_my_friend_of_friend_ids()
returns table (
  friend_of_friend_id uuid,
  mutual_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with my_friends as (
    select friend_id from public.get_friend_ids(auth.uid())
  )
  select fb.friend_id as friend_of_friend_id, count(*)::integer as mutual_count
  from my_friends mf
  join public.get_friend_ids(mf.friend_id) fb on true
  where fb.friend_id <> auth.uid()
    and fb.friend_id not in (select friend_id from my_friends)
  group by fb.friend_id;
$$;

revoke all on function public.get_my_friend_of_friend_ids() from public;
grant execute on function public.get_my_friend_of_friend_ids() to authenticated;
