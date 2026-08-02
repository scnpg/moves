-- Privacy-preserving contacts matching: the client normalizes and SHA-256
-- hashes each device-contact phone number locally and sends only the
-- hashes here - raw phone numbers, the caller's own or anyone else's,
-- never reach the server. This only finds people who separately, and
-- voluntarily, set phone_hash on their own profile (Profile screen).
create or replace function public.match_contacts(p_phone_hashes text[])
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles p
  where p.phone_hash = any(p_phone_hashes)
    and p.id <> auth.uid()
    and not exists (
      select 1 from public.friendships f
      where (f.user_id_1 = auth.uid() and f.user_id_2 = p.id)
         or (f.user_id_2 = auth.uid() and f.user_id_1 = p.id)
    )
  limit 100;
$$;

revoke all on function public.match_contacts(text[]) from public;
grant execute on function public.match_contacts(text[]) to authenticated;
