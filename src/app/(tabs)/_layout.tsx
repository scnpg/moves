import { useState } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useLocale } from '@/i18n/LocaleProvider';
import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <View
      style={[styles.labelBox, focused && styles.labelBoxActive, hovered && styles.labelBoxHovered]}
      // @ts-expect-error react-native-web forwards unrecognized props to the underlying DOM node; no-op on native.
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Text style={[styles.labelText, focused && styles.labelTextActive]}>{label.toUpperCase()}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useLocale();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: color.bg,
          borderTopColor: color.border,
          borderTopWidth: borderWidth.base,
          height: 64,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.moves'),
          tabBarIcon: ({ focused }) => <TabLabel label={t('nav.moves')} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('nav.search'),
          tabBarIcon: ({ focused }) => <TabLabel label={t('nav.search')} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ focused }) => <TabLabel label={t('nav.profile')} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  labelBox: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  labelBoxActive: {
    backgroundColor: color.brandMuted,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  labelBoxHovered: {
    backgroundColor: color.bgElevated,
  },
  labelText: {
    fontFamily: font.family.mono,
    fontSize: 11,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
    color: color.textMuted,
  },
  labelTextActive: {
    color: color.textPrimary,
  },
});
