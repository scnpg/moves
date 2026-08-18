-- DB-level rate limiting for the two write-heavy, spammable/DoS-able
-- paths that don't go through Supabase Auth's own limiter (that only
-- covers the /auth endpoints - see auth.rate_limit in config.toml):
-- Move (pin) creation and chat messages. No external infra (Redis,
-- Cloudflare) required - a BEFORE INSERT trigger checking a short
-- rolling window is enough at this app's scale, and keeps the limit
-- enforced server-side regardless of which client is used.

create index move_messages_sender_id_created_at_idx on public.move_messages (sender_id, created_at);

create or replace function public.enforce_move_creation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  select count(*) into v_recent_count
  from public.moves
  where host_id = new.host_id
    and created_at > now() - interval '10 minutes';

  if v_recent_count >= 5 then
    raise exception 'Too many Moves created recently. Please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger moves_rate_limit
  before insert on public.moves
  for each row execute function public.enforce_move_creation_rate_limit();

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
begin
  select count(*) into v_recent_count
  from public.move_messages
  where sender_id = new.sender_id
    and created_at > now() - interval '30 seconds';

  if v_recent_count >= 15 then
    raise exception 'You are sending messages too quickly. Please slow down.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger move_messages_rate_limit
  before insert on public.move_messages
  for each row execute function public.enforce_message_rate_limit();
