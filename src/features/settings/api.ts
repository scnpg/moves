import { supabase } from '@/lib/supabase';
import type { UserSettings } from '@/lib/database.types';

export type NotificationPrefs = Pick<
  UserSettings,
  'notify_friend_moves' | 'notify_mutual_moves' | 'notify_close_friends_moves' | 'notify_public_moves' | 'notify_group_chat'
>;

const DEFAULT_PREFS: NotificationPrefs = {
  notify_friend_moves: true,
  notify_mutual_moves: true,
  notify_close_friends_moves: true,
  notify_public_moves: true,
  notify_group_chat: true,
};

/** No row exists until the first save_user_settings() call (see the migration's upsert) - defaults (all on) stand in until then. */
export async function getMyNotificationSettings(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('notify_friend_moves, notify_mutual_moves, notify_close_friends_moves, notify_public_moves, notify_group_chat')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_PREFS;
}

/** Saves just the one changed preference - save_user_settings() only overwrites params it's given, leaving the rest as they were. */
export async function updateNotificationPref(key: keyof NotificationPrefs, value: boolean) {
  const { error } = await supabase.rpc('save_user_settings', { [`p_${key}`]: value });
  if (error) throw error;
}
