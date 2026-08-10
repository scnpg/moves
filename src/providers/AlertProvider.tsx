import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/theme/ThemeProvider';

interface ToastItem {
  id: string;
  title: string;
  message?: string;
}

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  resolve: (value: boolean) => void;
}

// Module-level dispatcher: lets src/lib/alerts.ts call notify()/confirmAction()
// as plain functions from anywhere (api layers, screens) without threading
// context through every call site. Set once AlertProvider mounts.
let dispatchToast: ((title: string, message?: string) => void) | null = null;
let dispatchConfirm: ((title: string, message: string, confirmLabel: string) => Promise<boolean>) | null = null;

export function showToast(title: string, message?: string) {
  dispatchToast?.(title, message);
}

export function showConfirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return dispatchConfirm?.(title, message, confirmLabel) ?? Promise.resolve(false);
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const { colors, border, shadow, font } = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    dispatchToast = (title, message) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    };

    dispatchConfirm = (title, message, confirmLabel) =>
      new Promise((resolve) => {
        setConfirmRequest({ title, message, confirmLabel, resolve });
      });

    return () => {
      dispatchToast = null;
      dispatchConfirm = null;
    };
  }, []);

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const resolveConfirm = (value: boolean) => {
    confirmRequest?.resolve(value);
    setConfirmRequest(null);
  };

  return (
    <>
      {children}

      <View pointerEvents="box-none" style={styles.toastLayer}>
        {toasts.map((toast) => (
          <Pressable
            key={toast.id}
            onPress={() => dismissToast(toast.id)}
            style={[styles.toast, { backgroundColor: colors.bgCard, borderWidth: border.rest.width, borderColor: colors.border, ...shadow.hard }]}
          >
            <Text style={[styles.toastTitle, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{toast.title}</Text>
            {toast.message ? (
              <Text style={[styles.toastMessage, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{toast.message}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      {confirmRequest ? (
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.confirmCard, { backgroundColor: colors.bgCard, borderWidth: border.rest.width, borderColor: colors.border, ...shadow.hard }]}>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary, fontFamily: font.family.bodySemibold }]}>{confirmRequest.title}</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary, fontFamily: font.family.bodyRegular }]}>{confirmRequest.message}</Text>
            <View style={styles.confirmActions}>
              <Button
                label={t('common.cancel')}
                variant="secondary"
                onPress={() => resolveConfirm(false)}
                style={styles.flexButton}
              />
              <Button
                label={confirmRequest.confirmLabel}
                variant="destructive"
                onPress={() => resolveConfirm(true)}
                style={styles.flexButton}
              />
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  toastLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 16,
    gap: 12,
    zIndex: 1000,
  },
  toast: {
    width: '100%',
    maxWidth: 420,
    padding: 16,
  },
  toastTitle: {
    fontSize: 15,
  },
  toastMessage: {
    fontSize: 13,
    marginTop: 2,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 1001,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    padding: 16,
    gap: 12,
  },
  confirmTitle: {
    fontSize: 18,
  },
  confirmMessage: {
    fontSize: 14,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  flexButton: {
    flex: 1,
  },
});
