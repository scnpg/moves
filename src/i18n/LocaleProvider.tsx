import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en';
import es from './locales/es';
import zhHant from './locales/zh-Hant';

export type Locale = 'en' | 'es' | 'zh-Hant';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es', 'zh-Hant'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  'zh-Hant': '繁體中文',
};

const dictionaries = { en, es, 'zh-Hant': zhHant } as const;

// Generates the union of every dot-path down to a leaf string in the `en`
// dictionary (e.g. "auth.signIn"), so t() is checked against real keys at
// compile time instead of accepting any string.
type DotPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = DotPaths<typeof en>;

const STORAGE_KEY = 'moves:locale';

/**
 * Only zh-Hant (Traditional) is supported, not zh-Hans (Simplified) - a
 * bare "zh" tag with no script/region signal is treated as Traditional
 * since that's this app's only Chinese variant, consistent with the
 * Taiwan-first framing used elsewhere (PhoneAuth's "Taiwan, R.O.C." country
 * label). Explicit Simplified signals (Hans script, CN/SG region) are left
 * unmatched so they fall through to the next preferred device locale.
 */
function isTraditionalChineseTag(tag: {
  languageCode: string | null;
  languageScriptCode: string | null;
  regionCode: string | null;
}): boolean {
  if (tag.languageCode !== 'zh') return false;
  if (tag.languageScriptCode === 'Hans') return false;
  if (tag.regionCode === 'CN' || tag.regionCode === 'SG') return false;
  return true;
}

/** Device locales are returned in the user's own preference order - first supported match wins. */
export function resolveDeviceLocale(): Locale {
  for (const tag of Localization.getLocales()) {
    if (isTraditionalChineseTag(tag)) return 'zh-Hant';
    if (tag.languageCode === 'es') return 'es';
    if (tag.languageCode === 'en') return 'en';
  }
  return 'en';
}

function lookup(dict: object, path: string): string {
  const value: unknown = path
    .split('.')
    .reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), dict);
  return typeof value === 'string' ? value : path;
}

interface LocaleContextValue {
  locale: Locale;
  /** Also persists the choice so it sticks across app restarts, overriding device detection from then on. */
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!mounted) return;
      const isSupported = (SUPPORTED_LOCALES as readonly string[]).includes(stored ?? '');
      setLocaleState(isSupported ? (stored as Locale) : resolveDeviceLocale());
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const t = useMemo(() => {
    const dict = dictionaries[locale];
    return (key: TranslationKey) => lookup(dict, key);
  }, [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
