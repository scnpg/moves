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
  is_moderator: boolean;
  username_reset_required: boolean;
  onboarding_completed: boolean;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
}

export type ModerationCaseKind = 'move' | 'profile' | 'message';
export type ModerationVerdict = 'confirmed_threat' | 'no_threat';

export interface ModerationQueueItem {
  id: string;
  kind: ModerationCaseKind;
  target_id: string;
  status: 'pending_llm' | 'possible_threat' | 'no_threat' | 'confirmed_threat';
  report_count: number;
  reasons: string[] | null;
  llm_verdict: string | null;
  llm_reasoning: string | null;
  created_at: string;
  move_title: string | null;
  move_description: string | null;
  profile_username: string | null;
  profile_display_name: string | null;
  message_content: string | null;
  content_username: string | null;
  content_display_name: string | null;
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
  chat_enabled: boolean;
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

export interface FriendOfFriendId {
  friend_of_friend_id: string;
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
  phone_hash: string;
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

export interface MoveInviteLink {
  id: string;
  move_id: string;
  token: string;
  created_by: string;
  max_uses: number | null;
  use_count: number;
  revoked_at: string | null;
  created_at: string;
}

export interface MoveByInviteLink {
  id: string;
  title: string;
  description: string | null;
  host_username: string;
  host_display_name: string | null;
  host_avatar_url: string | null;
  starts_at: string;
  expires_at: string;
  status: MoveStatus;
  degree_limit: DegreeLimit;
  max_members: number | null;
  approved_count: number;
  is_full: boolean;
  already_member: boolean;
  link_valid: boolean;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_banned: boolean;
}

export interface UserSettings {
  user_id: string;
  push_token: string | null;
  notify_friend_moves: boolean;
  notify_mutual_moves: boolean;
  notify_close_friends_moves: boolean;
  notify_public_moves: boolean;
  notify_group_chat: boolean;
  updated_at: string;
}

export type ReportReason = 'spam' | 'harassment' | 'inappropriate_content' | 'fake_profile' | 'threat' | 'other';

export interface BlockedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  blocked_at: string;
}
