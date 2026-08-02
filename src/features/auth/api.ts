import { supabase } from '@/lib/supabase';

/** Returns whether the caller is now signed in - false means email confirmation is pending. */
export async function signUp(params: {
  email: string;
  password: string;
  username: string;
  displayName: string;
}): Promise<{ signedIn: boolean }> {
  const { email, password, username, displayName } = params;
  // handle_new_user() (supabase/migrations/20260801120100_profiles.sql) reads
  // these keys straight out of raw_user_meta_data to provision the profile row.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: displayName },
    },
  });
  if (error) throw error;
  return { signedIn: data.session != null };
}

export async function signIn(params: { email: string; password: string }) {
  const { error } = await supabase.auth.signInWithPassword(params);
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
