import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Button } from '@/components/Button';
import { HoverPressable } from '@/components/HoverPressable';
import { createMoveInviteLink, listMoveInviteLinks, revokeMoveInviteLink } from '@/features/moves/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { inviteLinkUrl } from '@/lib/links';
import type { MoveInviteLink } from '@/lib/database.types';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

interface InviteLinkPanelProps {
  moveId: string;
}

/**
 * Host-only, collapsed by default (tap-to-expand, same pattern as the
 * Settings screen's preference rows) - this is a niche action, not
 * something that should compete for space with the room header's more
 * frequently used sections every time a host opens their own Move.
 */
export function InviteLinkPanel({ moveId }: InviteLinkPanelProps) {
  const { session } = useAuth();
  const { t } = useLocale();
  const { colors, border, font } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [links, setLinks] = useState<MoveInviteLink[] | null>(null);
  const [creating, setCreating] = useState<'multi' | 'single' | null>(null);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && links === null) {
      listMoveInviteLinks(moveId)
        .then(setLinks)
        .catch(() => setLinks([]));
    }
  };

  const handleCreate = async (singleUse: boolean) => {
    if (!session?.user) return;
    setCreating(singleUse ? 'single' : 'multi');
    try {
      const link = await createMoveInviteLink(moveId, session.user.id, singleUse);
      await Clipboard.setStringAsync(inviteLinkUrl(link.token));
      notify(t('common.linkCopied'), t('inviteLink.linkCopiedMessage'));
      setLinks((prev) => [link, ...(prev ?? [])]);
    } catch (err) {
      notify(t('inviteLink.couldNotCreate'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setCreating(null);
    }
  };

  const handleCopy = async (token: string) => {
    await Clipboard.setStringAsync(inviteLinkUrl(token));
    notify(t('common.linkCopied'), t('inviteLink.linkCopiedMessage'));
  };

  const handleRevoke = async (linkId: string) => {
    try {
      await revokeMoveInviteLink(linkId);
      setLinks((prev) => (prev ?? []).map((l) => (l.id === linkId ? { ...l, revoked_at: new Date().toISOString() } : l)));
    } catch (err) {
      notify(t('inviteLink.couldNotRevoke'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    }
  };

  const activeLinks = (links ?? []).filter((l) => !l.revoked_at && (l.max_uses == null || l.use_count < l.max_uses));

  return (
    <View style={[styles.wrap, { borderBottomWidth: border.soft.width, borderBottomColor: border.soft.color }]}>
      <HoverPressable onPress={toggle} style={styles.disclosureRow} lightenOpacity={0.08}>
        <Text style={[styles.disclosureLabel, { color: colors.textMuted, fontFamily: font.family.monoBold }]}>
          {t('inviteLink.disclosureLabel')}
        </Text>
        <Text style={[styles.chevron, { color: colors.textMuted, transform: [{ rotate: expanded ? '90deg' : '0deg' }] }]}>›</Text>
      </HoverPressable>

      {expanded ? (
        <View style={styles.body}>
          <Text style={[styles.helper, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('inviteLink.helper')}</Text>

          <View style={styles.buttonRow}>
            <Button
              label={t('inviteLink.createMulti')}
              variant="secondary"
              size="sm"
              onPress={() => handleCreate(false)}
              loading={creating === 'multi'}
              style={styles.buttonFlex}
            />
            <Button
              label={t('inviteLink.createSingle')}
              variant="secondary"
              size="sm"
              onPress={() => handleCreate(true)}
              loading={creating === 'single'}
              style={styles.buttonFlex}
            />
          </View>

          {activeLinks.length > 0 ? (
            <View style={[styles.list, { borderTopWidth: border.soft.width, borderTopColor: border.soft.color }]}>
              {activeLinks.map((link, i) => (
                <View
                  key={link.id}
                  style={[styles.linkRow, i > 0 && { borderTopWidth: border.soft.width, borderTopColor: border.soft.color }]}
                >
                  <Text style={[styles.linkType, { color: colors.textPrimary, fontFamily: font.family.bodyRegular }]}>
                    {link.max_uses === 1 ? t('inviteLink.singleUseLabel') : t('inviteLink.multiUseLabel')}
                  </Text>
                  <HoverPressable onPress={() => handleCopy(link.token)} style={styles.linkAction}>
                    <Text style={[styles.linkActionText, { color: colors.textSecondary, fontFamily: font.family.monoBold }]}>
                      {t('common.copyLink').toUpperCase()}
                    </Text>
                  </HoverPressable>
                  <HoverPressable onPress={() => handleRevoke(link.id)} style={styles.linkAction}>
                    <Text style={[styles.linkActionText, { color: colors.danger, fontFamily: font.family.monoBold }]}>
                      {t('inviteLink.revoke').toUpperCase()}
                    </Text>
                  </HoverPressable>
                </View>
              ))}
            </View>
          ) : links !== null ? (
            <Text style={[styles.empty, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>{t('inviteLink.noActiveLinks')}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disclosureLabel: {
    fontSize: 12,
    letterSpacing: 0.7,
  },
  chevron: {
    fontSize: 15,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  helper: {
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonFlex: {
    flex: 1,
  },
  list: {
    paddingTop: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  linkType: {
    flex: 1,
    fontSize: 13,
  },
  linkAction: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  linkActionText: {
    fontSize: 10,
    letterSpacing: 0.7,
  },
  empty: {
    fontSize: 12,
    paddingTop: 4,
  },
});
