// Hand-rolled design tokens. No NativeWind / no UI kit - every screen in
// this app styles itself with StyleSheet.create() against these values.
//
// Look: "Energetic Brutalist" - white paper, near-black ink, thick hard
// borders, sharp corners, flat saturated accent colors, no soft shadows.
// Type: Danfo (bundled, assets/fonts/Danfo-Regular.ttf) is reserved for
// the "MOVES?" wordmark only. Everything else uses bold system grotesk for
// headlines and a monospace stack for uppercase technical/meta labels.
import { Platform } from 'react-native';

// Seven flat, equally-vibrant hues (~54-62% HSL lightness, ~85-100% saturation)
// spanning the wheel - closer to an Olympic-poster palette than a neon
// nightclub gradient. green/blue/pink are load-bearing (degree-of-separation
// color coding); orange/violet/teal exist for variety (avatar tints, decor).
const accent = {
  green: '#4DE28F', // 1st degree, live/positive
  blue: '#3AC3F2', // 2nd degree, informational
  pink: '#FF3D8B', // open/public, alerts
  yellow: '#FFD23D', // close-friend tag highlight (star/ring on avatars)
  orange: '#FF8A3D',
  violet: '#6B4DE6', // private (link-only)
  teal: '#3DE0C9',
  red: '#FF4D4D', // close-friends-only Moves accent border/glow
} as const;

export const color = {
  bg: '#FFFFFF',
  bgElevated: '#F4F4F4',
  bgCard: '#FFFFFF',
  border: '#111111',
  borderSubtle: '#E1E1E1',

  textPrimary: '#111111',
  textSecondary: '#555555',
  textMuted: '#8A8A8A',
  textInverse: '#FFFFFF',

  brand: accent.green,
  brandMuted: '#E4FBEE',
  accent: accent.blue,
  closeFriend: accent.yellow,

  success: accent.green,
  danger: accent.pink,
  warning: accent.yellow,

  overlay: 'rgba(17,17,17,0.6)',

  accentGreen: accent.green,
  accentBlue: accent.blue,
  accentPink: accent.pink,
  accentYellow: accent.yellow,
  accentOrange: accent.orange,
  accentViolet: accent.violet,
  accentTeal: accent.teal,
  accentRed: accent.red,
} as const;

/** Full neon set, for anything that wants to cycle through all seven (avatar tints, decorative accents). */
export const neonPalette = [
  accent.green,
  accent.blue,
  accent.pink,
  accent.yellow,
  accent.orange,
  accent.violet,
  accent.teal,
] as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 6,
  pill: 4, // brutalist look has no true pills; kept as an alias of sm/md
} as const;

export const borderWidth = {
  thin: 1,
  base: 2,
  thick: 3,
} as const;

const monoFamily = Platform.select({
  web: '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Roboto Mono", monospace',
  default: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
});

const displayFamily = Platform.select({
  web: '"Helvetica Neue", Arial, "Segoe UI", sans-serif',
  default: 'System',
});

export const font = {
  family: {
    logo: 'Danfo',
    display: displayFamily,
    mono: monoFamily,
    body: Platform.select({ web: 'system-ui, sans-serif', default: 'System' }),
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    hero: 40,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
  tracking: {
    label: 0.6,
    wide: 1.2,
  },
} as const;

// Hard offset shadow (no blur) - the brutalist signature. boxShadow is a
// react-native-web-native style prop; native platforms fall back to a
// tight shadow* approximation since RN has no unblurred-shadow primitive.
export const shadow = {
  card: Platform.select({
    web: { boxShadow: '4px 4px 0px #111111' } as object,
    default: {
      shadowColor: '#111111',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
  }),
  small: Platform.select({
    web: { boxShadow: '2px 2px 0px #111111' } as object,
    default: {
      shadowColor: '#111111',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
  }),
} as const;

export const degreeLabel: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'Private (Link-Only)',
  1: 'Friends',
  2: 'Mutuals',
  3: 'Open',
  4: 'Close Friends',
};

export const degreeDescription: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'Hidden everywhere - only people with the share link or QR code can see or join.',
  1: 'Only your direct friends can see and join.',
  2: 'Friends and friends-of-friends can see and join.',
  3: 'Anyone nearby can see and join.',
  4: 'Only friends you’ve personally tagged as close can see and join.',
};

export const degreeBadgeLabel: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'PRIVATE',
  1: 'FRIENDS',
  2: 'MUTUALS',
  3: 'OPEN',
  4: 'CLOSE FRIENDS',
};

export const degreeColor: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: accent.violet,
  1: accent.green,
  2: accent.blue,
  3: accent.pink,
  4: accent.red,
};
