-- Public bucket for profile photos. Public bucket = files are servable via
-- the public URL endpoint without going through RLS at all (that's how
-- getPublicUrl() works with no SELECT policy needed); the policies below
-- govern who can write, using the "<uid>/avatar.jpg" path convention -
-- (storage.foldername(name))[1] is the first path segment, i.e. the uid.
-- storage.objects already ships with RLS enabled by the Storage extension
-- itself; only the policies below are ours to add.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can replace their own avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
