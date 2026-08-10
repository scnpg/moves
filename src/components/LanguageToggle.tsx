import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { LOCALE_LABELS, LOCALE_SHORT_LABELS, SUPPORTED_LOCALES, useLocale, type Locale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/theme/ThemeProvider';

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
  const { colors, border, shadow, font } = useTheme();

  const handleSelect = (next: Locale) => {
    setLocale(next);
    setOpen(false);
  };

  return (
    <View>
      <HoverPressable
        onPress={() => setOpen((o) => !o)}
        style={[styles.button, { borderWidth: border.rest.width, borderColor: border.rest.color }]}
        lightenOpacity={0.2}
      >
        <Text style={[styles.buttonText, { color: colors.textSecondary, fontFamily: font.family.monoBold }]}>
          {LOCALE_SHORT_LABELS[locale]}
        </Text>
        <Text style={[styles.caret, { color: colors.textMuted }]}>{open ? '▴' : '▾'}</Text>
      </HoverPressable>

      {open ? (
        <>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.menu,
              { backgroundColor: colors.bgCard, borderWidth: border.rest.width, borderColor: border.rest.color, ...shadow.small },
            ]}
          >
            {SUPPORTED_LOCALES.map((loc) => {
              const active = loc === locale;
              return (
                <HoverPressable
                  key={loc}
                  onPress={() => handleSelect(loc)}
                  style={[styles.menuItem, active && { backgroundColor: colors.brandMuted }]}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      { color: colors.textPrimary, fontFamily: active ? font.family.bodySemibold : font.family.bodyRegular },
                    ]}
                  >
                    {LOCALE_LABELS[loc]}
                  </Text>
                  {active ? <Text style={[styles.check, { color: colors.brand }]}>✓</Text> : null}
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
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  buttonText: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  caret: {
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
    marginTop: 4,
    width: 180,
    overflow: 'hidden',
    zIndex: 11,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    // CJK labels (e.g. "繁體中文") can wrap character-by-character if the
    // row is allowed to shrink below their natural width.
    ...Platform.select({ web: { whiteSpace: 'nowrap' } as object, default: {} }),
  },
  check: {
    fontWeight: '700',
  },
});
