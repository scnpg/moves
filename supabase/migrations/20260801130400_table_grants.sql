-- GRANT is evaluated before RLS: without table-level privileges here,
-- every direct `.from(table)` call from the client 403s with "permission
-- denied for table X" regardless of how permissive the RLS policies are.
-- (RPC functions were already grant-scoped individually in their own
-- migrations - this covers the tables the client queries directly.)
grant usage on schema public to authenticated, service_role;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.moves to authenticated;
grant select, insert, update, delete on public.move_members to authenticated;
grant select, insert on public.move_messages to authenticated;

grant all on public.profiles, public.friendships, public.moves, public.move_members, public.move_messages
  to service_role;
