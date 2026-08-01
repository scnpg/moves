-- Auto-approve the host as a member of their own move the instant it's
-- created, so hosts show up in member lists / chat without a separate
-- membership round-trip.
create or replace function public.handle_new_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.move_members (move_id, user_id, status, joined_at)
  values (new.id, new.host_id, 'approved', now());
  return new;
end;
$$;

create trigger on_move_created
  after insert on public.moves
  for each row execute function public.handle_new_move();

-- Gatekeeper for every join request. Runs BEFORE the row is written, so its
-- changes to NEW are what the move_members insert RLS policy's WITH CHECK
-- ultimately validates.
--   * Rejects joins to a move that no longer exists or isn't active.
--   * Enforces the move's degree_limit against the caller's relationship
--     to the host (skipped for the host's own row and for degree_limit = 3
--     "open" moves).
--   * Resolves the initial status: 'approved' immediately for open-join
--     moves, 'pending' when the host requires approval.
create or replace function public.handle_move_join_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_move public.moves%rowtype;
  v_degree smallint;
begin
  select * into v_move from public.moves where id = new.move_id;

  if v_move.id is null then
    raise exception 'Move not found';
  end if;

  if v_move.status <> 'active' then
    raise exception 'This move is no longer accepting members';
  end if;

  if new.user_id <> v_move.host_id and v_move.degree_limit <> 3 then
    v_degree := public.friendship_degree(new.user_id, v_move.host_id);
    if v_degree is null or v_degree > v_move.degree_limit then
      raise exception 'Not eligible to join this move';
    end if;
  end if;

  if new.status is null or new.status = 'pending' then
    new.status := case when v_move.requires_approval then 'pending' else 'approved' end;
  end if;

  if new.status = 'approved' and new.joined_at is null then
    new.joined_at := now();
  end if;

  return new;
end;
$$;

create trigger before_move_member_insert
  before insert on public.move_members
  for each row execute function public.handle_move_join_request();
