import { supabase } from '@/lib/supabase';
import type {
  DegreeLimit,
  EligibleMove,
  Move,
  MoveByInviteLink,
  MoveByShareToken,
  MoveInviteLink,
  MoveMember,
  MoveMessage,
  Profile,
} from '@/lib/database.types';

export interface MoveMemberWithProfile extends MoveMember {
  profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export interface MoveMessageWithSender extends MoveMessage {
  sender: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>;
}

export async function getEligibleMoves(params: {
  userId: string;
  lat?: number | null;
  lng?: number | null;
  radiusM?: number;
}): Promise<EligibleMove[]> {
  const { data, error } = await supabase.rpc('get_eligible_moves_for_user', {
    p_user_id: params.userId,
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_radius_m: params.radiusM ?? 5000,
  });
  if (error) throw error;
  return (data ?? []) as EligibleMove[];
}

/**
 * Active Moves the caller is currently hosting or an approved member of -
 * the "Moves" tab, as opposed to the "Feed" tab's full discovery list.
 * get_eligible_moves_for_user() already computes `location_visible` as
 * exactly `mm.status = 'approved' OR host_id = caller`, so filtering on it
 * client-side avoids a second RPC.
 */
export async function getMyOptedInMoves(userId: string): Promise<EligibleMove[]> {
  const eligible = await getEligibleMoves({ userId });
  return eligible.filter((m) => m.location_visible);
}

/** All-time count of Moves this user has hosted (any status), for the profile stat strip. */
export async function getHostedMoveCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('moves')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', userId);
  if (error) throw error;
  return count ?? 0;
}

/** All-time count of Moves this user has joined (approved membership, any status), for the profile stat strip. */
export async function getJoinedMoveCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('move_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'approved');
  if (error) throw error;
  return count ?? 0;
}

/**
 * Per-move blacklist, set at creation time (Create Move -> More options ->
 * Blacklisted users). Distinct from the app-wide blocked_users list -
 * one-directional, host-only, scoped to this Move. Enforced server-side in
 * handle_move_join_request() and get_eligible_moves_for_user(), not just
 * here - this is a convenience insert, not the security boundary.
 */
export async function addMoveExclusions(moveId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const { error } = await supabase
    .from('move_excluded_users')
    .insert(userIds.map((userId) => ({ move_id: moveId, user_id: userId })));
  if (error) throw error;
}

export interface CreateMoveInput {
  hostId: string;
  title: string;
  description: string | null;
  degreeLimit: DegreeLimit;
  requiresApproval: boolean;
  startsAt: string;
  expiresAt: string;
  maxMembers: number | null;
  lat: number | null;
  lng: number | null;
  chatEnabled: boolean;
}

export interface TitleModerationResult {
  verdict: 'allowed' | 'blocked';
  reason?: string;
}

/**
 * Checks a Move title for intense profanity or hate speech before
 * creation - see supabase/functions/check-title. Fails open (resolves to
 * "allowed") on any network/function error rather than throwing, so a
 * moderation-service hiccup can never block someone from creating a Move.
 */
export async function checkTitleForModeration(title: string): Promise<TitleModerationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('check-title', { body: { title } });
    if (error) throw error;
    return data as TitleModerationResult;
  } catch (err) {
    console.warn('checkTitleForModeration failed, allowing by default', err);
    return { verdict: 'allowed' };
  }
}

export async function createMove(input: CreateMoveInput): Promise<Move> {
  const { data, error } = await supabase
    .from('moves')
    .insert({
      host_id: input.hostId,
      title: input.title,
      description: input.description,
      degree_limit: input.degreeLimit,
      requires_approval: input.requiresApproval,
      starts_at: input.startsAt,
      expires_at: input.expiresAt,
      max_members: input.maxMembers,
      location:
        input.lat != null && input.lng != null
          ? `SRID=4326;POINT(${input.lng} ${input.lat})`
          : null,
      chat_enabled: input.chatEnabled,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Move;
}

/** Returns null (rather than throwing) when RLS hides the row - i.e. the caller
 * is not the host or an approved member yet. Callers should fall back to
 * getEligibleMoves() for a redacted preview in that case. */
export async function getMove(moveId: string): Promise<Move | null> {
  const { data, error } = await supabase.from('moves').select('*').eq('id', moveId).maybeSingle();
  if (error) throw error;
  return data as Move | null;
}

export async function getMyMembership(moveId: string, userId: string): Promise<MoveMember | null> {
  const { data, error } = await supabase
    .from('move_members')
    .select('*')
    .eq('move_id', moveId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as MoveMember | null;
}

export async function requestToJoin(moveId: string, userId: string) {
  const { error } = await supabase.from('move_members').insert({ move_id: moveId, user_id: userId });
  if (error) throw error;
}

/** Public preview for a Private (Link-Only) Move's share link - works while signed out. Null if the token is invalid/expired. */
export async function getMoveByShareToken(shareToken: string): Promise<MoveByShareToken | null> {
  const { data, error } = await supabase.rpc('get_move_by_share_token', { p_share_token: shareToken });
  if (error) throw error;
  return ((data as MoveByShareToken[] | null)?.[0] as MoveByShareToken) ?? null;
}

/** Self-service join via a Private (Link-Only) Move's share token. Authenticated only; idempotent if already a member. */
export async function joinMoveViaToken(shareToken: string) {
  const { error } = await supabase.rpc('join_move_via_token', { p_share_token: shareToken });
  if (error) throw error;
}

/** Host-only: mints a bypass link for this Move. singleUse=true limits it to one join, ever. */
export async function createMoveInviteLink(moveId: string, hostId: string, singleUse: boolean): Promise<MoveInviteLink> {
  const { data, error } = await supabase
    .from('move_invite_links')
    .insert({ move_id: moveId, created_by: hostId, max_uses: singleUse ? 1 : null })
    .select('*')
    .single();
  if (error) throw error;
  return data as MoveInviteLink;
}

/** Host-only: every bypass link ever created for this Move, active or not - RLS scopes this to the host automatically. */
export async function listMoveInviteLinks(moveId: string): Promise<MoveInviteLink[]> {
  const { data, error } = await supabase
    .from('move_invite_links')
    .select('*')
    .eq('move_id', moveId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MoveInviteLink[];
}

export async function revokeMoveInviteLink(linkId: string) {
  const { error } = await supabase
    .from('move_invite_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId);
  if (error) throw error;
}

/** Public preview for a bypass invite link - works while signed out, and for a Move at any degree_limit tier. Null if the token doesn't exist at all. */
export async function getMoveByInviteLink(token: string): Promise<MoveByInviteLink | null> {
  const { data, error } = await supabase.rpc('get_move_by_invite_link', { p_token: token });
  if (error) throw error;
  return ((data as MoveByInviteLink[] | null)?.[0] as MoveByInviteLink) ?? null;
}

/** Self-service join via a host-issued bypass link. Authenticated only; idempotent if already a member. */
export async function joinMoveViaInviteLink(token: string) {
  const { error } = await supabase.rpc('join_move_via_invite_link', { p_token: token });
  if (error) throw error;
}

export async function listMembers(moveId: string): Promise<MoveMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('move_members')
    .select('*, profile:profiles(id, username, display_name, avatar_url)')
    .eq('move_id', moveId)
    .order('requested_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as MoveMemberWithProfile[];
}

export async function approveMember(memberId: string) {
  const { error } = await supabase.from('move_members').update({ status: 'approved' }).eq('id', memberId);
  if (error) throw error;
}

export async function rejectMember(memberId: string) {
  const { error } = await supabase.from('move_members').update({ status: 'rejected' }).eq('id', memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string) {
  const { error } = await supabase.from('move_members').delete().eq('id', memberId);
  if (error) throw error;
}

export async function endMoveEarly(moveId: string) {
  const { error } = await supabase
    .from('moves')
    .update({ status: 'expired', cooldown_started_at: new Date().toISOString() })
    .eq('id', moveId);
  if (error) throw error;
}

/** Permanently removes the move (and, via cascade, its members and chat). Host-only per RLS. */
export async function deleteMove(moveId: string) {
  const { error } = await supabase.from('moves').delete().eq('id', moveId);
  if (error) throw error;
}

export async function listMessages(moveId: string): Promise<MoveMessageWithSender[]> {
  const { data, error } = await supabase
    .from('move_messages')
    .select('*, sender:profiles(id, username, display_name, avatar_url)')
    .eq('move_id', moveId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as MoveMessageWithSender[];
}

export async function sendMessage(moveId: string, senderId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;
  const { error } = await supabase
    .from('move_messages')
    .insert({ move_id: moveId, sender_id: senderId, content: trimmed });
  if (error) throw error;
}

export function subscribeToMoveMessages(moveId: string, onInsert: (message: MoveMessage) => void) {
  const channel = supabase
    .channel(`move-messages-${moveId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'move_messages', filter: `move_id=eq.${moveId}` },
      (payload) => onInsert(payload.new as MoveMessage)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToMoveMembers(moveId: string, onChange: () => void) {
  const channel = supabase
    .channel(`move-members-${moveId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'move_members', filter: `move_id=eq.${moveId}` },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
