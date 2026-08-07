import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LocationPicker, type LocationValue } from '@/components/LocationPicker';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SubHeader } from '@/components/SubHeader';
import { TextField } from '@/components/TextField';
import { TimeField } from '@/components/TimeField';
import { getReferralCount } from '@/features/friends/api';
import { createMove } from '@/features/moves/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { confirmAction, notify } from '@/lib/alerts';
import type { DegreeLimit } from '@/lib/database.types';
import { isCloseFriendsUnlocked, isPrivateUnlocked, nextMilestoneLabel } from '@/lib/referrals';
import { nextOccurrenceOf, timeAfter, timeString } from '@/lib/time';
import { useAuth } from '@/providers/AuthProvider';
import { color, font, spacing } from '@/theme/tokens';

const DURATION_VALUES = ['1', '2', '4', '6'] as const;
const END_MODE_VALUES = ['duration', 'time'] as const;

export default function CreateMoveScreen() {
  const { session } = useAuth();
  const { t } = useLocale();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [degreeLimit, setDegreeLimit] = useState<DegreeLimit>(3);
  const [startTime, setStartTime] = useState(() => timeString(new Date()));
  const [endMode, setEndMode] = useState<(typeof END_MODE_VALUES)[number]>('duration');
  const [durationHours, setDurationHours] = useState<(typeof DURATION_VALUES)[number]>('2');
  const [endTime, setEndTime] = useState(() => timeString(new Date(Date.now() + 2 * 60 * 60_000)));
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [maxMembers, setMaxMembers] = useState('');
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [referralCount, setReferralCount] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    getReferralCount(session.user.id)
      .then(setReferralCount)
      .catch(() => setReferralCount(0));
  }, [session?.user]);

  const privateLocked = !isPrivateUnlocked(referralCount ?? 0);
  const closeFriendsLocked = !isCloseFriendsUnlocked(referralCount ?? 0);

  const DURATION_OPTIONS = [
    { value: '1', label: t('createMove.oneHour') },
    { value: '2', label: t('createMove.twoHours') },
    { value: '4', label: t('createMove.fourHours') },
    { value: '6', label: t('createMove.sixHours') },
  ] as const;

  const END_MODE_OPTIONS = [
    { value: 'duration', label: t('createMove.duration') },
    { value: 'time', label: t('createMove.endTime') },
  ] as const;

  const DEGREE_OPTIONS = [
    { value: '4', label: t('createMove.closeFriendsOption'), disabled: closeFriendsLocked },
    { value: '1', label: t('createMove.friendsOption') },
    { value: '2', label: t('createMove.mutualsOption') },
    { value: '3', label: t('createMove.openOption') },
    { value: '0', label: t('createMove.privateOption'), disabled: privateLocked },
  ] as const;

  const hasUnsavedInput =
    title.trim() !== '' ||
    description.trim() !== '' ||
    maxMembers.trim() !== '' ||
    requiresApproval ||
    location != null;

  const handleClose = async () => {
    if (hasUnsavedInput) {
      const confirmed = await confirmAction(
        t('createMove.discardTitle'),
        t('createMove.discardMessage'),
        t('createMove.discard')
      );
      if (!confirmed) return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleCreate = async () => {
    if (!session?.user) return;
    if (!title.trim()) {
      notify(t('createMove.titleRequired'), t('createMove.giveTitle'));
      return;
    }

    const parsedMax = maxMembers.trim() ? Number(maxMembers) : null;
    if (parsedMax != null && (!Number.isInteger(parsedMax) || parsedMax <= 0)) {
      notify(t('createMove.invalidCap'), t('createMove.maxMembersError'));
      return;
    }

    // A time in the past means "tomorrow" - Moves are same-day/spontaneous,
    // there's no separate date picker.
    const startsAt = nextOccurrenceOf(startTime);
    const expiresAt =
      endMode === 'duration'
        ? new Date(startsAt.getTime() + Number(durationHours) * 60 * 60_000)
        : timeAfter(endTime, startsAt, startsAt);

    setSubmitting(true);
    try {
      const move = await createMove({
        hostId: session.user.id,
        title: title.trim(),
        description: description.trim() || null,
        degreeLimit,
        requiresApproval,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        maxMembers: parsedMax,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      });
      router.replace(`/room/${move.id}`);
    } catch (err) {
      notify(t('createMove.couldNotCreate'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <SubHeader title={t('createMove.newMove')} onBack={handleClose} variant="close" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField label={t('createMove.titleLabel')} value={title} onChangeText={setTitle} placeholder={t('createMove.titlePlaceholder')} />
        <TextField
          label={t('createMove.descriptionLabel')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('createMove.descriptionPlaceholder')}
          multiline
        />

        <TimeField label={t('createMove.starts')} value={startTime} onChange={setStartTime} />

        <View style={styles.field}>
          <Text style={styles.label}>{t('createMove.ends')}</Text>
          <SegmentedControl segments={END_MODE_OPTIONS} value={endMode} onChange={setEndMode} />
          {endMode === 'duration' ? (
            <SegmentedControl segments={DURATION_OPTIONS} value={durationHours} onChange={setDurationHours} />
          ) : (
            <TimeField label={t('createMove.endTime')} value={endTime} onChange={setEndTime} />
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('createMove.whoCanSeeJoin')}</Text>
          <SegmentedControl
            segments={DEGREE_OPTIONS}
            value={String(degreeLimit)}
            onChange={(v) => setDegreeLimit(Number(v) as DegreeLimit)}
          />
          <Text style={styles.helperText}>{t(`degree.description.${degreeLimit}`)}</Text>
          {nextMilestoneLabel(referralCount ?? 0, t) ? (
            <Text style={styles.helperText}>{t('createMove.progress', { label: nextMilestoneLabel(referralCount ?? 0, t)! })}</Text>
          ) : null}
        </View>

        <Card style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>{t('createMove.requireApproval')}</Text>
              <Text style={styles.helperText}>{t('createMove.requireApprovalHelp')}</Text>
            </View>
            <Switch value={requiresApproval} onValueChange={setRequiresApproval} trackColor={{ true: color.brand, false: color.border }} />
          </View>
        </Card>

        <TextField
          label={t('createMove.maxPeopleLabel')}
          value={maxMembers}
          onChangeText={setMaxMembers}
          placeholder={t('createMove.noCap')}
          keyboardType="number-pad"
        />

        <View style={styles.field}>
          <Text style={styles.label}>{t('createMove.locationLabel')}</Text>
          <Text style={styles.helperText}>
            {degreeLimit === 1 ? t('createMove.locationVisibleFriends') : t('createMove.locationHiddenUntilApproved')}
          </Text>
          <LocationPicker value={location} onChange={setLocation} />
        </View>

        <Button label={t('createMove.createButton')} onPress={handleCreate} loading={submitting} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
    textTransform: 'uppercase',
  },
  helperText: {
    color: color.textMuted,
    fontSize: font.size.xs,
  },
  toggleCard: {
    gap: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    color: color.textPrimary,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
});
