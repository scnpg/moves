import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { createMove } from '@/features/moves/api';
import type { DegreeLimit } from '@/lib/database.types';
import { useUserLocation } from '@/lib/useLocation';
import { useAuth } from '@/providers/AuthProvider';
import { color, degreeDescription, font, spacing } from '@/theme/tokens';

const START_OPTIONS = [
  { value: '0', label: 'Now' },
  { value: '30', label: 'In 30 min' },
  { value: '60', label: 'In 1 hour' },
] as const;

const DURATION_OPTIONS = [
  { value: '1', label: '1 hr' },
  { value: '2', label: '2 hrs' },
  { value: '4', label: '4 hrs' },
  { value: '6', label: '6 hrs' },
] as const;

const DEGREE_OPTIONS = [
  { value: '1', label: 'Friends' },
  { value: '2', label: 'Friends of friends' },
  { value: '3', label: 'Open' },
];

export default function CreateMoveScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { coords } = useUserLocation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [degreeLimit, setDegreeLimit] = useState<DegreeLimit>(3);
  const [startsInMinutes, setStartsInMinutes] = useState<(typeof START_OPTIONS)[number]['value']>('0');
  const [durationHours, setDurationHours] = useState<(typeof DURATION_OPTIONS)[number]['value']>('2');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [maxMembers, setMaxMembers] = useState('');
  const [useLocation, setUseLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!session?.user) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your Move a title.');
      return;
    }
    if (useLocation && !coords) {
      Alert.alert('Location unavailable', 'We could not get your location. Try again or turn off location.');
      return;
    }

    const parsedMax = maxMembers.trim() ? Number(maxMembers) : null;
    if (parsedMax != null && (!Number.isInteger(parsedMax) || parsedMax <= 0)) {
      Alert.alert('Invalid cap', 'Max members must be a positive whole number.');
      return;
    }

    const startsAt = new Date(Date.now() + Number(startsInMinutes) * 60_000);
    const expiresAt = new Date(startsAt.getTime() + Number(durationHours) * 60 * 60_000);

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
        lat: useLocation ? coords?.lat ?? null : null,
        lng: useLocation ? coords?.lng ?? null : null,
      });
      router.replace(`/moves/${move.id}`);
    } catch (err) {
      Alert.alert('Could not create Move', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'New Move',
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.textPrimary,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Tacos at 8 PM" />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional details"
          multiline
        />

        <View style={styles.field}>
          <Text style={styles.label}>Starts</Text>
          <SegmentedControl segments={START_OPTIONS} value={startsInMinutes} onChange={setStartsInMinutes} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Duration</Text>
          <SegmentedControl segments={DURATION_OPTIONS} value={durationHours} onChange={setDurationHours} />
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

        <Card style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Share my location</Text>
              <Text style={styles.helperText}>
                {degreeLimit === 1
                  ? 'Exact location is visible once someone joins.'
                  : 'Exact location stays hidden until someone joins or is approved.'}
              </Text>
            </View>
            <Switch value={useLocation} onValueChange={setUseLocation} trackColor={{ true: color.brand, false: color.border }} />
          </View>
        </Card>

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
    color: color.textSecondary,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
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
    fontWeight: font.weight.medium,
  },
});
