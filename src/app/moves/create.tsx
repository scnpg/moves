import { useState } from 'react';
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
import { createMove } from '@/features/moves/api';
import { confirmAction, notify } from '@/lib/alerts';
import type { DegreeLimit } from '@/lib/database.types';
import { nextOccurrenceOf, timeAfter, timeString } from '@/lib/time';
import { useAuth } from '@/providers/AuthProvider';
import { color, degreeDescription, font, spacing } from '@/theme/tokens';

const DURATION_OPTIONS = [
  { value: '1', label: '1 hr' },
  { value: '2', label: '2 hrs' },
  { value: '4', label: '4 hrs' },
  { value: '6', label: '6 hrs' },
] as const;

const END_MODE_OPTIONS = [
  { value: 'duration', label: 'Duration' },
  { value: 'time', label: 'End time' },
] as const;

const DEGREE_OPTIONS = [
  { value: '1', label: 'Friends' },
  { value: '2', label: 'Friends of friends' },
  { value: '3', label: 'Open' },
];

export default function CreateMoveScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [degreeLimit, setDegreeLimit] = useState<DegreeLimit>(3);
  const [startTime, setStartTime] = useState(() => timeString(new Date()));
  const [endMode, setEndMode] = useState<(typeof END_MODE_OPTIONS)[number]['value']>('duration');
  const [durationHours, setDurationHours] = useState<(typeof DURATION_OPTIONS)[number]['value']>('2');
  const [endTime, setEndTime] = useState(() => timeString(new Date(Date.now() + 2 * 60 * 60_000)));
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [maxMembers, setMaxMembers] = useState('');
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasUnsavedInput =
    title.trim() !== '' ||
    description.trim() !== '' ||
    maxMembers.trim() !== '' ||
    requiresApproval ||
    location != null;

  const handleClose = async () => {
    if (hasUnsavedInput) {
      const confirmed = await confirmAction(
        'Discard this Move?',
        "You've filled out some details - going back will lose them.",
        'Discard'
      );
      if (!confirmed) return;
    }
    router.back();
  };

  const handleCreate = async () => {
    if (!session?.user) return;
    if (!title.trim()) {
      notify('Title required', 'Give your Move a title.');
      return;
    }

    const parsedMax = maxMembers.trim() ? Number(maxMembers) : null;
    if (parsedMax != null && (!Number.isInteger(parsedMax) || parsedMax <= 0)) {
      notify('Invalid cap', 'Max members must be a positive whole number.');
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
      router.replace(`/moves/${move.id}`);
    } catch (err) {
      notify('Could not create Move', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <SubHeader title="New Move" onBack={handleClose} variant="close" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Tacos at 8 PM" />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional details"
          multiline
        />

        <TimeField label="Starts" value={startTime} onChange={setStartTime} />

        <View style={styles.field}>
          <Text style={styles.label}>Ends</Text>
          <SegmentedControl segments={END_MODE_OPTIONS} value={endMode} onChange={setEndMode} />
          {endMode === 'duration' ? (
            <SegmentedControl segments={DURATION_OPTIONS} value={durationHours} onChange={setDurationHours} />
          ) : (
            <TimeField label="End time" value={endTime} onChange={setEndTime} />
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Who can see & join</Text>
          <SegmentedControl
            segments={DEGREE_OPTIONS}
            value={String(degreeLimit)}
            onChange={(v) => setDegreeLimit(Number(v) as DegreeLimit)}
          />
          <Text style={styles.helperText}>{degreeDescription[degreeLimit]}</Text>
        </View>

        <Card style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Require approval to join</Text>
              <Text style={styles.helperText}>
                Requests land in your approval queue instead of joining instantly.
              </Text>
            </View>
            <Switch value={requiresApproval} onValueChange={setRequiresApproval} trackColor={{ true: color.brand, false: color.border }} />
          </View>
        </Card>

        <TextField
          label="Max people (optional)"
          value={maxMembers}
          onChangeText={setMaxMembers}
          placeholder="No cap"
          keyboardType="number-pad"
        />

        <View style={styles.field}>
          <Text style={styles.label}>Location (optional)</Text>
          <Text style={styles.helperText}>
            {degreeLimit === 1
              ? 'Exact location is visible once someone joins.'
              : 'Exact location stays hidden until someone joins or is approved.'}
          </Text>
          <LocationPicker value={location} onChange={setLocation} />
        </View>

        <Button label="Create Move" onPress={handleCreate} loading={submitting} />
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
