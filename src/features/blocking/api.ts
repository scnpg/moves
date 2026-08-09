import { supabase } from '@/lib/supabase';
import type { BlockedUser, ReportReason } from '@/lib/database.types';

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
