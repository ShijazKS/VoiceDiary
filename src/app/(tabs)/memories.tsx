import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MemoryRow from "@/components/memories/MemoryRow";
import MonthCalendar from "@/components/memories/MonthCalendar";
import { useMemories } from "@/hooks/useMemories";
import {
  FULL_MONTHS,
  longDate,
  parseDateKey,
  todayKey,
  type Memory,
} from "@/lib/memory";
import { recordingDayKey } from "@/lib/settings";
import { SERIF, useTheme, type Palette } from "@/lib/theme";

type Mode = "calendar" | "timeline" | "highlights";
const MODES: { id: Mode; label: string }[] = [
  { id: "calendar", label: "Calendar" },
  { id: "timeline", label: "Timeline" },
  { id: "highlights", label: "Highlights" },
];

type Item =
  | { key: string; type: "heading"; label: string }
  | { key: string; type: "memory"; memory: Memory }
  | { key: string; type: "note"; text: string };

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { memories, loading } = useMemories();

  const now = new Date();
  const [mode, setMode] = useState<Mode>("calendar");
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [activeTag, setActiveTag] = useState<string | null>(null);

  /* ------------------------------ derived data ------------------------------ */

  const recordedDates = useMemo(
    () => new Set(memories.map((m) => m.date)),
    [memories],
  );

  const average = useMemo(
    () =>
      memories.length
        ? memories.reduce((sum, m) => sum + m.rating, 0) / memories.length
        : null,
    [memories],
  );

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();

    memories.forEach((m) => {
      m.tags.forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [memories]);

  const items: Item[] = useMemo(() => {
    if (mode === "calendar") {
      const memory = memories.find((m) => m.date === selectedDate);
      const today = todayKey();

      const note =
        selectedDate === recordingDayKey()
          ? "Nothing recorded yet for this day. Tap the mic on the Today tab."
          : selectedDate === today
            ? "Today isn’t recorded yet. With “Previous day” on, it’s saved tomorrow."
            : selectedDate > today
              ? "This day hasn’t happened yet."
              : "No memory on this day.";

      return [
        {
          key: "h-selected",
          type: "heading",
          label: longDate(selectedDate),
        },

        memory
          ? {
              key: memory.date,
              type: "memory",
              memory,
            }
          : {
              key: "note",
              type: "note",
              text: note,
            },
      ];
    }

    // Highlights: every bookmarked memory, newest first (no tag filter here)
    if (mode === "highlights") {
      return memories
        .filter((m) => m.bookmarked)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((m) => ({
          key: m.date,
          type: "memory" as const,
          memory: m,
        }));
    }

    const filtered = activeTag
      ? memories.filter((m) => m.tags.includes(activeTag))
      : memories;

    // Timeline: grouped by month
    const out: Item[] = [];
    let last = "";

    for (const memory of filtered) {
      const date = parseDateKey(memory.date);
      const label = `${FULL_MONTHS[date.getMonth()]} ${date.getFullYear()}`;

      if (label !== last) {
        out.push({
          key: `h-${label}`,
          type: "heading",
          label,
        });

        last = label;
      }

      out.push({
        key: memory.date,
        type: "memory",
        memory,
      });
    }

    return out;
  }, [mode, memories, selectedDate, activeTag]);

  /* --------------------------------- header --------------------------------- */

  const header = (
    <View>
      <Text style={styles.title}>Memories</Text>
      <Text style={styles.subtitle}>
        {memories.length
          ? `${memories.length} ${memories.length === 1 ? "moment" : "moments"} · average ${average!.toFixed(1)} / 10`
          : "Your moments, always here."}
      </Text>

      <View style={styles.segment}>
        {MODES.map((m) => {
          const on = m.id === mode;
          return (
            <Pressable
              key={m.id}
              onPress={() => setMode(m.id)}
              style={[styles.segmentItem, on && styles.segmentItemOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === "calendar" ? (
        <View style={{ marginTop: 16 }}>
          <MonthCalendar
            year={cursor.year}
            month={cursor.month}
            recordedDates={recordedDates}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            onChangeMonth={(year: any, month: any) =>
              setCursor({ year, month })
            }
          />
        </View>
      ) : mode === "highlights" ? (
        // no tag filter here, just some air above the first card
        <View style={{ height: 16 }} />
      ) : (
        allTags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagFilter}
          >
            <TagChip
              label="All"
              on={activeTag === null}
              onPress={() => setActiveTag(null)}
            />
            {allTags.map((t) => (
              <TagChip
                key={t}
                label={`#${t}`}
                on={activeTag === t}
                onPress={() => setActiveTag(activeTag === t ? null : t)}
              />
            ))}
          </ScrollView>
        )
      )}
    </View>
  );

  /* ------------------------------ empty messages ----------------------------- */

  const empty = (() => {
    if (loading) return null;
    if (mode === "highlights") {
      return (
        <EmptyNote text="No bookmarks yet. Tap the bookmark icon on a memory's player to save it here." />
      );
    }
    return (
      <EmptyNote
        text={
          activeTag
            ? `No memories tagged #${activeTag}.`
            : "No memories yet. Record your first one on the Today tab."
        }
      />
    );
  })();

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(i) => i.key}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 28,
      }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) =>
        item.type === "heading" ? (
          <Text style={styles.sectionHeading}>{item.label}</Text>
        ) : item.type === "note" ? (
          <EmptyNote text={item.text} />
        ) : (
          <View style={styles.rowWrap}>
            <MemoryRow memory={item.memory} />
          </View>
        )
      }
    />
  );
}

function TagChip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function EmptyNote({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
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

    tagFilter: { gap: 8, paddingTop: 16, paddingRight: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: c.surfaceTint,
    },
    chipOn: { backgroundColor: c.brand },
    chipText: { fontSize: 13, fontWeight: "600", color: c.muted },
    chipTextOn: { color: c.onBrand },

    sectionHeading: {
      marginTop: 22,
      marginBottom: 10,
      fontSize: 20,
      fontFamily: SERIF,
      fontWeight: "700",
      color: c.ink,
    },
    rowWrap: { marginBottom: 10 },

    empty: { paddingVertical: 28, alignItems: "center" },
    emptyText: {
      textAlign: "center",
      fontSize: 15,
      lineHeight: 22,
      color: c.muted,
      maxWidth: 280,
    },
  });
