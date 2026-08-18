import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { HoverPressable } from '@/components/HoverPressable';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

// 8-tooth gear silhouette with a circular hole cut via evenodd - drawn as a
// flat solid icon (not the wiry Unicode ⚙ glyph, which renders as a thin
// line-art character and looks inconsistent across platform fonts).
const GEAR_PATH =
  'M 44.47,21.53 L 41.99,8.77 L 58.01,8.77 L 55.53,21.53 A 29 29 0 0 1 66.22,25.96 L 66.22,25.96 L 73.49,15.18 L 84.82,26.51 L 74.04,33.78 A 29 29 0 0 1 78.47,44.47 L 78.47,44.47 L 91.23,41.99 L 91.23,58.01 L 78.47,55.53 A 29 29 0 0 1 74.04,66.22 L 74.04,66.22 L 84.82,73.49 L 73.49,84.82 L 66.22,74.04 A 29 29 0 0 1 55.53,78.47 L 55.53,78.47 L 58.01,91.23 L 41.99,91.23 L 44.47,78.47 A 29 29 0 0 1 33.78,74.04 L 33.78,74.04 L 26.51,84.82 L 15.18,73.49 L 25.96,66.22 A 29 29 0 0 1 21.53,55.53 L 21.53,55.53 L 8.77,58.01 L 8.77,41.99 L 21.53,44.47 A 29 29 0 0 1 25.96,33.78 L 25.96,33.78 L 15.18,26.51 L 26.51,15.18 L 33.78,25.96 A 29 29 0 0 1 44.47,21.53 Z M 50.00,34.00 A 16 16 0 1 0 50.00,66.00 A 16 16 0 1 0 50.00,34.00 Z';

function GearIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={GEAR_PATH} fillRule="evenodd" fill={color} />
    </Svg>
  );
}

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
  const { colors, border } = useTheme();

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
        <Image source={require('../../assets/images/movesletterlogo-trimmed.png')} style={styles.logo} resizeMode="contain" />
      </HoverPressable>
      <HoverPressable onPress={() => router.push('/settings')} style={styles.settingsButton} lightenOpacity={0.2}>
        <GearIcon size={21} color={colors.textSecondary} />
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
    width: 120,
    height: 24,
  },
  settingsButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
