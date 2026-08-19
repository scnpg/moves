import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SubHeader } from '@/components/SubHeader';
import { getMoveByInviteLink, joinMoveViaInviteLink } from '@/features/moves/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { formatWhen } from '@/lib/format';
import { PENDING_INVITE_TOKEN_KEY } from '@/lib/links';
import type { MoveByInviteLink } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

const DEGREE_TONE = { 0: 'violet', 1: 'green', 2: 'blue', 3: 'pink', 4: 'red' } as const;

/**
 * Reachable while signed out (see the invite/ exemption in app/_layout.tsx) -
 * get_move_by_invite_link() is granted to anon for exactly this preview.
 * Mirrors join/[share_token].tsx's flow, but a bypass link works on a Move
 * at any degree_limit tier (not just Private) and can be single-use, so it
 * shows the Move's real tier badge and a distinct "no longer active"
 * state instead of treating every invalid token as simply "not found".
 */
export default function InviteLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const { colors, font } = useTheme();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<MoveByInviteLink | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const move = await getMoveByInviteLink(token);
      setPreview(move);
      setNotFound(!move);
    } catch {
      setNotFound(true);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load().finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const willAutoJoin = !!session?.user && !!preview && !preview.already_member && preview.link_valid;

  useEffect(() => {
    if (!willAutoJoin || !token || !preview) return;
    setJoining(true);
    joinMoveViaInviteLink(token)
      .then(() => {
        AsyncStorage.removeItem(PENDING_INVITE_TOKEN_KEY).catch(() => {});
        router.replace(`/room/${preview.id}`);
      })
      .catch((err) => {
        notify(t('invite.couldNotJoin'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
        setJoining(false);
      });
  }, [willAutoJoin, preview, token, router, t]);

  useEffect(() => {
    if (authLoading || !session?.user || !preview?.already_member) return;
    router.replace(`/room/${preview.id}`);
  }, [session, authLoading, preview, router]);

  const handleBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const handleSignInToJoin = async () => {
    if (token) await AsyncStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
    router.push('/(auth)/sign-in');
  };

  if (loading || willAutoJoin || joining) {
    return (
      <Screen>
        <SubHeader title="" onBack={handleBack} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </Screen>
    );
  }

  if (notFound || !preview) {
    return (
      <Screen>
        <SubHeader title="" onBack={handleBack} />
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('invite.linkInvalid')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <SubHeader title={preview.title} onBack={handleBack} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Avatar uri={preview.host_avatar_url} name={preview.host_display_name ?? preview.host_username} size={56} />
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{preview.title}</Text>
          <Text style={[styles.hostLine, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
            {t('common.hostedByName', { name: preview.host_display_name ?? preview.host_username })}
          </Text>
        </View>

        {preview.description ? (
          <Text style={[styles.description, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{preview.description}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <Badge label={formatWhen(preview.starts_at, preview.expires_at, t)} tone="green" />
          <Badge label={t(`degree.badge.${preview.degree_limit}`)} tone={DEGREE_TONE[preview.degree_limit]} />
        </View>

        <Text style={[styles.helperText, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
          {preview.max_members
            ? t('room.peopleJoined', { count: preview.approved_count, max: preview.max_members })
            : t('room.peopleJoinedNoCap', { count: preview.approved_count })}
        </Text>

        {!preview.link_valid ? (
          <Text style={[styles.waitingText, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{t('invite.linkNoLongerActive')}</Text>
        ) : preview.is_full ? (
          <Button label={t('room.moveFull')} variant="secondary" onPress={() => {}} disabled size="lg" />
        ) : (
          <Button label={t('invite.signInToJoin')} onPress={handleSignInToJoin} size="lg" />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  content: { flex: 1, padding: 16, gap: 16 },
  header: { alignItems: 'center', gap: 4, paddingVertical: 16 },
  title: { fontSize: 22, lineHeight: 26, textAlign: 'center', marginTop: 12 },
  hostLine: { fontSize: 11, letterSpacing: 0.9 },
  description: { fontSize: 16 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  helperText: { fontSize: 11 },
  waitingText: { fontSize: 15, textAlign: 'center' },
});
