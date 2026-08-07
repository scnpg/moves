import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { updateProfile } from '@/features/profile/api';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { hashPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { color, font, spacing } from '@/theme/tokens';

// See PhoneAuth.web.tsx (used automatically on that platform) for the
// full-featured version with a country picker - react-phone-number-input
// is React-DOM only. This native fallback just asks for a full E.164-style
// number ("+886..." etc) directly; same auth calls either way. A phone-
// first signup's placeholder username is handled by the root layout (see
// that component's doc comment for why it can't be done here).
type Step = 'phone' | 'code';

export function PhoneAuth({ onDone }: { onDone: () => void }) {
  const { t } = useLocale();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    const trimmed = phone.trim();
    if (!trimmed.startsWith('+') || trimmed.length < 8) {
      notify(t('phoneAuth.invalidNumber'), t('phoneAuth.enterFullNumberNative'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: trimmed });
      if (error) throw error;
      setStep('code');
    } catch (err) {
      notify(t('phoneAuth.couldNotSendCode'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone || code.trim().length < 4) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ phone: trimmedPhone, token: code.trim(), type: 'sms' });
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error('Verification failed');

      const phoneHash = await hashPhone(trimmedPhone);
      if (phoneHash) {
        updateProfile(user.id, { phone_hash: phoneHash }).catch(() => {});
      }

      onDone();
    } catch (err) {
      notify(t('phoneAuth.couldNotVerifyCode'), err instanceof Error ? err.message : t('common.pleaseTryAgain'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'code') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.helper}>{t('phoneAuth.codeSentTo', { phone: phone.trim() })}</Text>
        <TextField label={t('phoneAuth.codeLabel')} value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="123456" />
        <Button label={t('phoneAuth.verify')} onPress={handleVerify} loading={loading} />
        <Button label={t('phoneAuth.useDifferentNumber')} variant="ghost" onPress={() => setStep('phone')} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TextField
        label={t('phoneAuth.phoneNumberLabelNative')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+1 555 123 4567"
      />
      <Button label={t('phoneAuth.sendCode')} onPress={handleSendCode} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  helper: {
    color: color.textSecondary,
    fontSize: font.size.sm,
  },
});
