import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HoverPressable } from '@/components/HoverPressable';
import { TextField } from '@/components/TextField';
import { reportUser } from '@/features/blocking/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import type { ReportReason } from '@/lib/database.types';
import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

const REASONS: ReportReason[] = ['spam', 'harassment', 'inappropriate_content', 'fake_profile', 'other'];

interface ReportUserPanelProps {
  userId: string;
  name: string;
  moveId?: string;
  onDone: () => void;
}

export function ReportUserPanel({ userId, name, moveId, onDone }: ReportUserPanelProps) {
  const { t } = useLocale();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      notify(t('report.pickReasonFirst'), t('report.pickReasonFirstMessage'));
      return;
    }
    setSubmitting(true);
    try {
      await reportUser({ userId, reason, details, moveId });
      notify(t('report.submitted'), t('report.submittedMessage'));
      onDone();
    } catch (err) {
      notify(t('report.couldNotSubmit'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('report.title', { name })}</Text>
      <Text style={styles.label}>{t('report.reasonLabel')}</Text>
      <View style={styles.chipRow}>
        {REASONS.map((r) => {
          const active = reason === r;
          return (
            <HoverPressable key={r} onPress={() => setReason(r)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`report.reason${toKey(r)}` as never)}</Text>
            </HoverPressable>
          );
        })}
      </View>
      <TextField
        value={details}
        onChangeText={setDetails}
        placeholder={t('report.detailsPlaceholder')}
        multiline
        maxLength={1000}
      />
      <View style={styles.actions}>
        <Button label={t('report.cancel')} variant="secondary" onPress={onDone} style={styles.flexButton} />
        <Button label={t('report.submit')} variant="danger" onPress={handleSubmit} loading={submitting} style={styles.flexButton} />
      </View>
    </Card>
  );
}

function toKey(reason: ReportReason): string {
  return reason
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  title: {
    color: color.textPrimary,
    fontSize: font.size.md,
    fontWeight: font.weight.heavy,
  },
  label: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.borderSubtle,
  },
  chipActive: {
    backgroundColor: color.brandMuted,
    borderColor: color.border,
  },
  chipText: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
  },
  chipTextActive: {
    color: color.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  flexButton: {
    flex: 1,
  },
});
