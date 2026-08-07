import type { TranslationKey } from '@/i18n/LocaleProvider';

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function formatWhen(startsAtIso: string, expiresAtIso: string, t: T): string {
  const starts = new Date(startsAtIso);
  const now = new Date();
  const sameDay = starts.toDateString() === now.toDateString();
  const time = starts.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (starts.getTime() <= now.getTime()) {
    const expires = new Date(expiresAtIso);
    if (expires.getTime() > now.getTime()) return t('common.time.happeningNow');
    return t('common.time.ended');
  }

  if (sameDay) return `${t('common.time.today')}, ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (starts.toDateString() === tomorrow.toDateString()) return `${t('common.time.tomorrow')}, ${time}`;

  return `${starts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}

export function formatDistance(meters: number | null | undefined, t: T): string | null {
  if (meters == null) return null;
  if (meters < 1000) return t('common.distanceMeters', { value: Math.round(meters) });
  return t('common.distanceKm', { value: (meters / 1000).toFixed(1) });
}

/** Short "2h 14m" style remaining-time, for card meta rows. */
export function formatTimeRemaining(targetIso: string, t: T): string {
  const remainingMs = new Date(targetIso).getTime() - Date.now();
  if (remainingMs <= 0) return t('common.time.ended').toLowerCase();

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const h = t('common.time.hourAbbrev');
  const m = t('common.time.minuteAbbrev');

  if (hours > 0) return `${hours}${h} ${minutes}${m}`;
  return `${minutes}${m}`;
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
