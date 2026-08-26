-- Phone number becomes required for new accounts created through the
-- email/password sign-up form (src/app/(auth)/sign-up.tsx now collects
-- and hashes it client-side before it ever leaves the device - see
-- hashPhone() in src/lib/phone.ts - then passes it through signUp() as
-- phone_hash metadata, same privacy model profiles.phone_hash already
-- had). This enforces that requirement server-side too, not just on the
-- form, the same way every other "the client already validates this" gap
-- closed elsewhere in this app also got a matching DB-level check.
--
-- Scoped to raw_app_meta_data ->> 'provider' = 'email' specifically
-- (GoTrue sets this itself based on the actual signup method - not
-- something a client can spoof via the signUp() data option, unlike
-- raw_user_meta_data) rather than checking for phone_hash being present
-- unconditionally: a future OAuth-based signup (e.g. Sign in with Apple)
-- has no metadata field to carry it at all, since those providers don't
-- go through this app's own form - those accounts fall back to
-- src/app/complete-profile.tsx's existing "finish setting up your
-- account" gate instead, which now also collects phone when missing.
--
-- No NOT NULL constraint on profiles.phone_hash itself - existing
-- accounts from before this change never had one, and a hard column
-- constraint would break every one of them on the next unrelated update.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_by uuid;
  v_phone_hash text;
begin
  begin
    v_referred_by := (new.raw_user_meta_data ->> 'referred_by')::uuid;
  exception when others then
    v_referred_by := null;
  end;

  if v_referred_by = new.id then
    v_referred_by := null;
  end if;

  if v_referred_by is not null and not exists (select 1 from public.profiles where id = v_referred_by) then
    v_referred_by := null;
  end if;

  v_phone_hash := new.raw_user_meta_data ->> 'phone_hash';

  if new.raw_app_meta_data ->> 'provider' = 'email' and coalesce(v_phone_hash, '') = '' then
    raise exception 'A phone number is required to create an account.';
  end if;

  insert into public.profiles (id, username, display_name, avatar_url, referred_by, phone_hash)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username'),
    new.raw_user_meta_data ->> 'avatar_url',
    v_referred_by,
    v_phone_hash
  );
  return new;
end;
$$;
