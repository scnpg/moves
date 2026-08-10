import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { darkTheme, lightTheme, type Theme } from '@/theme/themes';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type TimeFormat = '12h' | '24h';
export type UnitSystem = 'imperial' | 'metric';

const THEME_MODE_KEY = 'moves:theme_mode';
const TIME_FORMAT_KEY = 'moves:time_format';
const UNIT_SYSTEM_KEY = 'moves:unit_system';

interface ThemeContextValue extends Theme {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  scheme: 'light' | 'dark';
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>('12h');
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>('imperial');

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        setThemeModeState(stored);
      }
    });
    AsyncStorage.getItem(TIME_FORMAT_KEY).then((stored) => {
      if (stored === '12h' || stored === '24h') {
        setTimeFormatState(stored);
      }
    });
    AsyncStorage.getItem(UNIT_SYSTEM_KEY).then((stored) => {
      if (stored === 'imperial' || stored === 'metric') {
        setUnitSystemState(stored);
      }
    });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_MODE_KEY, mode).catch(() => {});
  };

  const setTimeFormat = (format: TimeFormat) => {
    setTimeFormatState(format);
    AsyncStorage.setItem(TIME_FORMAT_KEY, format).catch(() => {});
  };

  const setUnitSystem = (system: UnitSystem) => {
    setUnitSystemState(system);
    AsyncStorage.setItem(UNIT_SYSTEM_KEY, system).catch(() => {});
  };

  const scheme: 'light' | 'dark' =
    themeMode === 'auto' ? (systemScheme === 'dark' ? 'dark' : 'light') : themeMode;

  const value = useMemo<ThemeContextValue>(() => {
    const theme = scheme === 'dark' ? darkTheme : lightTheme;
    return { ...theme, themeMode, setThemeMode, scheme, timeFormat, setTimeFormat, unitSystem, setUnitSystem };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme, themeMode, timeFormat, unitSystem]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
