import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { HoverPressable } from '@/components/HoverPressable';
import { TextField } from '@/components/TextField';
import { useLocale } from '@/i18n/LocaleProvider';
import { notify } from '@/lib/alerts';
import { getCurrentLocation, useUserLocation } from '@/lib/useLocation';
import { useTheme } from '@/theme/ThemeProvider';

export interface LocationValue {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
}

// Violette's Lock, Potomac, MD - same fallback LiveMap.tsx and the web
// picker use until a real value (pin, ambient location, or search result)
// is available.
const DEFAULT_CENTER: LocationValue = { lat: 39.0672, lng: -77.3285 };
const DEFAULT_DELTA = 0.02;

/**
 * Real interactive map on iOS via Apple's own MapKit (react-native-maps,
 * PROVIDER_DEFAULT) - already linked and in active use by LiveMap.tsx, so
 * this needs no new native module or EAS build. Tap the map (or drag the
 * marker) to place/move the pin, mirroring LocationPicker.web.tsx's
 * click-to-pin Leaflet map.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { t } = useLocale();
  const { colors, border, font, scheme } = useTheme();
  const { coords } = useUserLocation();
  const mapRef = useRef<MapView | null>(null);
  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const center = value ?? coords ?? DEFAULT_CENTER;

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

  // Search results and "use my location" both change `value`/`coords`
  // without the user touching the map directly - animate there instead of
  // silently updating out of view, same idea as web's <Recenter>.
  useEffect(() => {
    mapRef.current?.animateToRegion(
      { latitude: center.lat, longitude: center.lng, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA },
      300
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

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

      <View style={[styles.mapWrap, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          userInterfaceStyle={scheme}
          style={styles.map}
          initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA }}
          onPress={(e) => onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
        >
          {value ? (
            <Marker
              coordinate={{ latitude: value.lat, longitude: value.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              draggable
              onDragEnd={(e) => onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
            >
              <View style={[styles.pinDot, { borderColor: colors.border, backgroundColor: colors.accentBlue }]} />
            </Marker>
          ) : null}
        </MapView>
      </View>

      <View style={styles.actionsRow}>
        <Text style={[styles.hint, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
          {value ? t('locationPicker.tapToMove') : t('locationPicker.tapToPin')}
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
  mapWrap: {
    height: 200,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
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
