import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { supabase } from '@/lib/supabase';

// The confirmation email's link redirects here after verifying - same
// origin the signup happened from (so local dev links go back to
// localhost, and real users land back on the deployed site). The app's
// base path (experiments.baseUrl in app.json) only applies to the static
// `expo export` build GitHub Pages serves - the local dev server always
// serves from "/", regardless of that setting.
function emailRedirectTo(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalDev) return window.location.origin;
  const baseUrl = Constants.expoConfig?.experiments?.baseUrl ?? '';
  return `${window.location.origin}${baseUrl}`;
}

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
      emailRedirectTo: emailRedirectTo(),
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
