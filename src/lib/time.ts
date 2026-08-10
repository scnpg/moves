/** "HH:MM" (24-hour) for the given moment - the format <input type="time"> uses. */
export function timeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// The Starts field defaults to "now" (to the minute) when the create-move
// form mounts, but a user can easily take a few minutes to fill out the
// rest of the form without touching it. Without slack, that innocuous
// delay makes the picked time look "already passed" and silently rolls
// the whole Move to tomorrow. Tolerating recent-past times as "still
// today" avoids that surprise while still rolling a genuinely past time
// (e.g. picking 9am at 3pm) to the next occurrence.
const PAST_TOLERANCE_MS = 15 * 60_000;

/** Combines "HH:MM" with `from`'s date, rolling to tomorrow only if that moment is more than PAST_TOLERANCE_MS in the past. */
export function nextOccurrenceOf(hhmm: string, from: Date = new Date()): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const candidate = new Date(from);
  candidate.setHours(h, m, 0, 0);
  if (candidate.getTime() < from.getTime() - PAST_TOLERANCE_MS) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

/** Combines "HH:MM" with `date`'s year/month/day - for an explicitly picked date rather than "next occurrence from now". */
export function combineDateAndTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(h, m, 0, 0);
  return combined;
}
