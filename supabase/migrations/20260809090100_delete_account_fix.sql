-- Fixes delete_my_account(): storage.objects has a platform-level guard
-- ("Direct deletion from storage tables is not allowed. Use the Storage
-- API instead.") that rejects a plain SQL DELETE even from a security
-- definer function, because it only removes the DB row, not the
-- underlying object in the storage backend. Avatar cleanup now happens
-- client-side via supabase.storage.from('avatars').remove([...]) - which
-- goes through the real Storage API - immediately before this RPC is
-- called (see src/features/auth/api.ts).
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

  delete from auth.users where id = v_uid;
end;
$$;
