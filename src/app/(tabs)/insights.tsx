import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BarChart,
  Card,
  MeterRow,
  StatTile,
} from "@/components/insights/Widgets";
import {
  WEEKDAYS_FULL,
  computeInsights,
  computeStreaks,
  formatTotal,
  periodRange,
  type Period,
} from "@/lib/insights";
import { getAllDates, getInsightRows } from "@/lib/memories-repo";
import {
  FULL_MONTHS,
  formatTime,
  longDate,
  todayKey,
  type InsightRow,
} from "@/lib/memory";
import { SERIF, useTheme, type Palette } from "@/lib/theme";

const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
];

const TAG_COLORS = [
  "#9CC3F0",
  "#F2B28C",
  "#8FCBA6",
  "#C7B6EE",
  "#B8D4F5",
  "#EBCFAE",
];

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const now = new Date();

  const [period, setPeriod] = useState<Period>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [rows, setRows] = useState<InsightRow[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const { from, to } = periodRange(period, year, month);

  // refresh whenever the tab is focused or the period changes
  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([getInsightRows(from, to), getAllDates()])
        .then(([r, d]) => {
          if (!live) return;
          setRows(r);
          setDates(d);
        })
        .finally(() => live && setLoading(false));
      return () => {
        live = false;
      };
    }, [from, to]),
  );

  const stats = useMemo(
    () => computeInsights(rows, period, year, month),
    [rows, period, year, month],
  );
  const streaks = useMemo(() => computeStreaks(dates, todayKey()), [dates]);

  /* ---- period navigation (works across any number of years) ---- */
  const first = dates[0];
  const firstYear = first ? Number(first.slice(0, 4)) : now.getFullYear();
  const firstMonth = first ? Number(first.slice(5, 7)) - 1 : now.getMonth();
  const idx = year * 12 + month;
  const canPrev =
    period === "month" ? idx > firstYear * 12 + firstMonth : year > firstYear;
  const canNext =
    period === "month"
      ? idx < now.getFullYear() * 12 + now.getMonth()
      : year < now.getFullYear();

  const shift = (delta: number) => {
    if (period === "year") return setYear(year + delta);
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const periodLabel =
    period === "month" ? `${FULL_MONTHS[month]} ${year}` : String(year);
  const periodWord =
    period === "month"
      ? "this month"
      : period === "year"
        ? "this year"
        : "overall";

  const openDay = (date: string) =>
    router.push({ pathname: "/memory/[date]", params: { date } });

  /* ------------------------------------------------------------------------ */

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Insights</Text>
      <Text style={styles.subtitle}>A look at your journey.</Text>

      {/* Period selector */}
      <View style={styles.segment}>
        {PERIODS.map((p) => {
          const on = p.id === period;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPeriod(p.id)}
              style={[styles.segmentItem, on && styles.segmentItemOn]}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {period !== "all" && (
        <View style={styles.stepper}>
          <Pressable
            onPress={() => shift(-1)}
            disabled={!canPrev}
            hitSlop={12}
            accessibilityLabel="Previous"
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={canPrev ? colors.ink : colors.faint}
            />
          </Pressable>
          <Text style={styles.stepperLabel}>{periodLabel}</Text>
          <Pressable
            onPress={() => shift(1)}
            disabled={!canNext}
            hitSlop={12}
            accessibilityLabel="Next"
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={canNext ? colors.ink : colors.faint}
            />
          </Pressable>
        </View>
      )}

      {/* Streaks are global, so they stay visible even for an empty period */}
      {!loading && stats.count === 0 ? (
        <Card style={{ marginTop: 16 }}>
          <Text style={styles.emptyTitle}>
            Nothing recorded {period === "all" ? "yet" : periodWord}
          </Text>
          <Text style={styles.emptyText}>
            Record a memory on the Today tab and your insights will appear here.
          </Text>
        </Card>
      ) : (
        <View style={styles.sections}>
          {/* Summary strip */}
          <View style={styles.summary}>
            <Summary
              icon="mic"
              tint={colors.accent}
              value={String(stats.count)}
              label="Recordings"
            />
            <View style={styles.summaryDivider} />
            <Summary
              icon="time"
              tint={colors.success}
              value={formatTotal(stats.totalMs)}
              label="Total time"
            />
            <View style={styles.summaryDivider} />
            <Summary
              icon="star"
              tint={colors.star}
              value={stats.average != null ? stats.average.toFixed(1) : "–"}
              label="Avg rating"
            />
          </View>

          {/* Rating trend */}
          <Card
            title={
              period === "month"
                ? "Daily rating"
                : period === "year"
                  ? "Monthly average"
                  : "Yearly average"
            }
            subtitle={
              period === "month"
                ? "How each day felt. The darkest bars are your best days."
                : "Average rating per " +
                  (period === "year" ? "month." : "year.")
            }
          >
            <BarChart
              bars={stats.trend}
              labelEvery={period === "month" ? 5 : 1}
            />
          </Card>

          {/* Highlights grid */}
          <View style={styles.grid}>
            {stats.topRated && (
              <StatTile
                icon="trophy"
                tint={colors.star}
                label="Top rated day"
                value={`${stats.topRated.rating} / 10`}
                sub={longDate(stats.topRated.date)}
                onPress={() => openDay(stats.topRated!.date)}
              />
            )}

            {period !== "month" && stats.bestMonth ? (
              <StatTile
                icon="calendar"
                tint={colors.accent}
                label="Best month"
                value={FULL_MONTHS[stats.bestMonth.month]}
                sub={`${stats.bestMonth.avg.toFixed(1)} avg${period === "all" ? ` · ${stats.bestMonth.year}` : ""} · ${stats.bestMonth.n} ${stats.bestMonth.n === 1 ? "day" : "days"}`}
              />
            ) : stats.bestWeekdayIndex >= 0 ? (
              <StatTile
                icon="calendar"
                tint={colors.accent}
                label="Best weekday"
                value={WEEKDAYS_FULL[stats.bestWeekdayIndex]}
                sub={`${stats.bestWeekdayAvg!.toFixed(1)} avg rating`}
              />
            ) : null}

            {stats.longest && (
              <StatTile
                icon="mic"
                tint={colors.tagText}
                label="Longest recording"
                value={formatTime(stats.longest.durationMs / 1000)}
                sub={longDate(stats.longest.date)}
                onPress={() => openDay(stats.longest!.date)}
              />
            )}

            <StatTile
              icon="flame"
              tint={colors.danger}
              label="Current streak"
              value={`${streaks.current} ${streaks.current === 1 ? "day" : "days"}`}
              sub={`Longest: ${streaks.longest} ${streaks.longest === 1 ? "day" : "days"}`}
            />
          </View>

          {/* Rating breakdown */}
          <Card
            title="How your days felt"
            subtitle={`Split of ratings ${periodWord}.`}
          >
            {stats.breakdown.map((g) => (
              <MeterRow
                key={g.id}
                label={g.label}
                hint={g.range}
                fraction={g.pct / 100}
                color={g.color}
                right={`${g.pct}%`}
              />
            ))}
          </Card>

          {/* Weekday pattern (only meaningful with enough data) */}
          {stats.count >= 3 && (
            <Card
              title="Your week"
              subtitle={
                stats.bestWeekdayIndex >= 0
                  ? `${WEEKDAYS_FULL[stats.bestWeekdayIndex]}s are your best days (avg ${stats.bestWeekdayAvg!.toFixed(1)}).`
                  : "Average rating by weekday."
              }
            >
              <BarChart bars={stats.weekdays} height={90} />
            </Card>
          )}

          {/* Most talked about (tags) */}
          <Card
            title="Most used tags"
            subtitle={`What your days were about ${periodWord}.`}
          >
            {stats.topTags.map((t, i) => (
              <MeterRow
                key={t.name}
                label={`#${t.name}`}
                fraction={t.n / stats.topTags[0].n}
                color={TAG_COLORS[i % TAG_COLORS.length]}
                right={String(t.n)}
              />
            ))}
          </Card>

          {/* Time of day */}
          {/* {stats.bestSlot && (
            <Card
              title="Best time to reflect"
              subtitle={`You record most in the ${stats.bestSlot.label.toLowerCase()} (${stats.bestSlot.pct}%).`}
            >
              {stats.timeOfDay.map((s) => (
                <MeterRow
                  key={s.id}
                  label={s.label}
                  hint={s.hint}
                  fraction={stats.bestSlot!.n ? s.n / stats.bestSlot!.n : 0}
                  color={s.id === stats.bestSlot!.id ? colors.brand : colors.waveActive}
                  right={String(s.n)}
                  bold={s.id === stats.bestSlot!.id}
                />
              ))}
            </Card>
          )} */}
        </View>
      )}
    </ScrollView>
  );
}

function Summary({
  icon,
  tint,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: string;
  label: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.summaryItem}>
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    title: { fontSize: 34, fontFamily: SERIF, fontWeight: "700", color: c.ink },
    subtitle: { marginTop: 4, fontSize: 15, color: c.muted },

    segment: {
      flexDirection: "row",
      marginTop: 18,
      padding: 4,
      borderRadius: 18,
      backgroundColor: c.surfaceTint,
    },
    segmentItem: {
      flex: 1,
      height: 38,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentItemOn: { backgroundColor: c.accent },
    segmentText: { fontSize: 14, fontWeight: "600", color: c.muted },
    segmentTextOn: { color: "#FFF" },

    stepper: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 16,
      paddingHorizontal: 4,
    },
    stepperLabel: {
      fontSize: 18,
      fontFamily: SERIF,
      fontWeight: "600",
      color: c.ink,
    },

    sections: { marginTop: 16, gap: 14 },

    summary: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      borderRadius: 22,
      backgroundColor: c.cardBg,
    },
    summaryItem: { flex: 1, alignItems: "center", gap: 2 },
    summaryValue: {
      marginTop: 4,
      fontSize: 20,
      fontFamily: SERIF,
      fontWeight: "700",
      color: c.ink,
    },
    summaryLabel: { fontSize: 12, color: c.muted },
    summaryDivider: { width: 1, height: 40, backgroundColor: c.border },

    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 14,
    },

    emptyTitle: {
      fontSize: 18,
      fontFamily: SERIF,
      fontWeight: "700",
      color: c.ink,
    },
    emptyText: { marginTop: 6, fontSize: 15, lineHeight: 22, color: c.muted },
  });
