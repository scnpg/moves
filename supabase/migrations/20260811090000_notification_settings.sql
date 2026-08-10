-- Rounds out user_settings' notification preferences (was just
-- notify_friend_moves/notify_mutual_moves - friends and friends-of-friends
-- Moves, the two categories notify-new-move already computed recipients
-- for) with the remaining Move visibility tiers plus group chat. All
-- default true, matching the existing two columns' default - notifications
-- are opt-out, not opt-in.
alter table public.user_settings add column if not exists notify_close_friends_moves boolean not null default true;
alter table public.user_settings add column if not exists notify_public_moves boolean not null default true;
alter table public.user_settings add column if not exists notify_group_chat boolean not null default true;

comment on column public.user_settings.notify_close_friends_moves is 'New Close-Friends-only (degree_limit=4) Moves from people who''ve tagged this user close.';
comment on column public.user_settings.notify_public_moves is 'New Open (degree_limit=3) Moves - not yet consumed by notify-new-move, which only computes friend-graph recipients; needs a geo-broadcast path to actually use this.';
comment on column public.user_settings.notify_group_chat is 'New messages in a Move''s group chat this user is an approved member of - not yet consumed anywhere; no chat-message push path exists yet.';

drop function if exists public.save_user_settings(text, boolean, boolean);

create or replace function public.save_user_settings(
  p_push_token text default null,
  p_notify_friend_moves boolean default null,
  p_notify_mutual_moves boolean default null,
  p_notify_close_friends_moves boolean default null,
  p_notify_public_moves boolean default null,
  p_notify_group_chat boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  insert into public.user_settings (
    user_id, push_token, notify_friend_moves, notify_mutual_moves,
    notify_close_friends_moves, notify_public_moves, notify_group_chat
  )
  values (
    auth.uid(),
    p_push_token,
    coalesce(p_notify_friend_moves, true),
    coalesce(p_notify_mutual_moves, true),
    coalesce(p_notify_close_friends_moves, true),
    coalesce(p_notify_public_moves, true),
    coalesce(p_notify_group_chat, true)
  )
  on conflict (user_id) do update set
    push_token = coalesce(p_push_token, public.user_settings.push_token),
    notify_friend_moves = coalesce(p_notify_friend_moves, public.user_settings.notify_friend_moves),
    notify_mutual_moves = coalesce(p_notify_mutual_moves, public.user_settings.notify_mutual_moves),
    notify_close_friends_moves = coalesce(p_notify_close_friends_moves, public.user_settings.notify_close_friends_moves),
    notify_public_moves = coalesce(p_notify_public_moves, public.user_settings.notify_public_moves),
    notify_group_chat = coalesce(p_notify_group_chat, public.user_settings.notify_group_chat),
    updated_at = now();
end;
$$;

revoke all on function public.save_user_settings(text, boolean, boolean, boolean, boolean, boolean) from public;
grant execute on function public.save_user_settings(text, boolean, boolean, boolean, boolean, boolean) to authenticated;
