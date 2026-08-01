-- moves: a temporary hangout + its access rules. `location` is only ever
-- returned to clients through get_eligible_moves_for_user(), which redacts
-- it for users who are not the host or an approved member - "exact address
-- hidden until a user joins/is approved".
--
-- Lifecycle: active -> cooldown (natural expiry OR host ends early) -> hard
-- deleted by cleanup_expired_moves() one hour after cooldown_started_at.
-- 'expired' is used interchangeably with 'cooldown' as the pre-delete state
-- (see cleanup_expired_moves for the exact semantics).
create table public.moves (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  location geography(point, 4326),
  degree_limit smallint not null default 3 check (degree_limit in (1, 2, 3)),
  requires_approval boolean not null default false,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'cooldown', 'expired')),
  cooldown_started_at timestamptz,
  created_at timestamptz not null default now(),
  constraint moves_valid_window check (expires_at > starts_at)
);

comment on table public.moves is 'Ephemeral hangout rooms. Rows are hard-deleted by cleanup_expired_moves() once their cooldown window elapses.';
comment on column public.moves.degree_limit is '1 = friends only, 2 = friends-of-friends, 3 = open to anyone.';
comment on column public.moves.location is 'Exact coordinates - never selected directly by clients, only surfaced (redacted or not) via get_eligible_moves_for_user().';

create index moves_host_id_idx on public.moves (host_id);
create index moves_status_idx on public.moves (status);
create index moves_expires_at_idx on public.moves (expires_at);
create index moves_location_gix on public.moves using gist (location);
