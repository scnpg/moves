import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { HoverPressable } from '@/components/HoverPressable';
import { TextField } from '@/components/TextField';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { getCurrentLocation } from '@/lib/useLocation';
import { useTheme } from '@/theme/ThemeProvider';

export interface LocationValue {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
}

/**
 * No native map view wired up yet (see LocationPicker.web.tsx for the real
 * click-to-pin Leaflet map on web) - address search and one-time "use my
 * location" still work, they just can't show a pin on a map here.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { t } = useLocale();
  const { colors, border, font } = useTheme();
  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  // Debounced forward-geocoding: search fires 300ms after typing stops.
  useEffect(() => {
    const trimmed = address.trim();
    if (!trimmed) return;

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`
        );
        const results = await response.json();
        if (results[0]) {
          onChange({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const here = await getCurrentLocation();
      onChange(here);
    } catch (err) {
      notify(
        t('locationPicker.couldNotGetLocation'),
        err instanceof Error ? err.message : t('locationPicker.checkPermission')
      );
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextField
            value={address}
            onChangeText={setAddress}
            placeholder={t('locationPicker.searchPlaceholder')}
            autoCapitalize="none"
          />
        </View>
        {searching ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
      </View>
      <View style={styles.actionsRow}>
        <Text style={[styles.hint, { color: value ? colors.brand : colors.textMuted, fontFamily: font.family.bodyRegular }]}>
          {value ? `📍 ${t('locationPicker.pinnedAt', { lat: value.lat.toFixed(3), lng: value.lng.toFixed(3) })}` : t('locationPicker.noLocationSet')}
        </Text>
        <View style={styles.actionButtons}>
          <HoverPressable
            onPress={handleUseMyLocation}
            style={[styles.smallButton, { borderWidth: border.rest.width, borderColor: colors.brand }]}
            disabled={locating}
          >
            <Text style={[styles.smallButtonText, { color: colors.brand, fontFamily: font.family.monoBold }]}>
              {locating ? t('locationPicker.locating') : t('locationPicker.useMyLocation')}
            </Text>
          </HoverPressable>
          {value ? (
            <HoverPressable onPress={() => onChange(null)} style={[styles.smallButton, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
              <Text style={[styles.smallButtonText, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>{t('locationPicker.clear')}</Text>
            </HoverPressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  hint: {
    fontSize: 12,
    flexShrink: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  smallButtonText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
