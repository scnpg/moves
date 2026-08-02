import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { Button } from '@/components/Button';
import { HoverPressable } from '@/components/HoverPressable';
import { TextField } from '@/components/TextField';
import { useUserLocation } from '@/lib/useLocation';
import { borderWidth, color, font, radius, spacing } from '@/theme/tokens';

export interface LocationValue {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
}

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006];

function ClickToPin({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
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
  const { coords } = useUserLocation();
  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);

  const center: [number, number] = value
    ? [value.lat, value.lng]
    : coords
      ? [coords.lat, coords.lng]
      : DEFAULT_CENTER;

  const handleSearch = async () => {
    if (!address.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address.trim())}`,
        { headers: { Accept: 'application/json' } }
      );
      const results = await response.json();
      if (results[0]) {
        onChange({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextField
            value={address}
            onChangeText={setAddress}
            placeholder="Search an address (optional)"
            autoCapitalize="none"
            onSubmitEditing={handleSearch}
          />
        </View>
        <Button label="Find" variant="secondary" onPress={handleSearch} loading={searching} />
      </View>

      <View style={styles.mapWrap}>
        <MapContainer
          center={center}
          zoom={value ? 15 : 12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <ClickToPin onPick={(lat, lng) => onChange({ lat, lng })} />
          {value ? (
            <CircleMarker
              center={[value.lat, value.lng]}
              radius={9}
              pathOptions={{ color: '#111111', weight: 2, fillColor: color.accentBlue, fillOpacity: 0.85 }}
            />
          ) : null}
        </MapContainer>
      </View>

      <View style={styles.actionsRow}>
        <Text style={styles.hint}>{value ? 'Tap the map to move the pin.' : 'Tap the map to drop a pin.'}</Text>
        <View style={styles.actionButtons}>
          {coords ? (
            <HoverPressable
              onPress={() => onChange({ lat: coords.lat, lng: coords.lng })}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>USE MY LOCATION</Text>
            </HoverPressable>
          ) : null}
          {value ? (
            <HoverPressable onPress={() => onChange(null)} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>CLEAR</Text>
            </HoverPressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
  },
  mapWrap: {
    height: 200,
    borderWidth: borderWidth.base,
    borderColor: color.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  hint: {
    color: color.textMuted,
    fontSize: font.size.xs,
    flexShrink: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  smallButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: color.border,
  },
  smallButtonText: {
    fontFamily: font.family.mono,
    color: color.textPrimary,
    fontSize: 10,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.label,
  },
});
