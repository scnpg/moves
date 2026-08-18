import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, AvatarStack } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HoverPressable } from '@/components/HoverPressable';
import { Screen } from '@/components/Screen';
import { SunburstBackdrop } from '@/components/Streamline';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/theme/ThemeProvider';

const FAKE_PEOPLE = [
  { alt: 'Ari' },
  { alt: 'Kai' },
  { alt: 'Sam' },
];

/** Scattered pins on a map-like panel - stands in for the live Feed/Moves map. */
function DiscoverIllustration() {
  const { colors, border, signal } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.bgElevated, borderColor: colors.border, borderWidth: border.rest.width }]}>
      <View style={styles.discoverLiveBadge}>
        <Badge label="LIVE" tone="green" />
      </View>
      <View style={[styles.pin, { top: '58%', left: '20%' }]}>
        <Avatar name="Jo" size={30} tint={1} hosting />
      </View>
      <View style={[styles.pin, { top: '28%', left: '62%' }]}>
        <Avatar name="Lee" size={26} tint={2} />
      </View>
      <View style={[styles.pin, { top: '66%', left: '70%' }]}>
        <Avatar name="Max" size={26} tint={3} />
      </View>
      <View style={[styles.pinRing, { top: '58%', left: '20%', borderColor: signal.degree[1] }]} />
    </View>
  );
}

/** A Move card mid-creation - the degree-tier badges plus who's already in. */
function HostIllustration() {
  const { colors, border } = useTheme();
  return (
    <View style={styles.panel}>
      <Card style={styles.hostCard}>
        <View style={[styles.textBarWide, { backgroundColor: colors.border }]} />
        <View style={[styles.textBarNarrow, { backgroundColor: colors.borderSubtle }]} />
        <View style={styles.hostBadgeRow}>
          <Badge label="Friends" tone="green" />
          <Badge label="Friends of friends" tone="blue" />
          <Badge label="Open" tone="pink" />
        </View>
        <View style={[styles.hostDivider, { borderColor: border.soft.color, borderWidth: border.soft.width }]} />
        <AvatarStack size={28} avatars={FAKE_PEOPLE} overflow={2} />
      </Card>
    </View>
  );
}

/** Two chat bubbles plus a "who's here" row - stands in for a Move's group chat. */
function ChatIllustration() {
  const { colors, border } = useTheme();
  return (
    <View style={styles.panel}>
      <View style={styles.chatWhosHere}>
        <AvatarStack size={24} avatars={FAKE_PEOPLE} overflow={1} />
      </View>
      <View style={styles.chatBubbleRow}>
        <Avatar name="Ari" size={26} />
        <View style={[styles.bubble, styles.bubbleTheirs, { backgroundColor: colors.bgCard, borderColor: border.rest.color, borderWidth: border.rest.width }]}>
          <View style={[styles.textBarNarrow, { backgroundColor: colors.borderSubtle, marginBottom: 0 }]} />
        </View>
      </View>
      <View style={[styles.chatBubbleRow, styles.chatBubbleRowMine]}>
        <View style={[styles.bubble, styles.bubbleMine, { backgroundColor: colors.brand, borderColor: border.rest.color, borderWidth: border.rest.width }]}>
          <View style={[styles.textBarNarrow, { backgroundColor: colors.onAccent, opacity: 0.5, marginBottom: 0 }]} />
        </View>
      </View>
    </View>
  );
}

const SLIDES = [
  { key: 'discover', titleKey: 'onboarding.discoverTitle', bodyKey: 'onboarding.discoverBody', Illustration: DiscoverIllustration },
  { key: 'host', titleKey: 'onboarding.hostTitle', bodyKey: 'onboarding.hostBody', Illustration: HostIllustration },
  { key: 'chat', titleKey: 'onboarding.chatTitle', bodyKey: 'onboarding.chatBody', Illustration: ChatIllustration },
] as const;

/**
 * Shown once per account, gated in _layout.tsx between the username check
 * and the location gate - finishing (Skip or the last Get Started) flows
 * straight into that existing location-permission prompt, so this is the
 * only place location gets asked for right after onboarding.
 */
export function OnboardingCarousel({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const { t } = useLocale();
  const { colors, font } = useTheme();
  const isLast = index === SLIDES.length - 1;
  const { titleKey, bodyKey, Illustration } = SLIDES[index];

  return (
    <Screen style={styles.screen}>
      <SunburstBackdrop />
      <View style={styles.topRow}>
        {!isLast ? (
          <HoverPressable onPress={onComplete} style={styles.skipWrap}>
            <Text style={[styles.skipText, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('onboarding.skip')}</Text>
          </HoverPressable>
        ) : null}
      </View>

      <View style={styles.content}>
        <Illustration />

        <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]}>{t(titleKey)}</Text>
        <Text style={[styles.body, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{t(bodyKey)}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[styles.dot, { backgroundColor: i === index ? colors.brand : colors.borderSubtle, borderColor: colors.border }]}
            />
          ))}
        </View>
        <Button
          label={isLast ? t('onboarding.getStarted') : t('onboarding.next')}
          onPress={() => (isLast ? onComplete() : setIndex((i) => i + 1))}
          size="lg"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  topRow: {
    height: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipWrap: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 12,
    letterSpacing: 0.9,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    gap: 20,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },

  panel: {
    width: 260,
    height: 170,
    justifyContent: 'center',
  },

  // Discover
  discoverLiveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  pin: {
    position: 'absolute',
  },
  pinRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    marginLeft: -8,
    marginTop: -8,
    borderRadius: 23,
    borderWidth: 1,
    opacity: 0.5,
  },

  // Host
  hostCard: {
    width: '100%',
    gap: 10,
  },
  textBarWide: {
    height: 10,
    width: '70%',
    borderRadius: 2,
  },
  textBarNarrow: {
    height: 8,
    width: '45%',
    borderRadius: 2,
    marginBottom: 2,
  },
  hostBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hostDivider: {
    borderTopWidth: 1,
  },

  // Chat
  chatWhosHere: {
    marginBottom: 14,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  chatBubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: 150,
  },
  bubbleTheirs: {},
  bubbleMine: {},
});
