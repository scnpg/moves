import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Never actually shown - (tabs)/_layout.tsx gives this route's tab bar slot
 * a custom button that pushes straight to the /room/create modal and never
 * calls the default tab-switch navigation. This file exists only because
 * expo-router's file-based <Tabs.Screen name="create" /> needs a matching
 * route to register the slot. The redirect below is a fallback for the
 * unlikely case something still lands here directly (e.g. a stale link).
 */
export default function CreateTabRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/room/create');
  }, [router]);

  return null;
}
