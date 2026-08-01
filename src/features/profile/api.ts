import { supabase } from '@/lib/supabase';
import type { Move, Profile } from '@/lib/database.types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>
) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
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
