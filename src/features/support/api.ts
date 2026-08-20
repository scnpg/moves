import { supabase } from '@/lib/supabase';

export async function submitSupportRequest(title: string, message: string) {
  const { error } = await supabase.rpc('submit_support_request', { p_title: title, p_message: message });
  if (error) throw error;
}
