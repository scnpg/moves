import type { EligibleMove } from '@/lib/database.types';

/** Presentational status for a Move card/detail header - not the raw DB status. */
export type MoveCardStatus = 'live' | 'starting' | 'ending' | 'full' | 'ended';

/** A live Move showing under this many ms remaining reads as "ending soon". */
const ENDING_SOON_MS = 15 * 60_000;

export function deriveMoveStatus(move: Pick<EligibleMove, 'status' | 'starts_at' | 'expires_at' | 'is_full'>): MoveCardStatus {
  const now = Date.now();
  const starts = new Date(move.starts_at).getTime();
  const expires = new Date(move.expires_at).getTime();

  if (move.status !== 'active' || now >= expires) return 'ended';
  if (now < starts) return 'starting';
  if (move.is_full) return 'full';
  if (expires - now <= ENDING_SOON_MS) return 'ending';
  return 'live';
}

/** ISO timestamp the countdown should count down to, given the derived status. */
export function countdownTargetFor(status: MoveCardStatus, move: Pick<EligibleMove, 'starts_at' | 'expires_at'>): string {
  return status === 'starting' ? move.starts_at : move.expires_at;
}
