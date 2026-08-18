import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Profile, PublicProfile } from '@/lib/database.types';

/**
 * Safe for viewing any user's profile (not just your own) - only
 * non-sensitive fields. last_lat/last_lng/phone_hash/referred_by are
 * locked down at the column-grant level (see
 * 20260818090000_lock_down_profile_columns.sql); your own profile comes
 * from AuthProvider's get_my_profile() RPC instead.
 */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('get_public_profile', { p_user_id: userId });
  if (error) throw error;
  return ((data as PublicProfile[] | null)?.[0] as PublicProfile) ?? null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'phone_hash' | 'bio'>>
) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
}

export async function completeOnboarding(userId: string) {
  const { error } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', userId);
  if (error) throw error;
}

/**
 * Uploads to a fixed "<uid>/avatar.jpg" path (upsert), so re-uploading
 * replaces the old photo rather than accumulating orphaned files. Returns a
 * cache-busted public URL, since the path itself never changes between
 * uploads.
 */
export async function uploadAvatar(userId: string, uri: string, mimeType: string): Promise<string> {
  const path = `${userId}/avatar.jpg`;

  let body: Blob | FormData;
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    body = await response.blob();
  } else {
    const formData = new FormData();
    formData.append('file', { uri, name: 'avatar.jpg', type: mimeType } as unknown as Blob);
    body = formData;
  }

  const { error } = await supabase.storage.from('avatars').upload(path, body, {
    upsert: true,
    contentType: mimeType,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
