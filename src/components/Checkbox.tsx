import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { useTheme } from '@/theme/ThemeProvider';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function Checkbox({ checked, onToggle, children }: CheckboxProps) {
  const { colors, border, font } = useTheme();

  return (
    <HoverPressable onPress={onToggle} style={styles.row} lightenOpacity={0.08}>
      <View
        style={[
          styles.box,
          {
            borderWidth: border.rest.width,
            borderColor: border.rest.color,
            backgroundColor: checked ? colors.brand : colors.well,
          },
        ]}
      >
        {checked ? <Text style={[styles.check, { color: colors.onAccent }]}>✓</Text> : null}
      </View>
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{children}</Text>
    </HoverPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  box: {
    width: 20,
    height: 20,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  check: {
    fontSize: 13,
    fontWeight: '800',
  },
  label: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
