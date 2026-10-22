import { Ionicons } from '@expo/vector-icons';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { TrendBar } from '@/lib/insights';
import { SERIF, useTheme, type Palette } from '@/lib/theme';

function useStyles() {
  const { colors } = useTheme();
  return { colors, styles: useMemo(() => makeStyles(colors), [colors]) };
}

/* --------------------------------- Card ----------------------------------- */

export function Card({
  title,
  subtitle,
  children,
  style,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { styles } = useStyles();
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      <View style={title ? { marginTop: 14 } : undefined}>{children}</View>
    </View>
  );
}

/* ------------------------------- Bar chart -------------------------------- */

/** Simple View-based bar chart (no chart library needed). Values are ratings 0–10. */
export function BarChart({
  bars,
  height = 110,
  labelEvery = 1,
}: {
  bars: TrendBar[];
  height?: number;
  labelEvery?: number;
}) {
  const { colors, styles } = useStyles();
  const dense = bars.length > 16;

  return (
    <View>
      <View style={[styles.chartArea, { height }]}>
        {/* guide line at 5 */}
        <View style={[styles.guide, { bottom: height * 0.5 }]} />
        <View style={[styles.barsRow, { gap: dense ? 2 : 6 }]}>
          {bars.map((b) => {
            const h = b.value != null ? Math.max(5, (b.value / 10) * height) : 3;
            return (
              <View key={b.key} style={styles.barSlot}>
                <View
                  style={{
                    width: '100%',
                    height: h,
                    borderRadius: dense ? 3 : 6,
                    backgroundColor:
                      b.value == null ? colors.surfaceTint : b.highlight ? colors.brand : colors.waveActive,
                  }}
                />
              </View>
            );
          })}
        </View>
      </View>
      <View style={[styles.barsRow, { gap: dense ? 2 : 6, marginTop: 6 }]}>
        {bars.map((b, i) => (
          <Text key={b.key} style={styles.barLabel} numberOfLines={1}>
            {i % labelEvery === 0 ? b.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------- Meter row -------------------------------- */

export function MeterRow({
  label,
  hint,
  fraction,
  color,
  right,
  bold,
}: {
  label: string;
  hint?: string;
  fraction: number; // 0–1
  color: string;
  right: string;
  bold?: boolean;
}) {
  const { styles } = useStyles();
  return (
    <View style={styles.meterRow}>
      <View style={styles.meterLabelBox}>
        <Text style={[styles.meterLabel, bold && { fontWeight: '700' }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? <Text style={styles.meterHint}>{hint}</Text> : null}
      </View>
      <View style={styles.meterTrack}>
        <View
          style={{
            width: `${Math.max(fraction, 0.02) * 100}%`,
            height: '100%',
            borderRadius: 6,
            backgroundColor: color,
          }}
        />
      </View>
      <Text style={styles.meterRight}>{right}</Text>
    </View>
  );
}

/* ------------------------------- Stat tile -------------------------------- */

export function StatTile({
  icon,
  tint,
  label,
  value,
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string; // a 6-digit hex colour (the icon circle uses it at ~20% opacity)
  label: string;
  value: string;
  sub?: string;
  onPress?: () => void;
}) {
  const { styles } = useStyles();
  const content = (
    <>
      <View style={[styles.tileIcon, { backgroundColor: tint + '33' }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.tileSub} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.tile}>{content}</View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: { padding: 16, borderRadius: 22, backgroundColor: c.cardBg },
    cardTitle: { fontSize: 19, fontFamily: SERIF, fontWeight: '700', color: c.ink },
    cardSubtitle: { marginTop: 2, fontSize: 13, color: c.muted },

    chartArea: { justifyContent: 'flex-end' },
    guide: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: c.border },
    barsRow: { flexDirection: 'row', alignItems: 'flex-end' },
    barSlot: { flex: 1, justifyContent: 'flex-end' },
    barLabel: { flex: 1, textAlign: 'center', fontSize: 10, color: c.muted },

    meterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    meterLabelBox: { width: 84 },
    meterLabel: { fontSize: 14, color: c.body },
    meterHint: { fontSize: 11, color: c.hint, marginTop: 1 },
    meterTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: c.surfaceTint, overflow: 'hidden' },
    meterRight: { width: 40, textAlign: 'right', fontSize: 13, color: c.inkSoft, fontVariant: ['tabular-nums'] },

    tile: { width: '48.5%', padding: 14, borderRadius: 20, backgroundColor: c.cardBg },
    tileIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    tileLabel: { marginTop: 10, fontSize: 12, color: c.muted },
    tileValue: { marginTop: 2, fontSize: 20, fontFamily: SERIF, fontWeight: '700', color: c.ink },
    tileSub: { marginTop: 2, fontSize: 12, lineHeight: 16, color: c.muted },
  });