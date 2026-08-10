import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HoverPressable } from '@/components/HoverPressable';
import { ReportUserPanel } from '@/components/ReportUserPanel';
import { Screen } from '@/components/Screen';
import { blockUser, getBlockedUsers, unblockUser } from '@/features/blocking/api';
import {
  acceptFriendRequest,
  getFriendshipStatus,
  getMutualFriends,
  removeFriendship,
  sendFriendRequest,
  setCloseFriend,
} from '@/features/friends/api';
import { getProfile, getPublicProfile } from '@/features/profile/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { confirmAction, notify } from '@/lib/alerts';
import type { MutualFriend, PublicProfile, SearchFriendshipStatus } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { colors, font } = useTheme();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [mutuals, setMutuals] = useState<MutualFriend[]>([]);
  const [status, setStatus] = useState<SearchFriendshipStatus>('none');
  const [isCloseFriend, setIsCloseFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Reachable while signed out - shared profile links/QR codes (see
  // ShareProfilePanel, get_public_profile()) need to work for people who
  // don't have an account yet. Friend status/mutuals only make sense once
  // signed in, so those stay at their "none" defaults otherwise.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      setLoading(true);

      (async () => {
        if (session?.user) {
          const [profileData, friendship, mutualData, blockedUsers] = await Promise.all([
            getProfile(id),
            getFriendshipStatus(session.user.id, id),
            getMutualFriends(session.user.id, id).catch(() => []),
            getBlockedUsers().catch(() => []),
          ]);
          if (cancelled) return;
          setProfile(profileData);
          setStatus(friendship.status);
          setIsCloseFriend(friendship.isCloseFriend);
          setMutuals(mutualData);
          setIsBlocked(blockedUsers.some((b) => b.id === id));
          setNotFound(!profileData);
        } else {
          const profileData = await getPublicProfile(id).catch(() => null);
          if (cancelled) return;
          setProfile(profileData);
          setNotFound(!profileData);
        }
        setLoading(false);
      })();

      return () => {
        cancelled = true;
      };
    }, [id, session?.user])
  );

  const handleAdd = async () => {
    if (!session?.user || !id) return;
    setActionLoading(true);
    try {
      await sendFriendRequest(id);
      setStatus('pending_sent');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!session?.user || !id) return;
    setActionLoading(true);
    try {
      await acceptFriendRequest(session.user.id, id);
      setStatus('accepted');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleClose = async () => {
    if (!id) return;
    const next = !isCloseFriend;
    setIsCloseFriend(next);
    try {
      await setCloseFriend(id, next);
    } catch {
      setIsCloseFriend(!next);
    }
  };

  const handleUnfriend = async () => {
    if (!session?.user || !id || !profile) return;
    const name = profile.display_name ?? profile.username;
    const confirmed = await confirmAction(t('friendsScreen.unfriendTitle'), t('friendsScreen.unfriendMessage', { name }), t('friendsScreen.unfriendTitle'));
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await removeFriendship(session.user.id, id);
      setStatus('none');
      setIsCloseFriend(false);
    } catch (err) {
      notify(t('friendsScreen.couldNotUnfriend'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!session?.user || !id || !profile) return;
    const name = profile.display_name ?? profile.username;
    const confirmed = await confirmAction(t('userProfile.blockConfirmTitle', { name }), t('userProfile.blockConfirmMessage'), t('userProfile.block'));
    if (!confirmed) return;
    setBlockLoading(true);
    try {
      await blockUser(id);
      setIsBlocked(true);
      setStatus('none');
      setIsCloseFriend(false);
      setReportOpen(false);
    } catch (err) {
      notify(t('userProfile.couldNotBlock'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!id) return;
    setBlockLoading(true);
    try {
      await unblockUser(id);
      setIsBlocked(false);
    } catch (err) {
      notify(t('userProfile.couldNotUnblock'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setBlockLoading(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: '', headerStyle: { backgroundColor: colors.bg } }} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  if (notFound || !profile) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: '', headerStyle: { backgroundColor: colors.bg } }} />
        <View style={styles.loading}>
          <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('userProfile.notAvailable')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
        }}
      />
      <View style={styles.content}>
        <View style={styles.profileHeader}>
          <Avatar
            uri={profile.avatar_url}
            name={profile.display_name ?? profile.username}
            size={88}
            closeFriend={isCloseFriend}
          />
          <Text style={[styles.displayName, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{profile.display_name ?? profile.username}</Text>
          <Text style={[styles.username, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>@{profile.username}</Text>
          {profile.bio ? <Text style={[styles.bio, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{profile.bio}</Text> : null}

          <View style={styles.actionsRow}>
            {!session?.user ? (
              <Button label={t('userProfile.signInToConnect')} onPress={() => router.push('/(auth)/sign-in')} />
            ) : isBlocked ? (
              <Button label={t('userProfile.unblock')} variant="secondary" onPress={handleUnblock} loading={blockLoading} />
            ) : status === 'none' ? (
              <Button label={t('userProfile.addFriend')} onPress={handleAdd} loading={actionLoading} />
            ) : status === 'pending_sent' ? (
              <Button label={t('userProfile.requestSent')} variant="secondary" onPress={() => {}} disabled />
            ) : status === 'pending_received' ? (
              <Button label={t('userProfile.acceptRequest')} onPress={handleAccept} loading={actionLoading} />
            ) : status === 'accepted' ? (
              <View style={styles.acceptedActionsRow}>
                <Button
                  label={isCloseFriend ? t('userProfile.closeFriendActive') : t('userProfile.markAsCloseFriend')}
                  variant="secondary"
                  onPress={handleToggleClose}
                  style={styles.flexButton}
                />
                <Button
                  label={t('userProfile.unfriend')}
                  variant="danger"
                  onPress={handleUnfriend}
                  loading={actionLoading}
                  style={styles.flexButton}
                />
              </View>
            ) : null}
          </View>

          {session?.user ? (
            <View style={styles.secondaryActionsRow}>
              {!isBlocked ? (
                <HoverPressable onPress={handleBlock} style={styles.secondaryAction}>
                  <Text style={[styles.secondaryActionText, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('userProfile.block')}</Text>
                </HoverPressable>
              ) : null}
              <HoverPressable onPress={() => setReportOpen((open) => !open)} style={styles.secondaryAction}>
                <Text style={[styles.secondaryActionText, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('userProfile.report')}</Text>
              </HoverPressable>
            </View>
          ) : null}

          {reportOpen && session?.user ? (
            <ReportUserPanel
              userId={id}
              name={profile.display_name ?? profile.username}
              onDone={() => setReportOpen(false)}
            />
          ) : null}
        </View>

        {session?.user ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
              {mutuals.length > 0
                ? t(mutuals.length === 1 ? 'userProfile.mutualFriendsCount' : 'userProfile.mutualFriendsCountPlural', { count: mutuals.length })
                : t('userProfile.mutualFriends')}
            </Text>

            <FlatList
              data={mutuals}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Card style={styles.mutualCard} raised={false}>
                  <Avatar uri={item.avatar_url} name={item.display_name ?? item.username} size={36} />
                  <Text style={[styles.mutualName, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{item.display_name ?? item.username}</Text>
                </Card>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('userProfile.noMutualFriends')}</Text>}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 16,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 16,
  },
  displayName: {
    fontSize: 20,
    marginTop: 12,
  },
  username: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  actionsRow: {
    marginTop: 16,
    alignSelf: 'stretch',
  },
  acceptedActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  secondaryAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  secondaryActionText: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  mutualCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  mutualName: {
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    paddingVertical: 16,
  },
});
