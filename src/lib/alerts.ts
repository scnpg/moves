import { Alert, Platform } from 'react-native';

import { showConfirm, showToast } from '@/providers/AlertProvider';

// react-native-web's Alert.alert() is a hard no-op (`static alert() {}`) -
// no dialog, no callback, nothing - on every platform it targets. On web
// these render through AlertProvider (in-app toast/modal, styled like the
// rest of the app) instead of window.alert/confirm, which look like raw
// browser chrome. Native still gets a real Alert.

/** Informational, single-acknowledgement alert. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    showToast(title, message);
    return;
  }
  Alert.alert(title, message);
}

/** Two-choice confirmation; resolves true only if the destructive/confirm option was chosen. */
export function confirmAction(title: string, message: string, confirmLabel = 'Confirm'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return showConfirm(title, message, confirmLabel);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
