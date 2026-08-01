-- move_members: join state for a move. The host's own row is inserted
-- automatically (see handle_new_move trigger). Regular join requests go
-- through handle_move_join_request, which enforces degree eligibility and
-- resolves the initial status against moves.requires_approval.
create table public.move_members (
  id uuid primary key default gen_random_uuid(),
  move_id uuid not null references public.moves (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (move_id, user_id)
);

comment on table public.move_members is 'Membership / join-request state for a move. status = approved is required to read or send chat messages.';

create index move_members_user_id_idx on public.move_members (user_id);
create index move_members_move_id_status_idx on public.move_members (move_id, status);
