import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { Screen } from '@/components/Screen';
import { color, font, spacing } from '@/theme/tokens';

interface LegalDocumentProps {
  title: string;
  updated: string;
  children: ReactNode;
}

/** Shared chrome for /privacy and /terms - plain, English-only legal text (see those files for why). */
export function LegalDocument({ title, updated, children }: LegalDocumentProps) {
  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.textPrimary,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: {updated}</Text>
        {children}
      </ScrollView>
    </Screen>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{heading}</Text>
      {children}
    </View>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
    maxWidth: 640,
  },
  updated: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.xs,
  },
  section: {
    gap: spacing.xs,
  },
  heading: {
    color: color.textPrimary,
    fontSize: font.size.md,
    fontWeight: font.weight.heavy,
  },
  paragraph: {
    color: color.textSecondary,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.5,
  },
});
