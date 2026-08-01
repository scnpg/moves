-- Two-phase auto-deletion engine:
--   1. Any 'active' move past expires_at flips to 'cooldown' and starts its
--      1-hour grace timer. A host ending a move early (UPDATE moves SET
--      status = 'expired', cooldown_started_at = now() ..., allowed by the
--      "Hosts can update their moves" policy) gets the same grace window.
--   2. Any 'cooldown' or 'expired' move whose timer has elapsed is hard
--      deleted. move_members and move_messages both reference moves with
--      ON DELETE CASCADE, so this single delete purges the whole room.
--
-- Not exposed to clients: no grants below, only pg_cron (running as the
-- postgres role) invokes this.
create or replace function public.cleanup_expired_moves()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.moves
  set status = 'cooldown', cooldown_started_at = now()
  where status = 'active' and expires_at <= now();

  delete from public.moves
  where status in ('cooldown', 'expired')
    and cooldown_started_at is not null
    and cooldown_started_at <= now() - interval '1 hour';
end;
$$;

revoke all on function public.cleanup_expired_moves() from public;
