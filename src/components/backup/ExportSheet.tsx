import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MonthCalendar from "@/components/memories/MonthCalendar";
import { Segmented, type IconName } from "@/components/Settings-ui";
import type { DateRange } from "@/lib/backup";
import { getAllDates } from "@/lib/memories-repo";
import { FULL_MONTHS, prettyDate, toDateKey, todayKey } from "@/lib/memory";
import { Palette, SERIF, useTheme } from "@/lib/theme";

type Mode = "all" | "month" | "range";

const MODES: { value: Mode; label: string; icon: IconName }[] = [
  { value: "all", label: "Everything", icon: "albums-outline" },
  { value: "month", label: "A month", icon: "calendar-outline" },
  { value: "range", label: "Custom", icon: "options-outline" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  /** `null` = the whole diary. */
  onExport: (range: DateRange | null) => void;
};

const lastDayOf = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();
const monthOf = (key: string) => ({
  year: Number(key.slice(0, 4)),
  month: Number(key.slice(5, 7)) - 1,
});

export default function ExportSheet({ visible, onClose, onExport }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [dates, setDates] = useState<string[]>([]); // every recorded day, oldest first
  const [mode, setMode] = useState<Mode>("all");
  const [month, setMonth] = useState(() => monthOf(todayKey()));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [active, setActive] = useState<"from" | "to">("from");
  const [cursor, setCursor] = useState(() => monthOf(todayKey())); // month the calendar shows

  // Fresh start (and fresh data) each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const today = todayKey();
    const now = monthOf(today);
    setMode("all");
    setMonth(now);
    setFrom(toDateKey(now.year, now.month, 1));
    setTo(today);
    setActive("from");
    setCursor(now);
    getAllDates()
      .then(setDates)
      .catch(() => setDates([]));
  }, [visible]);

  const recordedDates = useMemo(() => new Set(dates), [dates]);
  const now = monthOf(todayKey());
  const earliest = dates.length ? monthOf(dates[0]) : now;
  const atEarliest =
    month.year * 12 + month.month <= earliest.year * 12 + earliest.month;
  const atLatest = month.year * 12 + month.month >= now.year * 12 + now.month;

  const range: DateRange | null =
    mode === "all"
      ? null
      : mode === "month"
        ? {
            from: toDateKey(month.year, month.month, 1),
            to: toDateKey(
              month.year,
              month.month,
              lastDayOf(month.year, month.month),
            ),
          }
        : { from, to };

  const count = range
    ? dates.filter((d) => d >= range.from && d <= range.to).length
    : dates.length;

  const shiftMonth = (delta: number) => {
    const d = new Date(month.year, month.month + delta, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  const pick = (key: string) => {
    if (active === "from") {
      const end = key > to ? key : to;
      setFrom(key);
      setTo(end);
      setActive("to"); // next tap chooses the end of the range
      setCursor(monthOf(end));
    } else {
      setTo(key);
      if (key < from) setFrom(key);
    }
  };

  const chooseField = (field: "from" | "to") => {
    setActive(field);
    setCursor(monthOf(field === "from" ? from : to));
  };

  const summary =
    count === 0
      ? "No memories in this range."
      : `${count} ${count === 1 ? "memory" : "memories"}${range ? ` · ${prettyDate(range.from)} – ${prettyDate(range.to)}` : ""}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Export a backup</Text>
          <Text style={styles.subtitle}>
            Choose which memories go into the backup file.
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.segmentBox}>
              <Segmented options={MODES} value={mode} onChange={setMode} />
            </View>

            {mode === "month" ? (
              <View style={styles.monthRow}>
                <Pressable
                  onPress={() => shiftMonth(-1)}
                  disabled={atEarliest}
                  hitSlop={12}
                  accessibilityLabel="Previous month"
                >
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color={atEarliest ? colors.faint : colors.ink}
                  />
                </Pressable>
                <Text style={styles.monthText}>
                  {FULL_MONTHS[month.month]} {month.year}
                </Text>
                <Pressable
                  onPress={() => shiftMonth(1)}
                  disabled={atLatest}
                  hitSlop={12}
                  accessibilityLabel="Next month"
                >
                  <Ionicons
                    name="chevron-forward"
                    size={24}
                    color={atLatest ? colors.faint : colors.ink}
                  />
                </Pressable>
              </View>
            ) : null}

            {mode === "range" ? (
              <View>
                <View style={styles.fields}>
                  {(["from", "to"] as const).map((f) => (
                    <Pressable
                      key={f}
                      onPress={() => chooseField(f)}
                      style={[
                        styles.field,
                        active === f && {
                          borderColor: colors.accent,
                          backgroundColor: colors.surfaceTint,
                        },
                      ]}
                    >
                      <Text style={styles.fieldLabel}>
                        {f === "from" ? "From" : "To"}
                      </Text>
                      <Text style={styles.fieldValue}>
                        {prettyDate(f === "from" ? from : to)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ marginTop: 12 }}>
                  <MonthCalendar
                    year={cursor.year}
                    month={cursor.month}
                    recordedDates={recordedDates}
                    selectedDate={active === "from" ? from : to}
                    onSelect={pick}
                    onChangeMonth={(year: number, m: number) =>
                      setCursor({ year, month: m })
                    }
                  />
                </View>
              </View>
            ) : null}

            <Text
              style={[styles.summary, count === 0 && { color: colors.danger }]}
            >
              {summary}
            </Text>
            <Text style={styles.note}>
              {mode === "all"
                ? "Includes your recording and reminder settings."
                : "Partial backups hold only these memories (no settings) and can be merged into any diary."}
            </Text>

            <Pressable
              onPress={() => onExport(range)}
              disabled={count === 0}
              style={({ pressed }) => [
                styles.button,
                count === 0 && { opacity: 0.4 },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
            >
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={colors.onBrand}
              />
              <Text style={styles.buttonText}>Export</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(33,26,23,0.4)",
    },
    sheet: {
      maxHeight: "90%",
      paddingHorizontal: 20,
      paddingTop: 10,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor: c.surface,
    },
    grabber: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.faint,
      marginBottom: 14,
    },
    title: { fontSize: 22, fontWeight: "700", fontFamily: SERIF, color: c.ink },
    subtitle: { marginTop: 2, marginBottom: 16, fontSize: 14, color: c.muted },
    segmentBox: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.background,
    },
    monthRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 18,
      paddingHorizontal: 8,
    },
    monthText: {
      fontSize: 20,
      fontFamily: SERIF,
      fontWeight: "600",
      color: c.ink,
    },
    fields: { flexDirection: "row", gap: 10, marginTop: 16 },
    field: {
      flex: 1,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    fieldLabel: { fontSize: 12, fontWeight: "600", color: c.muted },
    fieldValue: { marginTop: 2, fontSize: 16, fontWeight: "600", color: c.ink },
    summary: { marginTop: 18, fontSize: 15, fontWeight: "600", color: c.ink },
    note: { marginTop: 4, fontSize: 13, lineHeight: 18, color: c.muted },
    button: {
      height: 52,
      marginTop: 18,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.brand,
    },
    buttonText: { fontSize: 16, fontWeight: "700", color: c.onBrand },
  });
