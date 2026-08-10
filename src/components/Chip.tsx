import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type ChipVariant = 'default' | 'selected' | 'live';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  onPress?: () => void;
}

export function Chip({ label, variant = 'default', onPress }: ChipProps) {
  const { colors, borderWidth, font } = useTheme();

  const bg = variant === 'selected' ? colors.border : variant === 'live' ? colors.accentGreenFlat : colors.bgCard;
  const fg = variant === 'selected' ? colors.textInverse : variant === 'live' ? colors.onAccent : colors.textPrimary;

  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderWidth: borderWidth.structural,
          borderColor: colors.border,
          paddingLeft: variant === 'live' ? 10 : 12,
          gap: variant === 'live' ? 6 : 0,
        },
      ]}
    >
      {variant === 'live' ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <Text style={[styles.label, { color: fg, fontFamily: font.family.monoBold }]}>{label.toUpperCase()}</Text>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 28,
    borderRadius: 999,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
});
