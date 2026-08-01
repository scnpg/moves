-- friendships: undirected edge, always stored with user_id_1 < user_id_2 so
-- a pair can never be represented by two conflicting rows. requested_by
-- records who sent the request, independent of storage order.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id_1 uuid not null references public.profiles (id) on delete cascade,
  user_id_2 uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint friendships_no_self check (user_id_1 <> user_id_2),
  constraint friendships_ordered check (user_id_1 < user_id_2),
  constraint friendships_requester_is_participant check (requested_by in (user_id_1, user_id_2)),
  unique (user_id_1, user_id_2)
);

comment on table public.friendships is 'Undirected friend edges. Only status = accepted rows count as an active friendship.';

create index friendships_user_id_2_idx on public.friendships (user_id_2);

-- Normalize (user_id_1, user_id_2) ordering so callers never have to sort
-- the pair themselves. Runs before the friendships_ordered check.
create or replace function public.normalize_friendship_order()
returns trigger
language plpgsql
as $$
declare
  v_tmp uuid;
begin
  if new.user_id_1 > new.user_id_2 then
    v_tmp := new.user_id_1;
    new.user_id_1 := new.user_id_2;
    new.user_id_2 := v_tmp;
  end if;
  return new;
end;
$$;

create trigger friendships_normalize_order
  before insert or update on public.friendships
  for each row execute function public.normalize_friendship_order();
