-- Schedule the auto-deletion engine to run every 5 minutes. If this
-- extension can't be created in your environment (some hosted Postgres
-- providers require enabling it from a dashboard first), enable pg_cron
-- there and re-run this migration.
create extension if not exists pg_cron with schema extensions;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'cleanup-expired-moves',
  '*/5 * * * *',
  $$select public.cleanup_expired_moves();$$
);
