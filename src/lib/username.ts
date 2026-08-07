export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// handle_new_user() (supabase/migrations/20260803140200_referrals.sql)
// falls back to this pattern when a signup carries no username metadata -
// which is exactly what a phone-first signup looks like, since there's no
// profile-info step before OTP verification. Used to detect "brand new
// account that still needs a real username" regardless of how it was created.
export const AUTO_USERNAME_PATTERN = /^user_[0-9a-f]{8}$/;

export function isPlaceholderUsername(username: string | null | undefined): boolean {
  return !!username && AUTO_USERNAME_PATTERN.test(username);
}
