// Hand-rolled design tokens. No NativeWind / no UI kit - every screen in
// this app styles itself with StyleSheet.create() against these values.

export const color = {
  bg: '#0B0B10',
  bgElevated: '#15151D',
  bgCard: '#1B1B26',
  border: '#2A2A38',
  borderSubtle: '#22222E',

  textPrimary: '#F5F5F7',
  textSecondary: '#A5A5B5',
  textMuted: '#6B6B7C',
  textInverse: '#0B0B10',

  brand: '#6C5CE7',
  brandMuted: '#3A3266',
  accent: '#00D9C0',
  closeFriend: '#FFB020',

  success: '#3DDC84',
  danger: '#FF5470',
  warning: '#FFB020',

  overlay: 'rgba(0,0,0,0.6)',
} as const;

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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const font = {
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const degreeLabel: Record<1 | 2 | 3, string> = {
  1: 'Friends only',
  2: 'Friends of friends',
  3: 'Open',
};

export const degreeDescription: Record<1 | 2 | 3, string> = {
  1: 'Only your direct friends can see and join.',
  2: 'Friends and friends-of-friends can see and join.',
  3: 'Anyone nearby can see and join.',
};
