// Raw color/border/shadow values for each mode, ported 1:1 from the Figma
// "Design System Foundation" prototype's src/index.css (:root and
// [data-theme="dark"] blocks). No logic here - themes.ts assembles these
// into the full Theme shape consumed via useTheme().

export interface ModePalette {
  ink900: string;
  ink500: string;
  ink200: string;
  paper000: string;
  paper100: string;
  accentGreen: string;
  accentWash: string;
  onAccent: string;
  /** High-contrast highlight distinct from ink900 - dark mode's "two bright edges per screen" (focused input, live card border). Equals ink900 in light mode. */
  brightEdge: string;
  /** Recessed input/well background. */
  well: string;
  /** Hard-offset shadow color (--shadow-hard). */
  shadowColor: string;
  /** --bw2 in px. */
  borderStructural: number;
  /** --bw3 in px. */
  borderEmphatic: number;
  /** Light mode gets the inset-left focus bar; dark mode relies on the bright border alone. */
  hasFocusInsetBar: boolean;
  cardLiveBorderWidth: number;
  cardRestBorderWidth: number;
  map: {
    bg: string;
    water: string;
    park: string;
    roadMajor: string;
    roadMid: string;
    roadMinor: string;
    diagonal: string;
    pinSurface: string;
    pinInk: string;
  };
  /** App-only multi-hue signal palette (degree-of-separation coding, badges) - no prototype equivalent, retuned per-mode for contrast against paper100/paper000. */
  signal: {
    blue: string;
    pink: string;
    yellow: string;
    orange: string;
    violet: string;
    teal: string;
    red: string;
  };
}

export const lightPalette: ModePalette = {
  ink900: '#000000',
  ink500: '#6B6B6B',
  ink200: '#D9D9D9',
  paper000: '#FFFFFF',
  paper100: '#F4F4F4',
  accentGreen: '#35DE83',
  accentWash: '#DFF7E7',
  onAccent: '#000000',
  brightEdge: '#000000',
  well: '#FFFFFF',
  shadowColor: '#000000',
  borderStructural: 2,
  borderEmphatic: 3,
  hasFocusInsetBar: true,
  cardLiveBorderWidth: 4,
  cardRestBorderWidth: 4,
  map: {
    bg: '#E2E2E2',
    water: '#C4D2D9',
    park: '#C9DAC9',
    roadMajor: '#F0F0F0',
    roadMid: '#F2F2F2',
    roadMinor: '#E9E9E9',
    diagonal: '#EEEEEE',
    pinSurface: '#FFFFFF',
    pinInk: '#000000',
  },
  signal: {
    blue: '#3AC3F2',
    pink: '#FF3D8B',
    yellow: '#FFD23D',
    orange: '#FF8A3D',
    violet: '#6B4DE6',
    teal: '#3DE0C9',
    red: '#FF4D4D',
  },
};

export const darkPalette: ModePalette = {
  ink900: '#ECECEF',
  ink500: '#9A9AA2',
  ink200: '#2E2E34',
  paper000: '#1C1C20',
  paper100: '#121214',
  accentGreen: '#2FD07A',
  accentWash: '#0D2318',
  onAccent: '#0A1710',
  brightEdge: '#E6E6EA',
  well: '#0C0C0E',
  shadowColor: '#4A4A52',
  borderStructural: 1.5,
  borderEmphatic: 1.5,
  hasFocusInsetBar: false,
  cardLiveBorderWidth: 3,
  cardRestBorderWidth: 3,
  map: {
    bg: '#171717',
    water: '#1A2428',
    park: '#18221A',
    roadMajor: '#2C2C2C',
    roadMid: '#282828',
    roadMinor: '#222222',
    diagonal: '#252525',
    pinSurface: '#E6E6EA',
    pinInk: '#121214',
  },
  signal: {
    blue: '#2FA8D6',
    pink: '#E0357A',
    yellow: '#E6BC2E',
    orange: '#E67A2E',
    violet: '#5A3FC4',
    teal: '#2FC4AE',
    red: '#E04444',
  },
};
