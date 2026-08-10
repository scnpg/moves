import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

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
  const { colors, border, font } = useTheme();

  return (
    <View style={[styles.track, { backgroundColor: colors.bgCard, borderWidth: border.rest.width, borderColor: border.rest.color }]}>
      {segments.map((segment, index) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => !segment.disabled && onChange(segment.value)}
            style={[
              styles.segment,
              index > 0 && { borderLeftWidth: border.soft.width, borderLeftColor: border.soft.color },
              { backgroundColor: active ? colors.border : segment.disabled ? colors.bgElevated : 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  fontFamily: font.family.monoBold,
                  color: active ? colors.textInverse : segment.disabled ? colors.textMuted : colors.textSecondary,
                },
              ]}
            >
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
    height: 44,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
});
