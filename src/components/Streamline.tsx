import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * Faint radiating-line backdrop, nodding to the Mexico '68 Olympics optical
 * line work (Lance Wyman) without literally reproducing it. Meant to sit
 * BEHIND a headline in otherwise-empty space, at low enough opacity that it
 * reads as texture rather than pattern - reduce, don't rave. Web-only: a
 * decorative no-op elsewhere.
 */
export function SunburstBackdrop({ color: lineColor }: { color?: string }) {
  const { colors } = useTheme();
  if (Platform.OS !== 'web') return null;

  return (
    <View pointerEvents="none" style={styles.fill}>
      <View
        style={
          {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 900,
            height: 900,
            marginLeft: -450,
            marginTop: -450,
            borderRadius: 450,
            opacity: 0.05,
            backgroundImage: `repeating-conic-gradient(${lineColor ?? colors.border} 0deg 1deg, transparent 1deg 12deg)`,
          } as object
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
