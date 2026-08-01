import { supabase } from '@/lib/supabase';
import type { SearchUserResult } from '@/lib/database.types';

export async function searchUsers(query: string): Promise<SearchUserResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase.rpc('search_users', { p_query: trimmed });
  if (error) throw error;
  return (data ?? []) as SearchUserResult[];
}
