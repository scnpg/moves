import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { color, font } from '@/theme/tokens';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: font.size.lg, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: {
          backgroundColor: color.bgElevated,
          borderTopColor: color.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Moves',
          tabBarIcon: ({ focused }) => <TabIcon glyph="📍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🔍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
