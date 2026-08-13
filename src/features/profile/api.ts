import { supabase } from '@/lib/supabase';
import type { Profile, PublicProfile } from '@/lib/database.types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data as Profile;
}

/** Anon-callable preview for shareable profile links/QR codes - see get_public_profile(). */
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

/**
 * Uploads to a fixed "<uid>/avatar.jpg" path (upsert), so re-uploading
 * replaces the old photo rather than accumulating orphaned files. Returns a
 * cache-busted public URL, since the path itself never changes between
 * uploads.
 */
export async function uploadAvatar(userId: string, uri: string, mimeType: string): Promise<string> {
  const path = `${userId}/avatar.jpg`;

  // Reading the local uri into a real Blob (same on native and web) rather
  // than building a React Native-style FormData part ({uri, name, type})
  // matters as of Expo SDK 57's fetch implementation: its FormData encoder
  // only recognizes string/Blob/File parts (see
  // node_modules/expo/src/winter/fetch/convertFormData.ts), not RN's
  // classic uri-based part shape, so passing that shape through
  // storage-js's own FormData wrapping threw "Unsupported FormDataPart
  // implementation" on native. A real Blob is a part type that encoder
  // does handle.
  const response = await fetch(uri);
  const body = await response.blob();

  const { error } = await supabase.storage.from('avatars').upload(path, body, {
    upsert: true,
    contentType: mimeType,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
