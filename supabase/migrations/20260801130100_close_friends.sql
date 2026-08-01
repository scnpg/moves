-- Close friends is a personal, one-directional tag (like an address-book
-- star), not a mutual/symmetric state - marking someone close doesn't
-- notify them or change what they see. Stored as two directional flags on
-- the existing normalized friendship row rather than a separate table.
alter table public.friendships
  add column user_1_marked_close boolean not null default false,
  add column user_2_marked_close boolean not null default false;

comment on column public.friendships.user_1_marked_close is 'True if user_id_1 has tagged user_id_2 as a close friend.';
comment on column public.friendships.user_2_marked_close is 'True if user_id_2 has tagged user_id_1 as a close friend.';

-- Toggle whether the caller considers p_friend_id a close friend. Only
-- valid between accepted friends.
create or replace function public.set_close_friend(p_friend_id uuid, p_is_close boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_u1 uuid;
  v_u2 uuid;
begin
  if v_caller is null then
    raise exception 'not authorized';
  end if;

  if v_caller = p_friend_id then
    raise exception 'cannot mark yourself as a close friend';
  end if;

  v_u1 := least(v_caller, p_friend_id);
  v_u2 := greatest(v_caller, p_friend_id);

  update public.friendships
  set
    user_1_marked_close = case when v_caller = v_u1 then p_is_close else user_1_marked_close end,
    user_2_marked_close = case when v_caller = v_u2 then p_is_close else user_2_marked_close end
  where user_id_1 = v_u1
    and user_id_2 = v_u2
    and status = 'accepted';

  if not found then
    raise exception 'You are not friends with this user';
  end if;
end;
$$;

-- The set of friend ids the caller has personally marked close - never
-- reveals who has marked the caller close in return.
create or replace function public.get_close_friend_ids()
returns table (friend_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select case when f.user_id_1 = auth.uid() then f.user_id_2 else f.user_id_1 end as friend_id
  from public.friendships f
  where f.status = 'accepted'
    and (
      (f.user_id_1 = auth.uid() and f.user_1_marked_close)
      or (f.user_id_2 = auth.uid() and f.user_2_marked_close)
    );
$$;

revoke all on function public.set_close_friend(uuid, boolean) from public;
grant execute on function public.set_close_friend(uuid, boolean) to authenticated;

revoke all on function public.get_close_friend_ids() from public;
grant execute on function public.get_close_friend_ids() to authenticated;
