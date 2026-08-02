import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert() is a hard no-op (`static alert() {}`) -
// no dialog, no callback, nothing - on every platform it targets. These
// wrappers fall back to window.alert/confirm on web so alerts and
// destructive confirmations actually work there; native still gets a real
// Alert.

/** Informational, single-acknowledgement alert. */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Two-choice confirmation; resolves true only if the destructive/confirm option was chosen. */
export function confirmAction(title: string, message: string, confirmLabel = 'Confirm'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
