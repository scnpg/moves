-- Repurposes degree_limit = 0 from "invite-only" (host picks specific
-- friends before creating) to "Private (Link-Only)" - visible to nobody
-- except the host and whoever joins via a unique share link or its QR
-- code. The existing invisibility-to-everyone-else behavior (RLS direct
-- select + get_eligible_moves_for_user()'s degree=0 branch) is exactly
-- what "private" needs already; this migration only adds the join-by-
-- token path. invite_friends_to_move() from the earlier migration still
-- works unchanged (a host can still proactively add specific friends),
-- it's just no longer the only way in.
-- Idempotent add: written defensively in case only part of this migration
-- previously landed (e.g. an interrupted push).
alter table public.moves add column if not exists share_token uuid default gen_random_uuid();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'moves_share_token_key') then
    alter table public.moves add constraint moves_share_token_key unique (share_token);
  end if;
end $$;

update public.moves set share_token = gen_random_uuid() where share_token is null;

alter table public.moves alter column share_token set not null;

comment on column public.moves.share_token is 'Unguessable id for the share link/QR - the only way into a Private (Link-Only) move besides being the host or an already-invited member.';

-- handle_move_join_request predates the token-join path: for degree_limit
-- = 0 it only ever allowed the HOST's own session to insert a member row
-- (i.e. only invite_friends_to_move()). join_move_via_token() below needs
-- to let the joining user insert *their own* row instead. It marks the
-- insert as pre-authorized via a transaction-local setting rather than
-- loosening the trigger for every caller - set_config() here is only ever
-- reachable from inside this SECURITY DEFINER function, never directly by
-- a client, since PostgREST only exposes whitelisted functions/tables.
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

  if v_move.degree_limit = 0 then
    if auth.uid() <> v_move.host_id
      and coalesce(current_setting('app.move_join_via_token', true), 'false') <> 'true' then
      raise exception 'This move is private';
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

-- Public preview for the /join/:share_token page, reachable while signed
-- out (grantee includes anon below) - deliberately narrow, only the
-- fields the join screen needs, never the exact location.
create or replace function public.get_move_by_share_token(p_share_token uuid)
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
  max_members integer,
  approved_count integer,
  is_full boolean,
  already_member boolean
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
    m.max_members,
    mc.approved_count::integer,
    (m.max_members is not null and mc.approved_count >= m.max_members) as is_full,
    exists (
      select 1 from public.move_members mm
      where mm.move_id = m.id and mm.user_id = auth.uid()
    ) as already_member
  from public.moves m
  join public.profiles hp on hp.id = m.host_id
  left join lateral (
    select count(*) as approved_count
    from public.move_members mm2
    where mm2.move_id = m.id and mm2.status = 'approved'
  ) mc on true
  where m.share_token = p_share_token
    and m.degree_limit = 0;
end;
$$;

revoke all on function public.get_move_by_share_token(uuid) from public;
grant execute on function public.get_move_by_share_token(uuid) to anon, authenticated;

-- Self-service join for a Private (Link-Only) move - the counterpart to
-- invite_friends_to_move() for people who arrive via the link rather than
-- a direct host invite.
create or replace function public.join_move_via_token(p_share_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_move public.moves%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select * into v_move from public.moves
    where share_token = p_share_token and degree_limit = 0;

  if v_move.id is null then
    raise exception 'Move not found';
  end if;

  if v_move.status <> 'active' then
    raise exception 'This move is no longer accepting members';
  end if;

  if exists (select 1 from public.move_members where move_id = v_move.id and user_id = auth.uid()) then
    return;
  end if;

  perform set_config('app.move_join_via_token', 'true', true);

  insert into public.move_members (move_id, user_id, status, joined_at)
  values (v_move.id, auth.uid(), 'approved', now());
end;
$$;

revoke all on function public.join_move_via_token(uuid) from public;
grant execute on function public.join_move_via_token(uuid) to authenticated;
