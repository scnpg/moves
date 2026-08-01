-- Enable Supabase Realtime change streams for the active-chat and
-- join-request-queue experiences. RLS still applies to realtime payloads,
-- so subscribers only receive rows their existing SELECT policies allow.
alter publication supabase_realtime add table public.move_messages;
alter publication supabase_realtime add table public.move_members;
