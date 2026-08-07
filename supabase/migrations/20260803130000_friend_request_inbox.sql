-- Adds a real 'declined' status to friendships (previously the only way to
-- reject a request was to delete the row outright, indistinguishable from
-- an unfriend). A declined row still occupies the (user_id_1, user_id_2)
-- unique constraint, so send_friend_request() below knows to revive it
-- back to 'pending' on a later re-request rather than hitting a duplicate
-- key error.
alter table public.friendships
  drop constraint friendships_status_check;

alter table public.friendships
  add constraint friendships_status_check check (status in ('pending', 'accepted', 'declined'));

comment on table public.friendships is 'Undirected friend edges. Only status = accepted rows count as an active friendship; declined rows are kept (not deleted) so a re-request revives rather than duplicates them.';

drop policy if exists "Recipients can accept friend requests" on public.friendships;
create policy "Recipients can respond to friend requests"
on public.friendships for update
to authenticated
using (auth.uid() in (user_id_1, user_id_2) and auth.uid() <> requested_by)
with check (status in ('accepted', 'declined'));

-- Handles both a fresh request and a re-request after a prior decline in
-- one call, so the client never has to know which case it's in. Silently
-- no-ops on an already-pending pair (double-click safety) and rejects
-- re-requesting an existing friendship.
create or replace function public.send_friend_request(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_user_1 uuid := least(v_me, p_other_user_id);
  v_user_2 uuid := greatest(v_me, p_other_user_id);
  v_existing public.friendships%rowtype;
begin
  if v_me = p_other_user_id then
    raise exception 'Cannot send a friend request to yourself';
  end if;

  select * into v_existing from public.friendships
    where user_id_1 = v_user_1 and user_id_2 = v_user_2;

  if v_existing.id is null then
    insert into public.friendships (user_id_1, user_id_2, requested_by, status)
    values (v_user_1, v_user_2, v_me, 'pending');
  elsif v_existing.status = 'declined' then
    update public.friendships
      set status = 'pending', requested_by = v_me, created_at = now()
      where id = v_existing.id;
  elsif v_existing.status = 'accepted' then
    raise exception 'Already friends';
  end if;
  -- status = 'pending' already: no-op, whichever direction it started in.
end;
$$;

revoke all on function public.send_friend_request(uuid) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;

-- Powers the friend request inbox: everyone's pending requests, both
-- directions, with the other person's profile info in one round trip.
create or replace function public.get_friend_requests()
returns table (
  id uuid,
  other_user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  direction text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id,
    case when f.user_id_1 = auth.uid() then f.user_id_2 else f.user_id_1 end as other_user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    case when f.requested_by = auth.uid() then 'outgoing' else 'incoming' end as direction,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = (case when f.user_id_1 = auth.uid() then f.user_id_2 else f.user_id_1 end)
  where f.status = 'pending'
    and auth.uid() in (f.user_id_1, f.user_id_2)
  order by f.created_at desc;
$$;

revoke all on function public.get_friend_requests() from public;
grant execute on function public.get_friend_requests() to authenticated;
