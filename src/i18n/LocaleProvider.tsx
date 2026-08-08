import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en';
import es from './locales/es';
import zhHant from './locales/zh-Hant';

export type Locale = 'en' | 'es' | 'zh-Hant';

// Kept as a single flag so the whole feature (dictionaries, device
// detection, persistence, the header toggle) can be pinned off again in
// one place without touching every t() call site if needed.
export const LANGUAGE_SWITCHING_ENABLED = true;

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es', 'zh-Hant'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  'zh-Hant': '繁體中文',
};

/** Compact form for the header toggle. */
export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: 'EN',
  es: 'ES',
  'zh-Hant': '中',
};

const dictionaries = { en, es, 'zh-Hant': zhHant } as const;

// Generates the union of every dot-path down to a leaf string in the `en`
// dictionary (e.g. "auth.signIn", "degree.badge.0"), so t() is checked
// against real keys at compile time instead of accepting any string.
// Numeric-literal object keys (like the 0-4 in degree.badge) have `keyof`
// type `number`, not `string`, so this constrains to `string | number`
// (not just `string`) to pick those up too.
type DotPaths<T, Prefix extends string = ''> = {
  [K in keyof T & (string | number)]: T[K] extends string ? `${Prefix}${K}` : DotPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & (string | number)];

export type TranslationKey = DotPaths<typeof en>;

const STORAGE_KEY = 'moves:locale';

/**
 * Only zh-Hant (Traditional) is supported, not zh-Hans (Simplified) - a
 * bare "zh" tag with no script/region signal is treated as Traditional
 * since that's this app's only Chinese variant, consistent with the
 * Taiwan-first framing used elsewhere in the app. Explicit Simplified
 * signals (Hans script, CN/SG region) are left
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

/** Replaces "{name}" placeholders in a template string with the given values. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

interface LocaleContextValue {
  locale: Locale;
  /** Also persists the choice so it sticks across app restarts, overriding device detection from then on. */
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    if (!LANGUAGE_SWITCHING_ENABLED) return;
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
    return (key: TranslationKey, params?: Record<string, string | number>) => interpolate(lookup(dict, key), params);
  }, [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
