// Hand-written mirror of the schema in supabase/migrations. Keep in sync
// manually until the project is linked and `supabase gen types` can run.

export type FriendshipStatus = 'pending' | 'accepted';
export type MoveMemberStatus = 'pending' | 'approved' | 'rejected';
export type MoveStatus = 'active' | 'cooldown' | 'expired';
export type DegreeLimit = 1 | 2 | 3;

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
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
