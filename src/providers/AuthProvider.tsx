import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** True while a just-established session's profile (and ban status) is being fetched - _layout.tsx's routing effect waits for this before acting on `session`, so it never optimistically navigates into the app for a session that's about to be signed back out as banned. */
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  /** Non-null right after a banned account gets caught and signed out - _layout.tsx shows a dedicated screen instead of bouncing straight to sign-in. */
  bannedReason: string | null;
  dismissBanNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [bannedReason, setBannedReason] = useState<string | null>(null);

  // get_my_profile() rather than a direct table select - last_lat/last_lng/
  // phone_hash/referred_by are locked down at the column-grant level (see
  // 20260818090000_lock_down_profile_columns.sql) since a plain select('*')
  // would otherwise leak those same columns when reading someone else's
  // row. This RPC is scoped to auth.uid(), so it's exempt.
  //
  // A banned account is caught here (rather than only relying on the DB-
  // level assert_not_banned() checks on individual write paths) so it's
  // signed out client-side the moment its profile next loads, instead of
  // silently failing one write at a time.
  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const { data } = await supabase.rpc('get_my_profile');
      const nextProfile = (data as Profile) ?? null;
      if (nextProfile?.is_banned) {
        setBannedReason(nextProfile.ban_reason ?? '');
        setProfile(null);
        await supabase.auth.signOut();
        return;
      }
      setProfile(nextProfile);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile();
      }
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        // Clear any stale banned-screen state from a previous account
        // before this (possibly different, possibly now-unbanned) one's
        // profile loads.
        setBannedReason(null);
        loadProfile();
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (session?.user) {
      await loadProfile();
    }
  };

  const dismissBanNotice = () => setBannedReason(null);

  return (
    <AuthContext.Provider value={{ session, profile, loading, profileLoading, refreshProfile, bannedReason, dismissBanNotice }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
