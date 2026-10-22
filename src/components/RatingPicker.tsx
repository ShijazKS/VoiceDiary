import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RATING_GROUPS } from '@/lib/insights';
import { SERIF, useTheme, type Palette } from '@/lib/theme';

export const ratingGroup = (n: number) =>
  RATING_GROUPS.find((g) => n >= g.min && n <= g.max) ?? RATING_GROUPS[2];

const ROWS = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
];

type Props = { value: number; onChange: (n: number) => void };

/**
 * Big, thumb-friendly 1–10 picker: two rows of five large tiles
 * plus a live "7 / 10 · Good" readout. Used by RatingSheet (and can replace
 * the small dots in DetailsSheet).
 */
export default function RatingPicker({ value, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const group = ratingGroup(value);

  return (
    <View>
      <View style={styles.readout}>
        <Text style={styles.value}>
          {value}
          <Text style={styles.outOf}> / 10</Text>
        </Text>
        <View style={styles.labelPill}>
          <View style={[styles.labelDot, { backgroundColor: group.color }]} />
          <Text style={styles.labelText}>{group.label}</Text>
        </View>
      </View>

      {ROWS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((n) => {
            const on = n === value;
            return (
              <Pressable
                key={n}
                onPress={() => onChange(n)}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${n} out of 10`}
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { opacity: 0.75 }]}
              >
                <Text style={[styles.tileText, on && styles.tileTextOn]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    readout: { alignItems: 'center', marginTop: 14, marginBottom: 6 },
    value: { fontSize: 48, fontFamily: SERIF, fontWeight: '700', color: c.brand },
    outOf: { fontSize: 18, fontWeight: '400', color: c.muted },
    labelPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: 2,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: c.chip,
    },
    labelDot: { width: 9, height: 9, borderRadius: 5 },
    labelText: { fontSize: 14, fontWeight: '600', color: c.inkSoft },

    row: { flexDirection: 'row', gap: 10, marginTop: 10 },
    tile: {
      flex: 1,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ratingBg,
    },
    tileOn: { backgroundColor: c.star },
    tileText: { fontSize: 20, fontWeight: '700', color: c.ratingText },
    tileTextOn: { color: '#FFF' },
  });