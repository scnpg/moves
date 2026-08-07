import { supabase } from '@/lib/supabase';
import type {
  DegreeLimit,
  EligibleMove,
  Move,
  MoveByShareToken,
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
