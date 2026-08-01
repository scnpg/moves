import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, font, radius, spacing } from '@/theme/tokens';

interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{segment.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: color.bgCard,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: color.border,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: color.brand,
  },
  label: {
    color: color.textSecondary,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  labelActive: {
    color: color.textInverse,
  },
});
