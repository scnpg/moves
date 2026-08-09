import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function Checkbox({ checked, onToggle, children }: CheckboxProps) {
  return (
    <HoverPressable onPress={onToggle} style={styles.row} lightenOpacity={0.08}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.check}>✓</Text> : null}
      </View>
      <Text style={styles.label}>{children}</Text>
    </HoverPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  box: {
    width: 20,
    height: 20,
    marginTop: 1,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    borderRadius: radius.sm,
    backgroundColor: color.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  boxChecked: {
    backgroundColor: color.brand,
  },
  check: {
    color: color.textPrimary,
    fontSize: 13,
    fontWeight: font.weight.heavy,
  },
  label: {
    flex: 1,
    color: color.textMuted,
    fontSize: font.size.xs,
    lineHeight: font.size.xs * 1.6,
  },
});
