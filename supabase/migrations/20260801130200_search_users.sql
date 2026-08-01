-- Powers the Search tab: profile fields plus the caller's relationship to
-- each result, in one round trip, so the UI can render "Add" / "Requested"
-- / "Friends" state and the close-friend ring without N+1 queries.
create or replace function public.search_users(p_query text)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  friendship_status text,
  is_close_friend boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    coalesce(
      case
        when f.status = 'accepted' then 'accepted'
        when f.status = 'pending' and f.requested_by = auth.uid() then 'pending_sent'
        when f.status = 'pending' and f.requested_by <> auth.uid() then 'pending_received'
      end,
      'none'
    ) as friendship_status,
    coalesce(
      f.status = 'accepted' and (
        (f.user_id_1 = auth.uid() and f.user_1_marked_close)
        or (f.user_id_2 = auth.uid() and f.user_2_marked_close)
      ),
      false
    ) as is_close_friend
  from public.profiles p
  left join public.friendships f
    on f.user_id_1 = least(p.id, auth.uid())
    and f.user_id_2 = greatest(p.id, auth.uid())
  where p.id <> auth.uid()
    and p_query is not null
    and length(trim(p_query)) > 0
    and (p.username ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%')
  order by p.username
  limit 25;
$$;

revoke all on function public.search_users(text) from public;
grant execute on function public.search_users(text) to authenticated;
