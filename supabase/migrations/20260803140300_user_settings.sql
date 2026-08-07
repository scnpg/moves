-- Push notification preferences + device token. No profiles.phone column
-- here: verified phone numbers still only ever get stored as a hash (see
-- profiles.phone_hash / src/lib/phone.ts) - the phone-auth flow reuses
-- that existing column via the same client-side hashPhone() + a normal
-- profile update, rather than a new trigger that would store the raw
-- number in the clear and break the app's one existing rule about phone
-- numbers.
create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  push_token text,
  notify_friend_moves boolean not null default true,
  notify_mutual_moves boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is 'Per-user notification preferences and push token. One row per user, created on first write.';

alter table public.user_settings enable row level security;

create policy "Users can view their own settings"
on public.user_settings for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert their own settings"
on public.user_settings for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own settings"
on public.user_settings for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Upsert helper so the client doesn't need to know whether a row exists
-- yet - settings are created lazily on first save, not at signup.
create or replace function public.save_user_settings(
  p_push_token text default null,
  p_notify_friend_moves boolean default null,
  p_notify_mutual_moves boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  insert into public.user_settings (user_id, push_token, notify_friend_moves, notify_mutual_moves)
  values (
    auth.uid(),
    p_push_token,
    coalesce(p_notify_friend_moves, true),
    coalesce(p_notify_mutual_moves, true)
  )
  on conflict (user_id) do update set
    push_token = coalesce(p_push_token, public.user_settings.push_token),
    notify_friend_moves = coalesce(p_notify_friend_moves, public.user_settings.notify_friend_moves),
    notify_mutual_moves = coalesce(p_notify_mutual_moves, public.user_settings.notify_mutual_moves),
    updated_at = now();
end;
$$;

revoke all on function public.save_user_settings(text, boolean, boolean) from public;
grant execute on function public.save_user_settings(text, boolean, boolean) to authenticated;

-- RLS alone isn't enough (see table_grants.sql) - the client reads its
-- own settings via a direct select, not just the RPC above.
grant select, insert, update on public.user_settings to authenticated;
grant all on public.user_settings to service_role;
