import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SubHeader } from '@/components/SubHeader';
import { getMoveByShareToken, joinMoveViaToken } from '@/features/moves/api';
import { notify } from '@/lib/alerts';
import { formatWhen } from '@/lib/format';
import { PENDING_JOIN_TOKEN_KEY } from '@/lib/links';
import type { MoveByShareToken } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';
import { color, font, spacing } from '@/theme/tokens';

/**
 * Reachable while signed out (see the join/ exemption in app/_layout.tsx) -
 * get_move_by_share_token() is granted to anon for exactly this preview.
 * Signed-in visitors auto-join and get redirected straight into the room;
 * signed-out visitors see the preview, then get sent to sign in with the
 * token stashed in AsyncStorage (processed here again once session is set).
 */
export default function JoinMoveScreen() {
  const { share_token } = useLocalSearchParams<{ share_token: string }>();
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<MoveByShareToken | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!share_token) return;
    try {
      const move = await getMoveByShareToken(share_token);
      setPreview(move);
      setNotFound(!move);
    } catch {
      setNotFound(true);
    }
  }, [share_token]);

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

  useEffect(() => {
    if (authLoading || !session?.user || !preview || !share_token) return;
    if (preview.already_member) {
      router.replace(`/room/${preview.id}`);
      return;
    }
    setJoining(true);
    joinMoveViaToken(share_token)
      .then(() => {
        AsyncStorage.removeItem(PENDING_JOIN_TOKEN_KEY).catch(() => {});
        router.replace(`/room/${preview.id}`);
      })
      .catch((err) => {
        notify('Could not join', err instanceof Error ? err.message : 'Please try again.');
        setJoining(false);
      });
  }, [session, authLoading, preview, share_token, router]);

  const handleBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const handleSignInToJoin = async () => {
    if (share_token) await AsyncStorage.setItem(PENDING_JOIN_TOKEN_KEY, share_token);
    router.push('/(auth)/sign-in');
  };

  if (loading || (session?.user && preview && !preview.already_member) || joining) {
    return (
      <Screen>
        <SubHeader title="" onBack={handleBack} />
        <View style={styles.center}>
          <ActivityIndicator color={color.brand} />
        </View>
      </Screen>
    );
  }

  if (notFound || !preview) {
    return (
      <Screen>
        <SubHeader title="" onBack={handleBack} />
        <View style={styles.center}>
          <Text style={styles.emptyText}>This link is invalid or has expired.</Text>
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
          <Text style={styles.title}>{preview.title}</Text>
          <Text style={styles.hostLine}>Hosted by {preview.host_display_name ?? preview.host_username}</Text>
        </View>

        {preview.description ? <Text style={styles.description}>{preview.description}</Text> : null}

        <View style={styles.metaRow}>
          <Badge label={formatWhen(preview.starts_at, preview.expires_at)} tone="green" />
          <Badge label="PRIVATE" tone="violet" />
        </View>

        <Text style={styles.helperText}>
          {preview.max_members ? `${preview.approved_count}/${preview.max_members} joined` : `${preview.approved_count} joined`}
        </Text>

        {preview.is_full ? (
          <Button label="This Move is full" variant="secondary" onPress={() => {}} disabled />
        ) : (
          <Button label="Sign in to join" onPress={handleSignInToJoin} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: color.textMuted, fontSize: font.size.sm, textAlign: 'center', paddingVertical: spacing.lg },
  content: { flex: 1, padding: spacing.lg, gap: spacing.md },
  header: { alignItems: 'center', gap: spacing.xxs, paddingVertical: spacing.md },
  title: { color: color.textPrimary, fontSize: font.size.xl, fontWeight: font.weight.heavy, textAlign: 'center', marginTop: spacing.sm },
  hostLine: { fontFamily: font.family.mono, color: color.textMuted, fontSize: font.size.sm },
  description: { color: color.textSecondary, fontSize: font.size.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  helperText: { fontFamily: font.family.mono, color: color.textMuted, fontSize: font.size.xs },
});
