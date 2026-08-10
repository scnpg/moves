import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

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

// Violette's Lock, Potomac, MD - used until the picker has a real value or a device fix.
const DEFAULT_CENTER: [number, number] = [39.0672, -77.3285];

function ClickToPin({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// MapContainer's center/zoom props only apply on first mount in
// react-leaflet - without this, neither the ambient location resolving
// after the map is already up, nor pressing "use my location", actually
// moves the view. The pin was always placed correctly; it just wasn't in
// frame.
function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    // The map lives inside a fixed-height card that react-native-web lays
    // out after Leaflet's own initial size measurement, so Leaflet's
    // cached container size can be stale by the time this runs -
    // setView() then computes the wrong pixel origin and silently doesn't
    // move anything. invalidateSize() forces a fresh measurement first.
    map.invalidateSize();
    map.setView([lat, lng], zoom, { animate: false });
  }, [lat, lng, zoom, map]);
  return null;
}

/**
 * Address search (Nominatim - free, no API key, fine for this app's low
 * request volume) plus a click-to-place pin on a real map. Replaces
 * continuous device-location sharing with a single explicit point the host
 * chooses - "use my location" below is a one-time convenience to seed the
 * pin, not a live feed.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { t } = useLocale();
  const { colors, border, font, scheme } = useTheme();
  const { coords } = useUserLocation();
  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const center: [number, number] = value
    ? [value.lat, value.lng]
    : coords
      ? [coords.lat, coords.lng]
      : DEFAULT_CENTER;

  // Debounced forward-geocoding: search fires 300ms after typing stops,
  // rather than requiring an explicit submit.
  useEffect(() => {
    const trimmed = address.trim();
    if (!trimmed) return;

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`,
          { headers: { Accept: 'application/json' } }
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

      <View style={[styles.mapWrap, { borderWidth: border.rest.width, borderColor: border.rest.color }]}>
        <MapContainer
          key={scheme}
          center={center}
          zoom={17}
          style={{ height: '100%', width: '100%', touchAction: 'none' } as object}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={
              scheme === 'dark'
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            }
          />
          <Recenter lat={center[0]} lng={center[1]} zoom={17} />
          <ClickToPin onPick={(lat, lng) => onChange({ lat, lng })} />
          {value ? (
            <CircleMarker
              center={[value.lat, value.lng]}
              radius={9}
              pathOptions={{ color: colors.border, weight: 2, fillColor: colors.accentBlue, fillOpacity: 0.85 }}
            />
          ) : null}
        </MapContainer>
      </View>

      <View style={styles.actionsRow}>
        <Text style={[styles.hint, { color: colors.textMuted, fontFamily: font.family.bodyRegular }]}>
          {value ? t('locationPicker.tapToMove') : t('locationPicker.tapToPin')}
        </Text>
        <View style={styles.actionButtons}>
          <HoverPressable onPress={handleUseMyLocation} style={[styles.smallButton, { borderWidth: border.rest.width, borderColor: border.rest.color }]} disabled={locating}>
            <Text style={[styles.smallButtonText, { color: colors.textPrimary, fontFamily: font.family.monoBold }]}>
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
    alignItems: 'flex-end',
    gap: 8,
  },
  searchInput: {
    flex: 1,
  },
  mapWrap: {
    height: 200,
    overflow: 'hidden',
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
