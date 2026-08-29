import * as AppleAuthentication from 'expo-apple-authentication';

import { appOrigin } from '@/lib/links';
import { supabase } from '@/lib/supabase';

// Where a Supabase auth email's link redirects after verifying. Always a
// real, fully-qualified URL - appOrigin() already falls back to the
// deployed GitHub Pages site on native (there's no window there to
// resolve a "current origin" from), which matters more here than it did
// when this only handled signup confirmation: that flow works fine
// landing on the site root regardless of platform, but password reset
// needs to land specifically on /reset-password to be handled at all, so
// an unresolved redirect isn't an option the way plain `undefined` used
// to be.
function emailRedirectTo(path = ''): string {
  return `${appOrigin()}${path}`;
}

/** Returns whether the caller is now signed in - false means email confirmation is pending. */
export async function signUp(params: {
  email: string;
  password: string;
  username: string;
  displayName: string;
  /** Already hashed client-side (see src/lib/phone.ts hashPhone()) - the raw number never leaves the device. */
  phoneHash: string;
  referredBy?: string | null;
}): Promise<{ signedIn: boolean }> {
  const { email, password, username, displayName, phoneHash, referredBy } = params;
  // handle_new_user() (supabase/migrations/20260801120100_profiles.sql,
  // extended in 20260803140200_referrals.sql and 20260826090100_require_
  // phone_at_signup.sql) reads these keys straight out of
  // raw_user_meta_data to provision the profile row. referred_by is the
  // referrer's own user id (see src/lib/links.ts referralSignUpUrl()) -
  // self-referral and invalid ids are silently dropped server-side.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: displayName, phone_hash: phoneHash, referred_by: referredBy ?? null },
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

/**
 * Sends the "forgot password" email - the link inside it redirects to
 * /reset-password with a short-lived recovery session appended to the URL
 * (see that screen). Never reveals whether the address actually has an
 * account - Supabase returns success either way, and the UI should too
 * (same "don't confirm/deny" reasoning as signIn()'s username lookup
 * above), so this only ever throws on a genuine network/rate-limit error.
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: emailRedirectTo('/reset-password') });
  if (error) throw error;
}

/** Call once the recovery session from the emailed link is active (see /reset-password) - sets the new password on that same session. */
export async function confirmPasswordReset(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Native-only Sign in with Apple. Handles both sign-up and sign-in in one
 * flow - if there's no existing account for this Apple ID, GoTrue creates
 * one automatically (via handle_new_user(), same trigger the email/
 * password form goes through, so it lands on the exact same profile
 * shape). A brand-new account this way has no username/phone metadata to
 * give that trigger (Apple's identity token carries none of this app's
 * own fields), so it gets the placeholder username handle_new_user()
 * already falls back to either way - the root layout's existing
 * needsUsername gate gets them to complete-profile.tsx, which now also
 * collects phone in that same step. Configured server-side entirely
 * through the app's own Bundle ID as an authorized client (see
 * supabase/config.toml's [auth.external.apple]) - no Services ID or
 * signing key needed, since this is the native id-token flow, not the
 * web/OAuth-redirect one.
 *
 * Returns silently (no error) if the user dismisses the native sheet -
 * that's not a failure worth surfacing an alert for.
 */
export async function signInWithApple(): Promise<void> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ERR_REQUEST_CANCELED') return;
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Permanently deletes the caller's account: profile, Moves they host,
 * friendships, messages, and settings all cascade server-side (see
 * delete_my_account in supabase/migrations). Avatar files have no DB
 * foreign key to cascade from, so they're removed first via the real
 * Storage API - a plain SQL delete against storage.objects is rejected by
 * Supabase's own guard trigger.
 */
export async function deleteAccount(userId: string) {
  await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`]);
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  // 'local' only clears the client's own stored session - the account (and
  // any session/refresh-token rows for it) is already gone server-side, so
  // there's nothing left for a server-side logout call to revoke.
  await supabase.auth.signOut({ scope: 'local' });
}
