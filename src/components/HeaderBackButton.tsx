import { Text } from 'react-native';
import { useRouter } from 'expo-router';

import { HoverPressable } from '@/components/HoverPressable';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Custom headerLeft for screens using the native Stack.Screen header
 * (headerShown: true) - bypasses native-stack's own back-button title
 * entirely rather than fighting it via headerBackTitle/headerBackButtonDisplayMode,
 * which don't reliably suppress the previous route's title on this version
 * (headerBackTitle: '' is silently ignored, and headerBackButtonDisplayMode
 * triggers a native-stack modal-header remount loop). Matches the plain "‹"
 * used by the app's own SubHeader on every other pushed screen.
 */
export function HeaderBackButton() {
  const router = useRouter();
  const { colors, font } = useTheme();

  return (
    <HoverPressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
      lightenOpacity={0.08}
    >
      <Text style={{ fontSize: 22, lineHeight: 26, color: colors.textPrimary, fontFamily: font.family.monoBold }}>‹</Text>
    </HoverPressable>
  );
}
