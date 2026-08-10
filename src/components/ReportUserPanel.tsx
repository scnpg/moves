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
import { useTheme } from '@/theme/ThemeProvider';

const REASONS: ReportReason[] = ['spam', 'harassment', 'inappropriate_content', 'fake_profile', 'other'];

interface ReportUserPanelProps {
  userId: string;
  name: string;
  moveId?: string;
  onDone: () => void;
}

export function ReportUserPanel({ userId, name, moveId, onDone }: ReportUserPanelProps) {
  const { t } = useLocale();
  const { colors, border, font } = useTheme();
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
      <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>
        {moveId ? t('report.titleForMove') : t('report.title', { name })}
      </Text>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: font.family.monoBold }]}>
        {moveId ? t('report.reasonLabelForMove') : t('report.reasonLabel')}
      </Text>
      <View style={styles.chipRow}>
        {REASONS.map((r) => {
          const active = reason === r;
          return (
            <HoverPressable
              key={r}
              onPress={() => setReason(r)}
              style={[
                styles.chip,
                {
                  borderWidth: border.soft.width,
                  borderColor: active ? colors.border : border.soft.color,
                  backgroundColor: active ? colors.brandMuted : 'transparent',
                },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.textPrimary : colors.textSecondary, fontFamily: font.family.monoBold }]}>
                {t(`report.reason${toKey(r)}` as never)}
              </Text>
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
        <Button label={t('report.submit')} variant="destructive" onPress={handleSubmit} loading={submitting} style={styles.flexButton} />
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
    gap: 12,
  },
  title: {
    fontSize: 16,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 11,
    letterSpacing: 0.7,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  flexButton: {
    flex: 1,
  },
});
