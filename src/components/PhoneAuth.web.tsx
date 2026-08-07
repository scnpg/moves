import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import en from 'react-phone-number-input/locale/en.json';
import 'react-phone-number-input/style.css';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { updateProfile } from '@/features/profile/api';
import { notify } from '@/lib/alerts';
import { hashPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

// Product requirement: Taiwan reads "Taiwan, R.O.C" in the country picker,
// not the library's default "Taiwan".
const PHONE_LABELS = { ...en, TW: 'Taiwan, R.O.C' };

type Step = 'phone' | 'code';

/**
 * Two-step OTP auth (send/verify) via Supabase's own phone auth. Reuses
 * the existing hash-only phone storage (src/lib/phone.ts) for contact
 * matching - the verified number itself lives only in Supabase Auth's own
 * `auth.users.phone`, never in our schema.
 *
 * A phone-first signup gets a placeholder username (handle_new_user()'s
 * fallback) - the root layout detects that and routes to /complete-profile
 * before letting them into the app proper, rather than doing it here,
 * since the session (and the layout's own redirect) is already live the
 * instant verifyOtp() resolves.
 *
 * Not functionally live until an SMS provider is configured in the
 * Supabase Auth dashboard - signInWithOtp() will error without one.
 */
export function PhoneAuth({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!phone || !isValidPhoneNumber(phone)) {
      notify('Invalid number', 'Enter a full phone number, including country code.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setStep('code');
    } catch (err) {
      notify('Could not send code', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!phone || code.trim().length < 4) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: 'sms' });
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error('Verification failed');

      const phoneHash = await hashPhone(phone);
      if (phoneHash) {
        updateProfile(user.id, { phone_hash: phoneHash }).catch(() => {});
      }

      onDone();
    } catch (err) {
      notify('Could not verify code', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'code') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.helper}>Enter the code sent to {phone}.</Text>
        <TextField label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="123456" />
        <Button label="Verify" onPress={handleVerify} loading={loading} />
        <Button label="Use a different number" variant="ghost" onPress={() => setStep('phone')} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>PHONE NUMBER</Text>
      <View style={styles.phoneInputWrap}>
        <PhoneInput international defaultCountry="US" labels={PHONE_LABELS} value={phone} onChange={setPhone} />
      </View>
      <Button label="Send code" onPress={handleSendCode} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: font.family.mono,
    color: color.textSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
  helper: {
    color: color.textSecondary,
    fontSize: font.size.sm,
  },
  phoneInputWrap: {
    backgroundColor: color.bgCard,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
