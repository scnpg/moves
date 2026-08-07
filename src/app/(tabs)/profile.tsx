import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';

import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HoverPressable } from '@/components/HoverPressable';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ShareProfilePanel } from '@/components/ShareProfilePanel';
import { TextField } from '@/components/TextField';
import { signOut } from '@/features/auth/api';
import { getFriendRequests, getMyFriends, getReferralCount } from '@/features/friends/api';
import { getHostedActiveMoves, updateProfile, uploadAvatar } from '@/features/profile/api';
import { LOCALE_LABELS, SUPPORTED_LOCALES, useLocale, type Locale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import type { Move } from '@/lib/database.types';
import { formatWhen } from '@/lib/format';
import { referralSignUpUrl } from '@/lib/links';
import { hashPhone } from '@/lib/phone';
import { nextMilestoneLabel } from '@/lib/referrals';
import { useAuth } from '@/providers/AuthProvider';
import { color, font, spacing } from '@/theme/tokens';

const BIO_MAX_LENGTH = 280;

export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bioInput, setBioInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeMoves, setActiveMoves] = useState<Move[]>([]);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [copyingReferral, setCopyingReferral] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      getHostedActiveMoves(session.user.id).then(setActiveMoves).catch(() => {});
      getMyFriends().then((friends) => setFriendCount(friends.length)).catch(() => {});
      getFriendRequests()
        .then((requests) => setIncomingRequestCount(requests.filter((r) => r.direction === 'incoming').length))
        .catch(() => {});
      getReferralCount(session.user.id).then(setReferralCount).catch(() => {});
    }, [session?.user])
  );

  const handleCopyReferralLink = async () => {
    if (!session?.user) return;
    setCopyingReferral(true);
    try {
      await Clipboard.setStringAsync(referralSignUpUrl(session.user.id));
      notify('Link copied', 'Share it - once they sign up, it counts toward your invites.');
    } finally {
      setCopyingReferral(false);
    }
  };

  const startEditing = () => {
    setDisplayName(profile?.display_name ?? '');
    setBioInput(profile?.bio ?? '');
    setPhoneInput('');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!session?.user) return;
    if (bioInput.length > BIO_MAX_LENGTH) {
      notify('Bio too long', `Keep it under ${BIO_MAX_LENGTH} characters.`);
      return;
    }
    setSaving(true);
    try {
      const phoneHash = phoneInput.trim() ? await hashPhone(phoneInput.trim()) : undefined;
      if (phoneInput.trim() && !phoneHash) {
        notify('Phone number too short', 'Enter a full number so contacts can find you.');
        setSaving(false);
        return;
      }
      await updateProfile(session.user.id, {
        display_name: displayName.trim() || null,
        bio: bioInput.trim() || null,
        ...(phoneHash ? { phone_hash: phoneHash } : {}),
      });
      await refreshProfile();
      setEditing(false);
    } catch (err) {
      notify('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!session?.user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify('Photo access needed', 'Allow photo library access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const publicUrl = await uploadAvatar(session.user.id, asset.uri, asset.mimeType ?? 'image/jpeg');
      await updateProfile(session.user.id, { avatar_url: publicUrl });
      await refreshProfile();
    } catch (err) {
      notify('Could not upload photo', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      notify('Sign out failed', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <Screen>
      <FlatList
        data={activeMoves}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>{t('profile.title')}</Text>
              <HoverPressable
                onPress={() => setShareOpen((open) => !open)}
                style={styles.shareIconButton}
                lightenOpacity={0.2}
              >
                <Text style={styles.shareIcon}>🔗</Text>
              </HoverPressable>
            </View>

            {shareOpen && session?.user ? <ShareProfilePanel userId={session.user.id} /> : null}

            <Card style={styles.profileCard}>
              <HoverPressable onPress={handlePickAvatar} style={styles.avatarWrap} disabled={uploadingAvatar}>
                <Avatar uri={profile?.avatar_url} name={profile?.display_name ?? profile?.username} size={72} />
                <View style={styles.avatarOverlay}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={color.textInverse} />
                  ) : (
                    <Text style={styles.avatarOverlayText}>EDIT</Text>
                  )}
                </View>
              </HoverPressable>
              <View style={styles.profileText}>
                <Text style={styles.displayName}>{profile?.display_name ?? profile?.username}</Text>
                <Text style={styles.username}>@{profile?.username}</Text>
              </View>
            </Card>

            {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            <HoverPressable onPress={() => router.push('/friends')}>
              <Card style={styles.friendsRow}>
                <Text style={styles.friendsLabel}>
                  {t('profile.friends')}{friendCount != null ? ` · ${friendCount}` : ''}
                </Text>
                {incomingRequestCount > 0 ? (
                  <View style={styles.requestBadge}>
                    <Text style={styles.requestBadgeText}>{incomingRequestCount}</Text>
                  </View>
                ) : null}
                <Text style={styles.chevron}>›</Text>
              </Card>
            </HoverPressable>

            <Card style={styles.referralCard}>
              <Text style={styles.friendsLabel}>
                {t('profile.inviteFriends')}{referralCount != null ? ` · ${referralCount}` : ''}
              </Text>
              <Text style={styles.helperText}>
                {nextMilestoneLabel(referralCount ?? 0) ?? 'All visibility tiers unlocked - nice work.'}
              </Text>
              <Button label={t('profile.copyInviteLink')} variant="secondary" onPress={handleCopyReferralLink} loading={copyingReferral} />
            </Card>

            {editing ? (
              <Card style={styles.editCard}>
                <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
                <TextField
                  label="Bio (optional)"
                  value={bioInput}
                  onChangeText={setBioInput}
                  placeholder="Say something about yourself"
                  multiline
                  maxLength={BIO_MAX_LENGTH}
                />
                <Text style={styles.charCount}>
                  {bioInput.length}/{BIO_MAX_LENGTH}
                </Text>
                <TextField
                  label="Phone number (optional)"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  keyboardType="phone-pad"
                  placeholder={profile?.phone_hash ? 'Already added — replace it' : 'So contacts can find you'}
                />
                <Text style={styles.helperText}>
                  Only a one-way hash of this number is ever stored - never the number itself.
                </Text>
                <View style={styles.editActions}>
                  <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} style={styles.flexButton} />
                  <Button label="Save" onPress={handleSave} loading={saving} style={styles.flexButton} />
                </View>
              </Card>
            ) : (
              <Button label={t('profile.edit')} variant="secondary" onPress={startEditing} />
            )}

            <Text style={styles.sectionTitle}>{t('profile.yourActiveMoves')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.moveCard}>
            <Text style={styles.moveTitle} onPress={() => router.push(`/room/${item.id}`)}>
              {item.title}
            </Text>
            <View style={styles.moveMetaRow}>
              <Badge label={formatWhen(item.starts_at, item.expires_at)} tone="green" />
            </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('profile.notHostingAnyMoves')}</Text>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Card style={styles.languageCard}>
              <Text style={styles.friendsLabel}>{t('profile.language')}</Text>
              <SegmentedControl
                segments={SUPPORTED_LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
                value={locale}
                onChange={(next) => setLocale(next as Locale)}
              />
            </Card>
            <Button label={t('profile.signOut')} variant="ghost" onPress={handleSignOut} style={styles.signOutButton} />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerSection: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: font.size.xl,
    fontWeight: font.weight.heavy,
    color: color.textPrimary,
  },
  shareIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  shareIcon: {
    fontSize: font.size.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: -6,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accentBlue,
    paddingVertical: 2,
    borderRadius: 3,
  },
  avatarOverlayText: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: 9,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  profileText: {
    flex: 1,
  },
  displayName: {
    color: color.textPrimary,
    fontSize: font.size.lg,
    fontWeight: font.weight.heavy,
  },
  username: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.sm,
  },
  bio: {
    color: color.textSecondary,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.4,
  },
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendsLabel: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  chevron: {
    color: color.textMuted,
    fontSize: font.size.lg,
  },
  requestBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: color.accentPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestBadgeText: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: 11,
    fontWeight: font.weight.bold,
  },
  referralCard: {
    gap: spacing.xs,
  },
  editCard: {
    gap: spacing.sm,
  },
  helperText: {
    color: color.textMuted,
    fontSize: font.size.xs,
    marginTop: -spacing.xs,
  },
  charCount: {
    fontFamily: font.family.mono,
    color: color.textMuted,
    fontSize: font.size.xs,
    textAlign: 'right',
    marginTop: -spacing.xs,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.wide,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  moveCard: {
    gap: spacing.xs,
  },
  moveTitle: {
    color: color.textPrimary,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
  },
  moveMetaRow: {
    flexDirection: 'row',
  },
  emptyText: {
    color: color.textMuted,
    fontSize: font.size.sm,
    paddingVertical: spacing.md,
  },
  footer: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  languageCard: {
    gap: spacing.sm,
  },
  signOutButton: {
    marginTop: 0,
  },
});
