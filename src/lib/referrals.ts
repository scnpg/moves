import type { TranslationKey } from '@/i18n/LocaleProvider';

// Invite milestones that unlock the more exclusive Move visibility tiers -
// see get_referral_count() (supabase/migrations/20260803140200_referrals.sql),
// enforce_public_move_referral_gate() (supabase/migrations - the actual
// enforcement; this client-side gate is UX only), and the DEGREE_OPTIONS
// gating in src/app/room/create.tsx. Public is gated (not Private) because
// it's the tier anyone nearby can discover, so it's the one worth raising
// the bar on - Private (Link-Only) needs a link to find at all regardless
// of who's allowed to make one.
export const PUBLIC_UNLOCK_INVITES = 3;
export const CLOSE_FRIENDS_UNLOCK_INVITES = 5;

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function isPublicUnlocked(referralCount: number): boolean {
  return referralCount >= PUBLIC_UNLOCK_INVITES;
}

export function isCloseFriendsUnlocked(referralCount: number): boolean {
  return referralCount >= CLOSE_FRIENDS_UNLOCK_INVITES;
}

/** Short "2/3 invites - unlocks X" style progress label toward the next locked tier, or null once everything's unlocked. */
export function nextMilestoneLabel(referralCount: number, t: T): string | null {
  if (!isPublicUnlocked(referralCount)) {
    return t('common.milestoneProgress', {
      count: referralCount,
      max: PUBLIC_UNLOCK_INVITES,
      tier: t('degree.label.3'),
    });
  }
  if (!isCloseFriendsUnlocked(referralCount)) {
    return t('common.milestoneProgress', {
      count: referralCount,
      max: CLOSE_FRIENDS_UNLOCK_INVITES,
      tier: t('degree.label.4'),
    });
  }
  return null;
}
