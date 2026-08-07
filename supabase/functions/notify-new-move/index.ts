// Edge Function SCAFFOLD - not deployed or wired to a live push provider.
// See supabase/functions/notify-new-move/README.md for how to hook this up.
//
// Intended trigger: a Database Webhook on `moves` INSERT (Database ->
// Webhooks in the dashboard, or the `supabase_functions.http_request`
// trigger helper) posting the standard {type, table, record} webhook body
// here. Uses the service-role client to read across friendships/
// user_settings directly (bypasses RLS) rather than the authenticated RPCs,
// since there's no signed-in user in this context.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface MoveRecord {
  id: string;
  host_id: string;
  title: string;
  degree_limit: number;
}

interface WebhookPayload {
  type: string;
  table: string;
  record: MoveRecord;
}

interface FriendshipRow {
  user_id_1: string;
  user_id_2: string;
  user_1_marked_close: boolean;
  user_2_marked_close: boolean;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const payload = (await req.json()) as WebhookPayload;

  if (payload.table !== 'moves' || payload.type !== 'INSERT') {
    return new Response('ignored', { status: 200 });
  }

  const move = payload.record;

  // Private (Link-Only) moves have no discoverable audience - only people
  // with the link should ever know it exists.
  if (move.degree_limit === 0) {
    return new Response('skipped: private move', { status: 200 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: friendships } = await supabase
    .from('friendships')
    .select('user_id_1, user_id_2, user_1_marked_close, user_2_marked_close')
    .eq('status', 'accepted')
    .or(`user_id_1.eq.${move.host_id},user_id_2.eq.${move.host_id}`);

  const rows = (friendships ?? []) as FriendshipRow[];
  const otherId = (f: FriendshipRow) => (f.user_id_1 === move.host_id ? f.user_id_2 : f.user_id_1);
  const directFriendIds = rows.map(otherId);

  let recipientIds: string[];

  if (move.degree_limit === 4) {
    // Close Friends only - just the host's close-friend-tagged friends.
    recipientIds = rows
      .filter((f) => (f.user_id_1 === move.host_id ? f.user_1_marked_close : f.user_2_marked_close))
      .map(otherId);
  } else {
    recipientIds = [...directFriendIds];

    if (move.degree_limit >= 2 && directFriendIds.length > 0) {
      // Friends-of-friends ("mutuals") - one more hop out from the host.
      const idList = directFriendIds.join(',');
      const { data: fofRows } = await supabase
        .from('friendships')
        .select('user_id_1, user_id_2')
        .eq('status', 'accepted')
        .or(`user_id_1.in.(${idList}),user_id_2.in.(${idList})`);

      const fofIds = new Set(
        (fofRows ?? [])
          .flatMap((f) => [f.user_id_1, f.user_id_2])
          .filter((id) => id !== move.host_id && !directFriendIds.includes(id))
      );
      recipientIds.push(...fofIds);
    }
  }

  if (recipientIds.length === 0) {
    return new Response('no recipients', { status: 200 });
  }

  // Each recipient's own notify_friend_moves (direct friend of host) vs.
  // notify_mutual_moves (friend-of-friend) preference gates whether they
  // actually get pushed to.
  const { data: settings } = await supabase
    .from('user_settings')
    .select('user_id, push_token, notify_friend_moves, notify_mutual_moves')
    .in('user_id', recipientIds)
    .not('push_token', 'is', null);

  const directFriendSet = new Set(directFriendIds);
  const tokens = (settings ?? [])
    .filter((s) => (directFriendSet.has(s.user_id) ? s.notify_friend_moves : s.notify_mutual_moves))
    .map((s) => s.push_token as string);

  if (tokens.length === 0) {
    return new Response('no opted-in recipients with a push token', { status: 200 });
  }

  // TODO: pick one provider, uncomment its block, and set the matching
  // secret with `supabase secrets set NAME=value`. Both are left in as
  // reference payload shapes - this scaffold doesn't call either yet.

  // --- OneSignal ---
  // await fetch('https://onesignal.com/api/v1/notifications', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     Authorization: `Basic ${Deno.env.get('ONESIGNAL_REST_API_KEY')}`,
  //   },
  //   body: JSON.stringify({
  //     app_id: Deno.env.get('ONESIGNAL_APP_ID'),
  //     include_player_ids: tokens,
  //     headings: { en: 'New Move' },
  //     contents: { en: move.title },
  //   }),
  // });

  // --- FCM (HTTP v1) ---
  // for (const token of tokens) {
  //   await fetch(
  //     `https://fcm.googleapis.com/v1/projects/${Deno.env.get('FCM_PROJECT_ID')}/messages:send`,
  //     {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         Authorization: `Bearer ${Deno.env.get('FCM_ACCESS_TOKEN')}`,
  //       },
  //       body: JSON.stringify({
  //         message: { token, notification: { title: 'New Move', body: move.title } },
  //       }),
  //     }
  //   );
  // }

  console.log(`notify-new-move: would notify ${tokens.length} device(s) about move ${move.id}`);

  return new Response(JSON.stringify({ notified: tokens.length }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
