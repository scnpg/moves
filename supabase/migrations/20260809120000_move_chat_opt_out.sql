-- Host opt-out for a Move's group chat, set once at creation time (Create
-- Move -> More options -> Group chat). Defaults to true so every
-- already-created Move keeps working exactly as before.
alter table public.moves add column if not exists chat_enabled boolean not null default true;

comment on column public.moves.chat_enabled is 'Host opt-out for this Move''s group chat, set at creation time. When false, message inserts are rejected server-side (see the move_messages insert policy).';

-- was: supabase/migrations/20260801120800_rls_policies.sql. Adds one more
-- condition alongside the existing active-status check: no messages once
-- the host has opted the Move out of chat. Defense in depth - the client
-- also just doesn't render a composer when chat_enabled is false, but nothing
-- stops a modified client from calling the insert directly.
drop policy if exists "Approved members and host can send messages" on public.move_messages;

create policy "Approved members and host can send messages"
on public.move_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (public.is_approved_member(move_id, auth.uid()) or public.is_move_host(move_id, auth.uid()))
  and exists (select 1 from public.moves m where m.id = move_id and m.status = 'active' and m.chat_enabled)
);
