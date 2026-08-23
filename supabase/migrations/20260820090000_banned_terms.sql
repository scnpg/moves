-- Deterministic, instant banned-term blocking for Move titles/descriptions
-- and usernames/display names - a fast, zero-dependency complement to
-- check-title (supabase/functions/check-title), which is LLM-based and
-- only fires client-side on Move creation. This runs as a DB trigger, so
-- it also covers direct table writes and future call sites automatically.
--
-- Deliberately excludes several categories of common/topical words that
-- would cause heavy false positives as a hard block (e.g. bare "suicide",
-- "terrorist", "Holocaust", "invalid", "executed" - see the migration's
-- accompanying PR/commit message for the reasoning) in favor of specific,
-- unambiguous slurs and threat phrases. Not a general profanity filter -
-- ordinary cussing is intentionally not included here.
create table public.banned_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  language text not null default 'en' check (language in ('en', 'es', 'zh')),
  category text not null,
  -- 'word': \y-bounded regex match (won't match inside a larger word -
  -- "Scunthorpe" style false positives). 'substring': plain containment,
  -- used for Chinese entries where there's no whitespace to anchor a word
  -- boundary against.
  match_mode text not null default 'word' check (match_mode in ('word', 'substring')),
  created_at timestamptz not null default now(),
  unique (term, language)
);

comment on table public.banned_terms is 'Hand-curated list of slurs, harassment terms, and explicit threat/attack phrases blocked outright from Move titles/descriptions and usernames/display names. Add more with a plain insert - no code change needed.';

alter table public.banned_terms enable row level security;
-- No policies granted to authenticated/anon - only readable through
-- contains_banned_term() below (security definer) and directly by
-- service_role/the Supabase dashboard for maintaining the list.
grant select, insert, update, delete on public.banned_terms to service_role;

create or replace function public.contains_banned_term(p_text text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_found boolean;
begin
  if p_text is null or btrim(p_text) = '' then
    return false;
  end if;

  select exists (
    select 1
    from public.banned_terms bt
    where case bt.match_mode
      when 'word' then p_text ~* ('\y' || regexp_replace(bt.term, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\y')
      else p_text ilike '%' || bt.term || '%'
    end
  ) into v_found;

  return v_found;
end;
$$;

revoke all on function public.contains_banned_term(text) from public;
grant execute on function public.contains_banned_term(text) to authenticated;

create or replace function public.enforce_move_content_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.contains_banned_term(new.title) or public.contains_banned_term(coalesce(new.description, '')) then
    raise exception 'That title or description contains language that isn''t allowed here.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger moves_content_policy
  before insert or update of title, description on public.moves
  for each row execute function public.enforce_move_content_policy();

create or replace function public.enforce_profile_content_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.contains_banned_term(new.username) or public.contains_banned_term(coalesce(new.display_name, '')) then
    raise exception 'That username or display name contains language that isn''t allowed here.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Fires on the auto-provision insert in handle_new_user() too (username/
-- display_name come straight from signup metadata there), not just later
-- profile edits - a slur chosen as the initial username is caught at
-- signup, not after the fact.
create trigger profiles_content_policy
  before insert or update of username, display_name on public.profiles
  for each row execute function public.enforce_profile_content_policy();

-- ---------------------------------------------------------------------
-- Term list
-- ---------------------------------------------------------------------

insert into public.banned_terms (term, language, category) values
  -- Racial / ethnic slurs
  ('nigger', 'en', 'slur_racial'),
  ('nigga', 'en', 'slur_racial'),
  ('coon', 'en', 'slur_racial'),
  ('darky', 'en', 'slur_racial'),
  ('darkie', 'en', 'slur_racial'),
  ('jigaboo', 'en', 'slur_racial'),
  ('pickaninny', 'en', 'slur_racial'),
  ('spic', 'en', 'slur_racial'),
  ('wetback', 'en', 'slur_racial'),
  ('beaner', 'en', 'slur_racial'),
  ('chink', 'en', 'slur_racial'),
  ('gook', 'en', 'slur_racial'),
  ('zipperhead', 'en', 'slur_racial'),
  ('kike', 'en', 'slur_racial'),
  ('hymie', 'en', 'slur_racial'),
  ('towelhead', 'en', 'slur_racial'),
  ('camel jockey', 'en', 'slur_racial'),
  ('tarbaby', 'en', 'slur_racial'),
  ('porch monkey', 'en', 'slur_racial'),
  ('kaffir', 'en', 'slur_racial'),

  -- Nazi / hate-group slogans and names
  ('kkk', 'en', 'hate_symbol'),
  ('hitler', 'en', 'hate_symbol'),
  ('sieg heil', 'en', 'hate_symbol'),
  ('white power', 'en', 'hate_symbol'),

  -- Homophobic / transphobic slurs
  ('faggot', 'en', 'slur_homophobic'),
  ('fag', 'en', 'slur_homophobic'),
  ('dyke', 'en', 'slur_homophobic'),
  ('tranny', 'en', 'slur_homophobic'),
  ('hermaphrodite', 'en', 'slur_homophobic'),
  ('homo', 'en', 'slur_homophobic'),

  -- Religious / political epithets
  ('christfascist', 'en', 'slur_religious_political'),
  ('islamofascist', 'en', 'slur_religious_political'),

  -- Gendered harassment / degrading terms
  ('whore', 'en', 'harassment_gendered'),
  ('slut', 'en', 'harassment_gendered'),
  ('cumslut', 'en', 'harassment_gendered'),
  ('cocktease', 'en', 'harassment_gendered'),

  -- Ableist slurs
  ('retard', 'en', 'slur_ableist'),
  ('retarded', 'en', 'slur_ableist'),
  ('tard', 'en', 'slur_ableist'),
  ('mongoloid', 'en', 'slur_ableist'),
  ('spastic', 'en', 'slur_ableist'),
  ('spaz', 'en', 'slur_ableist'),
  ('cripple', 'en', 'slur_ableist'),
  ('degenerate', 'en', 'slur_ableist'),

  -- Sexual violence / abuse terms
  ('rapist', 'en', 'sexual_violence'),
  ('pedophile', 'en', 'sexual_violence'),
  ('paedophile', 'en', 'sexual_violence'),
  ('pedo', 'en', 'sexual_violence'),
  ('nonce', 'en', 'sexual_violence'),
  ('molester', 'en', 'sexual_violence'),
  ('child-lover', 'en', 'sexual_violence'),
  ('zoophile', 'en', 'sexual_violence'),
  ('necrophile', 'en', 'sexual_violence'),
  ('incestuous', 'en', 'sexual_violence'),

  -- Explicit self-harm incitement (narrowly scoped - bare "suicide" is
  -- deliberately excluded, see migration header)
  ('kys', 'en', 'self_harm_incitement'),
  ('kill yourself', 'en', 'self_harm_incitement'),
  ('kill urself', 'en', 'self_harm_incitement'),
  ('go kill yourself', 'en', 'self_harm_incitement'),
  ('you should die', 'en', 'self_harm_incitement'),
  ('hope you die', 'en', 'self_harm_incitement'),

  -- Weapons / attack planning - generic trigger phrases only, no
  -- construction detail (see migration header)
  ('how to make a bomb', 'en', 'weapons_attack'),
  ('bomb making', 'en', 'weapons_attack'),
  ('make a bomb', 'en', 'weapons_attack'),
  ('build a bomb', 'en', 'weapons_attack'),
  ('pipe bomb', 'en', 'weapons_attack'),
  ('pressure cooker bomb', 'en', 'weapons_attack'),
  ('improvised explosive device', 'en', 'weapons_attack'),
  ('school shooting', 'en', 'weapons_attack'),
  ('mass shooting', 'en', 'weapons_attack'),
  ('shoot up the school', 'en', 'weapons_attack'),
  ('shooting spree', 'en', 'weapons_attack'),
  ('suicide vest', 'en', 'weapons_attack'),
  ('suicide bomber', 'en', 'weapons_attack'),
  ('join isis', 'en', 'weapons_attack'),
  ('join al-qaeda', 'en', 'weapons_attack'),
  ('planning an attack', 'en', 'weapons_attack'),
  ('kill list', 'en', 'weapons_attack'),

  -- Spanish - small starting set, high-confidence terms only. Not
  -- exhaustive; see migration header.
  ('maricon', 'es', 'slur_homophobic'),
  ('marica', 'es', 'slur_homophobic'),
  ('sudaca', 'es', 'slur_racial'),
  ('violador', 'es', 'sexual_violence'),
  ('pedofilo', 'es', 'sexual_violence'),
  ('matate', 'es', 'self_harm_incitement');

-- Chinese entries use substring matching (no whitespace to anchor a word
-- boundary against - see match_mode comment above).
insert into public.banned_terms (term, language, category, match_mode) values
  ('支那', 'zh', 'slur_racial', 'substring'),
  ('黑鬼', 'zh', 'slur_racial', 'substring');
