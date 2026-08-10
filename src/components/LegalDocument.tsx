import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/Screen';
import { useTheme } from '@/theme/ThemeProvider';

interface LegalDocumentProps {
  title: string;
  updated: string;
  children: ReactNode;
}

/** Shared chrome for /privacy and /terms - plain, English-only legal text (see those files for why). */
export function LegalDocument({ title, updated, children }: LegalDocumentProps) {
  const { colors, font } = useTheme();
  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.updated, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>Last updated: {updated}</Text>
        {children}
      </ScrollView>
    </Screen>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  const { colors, font } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{heading}</Text>
      {children}
    </View>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  const { colors, font } = useTheme();
  return <Text style={[styles.paragraph, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 24,
    maxWidth: 640,
  },
  updated: {
    fontSize: 11,
    letterSpacing: 0.7,
  },
  section: {
    gap: 8,
  },
  heading: {
    fontSize: 16,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 21,
  },
});
