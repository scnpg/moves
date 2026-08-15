import { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HoverPressable } from '@/components/HoverPressable';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/theme/ThemeProvider';

export const TAB_BAR_HEIGHT = 64;

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  const [hovered, setHovered] = useState(false);
  const { colors, font } = useTheme();

  return (
    <View
      style={[
        styles.labelBox,
        { borderTopWidth: 4, borderTopColor: focused ? colors.border : 'transparent', marginTop: -6 },
      ]}
      // @ts-expect-error react-native-web forwards unrecognized props to the underlying DOM node; no-op on native.
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Text
        style={[
          styles.labelText,
          {
            fontFamily: focused ? font.family.monoBold : font.family.monoRegular,
            color: focused ? colors.textPrimary : hovered ? colors.textSecondary : colors.textMuted,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * Center tab bar slot - a raised square that pokes above the bar rather
 * than sitting flush in the row like the other four, so "start a Move"
 * reads as the one action that stands out. Fully replaces the slot's
 * default press handling (never calls React Navigation's own tab-switch),
 * so /room/create's existing modal presentation is what opens - this is a
 * shortcut into that screen, not a fifth piece of tab content.
 */
function CreateTabButton() {
  const router = useRouter();
  const { t } = useLocale();
  const { colors, borderWidth, shadow } = useTheme();

  return (
    <View style={styles.createSlot} pointerEvents="box-none">
      <HoverPressable
        onPress={() => router.push('/room/create')}
        accessibilityRole="button"
        accessibilityLabel={t('moves.startAMove')}
        style={[
          styles.createButton,
          { backgroundColor: colors.brand, borderWidth: borderWidth.emphatic, borderColor: colors.border, ...shadow.hard },
        ]}
        lightenOpacity={0.12}
      >
        <Text style={[styles.createIcon, { color: colors.onAccent }]}>+</Text>
      </HoverPressable>
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useLocale();
  const { colors, border } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Labels render via tabBarLabel below, not tabBarIcon - the icon
        // slot is hard-capped by the library to icon dimensions (~31pt,
        // see TabBarIcon.js's ICON_SIZE_WIDE) regardless of this tab's real
        // flex-allocated width, which silently truncated FEED/MOVES/SEARCH/
        // PROFILE no matter how small the font got. tabBarLabel has no such
        // cap (BottomTabItem.js's labelBeneath style is just a font size).
        tabBarShowLabel: true,
        // Without a tabBarIcon, the library falls back to its own MissingIcon
        // placeholder glyph (a down-pointing triangle) - suppress it since
        // this tab bar is label-only.
        tabBarIcon: () => null,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: border.rest.color,
          borderTopWidth: border.rest.width,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.feed'),
          tabBarLabel: ({ focused }) => <TabLabel label={t('nav.feed')} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="moves"
        options={{
          title: t('nav.moves'),
          tabBarLabel: ({ focused }) => <TabLabel label={t('nav.moves')} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t('moves.startAMove'),
          tabBarButton: () => <CreateTabButton />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('nav.search'),
          tabBarLabel: ({ focused }) => <TabLabel label={t('nav.search')} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarLabel: ({ focused }) => <TabLabel label={t('nav.profile')} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  labelBox: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
    alignItems: 'center',
  },
  labelText: {
    fontSize: 11,
    letterSpacing: 0.9,
    // Explicit cap (rather than relying on the flex parent to constrain
    // width) - RNWeb doesn't shrink text nodes to their container by
    // default, so numberOfLines/adjustsFontSizeToFit have nothing to
    // shrink against without this and the label can overflow into
    // neighboring tabs on narrow (mobile) widths.
    maxWidth: 62,
  },
  createSlot: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    position: 'absolute',
    top: -18,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createIcon: {
    fontSize: 28,
    lineHeight: 30,
  },
});
