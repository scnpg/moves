import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';

import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { Screen } from '@/components/Screen';
import { getModerationQueue, resolveModerationCase } from '@/features/blocking/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import type { ModerationQueueItem } from '@/lib/database.types';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Moderator-only review queue for threshold-triggered reports (see
 * supabase/migrations/20260810090000_content_moderation.sql). Not linked
 * from anywhere except Settings, and only shown there when
 * profile.is_moderator is true - get_moderation_queue() also re-checks
 * server-side, so a non-moderator hitting this route directly just gets an
 * empty list (the RPC throws, caught below) rather than any real content.
 */
export default function ModerationScreen() {
  const { t } = useLocale();
  const { colors, font, border } = useTheme();
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getModerationQueue()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleResolve = async (item: ModerationQueueItem, verdict: 'confirmed_threat' | 'no_threat') => {
    setResolvingId(item.id);
    try {
      await resolveModerationCase(item.id, verdict);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      notify(t('moderation.couldNotResolve'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setResolvingId(null);
    }
  };

  const contentFor = (item: ModerationQueueItem) => {
    if (item.kind === 'move') return { title: item.move_title, body: item.move_description };
    if (item.kind === 'message') return { title: `@${item.content_username}`, body: item.message_content };
    return { title: `@${item.profile_username}`, body: item.profile_display_name };
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('moderation.title'),
          headerLeft: () => <HeaderBackButton />,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
        }}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const { title, body } = contentFor(item);
            return (
              <Card style={styles.card} raised={false}>
                <View style={styles.headerRow}>
                  <Badge label={t(`moderation.kind${capitalize(item.kind)}` as never)} tone="pink" />
                  <Text style={[styles.reportCount, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
                    {t('moderation.reportCount', { count: item.report_count })}
                  </Text>
                </View>
                <Text style={[styles.contentTitle, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]} numberOfLines={1}>
                  {title}
                </Text>
                {body ? (
                  <Text style={[styles.contentBody, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]} numberOfLines={4}>
                    {body}
                  </Text>
                ) : null}
                {item.reasons && item.reasons.length > 0 ? (
                  <Text style={[styles.reasons, { color: colors.textMuted, fontFamily: font.family.monoRegular }]}>
                    {t('moderation.reasonsLabel')}: {item.reasons.join(', ')}
                  </Text>
                ) : null}
                {item.llm_reasoning ? (
                  <View style={[styles.llmBox, { borderWidth: border.soft.width, borderColor: border.soft.color }]}>
                    <Text style={[styles.llmLabel, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
                      {t('moderation.llmLabel')}
                    </Text>
                    <Text style={[styles.llmText, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>
                      {item.llm_reasoning}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <Button
                    label={t('moderation.markNoThreat')}
                    variant="secondary"
                    style={styles.flexButton}
                    loading={resolvingId === item.id}
                    onPress={() => handleResolve(item, 'no_threat')}
                  />
                  <Button
                    label={t('moderation.markThreat')}
                    variant="destructive"
                    style={styles.flexButton}
                    loading={resolvingId === item.id}
                    onPress={() => handleResolve(item, 'confirmed_threat')}
                  />
                </View>
              </Card>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
                {t('moderation.empty')}
              </Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportCount: {
    fontSize: 11,
    letterSpacing: 0.7,
  },
  contentTitle: {
    fontSize: 15,
  },
  contentBody: {
    fontSize: 13,
  },
  reasons: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  llmBox: {
    padding: 8,
    gap: 2,
  },
  llmLabel: {
    fontSize: 10,
    letterSpacing: 0.9,
  },
  llmText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  flexButton: {
    flex: 1,
  },
  empty: {
    paddingTop: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
