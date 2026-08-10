import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HoverPressable } from '@/components/HoverPressable';
import { Screen } from '@/components/Screen';
import { ShareProfilePanel } from '@/components/ShareProfilePanel';
import { TextField } from '@/components/TextField';
import { getFriendRequests, getMyFriends, getReferralCount } from '@/features/friends/api';
import { updateProfile, uploadAvatar } from '@/features/profile/api';
import { getHostedMoveCount, getJoinedMoveCount } from '@/features/moves/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { PHONE_CONTACTS_FEATURE_ENABLED } from '@/lib/features';
import { referralSignUpUrl } from '@/lib/links';
import { hashPhone } from '@/lib/phone';
import { isPrivateUnlocked, nextMilestoneLabel } from '@/lib/referrals';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

const BIO_MAX_LENGTH = 280;

function FounderBadge() {
  const { colors, border, font } = useTheme();
  const { t } = useLocale();
  return (
    <View style={[styles.founderBadge, { backgroundColor: colors.border, borderWidth: border.rest.width, borderColor: colors.border }]}>
      <Text style={[styles.founderStar, { color: colors.brand }]}>★</Text>
      <Text style={[styles.founderText, { color: colors.textInverse, fontFamily: font.family.monoBold }]}>{t('profile.founder')}</Text>
    </View>
  );
}

function StatCell({ value, label, bordered }: { value: number; label: string; bordered?: boolean }) {
  const { colors, border, font } = useTheme();
  return (
    <View style={[styles.statCell, bordered && { borderLeftWidth: border.soft.width, borderLeftColor: border.soft.color }]}>
      <Text style={[styles.statValue, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { colors, border, font } = useTheme();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bioInput, setBioInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [hostedCount, setHostedCount] = useState<number | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);
  const [copyingReferral, setCopyingReferral] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      getMyFriends().then((friends) => setFriendCount(friends.length)).catch(() => {});
      getFriendRequests()
        .then((requests) => setIncomingRequestCount(requests.filter((r) => r.direction === 'incoming').length))
        .catch(() => {});
      getReferralCount(session.user.id).then(setReferralCount).catch(() => {});
      getHostedMoveCount(session.user.id).then(setHostedCount).catch(() => {});
      getJoinedMoveCount(session.user.id).then(setJoinedCount).catch(() => {});
    }, [session?.user])
  );

  const handleCopyReferralLink = async () => {
    if (!session?.user) return;
    setCopyingReferral(true);
    try {
      await Clipboard.setStringAsync(referralSignUpUrl(session.user.id));
      notify(t('common.linkCopied'), t('profile.referralLinkCopiedMessage'));
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
      notify(t('profile.bioTooLong'), t('profile.bioTooLongMessage', { max: BIO_MAX_LENGTH }));
      return;
    }
    setSaving(true);
    try {
      const phoneHash = phoneInput.trim() ? await hashPhone(phoneInput.trim()) : undefined;
      if (phoneInput.trim() && !phoneHash) {
        notify(t('profile.phoneTooShort'), t('profile.phoneTooShortMessage'));
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
      notify(t('profile.couldNotSave'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!session?.user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notify(t('profile.photoAccessNeeded'), t('profile.photoAccessNeededMessage'));
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
      notify(t('profile.couldNotUploadPhoto'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const unlocked = isPrivateUnlocked(referralCount ?? 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.listContent}>
        <View style={styles.headerSection}>
          {/* Identity block */}
          <View style={styles.identityRow}>
            <HoverPressable onPress={handlePickAvatar} style={styles.avatarWrap} disabled={uploadingAvatar}>
              <Avatar uri={profile?.avatar_url} name={profile?.display_name ?? profile?.username} size={64} />
              {uploadingAvatar ? (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator size="small" color={colors.textInverse} />
                </View>
              ) : null}
            </HoverPressable>
            <View style={styles.identityText}>
              <View style={styles.nameRow}>
                <Text style={[styles.displayName, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]} numberOfLines={1}>
                  {profile?.display_name ?? profile?.username}
                </Text>
                {unlocked ? <FounderBadge /> : null}
              </View>
              <Text style={[styles.username, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>@{profile?.username}</Text>
            </View>
            <View style={styles.headerActions}>
              <HoverPressable onPress={() => setShareOpen((open) => !open)} style={styles.shareIconButton} lightenOpacity={0.15}>
                <Text style={styles.shareIcon}>🔗</Text>
              </HoverPressable>
              <Button label={t('profile.editShort')} variant="ghost" size="sm" onPress={startEditing} />
            </View>
          </View>

          {shareOpen && session?.user ? <ShareProfilePanel userId={session.user.id} /> : null}

          {profile?.bio ? (
            <Text style={[styles.bio, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{profile.bio}</Text>
          ) : null}

          {/* Stat strip */}
          <View style={[styles.statStrip, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
            <StatCell value={hostedCount ?? 0} label={t('profile.movesHosted')} />
            <StatCell value={joinedCount ?? 0} label={t('profile.movesJoined')} bordered />
            <StatCell value={friendCount ?? 0} label={t('profile.friendsStat')} bordered />
          </View>

          <HoverPressable onPress={() => router.push('/friends')}>
            <Card style={styles.friendsRow} raised={false}>
              <Text style={[styles.friendsLabel, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
                {t('profile.friends')}{friendCount != null ? ` · ${friendCount}` : ''}
              </Text>
              {incomingRequestCount > 0 ? (
                <View style={[styles.requestBadge, { backgroundColor: colors.accentPink }]}>
                  <Text style={[styles.requestBadgeText, { color: colors.textInverse, fontFamily: font.family.monoBold }]}>{incomingRequestCount}</Text>
                </View>
              ) : null}
              <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
            </Card>
          </HoverPressable>

          {/* Invite block */}
          <View style={[styles.inviteCard, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
            {unlocked ? (
              <View style={styles.inviteUnlocked}>
                <View style={styles.inviteUnlockedRow}>
                  <FounderBadge />
                  <Text style={[styles.inviteUnlockedLabel, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
                    {t('profile.badgeUnlocked')}
                  </Text>
                </View>
                <Text style={[styles.inviteDescription, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
                  {t('profile.badgeUnlockedDescription')}
                </Text>
                <Button label={t('profile.inviteMoreFriends')} variant="secondary" onPress={handleCopyReferralLink} loading={copyingReferral} />
              </View>
            ) : (
              <View style={styles.inviteProgress}>
                <Text style={[styles.friendsLabel, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
                  {t('profile.inviteFriends')}{referralCount != null ? ` · ${referralCount}` : ''}
                </Text>
                <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
                  {nextMilestoneLabel(referralCount ?? 0, t) ?? t('profile.allTiersUnlocked')}
                </Text>
                <Button label={t('profile.copyInviteLink')} onPress={handleCopyReferralLink} loading={copyingReferral} size="lg" />
              </View>
            )}
          </View>

          {editing ? (
            <Card style={styles.editCard}>
              <TextField label={t('auth.displayName')} value={displayName} onChangeText={setDisplayName} />
              <TextField
                label={t('profile.bioLabel')}
                value={bioInput}
                onChangeText={setBioInput}
                placeholder={t('profile.bioPlaceholder')}
                multiline
                maxLength={BIO_MAX_LENGTH}
              />
              <Text style={[styles.charCount, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
                {bioInput.length}/{BIO_MAX_LENGTH}
              </Text>
              {PHONE_CONTACTS_FEATURE_ENABLED ? (
                <>
                  <TextField
                    label={t('profile.phoneLabel')}
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    keyboardType="phone-pad"
                    placeholder={profile?.phone_hash ? t('profile.phoneReplacePlaceholder') : t('profile.phoneFindPlaceholder')}
                  />
                  <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('profile.phoneHelp')}</Text>
                </>
              ) : null}
              <View style={styles.editActions}>
                <Button label={t('profile.cancel')} variant="secondary" onPress={() => setEditing(false)} style={styles.flexButton} />
                <Button label={t('profile.save')} onPress={handleSave} loading={saving} style={styles.flexButton} />
              </View>
            </Card>
          ) : null}
        </View>

        <View style={styles.footer}>
          <View style={styles.legalRow}>
            <HoverPressable onPress={() => router.push('/terms')} style={styles.legalLinkWrap}>
              <Text style={[styles.legalLinkText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('auth.termsOfService')}</Text>
            </HoverPressable>
            <Text style={[styles.legalDot, { color: colors.textMuted }]}>·</Text>
            <HoverPressable onPress={() => router.push('/privacy')} style={styles.legalLinkWrap}>
              <Text style={[styles.legalLinkText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('auth.privacyPolicy')}</Text>
            </HoverPressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  headerSection: {
    gap: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarLoading: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  } as object,
  identityText: {
    flex: 1,
    gap: 3,
    paddingTop: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  displayName: {
    fontSize: 22,
    lineHeight: 26,
  },
  username: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  shareIconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIcon: {
    fontSize: 18,
  },
  founderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 18,
    paddingHorizontal: 7,
  },
  founderStar: {
    fontSize: 8,
  },
  founderText: {
    fontSize: 9,
    letterSpacing: 1,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
  },
  statStrip: {
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 28,
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendsLabel: {
    fontSize: 13,
    letterSpacing: 0.7,
  },
  chevron: {
    fontSize: 18,
  },
  requestBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestBadgeText: {
    fontSize: 11,
  },
  inviteCard: {
    padding: 16,
  },
  inviteProgress: {
    gap: 12,
  },
  inviteUnlocked: {
    gap: 12,
  },
  inviteUnlockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviteUnlockedLabel: {
    fontSize: 10,
    letterSpacing: 0.9,
  },
  inviteDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  editCard: {
    gap: 12,
  },
  field: {
    gap: 10,
  },
  helperText: {
    fontSize: 12,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 0.9,
  },
  footer: {
    gap: 16,
    marginTop: 24,
  },
  signOutButton: {
    marginTop: 0,
  },
  deleteAccountWrap: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteAccountText: {
    fontSize: 11,
    letterSpacing: 0.9,
  },
  legalRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  legalLinkWrap: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  legalLinkText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontSize: 12,
  },
});
