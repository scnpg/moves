-- In-app support requests (Settings -> Contact support). Insert-only via
-- submit_support_request() - no direct table grant, mirrors the
-- report_message() pattern. No admin UI yet; view submissions in the
-- Supabase Studio Table Editor for now.
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

comment on table public.support_requests is 'In-app support/feedback messages submitted from Settings. No moderator UI yet - review via Supabase Studio.';

create index support_requests_created_at_idx on public.support_requests (created_at);

alter table public.support_requests enable row level security;

create policy "Users can view their own support requests"
on public.support_requests for select
to authenticated
using (user_id = auth.uid());

grant select on public.support_requests to authenticated;
grant all on public.support_requests to service_role;

-- Same rate-limit pattern as moves/move_messages (20260818091500_rate_limits.sql).
create or replace function public.enforce_support_request_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  select count(*) into v_recent_count
  from public.support_requests
  where user_id = new.user_id
    and created_at > now() - interval '10 minutes';

  if v_recent_count >= 5 then
    raise exception 'Too many support requests submitted recently. Please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger support_requests_rate_limit
  before insert on public.support_requests
  for each row execute function public.enforce_support_request_rate_limit();

create or replace function public.submit_support_request(p_title text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  insert into public.support_requests (user_id, title, message)
  values (auth.uid(), trim(p_title), trim(p_message));
end;
$$;

revoke all on function public.submit_support_request(text, text) from public;
grant execute on function public.submit_support_request(text, text) to authenticated;
