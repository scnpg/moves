-- Lets the client resolve "username" -> email before calling
-- signInWithPassword() (which only accepts email or phone) - phone auth has
-- been removed, so this is now the sign-in screen's only alternative to
-- typing the email directly.
--
-- Privacy note: this necessarily reveals whether a username exists and, if
-- so, its associated email, to anyone who calls it - there's no way to
-- resolve username -> email for a pre-auth sign-in flow without that
-- exposure somewhere. The client (src/features/auth/api.ts) treats "no
-- such username" identically to "wrong password" so the UI itself doesn't
-- distinguish them, but the raw RPC response is not further protected
-- beyond that. Deemed acceptable for this app's threat model (a casual
-- social app, not handling financial/health data); revisit if that changes.
create or replace function public.get_email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = lower(p_username)
  limit 1;
$$;

revoke all on function public.get_email_for_username(text) from public;
grant execute on function public.get_email_for_username(text) to anon, authenticated;
