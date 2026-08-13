import { Platform } from 'react-native';

import { font } from '@/theme/tokens';
import { darkPalette, lightPalette, type ModePalette } from '@/theme/palette';

export interface Theme {
  mode: 'light' | 'dark';
  colors: {
    ink900: string;
    ink500: string;
    ink200: string;
    paper000: string;
    paper100: string;
    accentGreen: string;
    accentWash: string;
    onAccent: string;
    brightEdge: string;
    well: string;

    // Semantic aliases - kept name-compatible with the old static `color`
    // export so components migrate by swapping the import, not every usage.
    bg: string;
    bgElevated: string;
    bgCard: string;
    border: string;
    borderSubtle: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textInverse: string;
    brand: string;
    brandMuted: string;
    accent: string;
    closeFriend: string;
    success: string;
    danger: string;
    warning: string;
    overlay: string;

    accentGreenFlat: string;
    accentBlue: string;
    accentPink: string;
    accentYellow: string;
    accentOrange: string;
    accentViolet: string;
    accentTeal: string;
    accentRed: string;
  };
  signal: {
    degree: Record<0 | 1 | 2 | 3 | 4, string>;
    neonPalette: readonly string[];
  };
  font: typeof font;
  borderWidth: {
    hairline: number;
    structural: number;
    emphatic: number;
  };
  border: {
    rest: { width: number; color: string };
    soft: { width: number; color: string };
    focused: { width: number; color: string; hasInsetBar: boolean };
  };
  card: {
    live: { width: number; color: string };
    rest: { width: number; color: string };
  };
  shadow: {
    hard: object;
    small: object;
  };
  map: ModePalette['map'];
}

function buildTheme(mode: 'light' | 'dark', p: ModePalette): Theme {
  const overlay = mode === 'light' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.72)';

  const shadowFor = (offset: number) =>
    Platform.select({
      web: { boxShadow: `${offset}px ${offset}px 0px ${p.shadowColor}` } as object,
      default: {
        shadowColor: p.shadowColor,
        shadowOffset: { width: offset, height: offset },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: offset,
      },
    })!;

  return {
    mode,
    colors: {
      ink900: p.ink900,
      ink500: p.ink500,
      ink200: p.ink200,
      paper000: p.paper000,
      paper100: p.paper100,
      accentGreen: p.accentGreen,
      accentWash: p.accentWash,
      onAccent: p.onAccent,
      brightEdge: p.brightEdge,
      well: p.well,

      bg: p.paper100,
      bgElevated: p.paper000,
      bgCard: p.paper000,
      border: p.ink900,
      borderSubtle: p.ink200,
      textPrimary: p.ink900,
      textSecondary: p.ink500,
      textMuted: p.ink500,
      textInverse: p.paper000,
      brand: p.accentGreen,
      brandMuted: p.accentWash,
      accent: p.signal.blue,
      closeFriend: p.signal.yellow,
      success: p.accentGreen,
      danger: p.signal.red,
      warning: p.signal.yellow,
      overlay,

      accentGreenFlat: p.accentGreen,
      accentBlue: p.signal.blue,
      accentPink: p.signal.pink,
      accentYellow: p.signal.yellow,
      accentOrange: p.signal.orange,
      accentViolet: p.signal.violet,
      accentTeal: p.signal.teal,
      accentRed: p.signal.red,
    },
    signal: {
      degree: {
        0: p.signal.violet,
        1: p.accentGreen,
        2: p.signal.blue,
        3: p.signal.pink,
        4: p.signal.red,
      },
      neonPalette: [p.accentGreen, p.signal.blue, p.signal.pink, p.signal.yellow, p.signal.orange, p.signal.violet, p.signal.teal],
    },
    font,
    borderWidth: {
      hairline: 1,
      structural: p.borderStructural,
      emphatic: p.borderEmphatic,
    },
    border: {
      rest: { width: 1, color: p.ink900 },
      soft: { width: 1, color: p.ink200 },
      focused: { width: mode === 'light' ? 2 : 1.5, color: p.brightEdge, hasInsetBar: p.hasFocusInsetBar },
    },
    card: {
      // Every Move card gets the same bright edge (brightEdge already flips
      // per-mode: black on light paper, near-white on dark paper) - live
      // cards swap it for red instead, so color alone signals "happening
      // now" rather than a plain border-vs-no-border distinction.
      live: { width: p.cardLiveBorderWidth, color: p.signal.red },
      rest: { width: p.cardRestBorderWidth, color: p.brightEdge },
    },
    shadow: {
      hard: shadowFor(3),
      small: shadowFor(2),
    },
    map: p.map,
  };
}

export const lightTheme = buildTheme('light', lightPalette);
export const darkTheme = buildTheme('dark', darkPalette);
