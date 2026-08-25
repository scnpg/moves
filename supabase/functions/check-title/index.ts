// Synchronously classifies a Move title for intense profanity or hate
// speech before creation - called directly from the client (see
// handleCreate in src/app/room/create.tsx) and awaited before the insert.
// Unlike moderate-report (a fire-after webhook on content that already
// exists and was already reported), this runs in the create flow itself
// and can block the submission outright.
//
// Deliberately narrow: this only flags the worst tier (slurs, dehumanizing
// hate speech, extreme obscenity) - ordinary swearing or edgy-but-harmless
// titles are meant to pass through untouched. See README.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Verdict = 'blocked' | 'allowed';

async function classify(title: string): Promise<{ verdict: Verdict; reason: string }> {
  const prompt = `You are a content filter for a social meetup app called Moves. A user is about to create a "Move" (a meetup event) with this title:

"${title}"

Flag it ONLY if it contains intense profanity or hate speech: slurs, dehumanizing language targeting a protected group (race, ethnicity, religion, gender, sexual orientation, disability, etc), or extreme obscenity. Do NOT flag mild swearing, dark humor, crude-but-harmless jokes, or edgy titles that don't target a group.

Respond in exactly this format:
VERDICT: <blocked|allowed>
<one short sentence of reasoning>`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text = (data.content?.[0]?.text as string) ?? '';
  const match = text.match(/VERDICT:\s*(blocked|allowed)/i);
  const verdict = (match?.[1]?.toLowerCase() as Verdict) ?? 'allowed';
  const reason = text.replace(/VERDICT:\s*\w+/i, '').trim().slice(0, 300);
  return { verdict, reason };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { title } = (await req.json()) as { title?: string };
    if (!title || !title.trim()) {
      return new Response(JSON.stringify({ verdict: 'allowed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!anthropicApiKey) {
      // No key set - fail open. Blocking every Move creation because a
      // secret isn't configured would be worse than letting an unchecked
      // title through; see README.
      console.log('check-title: ANTHROPIC_API_KEY not set, allowing by default');
      return new Response(JSON.stringify({ verdict: 'allowed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Unlike Move creation itself (rate-limited at the DB level),
    // nothing stopped a client from calling this function in a tight loop
    // without ever creating a Move - each call is a real Anthropic spend.
    // Scoped to the caller's own JWT (forwarded, not service_role) so the
    // RPC's auth.uid() is the actual user, not this function. Throwing
    // here (rather than checking `error`) lands in the catch below, which
    // already fails open exactly the same way a missing key or an
    // Anthropic outage does - the rate limit only ever stops the Anthropic
    // call, never Move creation itself (see checkTitleForModeration() in
    // src/features/moves/api.ts, which fails open on any error already).
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { error: rateLimitError } = await supabase.rpc('check_title_rate_limit');
    if (rateLimitError) throw rateLimitError;

    const { verdict, reason } = await classify(title);
    return new Response(JSON.stringify({ verdict, reason }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Fail open on any error (bad request, Anthropic outage, etc) - same
    // reasoning as the missing-key case above. A moderation-service hiccup
    // should never be the reason someone can't create a Move.
    console.error('check-title: classification failed', err);
    return new Response(JSON.stringify({ verdict: 'allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
