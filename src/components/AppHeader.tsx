import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HoverPressable } from '@/components/HoverPressable';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useAuth } from '@/providers/AuthProvider';
import { borderWidth, color, font, spacing } from '@/theme/tokens';

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

  const goHome = () => {
    router.replace(session ? '/(tabs)' : '/(auth)/sign-in');
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
      <HoverPressable onPress={goHome} style={styles.logoWrap} lightenOpacity={0.08}>
        <Text style={styles.logo}>MOVES?</Text>
      </HoverPressable>
      <LanguageToggle />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    borderBottomWidth: borderWidth.base,
    borderBottomColor: color.border,
    backgroundColor: color.bg,
    // Beats the Stack's page content (the next sibling in _layout.tsx) in
    // paint order, so the LanguageToggle dropdown's overflow isn't covered.
    zIndex: 20,
  },
  logoWrap: {
    flexShrink: 1,
  },
  logo: {
    fontFamily: font.family.logo,
    fontSize: font.size.lg,
    color: color.textPrimary,
  },
});
