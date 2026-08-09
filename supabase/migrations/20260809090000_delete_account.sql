-- Self-service account deletion (App Store Guideline 5.1.1(v) / Play Store
-- account-deletion policy both require this if the app supports account
-- creation). Hard-deletes the auth.users row, which cascades through
-- public.profiles -> friendships/moves/move_members/move_messages/
-- user_settings (all already ON DELETE CASCADE) and auth's own
-- identities/sessions/refresh_tokens. Avatar files in storage have no FK
-- to profiles, so they're cleaned up explicitly first.
--
-- Note: if the caller hosts an active Move, that Move (and its other
-- members' membership/chat history in it) is deleted too - same cascade
-- behavior as the existing "host deletes their Move" feature, not new
-- exposure introduced by this function.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authorized';
  end if;

  delete from storage.objects
  where bucket_id = 'avatars' and (storage.foldername(name))[1] = v_uid::text;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
