# notify-new-move (scaffold)

Boilerplate only - not deployed, not wired to a push provider. Computes who
*would* get notified about a new Move and logs the count; the actual
OneSignal/FCM `fetch()` calls are commented out in `index.ts`.

## To make this live

1. Pick a provider (OneSignal or FCM) and uncomment its block in `index.ts`.
2. Deploy: `npx supabase functions deploy notify-new-move`
3. Set secrets, e.g. for OneSignal:
   `npx supabase secrets set ONESIGNAL_APP_ID=... ONESIGNAL_REST_API_KEY=...`
4. Wire the trigger - Database → Webhooks in the Supabase dashboard:
   - Table: `moves`, Event: `INSERT`
   - Type: Supabase Edge Function → `notify-new-move`
5. Devices need to actually save a `push_token` via `save_user_settings()`
   (see `supabase/migrations/20260803140300_user_settings.sql`) - there's no
   client-side push registration flow yet (Expo push token request /
   `expo-notifications` setup), so `user_settings.push_token` will stay null
   for everyone until that's built too.
