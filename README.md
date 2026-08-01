# Moves?

Privacy-first, ephemeral social app for spontaneous real-world hangouts ("Moves").

This repo currently contains the **Supabase backend** — schema, Row Level Security policies, and RPCs. The Expo Router app will be added in a follow-up once the backend is confirmed.

## Stack

- **Backend:** Supabase (PostgreSQL + PostGIS), Supabase Realtime, pg_cron
- **Frontend (planned):** Expo (React Native) + Expo Router, TypeScript, hand-rolled design tokens (no NativeWind)

## Getting started (backend)

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

To run everything locally instead:

```bash
supabase start
supabase db reset   # applies all migrations in supabase/migrations against the local db
```

> `pg_cron` requires superuser-level extension privileges. On hosted Supabase this works directly via migration; on some other Postgres providers you may need to enable the extension from a dashboard first before `supabase db push` succeeds.

## Schema overview

| Table | Purpose |
|---|---|
| `profiles` | One row per `auth.users` row. Auto-created on signup via `handle_new_user()` trigger. **No friend-count column exists anywhere** — friend counts are hidden by never being computed. |
| `friendships` | Undirected edges, always stored normalized as `user_id_1 < user_id_2` (enforced by a trigger). `status` is `pending` or `accepted`; `requested_by` tracks who sent the request. |
| `moves` | A hangout room. `location` is a PostGIS `geography(Point, 4326)` and is **never** selected directly by clients — see below. `degree_limit` (1/2/3) and `requires_approval` drive access control. Lifecycle: `active` → `cooldown` → hard-deleted. |
| `move_members` | Join state per user per move (`pending` / `approved` / `rejected`). The host is auto-inserted as `approved` when a move is created. |
| `move_messages` | Ephemeral chat, cascade-deleted the instant its parent `moves` row is purged. |

## Access control design

Everything funnels through a small set of `SECURITY DEFINER` helper functions (`supabase/migrations/20260801120600_helper_functions.sql`) so that the RLS policies on `moves` and `move_members` never have to query each other directly — that cross-reference is what normally causes recursive-policy bugs. The helpers run with elevated privilege internally but are narrowly scoped:

- `is_move_host`, `is_approved_member` — safe to call directly, used inside RLS policies.
- `are_friends`, `get_friend_ids`, `friendship_degree` — **internal only**, revoked from `authenticated`. They're only reachable from inside other `SECURITY DEFINER` functions, so a client can't use them to probe whether two arbitrary strangers are friends or enumerate someone's full friend list.

### Mutual-friends-only profiles

`get_mutual_friends(user_a, user_b)` returns only the intersection of both users' accepted friends, and raises unless the caller is one of the two parties. It's the only path to friend-adjacent data on someone else's profile — there is no "list all friends" endpoint.

### Degree-gated discovery + hidden exact location

`get_eligible_moves_for_user(user_id, lat, lng, radius_m)` is the **only** way clients discover moves they haven't joined yet:

- Eligibility = host, or `degree_limit = 3` (open), or `friendship_degree(caller, host) <= degree_limit`.
- Optional proximity filter via `ST_DWithin`.
- `lat`/`lng` in the result are `null` (with `location_visible = false`) unless the caller is the host or an `approved` member — the exact address only appears once you've joined or been approved, per spec. Direct `SELECT` on `moves.location` is restricted by RLS to hosts/approved members for the same reason.

### Ephemerality

`cleanup_expired_moves()` is scheduled via `pg_cron` every 5 minutes (not reachable from the client — no grants to `authenticated`):

1. `active` moves past `expires_at` flip to `cooldown` and start a 1-hour timer (a host ending a move early does the same via a normal `UPDATE`).
2. Once that hour elapses, the `moves` row is hard-deleted; `move_members` and `move_messages` cascade-delete with it.

### Realtime

`move_messages` and `move_members` are added to the `supabase_realtime` publication for live chat and live join-request queues. RLS still applies to realtime payloads — subscribers only ever receive rows their own `SELECT` policies allow.

## Next steps

Once this backend is confirmed, the next step is scaffolding the Expo Router app: `src/features/*` modules (each owning its own `api.ts` against these tables/RPCs), `src/theme/tokens.ts` design tokens, and the five core screens (Live Map & Feed, Create a Move wizard, Friends & Mutuals, Profile, Move Room).
