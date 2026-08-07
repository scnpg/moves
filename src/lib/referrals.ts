// Invite milestones that unlock the more exclusive Move visibility tiers -
// see get_referral_count() (supabase/migrations/20260803140200_referrals.sql)
// and the DEGREE_OPTIONS gating in src/app/room/create.tsx.
export const PRIVATE_UNLOCK_INVITES = 3;
export const CLOSE_FRIENDS_UNLOCK_INVITES = 5;

export function isPrivateUnlocked(referralCount: number): boolean {
  return referralCount >= PRIVATE_UNLOCK_INVITES;
}

export function isCloseFriendsUnlocked(referralCount: number): boolean {
  return referralCount >= CLOSE_FRIENDS_UNLOCK_INVITES;
}

/** Short "2/3 Invites" style progress label toward the next locked tier, or null once everything's unlocked. */
export function nextMilestoneLabel(referralCount: number): string | null {
  if (!isPrivateUnlocked(referralCount)) {
    return `${referralCount}/${PRIVATE_UNLOCK_INVITES} invites - unlocks Private (Link-Only)`;
  }
  if (!isCloseFriendsUnlocked(referralCount)) {
    return `${referralCount}/${CLOSE_FRIENDS_UNLOCK_INVITES} invites - unlocks Close Friends`;
  }
  return null;
}
