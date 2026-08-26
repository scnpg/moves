-- Swaps which Move tier the invite-milestone gate applies to: Private
-- (Link-Only) is now free for anyone, and Public - the tier anyone nearby
-- can actually discover, so the one worth raising the bar on - now
-- requires 3 completed referrals (people who signed up via the host's
-- invite link, not just clicked it). See src/lib/referrals.ts for the
-- client-side mirror of this threshold (UX only - greys out the option -
-- this trigger is the actual enforcement, the same way handle_move_join_
-- request() is the real gate behind the client's disabled join button).
--
-- Fires on update of degree_limit too, not just insert - "Hosts can update
-- their moves" (20260801120800_rls_policies.sql) has no column
-- restriction, so a host could otherwise flip an existing Move to Public
-- after creation and skip the gate entirely.
create or replace function public.enforce_public_move_referral_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral_count integer;
begin
  if new.degree_limit = 3 then
    select count(*) into v_referral_count
    from public.profiles
    where referred_by = new.host_id;

    if v_referral_count < 3 then
      raise exception 'Invite 3 friends who sign up before creating a Public Move.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger moves_public_referral_gate
  before insert or update of degree_limit on public.moves
  for each row execute function public.enforce_public_move_referral_gate();
