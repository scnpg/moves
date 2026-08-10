import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;
const PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2);

interface WheelPickerProps {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

/** iOS-style snapping scroll wheel - the center row is the selected value. */
export function WheelPicker({ values, value, onChange, formatValue }: WheelPickerProps) {
  const { colors, border, font } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const index = Math.max(0, values.indexOf(value));

  // Re-sync scroll position whenever the value changes from outside this
  // wheel (initial mount, or the other wheel/AM-PM toggle changing it) -
  // harmless no-op when it's already there from the user's own scroll.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
  }, [index]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)));
    if (values[i] !== value) onChange(values[i]);
  };

  return (
    <View style={styles.wheel}>
      <View pointerEvents="none" style={[styles.centerBox, { top: PADDING, borderTopWidth: border.soft.width, borderBottomWidth: border.soft.width, borderColor: border.soft.color }]} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={{ paddingVertical: PADDING }}
      >
        {values.map((v) => {
          const selected = v === value;
          return (
            <Pressable
              key={v}
              onPress={() => {
                onChange(v);
                scrollRef.current?.scrollTo({ y: values.indexOf(v) * ITEM_HEIGHT, animated: true });
              }}
              style={styles.item}
            >
              <Text
                style={[
                  styles.itemText,
                  { color: selected ? colors.textPrimary : colors.textMuted, fontFamily: selected ? font.family.monoBold : font.family.monoRegular },
                ]}
              >
                {formatValue ? formatValue(v) : v}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: {
    flex: 1,
    height: ITEM_HEIGHT * VISIBLE_COUNT,
    overflow: 'hidden',
  },
  centerBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    zIndex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
