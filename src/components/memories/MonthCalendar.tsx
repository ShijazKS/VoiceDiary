import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FULL_MONTHS, toDateKey, todayKey } from '@/lib/memory';
import { SERIF, useTheme, type Palette } from '@/lib/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL = 42; // size of the rounded-square day marker

type Props = {
  year: number;
  month: number; // 0–11
  recordedDates: Set<string>;
  selectedDate: string;
  onSelect: (dateKey: string) => void;
  onChangeMonth: (year: number, month: number) => void;
};

export default function MonthCalendar({
  year,
  month,
  recordedDates,
  selectedDate,
  onSelect,
  onChangeMonth,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const today = todayKey();
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const showTodayPill = !isCurrentMonth || selectedDate !== today;

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const rows = Math.ceil((firstWeekday + daysInMonth) / 7);

  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const day = i - firstWeekday + 1;
    if (day < 1) return { key: `p${i}`, label: daysInPrev + day, inMonth: false as const };
    if (day > daysInMonth) return { key: `n${i}`, label: day - daysInMonth, inMonth: false as const };
    return { key: toDateKey(year, month, day), label: day, inMonth: true as const };
  });

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onChangeMonth(d.getFullYear(), d.getMonth());
  };

  const jumpToToday = () => {
    onChangeMonth(now.getFullYear(), now.getMonth());
    onSelect(today);
  };

  return (
    <View style={styles.card}>
      {/* Month header */}
      <View style={styles.header}>
        <Pressable onPress={() => shift(-1)} hitSlop={12} style={styles.navButton} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>

        <Text style={styles.month}>
          {FULL_MONTHS[month]} <Text style={styles.year}>{year}</Text>
        </Text>

        <Pressable
          onPress={() => shift(1)}
          disabled={isCurrentMonth}
          hitSlop={12}
          style={[styles.navButton, isCurrentMonth && { opacity: 0.35 }]}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.ink} />
        </Pressable>
      </View>

      {/* Weekday labels */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      {/* Days */}
      <View style={styles.grid}>
        {cells.map((c) => {
          if (!c.inMonth) {
            return (
              <View key={c.key} style={styles.cell}>
                <Text style={[styles.day, styles.dayFaded]}>{c.label}</Text>
              </View>
            );
          }

          const recorded = recordedDates.has(c.key);
          const selected = c.key === selectedDate;
          const isToday = c.key === today;
          const future = c.key > today;

          return (
            <Pressable
              key={c.key}
              style={styles.cell}
              onPress={() => onSelect(c.key)}
              disabled={future}
              accessibilityRole="button"
              accessibilityLabel={`${c.label} ${FULL_MONTHS[month]}${recorded ? ', has a memory' : ''}`}
              accessibilityState={{ selected, disabled: future }}
            >
              <View
                style={[
                  styles.square,
                  recorded && styles.squareRecorded,
                  isToday && !selected && styles.squareToday,
                  selected && styles.squareSelected,
                ]}
              >
                <Text
                  style={[
                    styles.day,
                    future && styles.dayFaded,
                    recorded && !selected && styles.dayRecordedText,
                    selected && styles.daySelectedText,
                  ]}
                >
                  {c.label}
                </Text>
                {recorded && <View style={[styles.dot, selected && styles.dotSelected]} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Legend + jump to today */}
      <View style={styles.footer}>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, { backgroundColor: colors.recordedBg }]}>
              <View style={[styles.legendDot, { backgroundColor: colors.brand }]} />
            </View>
            <Text style={styles.legendText}>Recorded</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, { borderWidth: 1.5, borderColor: colors.accent }]} />
            <Text style={styles.legendText}>Today</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSquare, { backgroundColor: colors.accent }]} />
            <Text style={styles.legendText}>Selected</Text>
          </View>
        </View>

        {showTodayPill && (
          <Pressable onPress={jumpToToday} hitSlop={8} style={styles.todayPill} accessibilityLabel="Jump to today">
            <Text style={styles.todayPillText}>Today</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: { padding: 16, borderRadius: 24, backgroundColor: c.cardBg },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navButton: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.chip,
    },
    month: { fontSize: 19, fontFamily: SERIF, fontWeight: '700', color: c.ink },
    year: { fontWeight: '400', color: c.muted },

    weekRow: { flexDirection: 'row', marginTop: 16 },
    weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: c.muted },

    grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
    cell: { width: `${100 / 7}%`, height: CELL + 6, alignItems: 'center', justifyContent: 'center' },

    // every day is a rounded square so the selected one reads clearly
    square: {
      width: CELL,
      height: CELL,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    squareRecorded: { backgroundColor: c.recordedBg },
    squareToday: { borderColor: c.accent },
    squareSelected: {
      backgroundColor: c.accent,
      borderColor: c.accent,
      ...Platform.select({
        ios: { shadowColor: c.accent, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
        default: { elevation: 4 },
      }),
    },

    day: { fontSize: 15, color: c.ink },
    dayFaded: { color: c.faint },
    dayRecordedText: { color: c.brand, fontWeight: '700' },
    daySelectedText: { color: '#FFF', fontWeight: '700' },

    dot: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: c.brand },
    dotSelected: { backgroundColor: '#FFF' },

    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    legend: { flexDirection: 'row', gap: 14, flexShrink: 1 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendSquare: { width: 14, height: 14, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    legendDot: { width: 4, height: 4, borderRadius: 2 },
    legendText: { fontSize: 12, color: c.muted },

    todayPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: c.surfaceTint },
    todayPillText: { fontSize: 12, fontWeight: '700', color: c.onTint },
  });