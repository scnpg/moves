import { supabase } from '@/lib/supabase';
import type { BlockedUser, ModerationQueueItem, ModerationVerdict, ReportReason } from '@/lib/database.types';

/** Also drops any existing friendship between the pair - see block_user() in the migration. */
export async function blockUser(userId: string) {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) throw error;
}

export async function unblockUser(userId: string) {
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  if (error) throw error;
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('get_blocked_users');
  if (error) throw error;
  return (data ?? []) as BlockedUser[];
}

/** Insert-only - reports aren't readable back through the client API (see reports table RLS). */
export async function reportUser(params: { userId: string; reason: ReportReason; details?: string; moveId?: string }) {
  const { userId, reason, details, moveId } = params;
  const { error } = await supabase.rpc('report_user', {
    p_reported_user_id: userId,
    p_reason: reason,
    p_details: details?.trim() || null,
    p_move_id: moveId ?? null,
  });
  if (error) throw error;
}

/** Counts toward that message's own report tally (see check_report_thresholds() in the moderation migration) - separate from reportUser()'s move-level and profile-level tallies. */
export async function reportMessage(params: { messageId: string; reason: ReportReason; details?: string }) {
  const { messageId, reason, details } = params;
  const { error } = await supabase.rpc('report_message', {
    p_message_id: messageId,
    p_reason: reason,
    p_details: details?.trim() || null,
  });
  if (error) throw error;
}

/** Moderator-only (is_moderator() gate on the RPC itself) - the review queue behind /moderation. */
export async function getModerationQueue(): Promise<ModerationQueueItem[]> {
  const { data, error } = await supabase.rpc('get_moderation_queue');
  if (error) throw error;
  return (data ?? []) as ModerationQueueItem[];
}

/** "confirmed_threat" triggers immediate removal server-side (delete the Move/message, or flag the profile's username for a forced change) - see apply_moderation_verdict() in the migration. */
export async function resolveModerationCase(caseId: string, verdict: ModerationVerdict) {
  const { error } = await supabase.rpc('resolve_moderation_case', { p_case_id: caseId, p_verdict: verdict });
  if (error) throw error;
}
