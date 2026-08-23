import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SubHeader } from '@/components/SubHeader';
import { TextField } from '@/components/TextField';
import { submitSupportRequest } from '@/features/support/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { useTheme } from '@/theme/ThemeProvider';

const SUPPORT_EMAIL = 'movessupport@gmail.com';

export default function SupportScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { colors, font } = useTheme();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleBack = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      notify(t('support.missingFieldsTitle'), t('support.missingFieldsMessage'));
      return;
    }
    setSending(true);
    try {
      await submitSupportRequest(title.trim(), message.trim());
      setTitle('');
      setMessage('');
      setSent(true);
    } catch (err) {
      notify(t('support.couldNotSend'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <SubHeader title={t('support.title')} onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{t('support.intro')}</Text>

        {sent ? (
          <View style={[styles.sentBanner, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
            <Text style={[styles.sentTitle, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{t('support.sentTitle')}</Text>
            <Text style={[styles.sentBody, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{t('support.sentMessage')}</Text>
            <Button label={t('support.sendAnother')} variant="secondary" onPress={() => setSent(false)} />
          </View>
        ) : (
          <View style={styles.form}>
            <TextField
              label={t('support.subjectLabel')}
              value={title}
              onChangeText={setTitle}
              placeholder={t('support.subjectPlaceholder')}
              maxLength={100}
            />
            <TextField
              label={t('support.messageLabel')}
              value={message}
              onChangeText={setMessage}
              placeholder={t('support.messagePlaceholder')}
              multiline
              maxLength={2000}
              style={styles.messageInput}
            />
            <Button label={t('support.send')} onPress={handleSend} loading={sending} size="lg" />
          </View>
        )}

        <View style={[styles.emailRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.emailText, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
            {t('support.emailFallback', { email: SUPPORT_EMAIL })}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 24,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    gap: 16,
  },
  messageInput: {
    minHeight: 140,
  },
  sentBanner: {
    borderWidth: 1,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  sentTitle: {
    fontSize: 16,
  },
  sentBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emailRow: {
    paddingTop: 20,
  },
  emailText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
