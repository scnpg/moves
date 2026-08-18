-- Tracks whether a user has clicked through the onboarding cards (see
-- OnboardingCarousel.tsx) - server-side rather than a local flag so it
-- doesn't reappear on a reinstall or a second device. Not sensitive, so
-- no column-grant change needed (get_my_profile()'s `select *` already
-- covers it for the owner; nobody else ever needs to read it).
alter table public.profiles
  add column onboarding_completed boolean not null default false;
