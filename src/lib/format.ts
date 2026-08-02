export function formatWhen(startsAtIso: string, expiresAtIso: string): string {
  const starts = new Date(startsAtIso);
  const now = new Date();
  const sameDay = starts.toDateString() === now.toDateString();
  const time = starts.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (starts.getTime() <= now.getTime()) {
    const expires = new Date(expiresAtIso);
    if (expires.getTime() > now.getTime()) return 'Happening now';
    return 'Ended';
  }

  if (sameDay) return `Today, ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (starts.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;

  return `${starts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}

export function formatDistance(meters: number | null | undefined): string | null {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.round(meters)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

/** Short "2h 14m" style remaining-time, for card meta rows. */
export function formatTimeRemaining(targetIso: string): string {
  const remainingMs = new Date(targetIso).getTime() - Date.now();
  if (remainingMs <= 0) return 'ended';

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatCountdown(targetIso: string): string {
  const remainingMs = new Date(targetIso).getTime() - Date.now();
  if (remainingMs <= 0) return '0:00';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
