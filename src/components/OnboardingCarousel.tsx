import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Avatar, AvatarStack } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ContactInviteRow } from '@/components/ContactInviteRow';
import { HoverPressable } from '@/components/HoverPressable';
import { Screen } from '@/components/Screen';
import { SunburstBackdrop } from '@/components/Streamline';
import { UserRow } from '@/components/UserRow';
import { getNearbyUserSuggestions, matchContacts, sendFriendRequest, updateMyLocation } from '@/features/friends/api';
import { useLocale, type TranslationKey } from '@/i18n/LocaleProvider';
import { getDeviceContactsWithHashes, type DeviceContactEntry } from '@/lib/contacts';
import type { NearbyUserSuggestion } from '@/lib/database.types';
import { referralSignUpUrl } from '@/lib/links';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

const INVITE_GOAL = 3;
const FRIEND_GOAL = 3;

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
          <Badge label="Public" tone="pink" />
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

interface Coords {
  lat: number;
  lng: number;
}

/**
 * The 4th and final slide - unlike the first three (static illustration +
 * copy), this one is interactive: it prompts for contacts access and lets
 * the user pick up to 3 people to invite, plus friend up to 3 people
 * already nearby. Both actions reuse the exact same RPCs/flows as the
 * Search tab's "From your contacts" / nearby-suggestions sections.
 */
function ConnectSlide({
  titleKey,
  bodyKey,
  coords,
  locationLoading,
}: {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  coords: Coords | null;
  locationLoading: boolean;
}) {
  const { t } = useLocale();
  const { session } = useAuth();
  const { colors, border, font } = useTheme();

  const [contactsSynced, setContactsSynced] = useState(false);
  const [contactsSyncing, setContactsSyncing] = useState(false);
  const [inviteCandidates, setInviteCandidates] = useState<DeviceContactEntry[]>([]);
  const [invitedHashes, setInvitedHashes] = useState<Set<string>>(new Set());

  const [nearby, setNearby] = useState<NearbyUserSuggestion[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!coords) return;
    setNearbyLoading(true);
    updateMyLocation(coords.lat, coords.lng)
      .then(() => getNearbyUserSuggestions(5000, 6))
      .then(setNearby)
      .catch(() => {})
      .finally(() => setNearbyLoading(false));
  }, [coords]);

  const handleSyncContacts = async () => {
    setContactsSyncing(true);
    try {
      const entries = await getDeviceContactsWithHashes();
      if (entries == null) return;
      const matches = await matchContacts(entries.map((e) => e.hash));
      const matchedHashes = new Set(matches.map((m) => m.phone_hash));
      setInviteCandidates(entries.filter((e) => !matchedHashes.has(e.hash)).slice(0, 6));
      setContactsSynced(true);
    } finally {
      setContactsSyncing(false);
    }
  };

  const handleInvite = async (contact: DeviceContactEntry) => {
    if (!session?.user || invitedHashes.size >= INVITE_GOAL) return;
    const link = referralSignUpUrl(session.user.id);
    const body = t('search.inviteSmsBody', { link });
    setInvitedHashes((prev) => new Set(prev).add(contact.hash));
    try {
      const digits = contact.phone.replace(/[^\d+]/g, '');
      const smsUrl = `sms:${digits}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`;
      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
        return;
      }
    } catch {
      // fall through to the share sheet below
    }
    try {
      await Share.share({ message: body });
    } catch {
      // user dismissed the share sheet - still counts toward their 3, that's fine
    }
  };

  const handleAddFriend = async (userId: string) => {
    if (addedIds.size >= FRIEND_GOAL || addedIds.has(userId)) return;
    setAddedIds((prev) => new Set(prev).add(userId));
    try {
      await sendFriendRequest(userId);
    } catch {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  return (
    <ScrollView style={styles.connectScroll} contentContainerStyle={styles.connectScrollContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.connectTitle, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]}>{t(titleKey)}</Text>
      <Text style={[styles.connectBody, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{t(bodyKey)}</Text>

      {Platform.OS !== 'web' ? (
        <View style={styles.connectSection}>
          <Text style={[styles.connectHeading, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
            {t('onboarding.inviteHeading', { count: invitedHashes.size, goal: INVITE_GOAL })}
          </Text>
          {!contactsSynced ? (
            <HoverPressable
              onPress={handleSyncContacts}
              disabled={contactsSyncing}
              style={[styles.connectButton, { borderWidth: 2, borderColor: colors.border }]}
            >
              <Text style={[styles.connectButtonText, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
                {contactsSyncing ? t('search.syncing') : t('onboarding.allowContacts')}
              </Text>
            </HoverPressable>
          ) : inviteCandidates.length === 0 ? (
            <Text style={[styles.connectEmpty, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('search.noContactsYet')}</Text>
          ) : (
            inviteCandidates.map((contact) => (
              <ContactInviteRow
                key={contact.hash}
                name={contact.name}
                invited={invitedHashes.has(contact.hash)}
                disabled={invitedHashes.size >= INVITE_GOAL && !invitedHashes.has(contact.hash)}
                onInvite={() => handleInvite(contact)}
              />
            ))
          )}
        </View>
      ) : null}

      <View style={styles.connectSection}>
        <Text style={[styles.connectHeading, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
          {t('onboarding.friendHeading', { count: addedIds.size, goal: FRIEND_GOAL })}
        </Text>
        {(locationLoading || nearbyLoading) && nearby.length === 0 ? (
          <ActivityIndicator color={colors.brand} style={styles.connectSpinner} />
        ) : nearby.length === 0 ? (
          <Text style={[styles.connectEmpty, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('onboarding.noNearbyYet')}</Text>
        ) : (
          nearby.map((person) => (
            <UserRow
              key={person.id}
              avatarUrl={person.avatar_url}
              name={person.display_name ?? person.username}
              username={person.username}
              friendshipStatus={addedIds.has(person.id) ? 'pending_sent' : 'none'}
              onAdd={addedIds.size >= FRIEND_GOAL ? undefined : () => handleAddFriend(person.id)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const SLIDES = [
  { key: 'discover', titleKey: 'onboarding.discoverTitle', bodyKey: 'onboarding.discoverBody', Illustration: DiscoverIllustration },
  { key: 'host', titleKey: 'onboarding.hostTitle', bodyKey: 'onboarding.hostBody', Illustration: HostIllustration },
  { key: 'chat', titleKey: 'onboarding.chatTitle', bodyKey: 'onboarding.chatBody', Illustration: ChatIllustration },
  { key: 'connect', titleKey: 'onboarding.connectTitle', bodyKey: 'onboarding.connectBody', Illustration: null },
] as const;

/**
 * Shown once per account, gated in _layout.tsx between the username check
 * and the location gate - finishing (Skip or the last Get Started) flows
 * straight into that existing location-permission prompt, so this is the
 * only place location gets asked for right after onboarding.
 */
export function OnboardingCarousel({
  onComplete,
  coords,
  locationLoading,
}: {
  onComplete: () => void;
  coords: Coords | null;
  locationLoading: boolean;
}) {
  const [index, setIndex] = useState(0);
  const { t } = useLocale();
  const { colors, font } = useTheme();
  const isLast = index === SLIDES.length - 1;
  const { key, titleKey, bodyKey, Illustration } = SLIDES[index];
  // The connect slide has real tasks (invite/friend 3 people) that could
  // otherwise feel mandatory even though "Get started" already bypasses
  // them - show the same escape hatch as every other slide, not just a
  // final-slide button whose label reads like a commitment.
  const showSkip = !isLast || key === 'connect';

  return (
    <Screen style={styles.screen}>
      <SunburstBackdrop />
      <View style={styles.topRow}>
        {showSkip ? (
          <HoverPressable onPress={onComplete} style={styles.skipWrap}>
            <Text style={[styles.skipText, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('onboarding.skip')}</Text>
          </HoverPressable>
        ) : null}
      </View>

      <View style={[styles.content, key === 'connect' && styles.connectContent]}>
        {key === 'connect' ? (
          <ConnectSlide titleKey={titleKey} bodyKey={bodyKey} coords={coords} locationLoading={locationLoading} />
        ) : (
          <>
            {Illustration ? <Illustration /> : null}
            <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]}>{t(titleKey)}</Text>
            <Text style={[styles.body, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{t(bodyKey)}</Text>
          </>
        )}
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
  connectContent: {
    justifyContent: 'flex-start',
    width: '100%',
  },
  connectScroll: {
    width: '100%',
  },
  connectScrollContent: {
    gap: 16,
    paddingBottom: 8,
  },
  connectTitle: {
    fontSize: 22,
    lineHeight: 27,
    textAlign: 'center',
  },
  connectBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  connectSection: {
    gap: 4,
  },
  connectHeading: {
    fontSize: 11,
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  connectButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  connectButtonText: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  connectEmpty: {
    fontSize: 13,
    paddingVertical: 4,
  },
  connectSpinner: {
    paddingVertical: 12,
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
