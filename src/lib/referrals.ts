import type { TranslationKey } from '@/i18n/LocaleProvider';

// Invite milestones that unlock the more exclusive Move visibility tiers -
// see get_referral_count() (supabase/migrations/20260803140200_referrals.sql)
// and the DEGREE_OPTIONS gating in src/app/room/create.tsx.
export const PRIVATE_UNLOCK_INVITES = 3;
export const CLOSE_FRIENDS_UNLOCK_INVITES = 5;

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function isPrivateUnlocked(referralCount: number): boolean {
  return referralCount >= PRIVATE_UNLOCK_INVITES;
}

export function isCloseFriendsUnlocked(referralCount: number): boolean {
  return referralCount >= CLOSE_FRIENDS_UNLOCK_INVITES;
}

/** Short "2/3 invites - unlocks X" style progress label toward the next locked tier, or null once everything's unlocked. */
export function nextMilestoneLabel(referralCount: number, t: T): string | null {
  if (!isPrivateUnlocked(referralCount)) {
    return t('common.milestoneProgress', {
      count: referralCount,
      max: PRIVATE_UNLOCK_INVITES,
      tier: t('degree.label.0'),
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
