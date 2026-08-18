import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ShareMovePanel } from '@/components/ShareMovePanel';
import { useLocale } from '@/i18n/LocaleProvider';
import { formatCountdown } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';

export default function MoveCreatedScreen() {
  const { id, title, expiresAt, shareToken, degreeLimit } = useLocalSearchParams<{
    id: string;
    title: string;
    expiresAt: string;
    shareToken: string;
    degreeLimit: string;
  }>();
  // join_move_via_token() only bypasses the eligibility check for Private
  // (Link-Only) Moves (see handle_move_join_request()) - for every other
  // tier the link just leads to "Not eligible to join" for anyone who
  // doesn't already qualify by degree, so showing it here would be
  // misleading. Matches the same degree_limit === 0 gate room/[id].tsx
  // already uses for the same panel.
  const isPrivate = degreeLimit === '0';
  const router = useRouter();
  const { t } = useLocale();
  const { colors, borderWidth, font } = useTheme();
  const [countdown, setCountdown] = useState(() => (expiresAt ? formatCountdown(expiresAt) : '0:00'));

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setCountdown(formatCountdown(expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const handleDone = () => {
    if (id) router.replace(`/room/${id}`);
    else router.replace('/(tabs)');
  };

  return (
    <Screen style={styles.noPadding}>
      <View style={[styles.topBar, { borderBottomWidth: borderWidth.structural, borderBottomColor: colors.border }]}>
        <Image source={require('../../../assets/images/movesletterlogo-trimmed.png')} style={styles.wordmark} resizeMode="contain" />
      </View>

      <View style={styles.content}>
        <Text style={[styles.statusLabel, { color: colors.brand, backgroundColor: colors.border, fontFamily: font.family.monoBold }]}>
          {t('moveCreated.moveIsLive')}
        </Text>

        <Text style={[styles.countdown, { color: colors.textPrimary, fontFamily: font.family.heroDisplay }]} key={countdown}>
          {countdown}
        </Text>
        <Text style={[styles.countdownLabel, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>{t('moveCreated.left')}</Text>

        <Text style={[styles.title, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{title}</Text>

        {isPrivate ? (
          <>
            <View style={styles.ruleWrap}>
              <Text style={[styles.ruleLabel, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>{t('moveCreated.share')}</Text>
              <View style={[styles.rule, { backgroundColor: colors.border }]} />
            </View>

            <Text style={[styles.shareNudge, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('moveCreated.shareNudge')}</Text>
          </>
        ) : null}
      </View>

      {isPrivate && shareToken ? <ShareMovePanel shareToken={shareToken} /> : null}

      <View style={styles.doneWrap}>
        <Button label={t('moveCreated.done')} variant="ghost" onPress={handleDone} />
      </View>

      <View style={[styles.bottomBar, { backgroundColor: colors.brand }]} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  noPadding: {
    padding: 0,
  },
  topBar: {
    paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  wordmark: {
    width: 100,
    height: 20,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 11,
    letterSpacing: 0.9,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 16,
  },
  countdown: {
    fontSize: 64,
    lineHeight: 62,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  countdownLabel: {
    fontSize: 11,
    letterSpacing: 0.9,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 28,
    maxWidth: 280,
  },
  ruleWrap: {
    width: '100%',
    marginBottom: 16,
  },
  ruleLabel: {
    fontSize: 10,
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  rule: {
    height: 2,
  },
  shareNudge: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
    maxWidth: 260,
  },
  doneWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  bottomBar: {
    height: 4,
  },
});
