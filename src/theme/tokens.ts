// Static, theme-independent design tokens. Colors, border weights, and
// shadows live in src/theme/{palette,themes,ThemeProvider}.tsx instead,
// since those differ between light and dark - use useTheme() for those.
export const font = {
  family: {
    // Danfo - the "MOVES?" wordmark only, wherever it appears as a logo.
    // The one exception to the header/body split below.
    logo: 'Danfo',
    // Space Grotesk - every heading/title/label/button/meta role (was Alfa
    // Slab One for hero display text, JetBrains Mono for uppercase
    // labels/buttons/meta - both collapsed into this one "header" family).
    heroDisplay: 'SpaceGrotesk_700Bold',
    monoRegular: 'SpaceGrotesk_500Medium',
    monoBold: 'SpaceGrotesk_700Bold',
    // Inter - anything a human wrote (descriptions, bios, chat messages).
    bodyRegular: 'Inter_400Regular',
    bodySemibold: 'Inter_600SemiBold',
  },
} as const;
