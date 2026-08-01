alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.moves enable row level security;
alter table public.move_members enable row level security;
alter table public.move_messages enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
-- Basic identity fields are not sensitive on their own (no friend counts
-- or contact info live here), so any authenticated user can look up any
-- profile. Mutual-friends-only visibility is enforced at the friendships
-- level and via get_mutual_friends(), not here.
create policy "Profiles are viewable by authenticated users"
on public.profiles for select
to authenticated
using (true);

create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------
create policy "Users can view their own friendships"
on public.friendships for select
to authenticated
using (auth.uid() in (user_id_1, user_id_2));

create policy "Users can send friend requests"
on public.friendships for insert
to authenticated
with check (
  auth.uid() in (user_id_1, user_id_2)
  and requested_by = auth.uid()
  and status = 'pending'
);

create policy "Recipients can accept friend requests"
on public.friendships for update
to authenticated
using (auth.uid() in (user_id_1, user_id_2) and auth.uid() <> requested_by)
with check (status = 'accepted');

create policy "Participants can remove a friendship"
on public.friendships for delete
to authenticated
using (auth.uid() in (user_id_1, user_id_2));

-- ---------------------------------------------------------------------
-- moves
-- ---------------------------------------------------------------------
-- Deliberately narrow: direct table SELECT is only for the host and
-- approved members (which is also what makes `location` safe to select
-- directly here - non-members never reach this policy). Discovery/feed
-- browsing for eligible-but-not-yet-joined users goes exclusively through
-- get_eligible_moves_for_user(), which redacts location.
create policy "Hosts and approved members can view moves"
on public.moves for select
to authenticated
using (
  host_id = auth.uid()
  or public.is_approved_member(id, auth.uid())
);

create policy "Hosts can create moves"
on public.moves for insert
to authenticated
with check (host_id = auth.uid());

create policy "Hosts can update their moves"
on public.moves for update
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

create policy "Hosts can delete their moves"
on public.moves for delete
to authenticated
using (host_id = auth.uid());

-- ---------------------------------------------------------------------
-- move_members
-- ---------------------------------------------------------------------
create policy "Members can view their own membership and fellow members"
on public.move_members for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_move_host(move_id, auth.uid())
  or public.is_approved_member(move_id, auth.uid())
);

create policy "Users can request to join moves for themselves"
on public.move_members for insert
to authenticated
with check (user_id = auth.uid());

create policy "Hosts can manage membership status"
on public.move_members for update
to authenticated
using (public.is_move_host(move_id, auth.uid()))
with check (public.is_move_host(move_id, auth.uid()));

create policy "Hosts can remove members and members can leave"
on public.move_members for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_move_host(move_id, auth.uid())
);

-- ---------------------------------------------------------------------
-- move_messages
-- ---------------------------------------------------------------------
create policy "Approved members and host can read messages"
on public.move_messages for select
to authenticated
using (
  public.is_approved_member(move_id, auth.uid())
  or public.is_move_host(move_id, auth.uid())
);

create policy "Approved members and host can send messages"
on public.move_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (public.is_approved_member(move_id, auth.uid()) or public.is_move_host(move_id, auth.uid()))
  and exists (select 1 from public.moves m where m.id = move_id and m.status = 'active')
);

-- No update/delete policies on move_messages: chat history is immutable
-- for the lifetime of the room and is purged wholesale by cascade delete
-- when the parent move is removed.
