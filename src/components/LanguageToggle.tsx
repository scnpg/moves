import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { LOCALE_LABELS, LOCALE_SHORT_LABELS, SUPPORTED_LOCALES, useLocale, type Locale } from '@/i18n/LocaleProvider';
import { borderWidth, color, font, radius, shadow, spacing } from '@/theme/tokens';

/**
 * Compact button showing the current language; tapping it opens a small
 * menu to pick any of SUPPORTED_LOCALES directly, rather than cycling
 * through them blind. The backdrop is an oversized invisible Pressable
 * (not a real full-screen overlay - this component has no portal to escape
 * into) centered on the button, which is enough to catch "tap anywhere
 * else to dismiss" on any real viewport.
 */
export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  const handleSelect = (next: Locale) => {
    setLocale(next);
    setOpen(false);
  };

  return (
    <View>
      <HoverPressable onPress={() => setOpen((o) => !o)} style={styles.button} lightenOpacity={0.2}>
        <Text style={styles.buttonText}>{LOCALE_SHORT_LABELS[locale]}</Text>
        <Text style={styles.caret}>{open ? '▴' : '▾'}</Text>
      </HoverPressable>

      {open ? (
        <>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.menu}>
            {SUPPORTED_LOCALES.map((loc) => {
              const active = loc === locale;
              return (
                <HoverPressable
                  key={loc}
                  onPress={() => handleSelect(loc)}
                  style={[styles.menuItem, active && styles.menuItemActive]}
                >
                  <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>{LOCALE_LABELS[loc]}</Text>
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </HoverPressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 30,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.borderSubtle,
  },
  buttonText: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  caret: {
    color: color.textMuted,
    fontSize: 9,
  },
  backdrop: {
    position: 'absolute',
    top: -2000,
    left: -2000,
    width: 4000,
    height: 4000,
    zIndex: 10,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: spacing.xxs,
    minWidth: 160,
    backgroundColor: color.bgCard,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    zIndex: 11,
    ...shadow.small,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  menuItemActive: {
    backgroundColor: color.brandMuted,
  },
  menuItemText: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: font.size.sm,
  },
  menuItemTextActive: {
    fontWeight: font.weight.bold,
  },
  check: {
    color: color.brand,
    fontWeight: font.weight.bold,
  },
});
