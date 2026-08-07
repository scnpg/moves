-- Referral tracking: a signup link carries the referrer's own user id as
-- a plain query param (?ref=<uuid>), passed through as signup metadata -
-- no separate short-code table needed. handle_new_user() validates and
-- records it; a bad/stale/self-referential value is silently dropped
-- rather than failing the signup.
alter table public.profiles
  add column referred_by uuid references public.profiles (id) on delete set null;

comment on column public.profiles.referred_by is 'Who this user signed up via (their referral link) - null if none, invalid, or self-referential.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred_by uuid;
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

  insert into public.profiles (id, username, display_name, avatar_url, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username'),
    new.raw_user_meta_data ->> 'avatar_url',
    v_referred_by
  );
  return new;
end;
$$;

-- Self-only (uid must be the caller) - referral progress isn't shown for
-- other users anywhere in the app, so there's no legitimate reason to
-- expose one person's count to another.
create or replace function public.get_referral_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when uid = auth.uid() then (select count(*)::integer from public.profiles where referred_by = uid)
    else null
  end;
$$;

revoke all on function public.get_referral_count(uuid) from public;
grant execute on function public.get_referral_count(uuid) to authenticated;
