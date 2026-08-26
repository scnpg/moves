-- check-title (supabase/functions/check-title) calls the Anthropic API
-- directly and is invoked straight from the client with no app-level
-- limit of its own - Move creation is rate-limited (20260818091500), but
-- checkTitleForModeration() is a separate, decoupled call from createMove(),
-- so nothing stopped a client from calling it in a tight loop without ever
-- creating a Move, running up Anthropic spend for free. This table + RPC
-- let the edge function enforce a per-caller limit itself.
--
-- Deliberately just a counter, not a moderation decision - the client
-- already fails open on ANY error from this function (see
-- checkTitleForModeration() in src/features/moves/api.ts), so a rejection
-- here only stops the wasted Anthropic call; it never blocks Move
-- creation, which stays protected by its own separate rate limit.
create table public.title_check_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index title_check_events_user_id_created_at_idx on public.title_check_events (user_id, created_at);

alter table public.title_check_events enable row level security;
grant all on public.title_check_events to service_role;

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
grant execute on function public.check_title_rate_limit() to authenticated;
