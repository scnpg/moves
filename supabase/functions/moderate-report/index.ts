// Classifies a threshold-triggered moderation_cases row via the Anthropic
// API, then records the verdict through record_llm_verdict() (which
// handles removal itself for "confirmed_threat" - see the migration).
// Needs a real deploy + secret before it does anything - see README.md.
//
// Intended trigger: a Database Webhook on `moderation_cases` INSERT
// (Database -> Webhooks in the dashboard), same pattern as
// notify-new-move. Until that's wired up, cases just sit as `pending_llm`
// - get_moderation_queue() treats that the same as `possible_threat`, so a
// human moderator still sees and can resolve every case even with this
// function never deployed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ModerationCaseRecord {
  id: string;
  kind: 'move' | 'profile' | 'message';
  target_id: string;
  report_count: number;
}

interface WebhookPayload {
  type: string;
  table: string;
  record: ModerationCaseRecord;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

type Verdict = 'confirmed_threat' | 'possible_threat' | 'no_threat';

async function classify(prompt: string): Promise<{ verdict: Verdict; reasoning: string }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text = (data.content?.[0]?.text as string) ?? '';
  const match = text.match(/VERDICT:\s*(confirmed_threat|possible_threat|no_threat)/i);
  const verdict = (match?.[1]?.toLowerCase() as Verdict) ?? 'possible_threat';
  const reasoning = text.replace(/VERDICT:\s*\w+/i, '').trim().slice(0, 1000);
  return { verdict, reasoning };
}

Deno.serve(async (req) => {
  const payload = (await req.json()) as WebhookPayload;

  if (payload.table !== 'moderation_cases' || payload.type !== 'INSERT') {
    return new Response('ignored', { status: 200 });
  }

  const moderationCase = payload.record;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (!anthropicApiKey) {
    // No key set yet - leave the case as pending_llm rather than guess.
    // get_moderation_queue() surfaces pending_llm the same as
    // possible_threat, so a moderator still sees it.
    console.log('moderate-report: ANTHROPIC_API_KEY not set, leaving case pending_llm');
    return new Response('skipped: no ANTHROPIC_API_KEY secret set', { status: 200 });
  }

  const { data: reports } = await supabase
    .from('reports')
    .select('reason, details')
    .or(
      moderationCase.kind === 'move'
        ? `move_id.eq.${moderationCase.target_id}`
        : moderationCase.kind === 'message'
          ? `message_id.eq.${moderationCase.target_id}`
          : `reported_user_id.eq.${moderationCase.target_id}`
    );

  const reasonSummary = (reports ?? [])
    .map((r) => `- ${r.reason}${r.details ? `: ${r.details}` : ''}`)
    .join('\n');

  let contentDescription = '';

  if (moderationCase.kind === 'move') {
    const { data: move } = await supabase
      .from('moves')
      .select('title, description')
      .eq('id', moderationCase.target_id)
      .maybeSingle();
    contentDescription = `Move title: "${move?.title ?? '(deleted)'}"\nMove description: "${move?.description ?? ''}"`;
  } else if (moderationCase.kind === 'message') {
    const { data: message } = await supabase
      .from('move_messages')
      .select('content')
      .eq('id', moderationCase.target_id)
      .maybeSingle();
    contentDescription = `Chat message: "${message?.content ?? '(deleted)'}"`;
  } else {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name, bio')
      .eq('id', moderationCase.target_id)
      .maybeSingle();
    contentDescription = `Username: "${profile?.username ?? '(deleted)'}"\nDisplay name: "${profile?.display_name ?? ''}"\nBio: "${profile?.bio ?? ''}"`;
  }

  const prompt = `You are a content moderator for a social meetup app called Moves. A ${moderationCase.kind} has been reported by ${moderationCase.report_count} different users.

${contentDescription}

Report reasons given by users:
${reasonSummary || '(no details given)'}

Classify this as one of three levels:
- confirmed_threat: clear, unambiguous safety threat (violence, illegal activity, targeted harassment, doxxing, csam, etc).
- possible_threat: concerning but not clear-cut - needs a human to look at it.
- no_threat: reports look unfounded, or this is just distasteful/low-quality content rather than a safety issue.

Respond in exactly this format:
VERDICT: <confirmed_threat|possible_threat|no_threat>
<one or two sentences of reasoning>`;

  try {
    const { verdict, reasoning } = await classify(prompt);
    await supabase.rpc('record_llm_verdict', {
      p_case_id: moderationCase.id,
      p_verdict: verdict,
      p_reasoning: reasoning,
    });
    return new Response(JSON.stringify({ verdict }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    // Leave it pending_llm on failure rather than guess a verdict - a human
    // will still see it via get_moderation_queue().
    console.error('moderate-report: classification failed', err);
    return new Response(`classification failed: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
});
