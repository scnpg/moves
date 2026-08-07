import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

interface Segment<T extends string> {
  value: T;
  label: string;
  /** Locked behind a milestone (e.g. referral count) - shown greyed out with a lock glyph, taps ignored. */
  disabled?: boolean;
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
      {segments.map((segment, index) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => !segment.disabled && onChange(segment.value)}
            style={[
              styles.segment,
              index > 0 && styles.segmentDivider,
              active && styles.segmentActive,
              segment.disabled && styles.segmentDisabled,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive, segment.disabled && styles.labelDisabled]}>
              {segment.disabled ? '🔒 ' : ''}
              {segment.label.toUpperCase()}
            </Text>
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
    borderRadius: radius.sm,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  segmentDivider: {
    borderLeftWidth: borderWidth.base,
    borderLeftColor: color.border,
  },
  segmentActive: {
    backgroundColor: color.border,
  },
  segmentDisabled: {
    backgroundColor: color.bgElevated,
  },
  label: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  labelActive: {
    color: color.textInverse,
  },
  labelDisabled: {
    color: color.textMuted,
  },
});
