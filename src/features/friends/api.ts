import { supabase } from '@/lib/supabase';
import type {
  ContactSuggestion,
  FriendListItem,
  FriendOfFriendSuggestion,
  FriendRequest,
  MutualFriend,
  NearbyUserSuggestion,
  SearchFriendshipStatus,
} from '@/lib/database.types';

export async function getFriendshipStatus(
  myUserId: string,
  otherUserId: string
): Promise<{ status: SearchFriendshipStatus; isCloseFriend: boolean }> {
  const { data, error } = await supabase
    .from('friendships')
    .select('user_id_1, status, requested_by, user_1_marked_close, user_2_marked_close')
    .or(
      `and(user_id_1.eq.${myUserId},user_id_2.eq.${otherUserId}),and(user_id_1.eq.${otherUserId},user_id_2.eq.${myUserId})`
    )
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: 'none', isCloseFriend: false };

  const iAmUser1 = data.user_id_1 === myUserId;
  const isCloseFriend =
    data.status === 'accepted' && (iAmUser1 ? data.user_1_marked_close : data.user_2_marked_close);

  if (data.status === 'accepted') return { status: 'accepted', isCloseFriend };
  return { status: data.requested_by === myUserId ? 'pending_sent' : 'pending_received', isCloseFriend: false };
}

/**
 * Handles both a fresh request and re-requesting someone who previously
 * declined you (which revives their existing row instead of erroring on
 * the unique-pair constraint) - see send_friend_request() in the migration.
 */
export async function sendFriendRequest(otherUserId: string) {
  const { error } = await supabase.rpc('send_friend_request', { p_other_user_id: otherUserId });
  if (error) throw error;
}

export async function declineFriendRequest(myUserId: string, otherUserId: string) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'declined' })
    .or(
      `and(user_id_1.eq.${myUserId},user_id_2.eq.${otherUserId}),and(user_id_1.eq.${otherUserId},user_id_2.eq.${myUserId})`
    );
  if (error) throw error;
}

/** Both directions of the caller's pending friend requests, with the other person's profile. */
export async function getFriendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await supabase.rpc('get_friend_requests');
  if (error) throw error;
  return (data ?? []) as FriendRequest[];
}

export async function acceptFriendRequest(myUserId: string, otherUserId: string) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .or(
      `and(user_id_1.eq.${myUserId},user_id_2.eq.${otherUserId}),and(user_id_1.eq.${otherUserId},user_id_2.eq.${myUserId})`
    );
  if (error) throw error;
}

export async function removeFriendship(myUserId: string, otherUserId: string) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(user_id_1.eq.${myUserId},user_id_2.eq.${otherUserId}),and(user_id_1.eq.${otherUserId},user_id_2.eq.${myUserId})`
    );
  if (error) throw error;
}

export async function setCloseFriend(friendUserId: string, isClose: boolean) {
  const { error } = await supabase.rpc('set_close_friend', {
    p_friend_id: friendUserId,
    p_is_close: isClose,
  });
  if (error) throw error;
}

export async function getCloseFriendIds(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('get_close_friend_ids');
  if (error) throw error;
  return new Set((data ?? []).map((row: { friend_id: string }) => row.friend_id));
}

export async function getMutualFriends(userA: string, userB: string): Promise<MutualFriend[]> {
  const { data, error } = await supabase.rpc('get_mutual_friends', {
    user_a: userA,
    user_b: userB,
  });
  if (error) throw error;
  return (data ?? []) as MutualFriend[];
}

/** The caller's own full friends list. Safe to call for yourself only -
 * there is no equivalent for looking up someone else's list. */
export async function getMyFriends(): Promise<FriendListItem[]> {
  const { data, error } = await supabase.rpc('get_my_friends');
  if (error) throw error;
  return (data ?? []) as FriendListItem[];
}

/** Rounds server-side (see update_my_location() migration) - never stores exact location. */
export async function updateMyLocation(lat: number, lng: number) {
  const { error } = await supabase.rpc('update_my_location', { p_lat: lat, p_lng: lng });
  if (error) throw error;
}

export async function getFriendOfFriendSuggestions(limit = 20): Promise<FriendOfFriendSuggestion[]> {
  const { data, error } = await supabase.rpc('get_friend_of_friend_suggestions', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as FriendOfFriendSuggestion[];
}

/** Empty until the caller has called updateMyLocation() at least once. */
export async function getNearbyUserSuggestions(radiusM = 5000, limit = 20): Promise<NearbyUserSuggestion[]> {
  const { data, error } = await supabase.rpc('get_nearby_user_suggestions', {
    p_radius_m: radiusM,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as NearbyUserSuggestion[];
}

/** phoneHashes must already be normalized+hashed client-side (see src/lib/phone.ts) - raw numbers never sent. */
export async function matchContacts(phoneHashes: string[]): Promise<ContactSuggestion[]> {
  if (phoneHashes.length === 0) return [];
  const { data, error } = await supabase.rpc('match_contacts', { p_phone_hashes: phoneHashes });
  if (error) throw error;
  return (data ?? []) as ContactSuggestion[];
}
