alter table public.profiles
  add column bio text;

alter table public.profiles
  add constraint profiles_bio_length check (char_length(bio) <= 280);
