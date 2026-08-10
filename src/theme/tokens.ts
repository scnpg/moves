// Static, theme-independent design tokens. Colors, border weights, and
// shadows live in src/theme/{palette,themes,ThemeProvider}.tsx instead,
// since those differ between light and dark - use useTheme() for those.
export const font = {
  family: {
    // Danfo - the "MOVES?" wordmark only, wherever it appears as a logo.
    logo: 'Danfo',
    // Alfa Slab One - hero countdown numbers and other big display text, never the wordmark itself.
    heroDisplay: 'AlfaSlabOne_400Regular',
    // JetBrains Mono - uppercase labels, buttons, meta text. Reads as clean
    // and technical rather than retro/blocky (was Space Mono - too heavy
    // and typewriter-ish for this app's voice).
    monoRegular: 'JetBrainsMono_400Regular',
    monoBold: 'JetBrainsMono_700Bold',
    // Inter - anything a human wrote.
    bodyRegular: 'Inter_400Regular',
    bodySemibold: 'Inter_600SemiBold',
  },
} as const;
