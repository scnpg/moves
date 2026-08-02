import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Move, Profile } from '@/lib/database.types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'phone_hash' | 'bio'>>
) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
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

/** Moves the given user is hosting that are still active. Only readable for your own id via RLS. */
export async function getHostedActiveMoves(userId: string): Promise<Move[]> {
  const { data, error } = await supabase
    .from('moves')
    .select('*')
    .eq('host_id', userId)
    .eq('status', 'active')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Move[];
}
