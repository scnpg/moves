import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { useTheme } from '@/theme/ThemeProvider';

/** Screen-local title row with a back ("‹") or close ("×") control, used below AppHeader on screens pushed from a tab (Create Move, Move Room). */
export function SubHeader({
  title,
  onBack,
  variant = 'back',
  right,
}: {
  title: string;
  onBack: () => void;
  variant?: 'back' | 'close';
  right?: ReactNode;
}) {
  const { colors, border, font } = useTheme();

  return (
    <View style={[styles.row, { borderBottomWidth: border.rest.width, borderBottomColor: border.rest.color }]}>
      <HoverPressable onPress={onBack} style={styles.iconButton} lightenOpacity={0.08}>
        <Text style={[styles.icon, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
          {variant === 'close' ? '×' : '‹'}
        </Text>
      </HoverPressable>
      <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]} numberOfLines={1}>
        {title}
      </Text>
      {right ?? <View style={styles.iconButton} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
    lineHeight: 24,
  },
  title: {
    flex: 1,
    fontSize: 16,
    textAlign: 'center',
  },
});
