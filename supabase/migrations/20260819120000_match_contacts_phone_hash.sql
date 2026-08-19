-- Extends match_contacts() to also return each match's phone_hash, so the
-- client can tell which device-contact hashes matched an existing account -
-- the remainder are contacts with no Moves account yet, surfaced with an
-- "invite" action that texts them a referral signup link. No new points
-- ledger needed for that: referralSignUpUrl()'s ?ref=<uuid> already flows
-- into handle_new_user()'s referred_by column, and get_referral_count()
-- already counts only completed signups (not clicks), which is exactly
-- "one point once they download and create an account".
drop function if exists public.match_contacts(text[]);

create function public.match_contacts(p_phone_hashes text[])
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  phone_hash text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.phone_hash
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
