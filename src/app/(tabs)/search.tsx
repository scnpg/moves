import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { HoverPressable } from '@/components/HoverPressable';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { UserRow } from '@/components/UserRow';
import {
  acceptFriendRequest,
  getFriendOfFriendSuggestions,
  getNearbyUserSuggestions,
  matchContacts,
  sendFriendRequest,
  setCloseFriend,
  updateMyLocation,
} from '@/features/friends/api';
import { searchUsers } from '@/features/search/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { getDeviceContactPhoneHashes, getWebContactPhoneHashes, isWebContactPickerAvailable } from '@/lib/contacts';
import { PHONE_CONTACTS_FEATURE_ENABLED } from '@/lib/features';
import type {
  ContactSuggestion,
  FriendOfFriendSuggestion,
  NearbyUserSuggestion,
  SearchUserResult,
} from '@/lib/database.types';
import { useUserLocation } from '@/lib/useLocation';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

export default function SearchScreen() {
  const { session } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { coords } = useUserLocation();
  const { colors, border, font } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [loading, setLoading] = useState(false);

  const [fof, setFof] = useState<FriendOfFriendSuggestion[]>([]);
  const [nearby, setNearby] = useState<NearbyUserSuggestion[]>([]);
  const [contacts, setContacts] = useState<ContactSuggestion[]>([]);
  const [contactsSyncing, setContactsSyncing] = useState(false);
  const [contactsSynced, setContactsSynced] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getFriendOfFriendSuggestions().then(setFof).catch(() => {});
    }, [])
  );

  useEffect(() => {
    if (!coords) return;
    updateMyLocation(coords.lat, coords.lng)
      .then(() => getNearbyUserSuggestions())
      .then(setNearby)
      .catch(() => {});
  }, [coords]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchUsers(trimmed);
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleSyncContacts = async () => {
    setContactsSyncing(true);
    try {
      const hashes = Platform.OS === 'web' ? await getWebContactPhoneHashes() : await getDeviceContactPhoneHashes();
      if (hashes == null) return; // unavailable, cancelled, or denied - leave the prompt up to retry
      const matches = await matchContacts(hashes);
      setContacts(matches);
      setContactsSynced(true);
    } finally {
      setContactsSyncing(false);
    }
  };

  const updateResult = (id: string, patch: Partial<SearchUserResult>) => {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleAdd = async (target: SearchUserResult) => {
    if (!session?.user) return;
    updateResult(target.id, { friendship_status: 'pending_sent' });
    try {
      await sendFriendRequest(target.id);
    } catch {
      updateResult(target.id, { friendship_status: 'none' });
    }
  };

  const handleAccept = async (target: SearchUserResult) => {
    if (!session?.user) return;
    updateResult(target.id, { friendship_status: 'accepted' });
    try {
      await acceptFriendRequest(session.user.id, target.id);
    } catch {
      updateResult(target.id, { friendship_status: 'pending_received' });
    }
  };

  const handleToggleClose = async (target: SearchUserResult) => {
    const next = !target.is_close_friend;
    updateResult(target.id, { is_close_friend: next });
    try {
      await setCloseFriend(target.id, next);
    } catch {
      updateResult(target.id, { is_close_friend: !next });
    }
  };

  const handleAddSuggestion = async (
    userId: string,
    removeFrom: 'fof' | 'nearby' | 'contacts'
  ) => {
    if (!session?.user) return;
    if (removeFrom === 'fof') setFof((prev) => prev.filter((s) => s.id !== userId));
    if (removeFrom === 'nearby') setNearby((prev) => prev.filter((s) => s.id !== userId));
    if (removeFrom === 'contacts') setContacts((prev) => prev.filter((s) => s.id !== userId));
    try {
      await sendFriendRequest(userId);
    } catch {
      // best-effort; if it failed the request just won't show up as "pending" anywhere yet
    }
  };

  const showingSuggestions = !query.trim();
  const showContactsSection = PHONE_CONTACTS_FEATURE_ENABLED && (Platform.OS !== 'web' || isWebContactPickerAvailable());
  const hasAnySuggestions = fof.length > 0 || nearby.length > 0 || contacts.length > 0;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{t('search.title')}</Text>
      </View>
      <View style={styles.searchBox}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          autoCapitalize="none"
        />
      </View>

      {showingSuggestions ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {fof.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('search.friendsOfFriends')}</Text>
              {fof.map((item) => (
                <UserRow
                  key={item.id}
                  avatarUrl={item.avatar_url}
                  name={item.display_name ?? item.username}
                  username={item.username}
                  friendshipStatus="none"
                  onPress={() => router.push(`/users/${item.id}`)}
                  onAdd={() => handleAddSuggestion(item.id, 'fof')}
                />
              ))}
            </View>
          ) : null}

          {nearby.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('search.peopleNearby')}</Text>
              {nearby.map((item) => (
                <UserRow
                  key={item.id}
                  avatarUrl={item.avatar_url}
                  name={item.display_name ?? item.username}
                  username={item.username}
                  friendshipStatus="none"
                  onPress={() => router.push(`/users/${item.id}`)}
                  onAdd={() => handleAddSuggestion(item.id, 'nearby')}
                />
              ))}
            </View>
          ) : null}

          {showContactsSection ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('search.fromContacts')}</Text>
              {contacts.map((item) => (
                <UserRow
                  key={item.id}
                  avatarUrl={item.avatar_url}
                  name={item.display_name ?? item.username}
                  username={item.username}
                  friendshipStatus="none"
                  onPress={() => router.push(`/users/${item.id}`)}
                  onAdd={() => handleAddSuggestion(item.id, 'contacts')}
                />
              ))}
              {!contactsSynced ? (
                <HoverPressable onPress={handleSyncContacts} style={[styles.syncButton, { borderWidth: 2, borderColor: colors.border }]} disabled={contactsSyncing}>
                  <Text style={[styles.syncButtonText, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
                    {contactsSyncing ? t('search.syncing') : t('search.findFriendsFromContacts')}
                  </Text>
                </HoverPressable>
              ) : contacts.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('search.noContactsYet')}</Text>
              ) : null}
            </View>
          ) : null}

          {!hasAnySuggestions && !showContactsSection ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('search.noSuggestions')}</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.listContent}>
          {results.map((item) => (
            <View key={item.id}>
              <UserRow
                avatarUrl={item.avatar_url}
                name={item.display_name ?? item.username}
                username={item.username}
                isCloseFriend={item.is_close_friend}
                friendshipStatus={item.friendship_status}
                onPress={() => router.push(`/users/${item.id}`)}
                onAdd={() => handleAdd(item)}
                onAccept={() => handleAccept(item)}
                onToggleClose={() => handleToggleClose(item)}
              />
              <View style={[styles.separator, { backgroundColor: border.soft.color }]} />
            </View>
          ))}
          {query.trim() && !loading && results.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('search.noUsersFound', { query: query.trim() })}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 26,
  },
  searchBox: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  separator: {
    height: 1,
  },
  syncButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  syncButtonText: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  empty: {
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
