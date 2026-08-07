import { useState } from 'react';

import { TextField } from '@/components/TextField';
import { useLocale } from '@/i18n/LocaleProvider';

interface TimeFieldProps {
  label: string;
  value: string; // "HH:MM", 24-hour
  onChange: (value: string) => void;
}

function to12Hour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function parse12Hour(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (h > 23 || m > 59) return null;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * No native time picker library wired up yet (see TimeField.web.tsx for
 * the real <input type="time"> used on web) - falls back to free text
 * entry with lightweight "8:00 PM" parsing.
 */
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const { t } = useLocale();
  const [text, setText] = useState(() => (value ? to12Hour(value) : ''));

  const handleBlur = () => {
    const parsed = parse12Hour(text);
    if (parsed) onChange(parsed);
  };

  return (
    <TextField
      label={label}
      value={text}
      onChangeText={setText}
      onBlur={handleBlur}
      placeholder={t('common.timePlaceholder')}
    />
  );
}
