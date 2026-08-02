import { supabase } from '@/lib/supabase';
import type { FriendListItem, MutualFriend, SearchFriendshipStatus } from '@/lib/database.types';

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

export async function sendFriendRequest(otherUserId: string, myUserId: string) {
  const { error } = await supabase.from('friendships').insert({
    user_id_1: myUserId,
    user_id_2: otherUserId,
    requested_by: myUserId,
  });
  if (error) throw error;
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
