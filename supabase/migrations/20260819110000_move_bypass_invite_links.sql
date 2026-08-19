-- Host-issued bypass links: unlike share_token (a fixed property of
-- Private/degree_limit=0 Moves - see 20260803140000_private_link_only_moves.sql),
-- these work on a Move at ANY degree_limit tier and let a host hand a
-- specific person a way in even though they don't meet that tier's usual
-- friends/friends-of-friends/close-friends criteria. Deliberately narrower
-- than the tier bypass itself: blocking (is_blocked_pair) and the per-move
-- exclusion list (is_excluded_from_move) still apply - see the updated
-- handle_move_join_request() below - since those are separate host safety
-- decisions a generic invite link shouldn't silently override.
--
-- max_uses null = reusable by anyone who has the link ("anyone with the
-- link"); max_uses = 1 = single-use ("one person, one time").
create table public.move_invite_links (
  id uuid primary key default gen_random_uuid(),
  move_id uuid not null references public.moves(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.move_invite_links is 'Host-issued exceptions to a Move''s degree/closeness eligibility check, scoped to whoever holds the link (or, for max_uses=1, the first person to use it). Not a property of the Move itself like share_token.';

alter table public.move_invite_links enable row level security;

-- Same host-scoped shape as move_excluded_users' policies: the host manages
-- their own Move's links directly via RLS, no RPC needed for CRUD. The
-- cross-user paths (previewing/joining via a link) go through the
-- SECURITY DEFINER functions below instead, same split as
-- is_excluded_from_move() vs. move_excluded_users' policies.
create policy "Hosts can view their move's invite links"
on public.move_invite_links for select
to authenticated
using (
  exists (select 1 from public.moves m where m.id = move_id and m.host_id = auth.uid())
);

create policy "Hosts can create invite links for their move"
on public.move_invite_links for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (select 1 from public.moves m where m.id = move_id and m.host_id = auth.uid())
);

create policy "Hosts can revoke their move's invite links"
on public.move_invite_links for update
to authenticated
using (
  exists (select 1 from public.moves m where m.id = move_id and m.host_id = auth.uid())
)
with check (
  exists (select 1 from public.moves m where m.id = move_id and m.host_id = auth.uid())
);

-- Public preview for the /invite/:token page, reachable while signed out
-- (mirrors get_move_by_share_token) - but unlike that function, this isn't
-- restricted to degree_limit = 0, since a bypass link is a host exception
-- layered on top of whatever tier the Move actually is. link_valid lets the
-- screen tell "revoked/already used" apart from "never existed".
create or replace function public.get_move_by_invite_link(p_token uuid)
returns table (
  id uuid,
  title text,
  description text,
  host_username text,
  host_display_name text,
  host_avatar_url text,
  starts_at timestamptz,
  expires_at timestamptz,
  status text,
  degree_limit smallint,
  max_members integer,
  approved_count integer,
  is_full boolean,
  already_member boolean,
  link_valid boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    m.id,
    m.title,
    m.description,
    hp.username,
    hp.display_name,
    hp.avatar_url,
    m.starts_at,
    m.expires_at,
    m.status,
    m.degree_limit,
    m.max_members,
    mc.approved_count::integer,
    (m.max_members is not null and mc.approved_count >= m.max_members) as is_full,
    exists (
      select 1 from public.move_members mm
      where mm.move_id = m.id and mm.user_id = auth.uid()
    ) as already_member,
    (l.revoked_at is null and (l.max_uses is null or l.use_count < l.max_uses)) as link_valid
  from public.move_invite_links l
  join public.moves m on m.id = l.move_id
  join public.profiles hp on hp.id = m.host_id
  left join lateral (
    select count(*) as approved_count
    from public.move_members mm2
    where mm2.move_id = m.id and mm2.status = 'approved'
  ) mc on true
  where l.token = p_token;
end;
$$;

revoke all on function public.get_move_by_invite_link(uuid) from public;
grant execute on function public.get_move_by_invite_link(uuid) to anon, authenticated;

-- Self-service join via a host-issued bypass link. Row-locks the link row
-- so two people tapping a single-use link at the same instant can't both
-- succeed. Auto-approves the same way join_move_via_token() does for
-- Private-tier links - handing someone a personal invite link already IS
-- the host's approval, so there's no separate pending-request step even if
-- the Move otherwise requires approval.
create or replace function public.join_move_via_invite_link(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.move_invite_links%rowtype;
  v_move public.moves%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select * into v_link from public.move_invite_links where token = p_token for update;

  if v_link.id is null then
    raise exception 'Invite link not found';
  end if;

  if v_link.revoked_at is not null then
    raise exception 'This invite link is no longer active';
  end if;

  if v_link.max_uses is not null and v_link.use_count >= v_link.max_uses then
    raise exception 'This invite link has already been used';
  end if;

  select * into v_move from public.moves where id = v_link.move_id;

  if v_move.id is null then
    raise exception 'Move not found';
  end if;

  if v_move.status <> 'active' then
    raise exception 'This move is no longer accepting members';
  end if;

  if exists (select 1 from public.move_members where move_id = v_move.id and user_id = auth.uid()) then
    return;
  end if;

  perform set_config('app.move_join_via_invite_link', 'true', true);

  insert into public.move_members (move_id, user_id, status, joined_at)
  values (v_move.id, auth.uid(), 'approved', now());

  update public.move_invite_links set use_count = use_count + 1 where id = v_link.id;
end;
$$;

revoke all on function public.join_move_via_invite_link(uuid) from public;
grant execute on function public.join_move_via_invite_link(uuid) to authenticated;

-- was: supabase/migrations/20260809110000_move_excluded_users.sql. Adds one
-- more bypass path alongside the existing degree_limit=0 token check: a
-- valid app.move_join_via_invite_link flag (set only from inside
-- join_move_via_invite_link() above) skips the degree/closeness check
-- entirely, for a Move at any tier. It's inserted ahead of that check, not
-- instead of the blocking/exclusion checks above it - those still apply.
create or replace function public.handle_move_join_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_move public.moves%rowtype;
  v_degree smallint;
begin
  select * into v_move from public.moves where id = new.move_id;

  if v_move.id is null then
    raise exception 'Move not found';
  end if;

  if v_move.status <> 'active' then
    raise exception 'This move is no longer accepting members';
  end if;

  if public.is_blocked_pair(v_move.host_id, new.user_id) then
    raise exception 'Not eligible to join this move';
  end if;

  if new.user_id <> v_move.host_id and public.is_excluded_from_move(new.move_id, new.user_id) then
    raise exception 'Not eligible to join this move';
  end if;

  if coalesce(current_setting('app.move_join_via_invite_link', true), 'false') = 'true' then
    null;
  elsif v_move.degree_limit = 0 then
    if auth.uid() <> v_move.host_id
      and coalesce(current_setting('app.move_join_via_token', true), 'false') <> 'true' then
      raise exception 'This move is private';
    end if;
  elsif v_move.degree_limit = 4 then
    if new.user_id <> v_move.host_id and not public.is_close_friend_of(v_move.host_id, new.user_id) then
      raise exception 'Not eligible to join this move';
    end if;
  elsif new.user_id <> v_move.host_id and v_move.degree_limit <> 3 then
    v_degree := public.friendship_degree(new.user_id, v_move.host_id);
    if v_degree is null or v_degree > v_move.degree_limit then
      raise exception 'Not eligible to join this move';
    end if;
  end if;

  if new.status is null or new.status = 'pending' then
    new.status := case when v_move.requires_approval then 'pending' else 'approved' end;
  end if;

  if new.status = 'approved' and new.joined_at is null then
    new.joined_at := now();
  end if;

  return new;
end;
$$;
