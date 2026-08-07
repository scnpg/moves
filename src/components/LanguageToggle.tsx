import { StyleSheet, Text } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { LOCALE_SHORT_LABELS, SUPPORTED_LOCALES, useLocale } from '@/i18n/LocaleProvider';
import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

/** Compact cycle-through toggle (EN -> ES -> 中 -> EN...) - three options is few enough that a picker menu would be overkill. */
export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  const cycleLocale = () => {
    const index = SUPPORTED_LOCALES.indexOf(locale);
    setLocale(SUPPORTED_LOCALES[(index + 1) % SUPPORTED_LOCALES.length]);
  };

  return (
    <HoverPressable onPress={cycleLocale} style={styles.button} lightenOpacity={0.2}>
      <Text style={styles.text}>{LOCALE_SHORT_LABELS[locale]}</Text>
    </HoverPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 30,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.borderSubtle,
    alignItems: 'center',
  },
  text: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
});
