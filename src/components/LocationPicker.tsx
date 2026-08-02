import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

/**
 * No native map view wired up yet (see LocationPicker.web.tsx for the real
 * click-to-pin Leaflet map on web) - address search and one-time "use my
 * location" still work, they just can't show a pin on a map here.
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { coords } = useUserLocation();
  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!address.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address.trim())}`
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
      <TextField
        value={address}
        onChangeText={setAddress}
        placeholder="Search an address (optional)"
        autoCapitalize="none"
        onSubmitEditing={handleSearch}
      />
      <View style={styles.actionsRow}>
        <Text style={styles.hint}>
          {value ? `Pinned at ${value.lat.toFixed(3)}, ${value.lng.toFixed(3)}` : 'No location set.'}
        </Text>
        <View style={styles.actionButtons}>
          {coords ? (
            <HoverPressable
              onPress={() => onChange({ lat: coords.lat, lng: coords.lng })}
              style={styles.smallButton}
              disabled={searching}
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
