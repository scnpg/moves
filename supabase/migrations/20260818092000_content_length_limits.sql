-- Unbounded text columns are a mild storage/rendering DoS vector (nothing
-- stopped a client from submitting a multi-megabyte title) and reasonable
-- input hygiene generally - profiles.bio and profiles.username already
-- have limits (see 20260803110000_profile_bio.sql and the username format
-- check below), these three didn't.
alter table public.moves
  add constraint moves_title_length check (char_length(title) between 1 and 100),
  add constraint moves_description_length check (description is null or char_length(description) <= 1000);

alter table public.profiles
  add constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 50);
