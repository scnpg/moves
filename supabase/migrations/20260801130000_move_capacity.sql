-- Optional cap on concurrent approved members for a move.
alter table public.moves
  add column max_members integer check (max_members is null or max_members > 0);

comment on column public.moves.max_members is 'Null = uncapped. Enforced against approved move_members count by enforce_move_capacity().';

-- Runs on both the join-request insert path (open moves that auto-approve)
-- and the host-approval update path, so the cap can't be bypassed either
-- way. Only fires when the row is *becoming* approved.
create or replace function public.enforce_move_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_current_count integer;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  select max_members into v_max from public.moves where id = new.move_id;

  if v_max is null then
    return new;
  end if;

  select count(*) into v_current_count
  from public.move_members
  where move_id = new.move_id
    and status = 'approved'
    and id <> new.id;

  if v_current_count >= v_max then
    raise exception 'This move is full';
  end if;

  return new;
end;
$$;

-- Named to sort after before_move_member_insert so status has already been
-- resolved by handle_move_join_request() before we check capacity.
create trigger before_move_member_insert_capacity
  before insert on public.move_members
  for each row execute function public.enforce_move_capacity();

create trigger before_move_member_update_capacity
  before update on public.move_members
  for each row execute function public.enforce_move_capacity();
