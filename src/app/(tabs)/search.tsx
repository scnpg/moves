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
import { color, font, spacing } from '@/theme/tokens';

export default function SearchScreen() {
  const { session } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { coords } = useUserLocation();
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
        <Text style={styles.headerTitle}>{t('search.title')}</Text>
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
              <Text style={styles.sectionTitle}>{t('search.friendsOfFriends')}</Text>
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
              <Text style={styles.sectionTitle}>{t('search.peopleNearby')}</Text>
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
              <Text style={styles.sectionTitle}>{t('search.fromContacts')}</Text>
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
                <HoverPressable onPress={handleSyncContacts} style={styles.syncButton} disabled={contactsSyncing}>
                  <Text style={styles.syncButtonText}>
                    {contactsSyncing ? t('search.syncing') : t('search.findFriendsFromContacts')}
                  </Text>
                </HoverPressable>
              ) : contacts.length === 0 ? (
                <Text style={styles.emptyText}>{t('search.noContactsYet')}</Text>
              ) : null}
            </View>
          ) : null}

          {!hasAnySuggestions && !showContactsSection ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('search.noSuggestions')}</Text>
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
              <View style={styles.separator} />
            </View>
          ))}
          {query.trim() && !loading && results.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('search.noUsersFound', { query: query.trim() })}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerTitle: {
    fontSize: font.size.xl,
    fontWeight: font.weight.heavy,
    color: color.textPrimary,
  },
  searchBox: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: color.borderSubtle,
  },
  syncButton: {
    borderWidth: 2,
    borderColor: color.border,
    borderRadius: 4,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  syncButtonText: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  empty: {
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: color.textMuted,
    fontSize: font.size.sm,
    textAlign: 'center',
  },
});
