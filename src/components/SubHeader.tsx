import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { borderWidth, color, font, spacing } from '@/theme/tokens';

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
  return (
    <View style={styles.row}>
      <HoverPressable onPress={onBack} style={styles.iconButton}>
        <Text style={styles.icon}>{variant === 'close' ? '×' : '‹'}</Text>
      </HoverPressable>
      <Text style={styles.title} numberOfLines={1}>
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
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: borderWidth.base,
    borderBottomColor: color.border,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  icon: {
    color: color.textPrimary,
    fontSize: 22,
    fontWeight: font.weight.heavy,
    lineHeight: 24,
  },
  title: {
    flex: 1,
    color: color.textPrimary,
    fontSize: font.size.md,
    fontWeight: font.weight.heavy,
    textAlign: 'center',
  },
});
