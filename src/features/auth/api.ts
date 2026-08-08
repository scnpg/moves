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
  referredBy?: string | null;
}): Promise<{ signedIn: boolean }> {
  const { email, password, username, displayName, referredBy } = params;
  // handle_new_user() (supabase/migrations/20260801120100_profiles.sql,
  // extended in 20260803140200_referrals.sql) reads these keys straight out
  // of raw_user_meta_data to provision the profile row. referred_by is the
  // referrer's own user id (see src/lib/links.ts referralSignUpUrl()) -
  // self-referral and invalid ids are silently dropped server-side.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: displayName, referred_by: referredBy ?? null },
      emailRedirectTo: emailRedirectTo(),
    },
  });
  if (error) throw error;
  return { signedIn: data.session != null };
}

/** Accepts either an email or a username in `identifier` - usernames are resolved to an email server-side before signing in. */
export async function signIn(params: { identifier: string; password: string }) {
  const { identifier, password } = params;
  let email = identifier;

  if (!identifier.includes('@')) {
    const { data, error } = await supabase.rpc('get_email_for_username', { p_username: identifier });
    if (error) throw error;
    // Matches Supabase's own "Invalid login credentials" wording so a
    // nonexistent username reads the same as a wrong password, rather than
    // confirming/denying the username exists.
    if (!data) throw new Error('Invalid login credentials');
    email = data;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
