-- Columns backing the "recommended friends" feature. Both are opt-in and
-- deliberately imprecise:
--   * last_lat/last_lng are rounded to ~1.1km (2 decimal places) by
--     update_my_location() below - the client never gets to write exact
--     coordinates here, only through that RPC.
--   * phone_hash is a client-computed SHA-256 of a normalized phone number,
--     set by the user themselves (Profile screen) so their contacts can
--     find them. Raw phone numbers - the user's own or anyone in their
--     device contacts - are never sent to or stored on the server; only
--     hashes are ever transmitted (see match_contacts()).
alter table public.profiles
  add column last_lat double precision,
  add column last_lng double precision,
  add column last_location_at timestamptz,
  add column phone_hash text;

create index profiles_phone_hash_idx on public.profiles (phone_hash) where phone_hash is not null;

comment on column public.profiles.last_lat is 'Rounded to 2 decimal places (~1.1km) by update_my_location(). Never exact.';
comment on column public.profiles.phone_hash is 'SHA-256 of a normalized phone number, computed client-side. Powers contacts-based friend suggestions without the server ever seeing raw numbers.';
