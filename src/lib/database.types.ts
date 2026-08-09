// Hand-written mirror of the schema in supabase/migrations. Keep in sync
// manually until the project is linked and `supabase gen types` can run.

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';
export type MoveMemberStatus = 'pending' | 'approved' | 'rejected';
export type MoveStatus = 'active' | 'cooldown' | 'expired';
// 0 = private (link/QR only), 1 = friends, 2 = friends-of-friends
// ("mutuals"), 3 = open, 4 = close friends only.
export type DegreeLimit = 0 | 1 | 2 | 3 | 4;

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
  phone_hash: string | null;
  referred_by: string | null;
}

export interface Friendship {
  id: string;
  user_id_1: string;
  user_id_2: string;
  requested_by: string;
  status: FriendshipStatus;
  created_at: string;
  user_1_marked_close: boolean;
  user_2_marked_close: boolean;
}

export interface Move {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  degree_limit: DegreeLimit;
  requires_approval: boolean;
  starts_at: string;
  expires_at: string;
  status: MoveStatus;
  cooldown_started_at: string | null;
  max_members: number | null;
  created_at: string;
  share_token: string;
}

export interface MoveMember {
  id: string;
  move_id: string;
  user_id: string;
  status: MoveMemberStatus;
  requested_at: string;
  joined_at: string | null;
}

export interface MoveMessage {
  id: string;
  move_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface EligibleMove {
  id: string;
  host_id: string;
  host_username: string;
  host_display_name: string | null;
  host_avatar_url: string | null;
  title: string;
  description: string | null;
  degree_limit: DegreeLimit;
  requires_approval: boolean;
  starts_at: string;
  expires_at: string;
  status: MoveStatus;
  max_members: number | null;
  approved_count: number;
  is_full: boolean;
  distance_m: number | null;
  location_visible: boolean;
  lat: number | null;
  lng: number | null;
  fuzzy_lat: number | null;
  fuzzy_lng: number | null;
}

export type SearchFriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

export interface SearchUserResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  friendship_status: SearchFriendshipStatus;
  is_close_friend: boolean;
}

export interface MutualFriend {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface FriendListItem {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_close_friend: boolean;
}

export interface FriendRequest {
  id: string;
  other_user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  direction: 'incoming' | 'outgoing';
  created_at: string;
}

export interface FriendOfFriendSuggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  mutual_count: number;
}

export interface NearbyUserSuggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  distance_m: number;
}

export interface ContactSuggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface MoveByShareToken {
  id: string;
  title: string;
  description: string | null;
  host_username: string;
  host_display_name: string | null;
  host_avatar_url: string | null;
  starts_at: string;
  expires_at: string;
  status: MoveStatus;
  max_members: number | null;
  approved_count: number;
  is_full: boolean;
  already_member: boolean;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export interface UserSettings {
  user_id: string;
  push_token: string | null;
  notify_friend_moves: boolean;
  notify_mutual_moves: boolean;
  updated_at: string;
}

export type ReportReason = 'spam' | 'harassment' | 'inappropriate_content' | 'fake_profile' | 'other';

export interface BlockedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  blocked_at: string;
}
