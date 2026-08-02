import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.labelBox, focused && styles.labelBoxActive]}>
      <Text style={[styles.labelText, focused && styles.labelTextActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
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
          title: 'Moves',
          tabBarIcon: ({ focused }) => <TabLabel label="MOVES" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => <TabLabel label="SEARCH" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabLabel label="PROFILE" focused={focused} />,
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
