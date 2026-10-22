import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { PHOTO_RATIO, formatTime, longDate, type Memory } from "@/lib/memory";
import { DEFAULT_MEMORY_IMAGE, useTheme, type Palette } from "@/lib/theme";

export default function MemoryRow({ memory }: { memory: Memory }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const firstLine = memory.description.split("\n")[0].trim();

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/memory/[date]",
          params: { date: memory.date },
        })
      }
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
    >
      <Image
        source={
          memory.imageUri ? { uri: memory.imageUri } : DEFAULT_MEMORY_IMAGE
        }
        style={styles.thumb}
      />

      <View style={styles.body}>
        <Text style={styles.date}>{longDate(memory.date)}</Text>
        <Text
          style={[styles.title, !firstLine && styles.titleMuted]}
          numberOfLines={2}
        >
          {firstLine || "Voice memory"}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Ionicons name="mic-outline" size={14} color={colors.muted} />
            <Text style={styles.metaText}>
              {formatTime(memory.durationMs / 1000)}
            </Text>
          </View>
          <View style={styles.meta}>
            <Ionicons name="star" size={13} color={colors.star} />
            <Text style={styles.metaText}>{memory.rating}</Text>
          </View>
          {/* <Text style={styles.tag} numberOfLines={1}>
            #{memory.tags[0]}
            {memory.tags.length > 1 ? `  +${memory.tags.length - 1}` : ''}
          </Text> */}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 10,
      borderRadius: 20,
      backgroundColor: c.cardBg,
    },
    thumb: {
      width: 72,
      aspectRatio: PHOTO_RATIO,
      borderRadius: 14,
      backgroundColor: c.placeholder,
    },
    body: { flex: 1 },
    date: { fontSize: 12, color: c.muted },
    title: {
      marginTop: 2,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: "600",
      color: c.ink,
    },
    titleMuted: { color: c.muted, fontWeight: "500" },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 8,
    },
    meta: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 13, color: c.inkSoft, fontVariant: ["tabular-nums"] },
    tag: { flexShrink: 1, fontSize: 13, color: c.tagText, fontWeight: "500" },
  });
