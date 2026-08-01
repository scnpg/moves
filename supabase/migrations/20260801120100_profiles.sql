-- profiles: one row per auth.users row. Deliberately has NO friend-count
-- column and no query in this schema ever aggregates friend counts -
-- "Friend Counts are HIDDEN" is enforced by simply never computing them.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

comment on table public.profiles is 'Public-facing user profile, one per auth.users row.';

-- Auto-provision a profile whenever a new auth user is created. Username /
-- display name can be supplied via signup metadata; otherwise a placeholder
-- is generated and the user can change it later (profiles update policy).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
