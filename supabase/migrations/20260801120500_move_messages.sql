-- move_messages: ephemeral chat for a move. Rows are hard-deleted via
-- ON DELETE CASCADE the moment the parent move row is purged by
-- cleanup_expired_moves(). No update/delete policies are defined - messages
-- are immutable for the lifetime of the room.
create table public.move_messages (
  id uuid primary key default gen_random_uuid(),
  move_id uuid not null references public.moves (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.move_messages is 'Ephemeral group chat for a move. Deleted automatically when the move is purged.';

create index move_messages_move_id_created_at_idx on public.move_messages (move_id, created_at);
