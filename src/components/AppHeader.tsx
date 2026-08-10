import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HoverPressable } from '@/components/HoverPressable';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Persistent brand bar shown above every screen. Tapping the wordmark
 * always returns to the signed-in home tab, or sign-in when signed out -
 * this is the app's only permanent "home" affordance, so it owns the top
 * safe-area inset (Screen no longer applies its own top edge).
 */
export function AppHeader() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, border, font } = useTheme();

  const goHome = () => {
    router.replace(session ? '/(tabs)' : '/(auth)/sign-in');
  };

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + 8,
          borderBottomWidth: border.rest.width,
          borderBottomColor: border.rest.color,
          backgroundColor: colors.bgElevated,
        },
      ]}
    >
      <HoverPressable onPress={goHome} style={styles.logoWrap} lightenOpacity={0.08}>
        <Text style={[styles.logo, { fontFamily: font.family.logo, color: colors.textPrimary }]}>MOVES?</Text>
      </HoverPressable>
      <HoverPressable onPress={() => router.push('/settings')} style={styles.settingsButton} lightenOpacity={0.2}>
        <Text style={[styles.settingsIcon, { color: colors.textSecondary }]}>⚙</Text>
      </HoverPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    // Beats the Stack's page content (the next sibling in _layout.tsx) in
    // paint order, so the LanguageToggle dropdown's overflow isn't covered.
    zIndex: 20,
  },
  logoWrap: {
    flexShrink: 1,
  },
  logo: {
    fontSize: 22,
    lineHeight: 24,
  },
  settingsButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 21,
  },
});
