-- Backfills a migration that was applied directly to the remote database
-- (by a concurrent session) without ever being committed as a file here -
-- `supabase migration list` showed remote version 20260821100000 with no
-- local match. Reconstructed from the live schema (supabase db dump) to
-- close that drift, not authored fresh - table/function shape, including
-- the grant-to-anon on the function (harmless: it checks auth.uid() is
-- null itself), match what's actually deployed.
--
-- Rate-limits the check-title Edge Function, which burns a real Anthropic
-- API call per invocation and previously had no limit at all - see
-- supabase/functions/check-title/index.ts, which calls this via the
-- caller's own forwarded JWT (so auth.uid() below is the real caller, not
-- the Edge Function itself).
create table if not exists public.title_check_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index title_check_events_user_id_created_at_idx on public.title_check_events (user_id, created_at);

alter table public.title_check_events enable row level security;
-- No policies - only ever written by check_title_rate_limit() below
-- (SECURITY DEFINER, runs as the table owner, bypassing RLS).

create or replace function public.check_title_rate_limit()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select count(*) into v_recent_count
  from public.title_check_events
  where user_id = auth.uid()
    and created_at > now() - interval '10 minutes';

  if v_recent_count >= 10 then
    raise exception 'Too many title checks recently. Please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  insert into public.title_check_events (user_id) values (auth.uid());
end;
$$;

revoke all on function public.check_title_rate_limit() from public;
grant execute on function public.check_title_rate_limit() to anon, authenticated;
