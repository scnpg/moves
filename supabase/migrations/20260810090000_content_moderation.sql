-- Content moderation pipeline: report thresholds -> LLM triage -> admin
-- review -> automatic removal. Builds on the existing reports/report_user()
-- from 20260809100000_block_report.sql rather than replacing it - a report
-- filed from a Move screen (move_id set, message_id null) counts toward
-- that Move's tally; one filed from a profile page (both null) counts
-- toward that profile's tally; the new report_message() below (message_id
-- set) counts toward that message's tally. Three different "target kinds"
-- read off the same table by which column is set, no new report_move()
-- RPC needed.
alter table public.reports add column if not exists message_id uuid references public.move_messages (id) on delete cascade;

alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('spam', 'harassment', 'inappropriate_content', 'fake_profile', 'threat', 'other'));

alter table public.profiles add column if not exists is_moderator boolean not null default false;
alter table public.profiles add column if not exists username_reset_required boolean not null default false;

comment on column public.profiles.username_reset_required is 'Set true when a moderator confirms a reported username itself is the violation - the existing complete-profile redirect (see _layout.tsx / lib/username.ts) reuses its "pick a username" flow to make the user change it, same UI as a placeholder username.';

-- Clears the flag the moment the user actually picks a new one - a DB
-- trigger rather than client-side bookkeeping so it can't be missed by
-- whichever code path updates the username (currently just
-- complete-profile.tsx's updateProfile() call, but this way nothing else
-- has to remember to clear it either).
create or replace function public.clear_username_reset_flag()
returns trigger
language plpgsql
as $$
begin
  if new.username is distinct from old.username then
    new.username_reset_required := false;
  end if;
  return new;
end;
$$;

create trigger on_profile_username_changed
  before update on public.profiles
  for each row execute function public.clear_username_reset_flag();

create or replace function public.report_message(
  p_message_id uuid,
  p_reason text,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid;
  v_move uuid;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select sender_id, move_id into v_sender, v_move from public.move_messages where id = p_message_id;
  if v_sender is null then
    raise exception 'message not found';
  end if;
  if v_sender = auth.uid() then
    raise exception 'cannot report your own message';
  end if;

  insert into public.reports (reporter_id, reported_user_id, move_id, message_id, reason, details)
  values (auth.uid(), v_sender, v_move, p_message_id, p_reason, nullif(trim(coalesce(p_details, '')), ''));
end;
$$;

revoke all on function public.report_message(uuid, text, text) from public;
grant execute on function public.report_message(uuid, text, text) to authenticated;

-- moderation_cases: one row per (kind, target_id) that has crossed its
-- report threshold. No RLS policies granted to authenticated at all - the
-- only access is through get_moderation_queue()/resolve_moderation_case()
-- below (both security definer, both gated on is_moderator()) and the
-- moderate-report Edge Function (service_role, bypasses RLS).
create table public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('move', 'profile', 'message')),
  target_id uuid not null,
  report_count integer not null,
  status text not null default 'pending_llm' check (status in ('pending_llm', 'possible_threat', 'no_threat', 'confirmed_threat')),
  llm_verdict text,
  llm_reasoning text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, target_id)
);

comment on table public.moderation_cases is 'Threshold-triggered moderation queue. pending_llm = not yet classified (LLM step not deployed/failed, or hasn''t run yet) - treated the same as possible_threat by the admin queue so nothing needing a human ever silently sits unseen.';

alter table public.moderation_cases enable row level security;
grant all on public.moderation_cases to service_role;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_moderator from public.profiles where id = auth.uid()), false);
$$;

revoke all on function public.is_moderator() from public;
grant execute on function public.is_moderator() to authenticated;

-- Seeds the initial moderator set by username, if those accounts exist yet
-- (a no-op update if not - whoever signs up as one of these later needs a
-- manual `update profiles set is_moderator = true` since there's no
-- promotion UI). Revisit with a real admin-management screen if the
-- moderator list needs to grow past a handful of people.
update public.profiles set is_moderator = true where username in ('ian', 'sda', 'white_monster');

-- Fires on every report insert; cheap enough (single count query, only on
-- the row's own target) to run synchronously rather than batched.
create or replace function public.check_report_thresholds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_target uuid;
  v_count integer;
  v_threshold numeric;
  v_move_id uuid;
  v_member_count integer;
begin
  if new.message_id is not null then
    v_kind := 'message';
    v_target := new.message_id;
    select count(distinct reporter_id) into v_count from public.reports where message_id = v_target;
    select move_id into v_move_id from public.move_messages where id = v_target;
    select count(*) into v_member_count from public.move_members where move_id = v_move_id and status = 'approved';
    -- "more than half the members" - member count includes the host (auto-approved on creation).
    v_threshold := v_member_count / 2.0;
  elsif new.move_id is not null then
    v_kind := 'move';
    v_target := new.move_id;
    select count(distinct reporter_id) into v_count from public.reports where move_id = v_target and message_id is null;
    v_threshold := 10;
  else
    v_kind := 'profile';
    v_target := new.reported_user_id;
    select count(distinct reporter_id) into v_count from public.reports where reported_user_id = v_target and move_id is null and message_id is null;
    v_threshold := 50;
  end if;

  if v_count > v_threshold then
    insert into public.moderation_cases (kind, target_id, report_count)
    values (v_kind, v_target, v_count)
    on conflict (kind, target_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_report_check_thresholds
  after insert on public.reports
  for each row execute function public.check_report_thresholds();

-- Shared by both the admin resolve path and the LLM verdict path below so
-- "confirmed_threat" always does the same removal regardless of who/what
-- decided it.
create or replace function public.apply_moderation_verdict(p_case_id uuid, p_verdict text, p_reviewer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.moderation_cases%rowtype;
begin
  select * into v_case from public.moderation_cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'case not found';
  end if;

  update public.moderation_cases
  set status = p_verdict, reviewed_by = p_reviewer, reviewed_at = now()
  where id = p_case_id;

  if p_verdict = 'confirmed_threat' then
    if v_case.kind = 'move' then
      delete from public.moves where id = v_case.target_id;
    elsif v_case.kind = 'message' then
      delete from public.move_messages where id = v_case.target_id;
    elsif v_case.kind = 'profile' then
      update public.profiles set username_reset_required = true where id = v_case.target_id;
    end if;
  end if;
end;
$$;

revoke all on function public.apply_moderation_verdict(uuid, text, uuid) from public;
grant execute on function public.apply_moderation_verdict(uuid, text, uuid) to service_role;

-- Called by the moderate-report Edge Function (supabase/functions/moderate-report)
-- once it has an Anthropic classification. Kept separate from
-- apply_moderation_verdict() so "possible_threat" (no removal, just a
-- status + reasoning update) doesn't need its own special case there.
create or replace function public.record_llm_verdict(p_case_id uuid, p_verdict text, p_reasoning text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_verdict not in ('confirmed_threat', 'possible_threat', 'no_threat') then
    raise exception 'invalid verdict';
  end if;

  update public.moderation_cases set llm_verdict = p_verdict, llm_reasoning = p_reasoning where id = p_case_id;

  if p_verdict = 'confirmed_threat' then
    perform public.apply_moderation_verdict(p_case_id, 'confirmed_threat', null);
  else
    update public.moderation_cases set status = p_verdict where id = p_case_id;
  end if;
end;
$$;

revoke all on function public.record_llm_verdict(uuid, text, text) from public;
grant execute on function public.record_llm_verdict(uuid, text, text) to service_role;

create or replace function public.resolve_moderation_case(p_case_id uuid, p_verdict text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;
  if p_verdict not in ('confirmed_threat', 'no_threat') then
    raise exception 'invalid verdict';
  end if;
  perform public.apply_moderation_verdict(p_case_id, p_verdict, auth.uid());
end;
$$;

revoke all on function public.resolve_moderation_case(uuid, text) from public;
grant execute on function public.resolve_moderation_case(uuid, text) to authenticated;

-- pending_llm is included alongside possible_threat deliberately (see the
-- table comment) - a case the LLM step never got to still needs a human.
create or replace function public.get_moderation_queue()
returns table (
  id uuid,
  kind text,
  target_id uuid,
  status text,
  report_count integer,
  reasons text[],
  llm_verdict text,
  llm_reasoning text,
  created_at timestamptz,
  move_title text,
  move_description text,
  profile_username text,
  profile_display_name text,
  message_content text,
  content_username text,
  content_display_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not authorized';
  end if;

  return query
  select
    mc.id, mc.kind, mc.target_id, mc.status, mc.report_count,
    (select array_agg(distinct r.reason) from public.reports r where
      (mc.kind = 'move' and r.move_id = mc.target_id and r.message_id is null)
      or (mc.kind = 'profile' and r.reported_user_id = mc.target_id and r.move_id is null and r.message_id is null)
      or (mc.kind = 'message' and r.message_id = mc.target_id)
    ) as reasons,
    mc.llm_verdict, mc.llm_reasoning, mc.created_at,
    m.title, m.description,
    pu.username, pu.display_name,
    msg.content,
    pc.username, pc.display_name
  from public.moderation_cases mc
  left join public.moves m on mc.kind = 'move' and m.id = mc.target_id
  left join public.profiles pu on mc.kind = 'profile' and pu.id = mc.target_id
  left join public.move_messages msg on mc.kind = 'message' and msg.id = mc.target_id
  left join public.profiles pc on mc.kind = 'message' and pc.id = msg.sender_id
  where mc.status in ('pending_llm', 'possible_threat')
  order by mc.created_at asc;
end;
$$;

revoke all on function public.get_moderation_queue() from public;
grant execute on function public.get_moderation_queue() to authenticated;
