# moderate-report

Classifies threshold-triggered moderation cases (see
`supabase/migrations/20260810090000_content_moderation.sql`) as
`confirmed_threat` / `possible_threat` / `no_threat` via the Anthropic API.
`confirmed_threat` triggers automatic removal (delete the Move, delete the
message, or flag the profile's username for a forced change) through
`record_llm_verdict()` -> `apply_moderation_verdict()`.

Not deployed or wired up by default. Until it is, every case that crosses a
report threshold just sits as `pending_llm` - `get_moderation_queue()`
treats that identically to `possible_threat`, so the admin queue
(`/moderation` in the app, moderator accounts only) still catches
everything; this function only saves them from triaging every case by hand.

## To make this live

1. Deploy: `npx supabase functions deploy moderate-report`
2. Set the API key: `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
3. Wire the trigger - Database -> Webhooks in the Supabase dashboard:
   - Table: `moderation_cases`, Event: `INSERT`
   - Type: Supabase Edge Function -> `moderate-report`

Without step 2, the function runs but no-ops (logs and returns 200) rather
than guessing a verdict. Without step 3, it never runs at all - cases still
land in the admin queue as `pending_llm` either way, just without the LLM
pre-triage.

## Report thresholds (from the migration)

- Move: more than 10 distinct reporters.
- Profile: more than 50 distinct reporters.
- Chat message: more than half of the Move's approved members.
