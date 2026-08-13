# check-title

Synchronously classifies a Move title for intense profanity or hate speech
*before* the Move is created, via the Anthropic API. Called directly from
the client (`checkTitleForModeration()` in `src/features/moves/api.ts`,
invoked from `handleCreate` in `src/app/room/create.tsx`) and awaited
before `createMove()` runs - unlike `moderate-report`, which is a
fire-after webhook on content that already exists and was already
reported, this one can block the submission outright.

Deliberately narrow: it only flags the worst tier (slurs, dehumanizing hate
speech targeting a protected group, extreme obscenity). Ordinary swearing,
dark humor, or edgy-but-harmless titles are meant to pass through
untouched - this isn't a general profanity filter.

**Fails open.** If `ANTHROPIC_API_KEY` isn't set, or the Anthropic call
errors for any reason, the function returns `{ verdict: "allowed" }` rather
than blocking - a moderation-service hiccup should never be the reason
someone can't create a Move. Until the key is set (step 2 below), this
function is a deployed no-op: every title passes.

## To make this live

1. Deploy: `npx supabase functions deploy check-title`
2. Set the API key (same key `moderate-report` uses, if already set):
   `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`

No webhook wiring needed - this is called directly by the client, not
triggered by a database event.
