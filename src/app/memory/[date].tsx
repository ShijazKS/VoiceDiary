import { Alert } from "@/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import RatingSheet from "@/components/RatingSheet";
import {
  deleteMemory,
  getMemoryByDate,
  setBookmarked as saveBookmark,
  updateMemory,
} from "@/lib/memories-repo";
import { formatTime, longDate, type Memory } from "@/lib/memory";
import {
  DEFAULT_MEMORY_IMAGE,
  SERIF,
  useTheme,
  type Palette,
} from "@/lib/theme";

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const SKIP_SECONDS = 10;

/** '#RRGGBB' / '#RGB' → 'rgba(r, g, b, a)' */
const rgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((x) => x + x)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

type Side = "top" | "bottom" | "left" | "right";

// eased fall-off so the shadow melts away instead of showing a hard edge
const FADE_STOPS = [1, 0.62, 0.3, 0.1, 0];
const FADE_LOCS = [0, 0.25, 0.5, 0.75, 1] as const;

/**
 * Soft shadow along one edge of the photo: a real gradient from `color` at the
 * edge to fully transparent inwards (same colour at both ends → no grey banding).
 */
function EdgeFade({
  side,
  size,
  color,
  max,
}: {
  side: Side;
  size: number;
  color: string;
  max: number;
}) {
  const stops = FADE_STOPS.map((k) => rgba(color, max * k));
  const reversed = side === "bottom" || side === "right";
  const horizontal = side === "left" || side === "right";
  const pos =
    side === "top"
      ? { top: 0, left: 0, right: 0, height: size }
      : side === "bottom"
        ? { bottom: -1, left: 0, right: 0, height: size + 1 }
        : side === "left"
          ? { left: 0, top: 0, bottom: 0, width: size }
          : { right: 0, top: 0, bottom: 0, width: size };
  return (
    <LinearGradient
      pointerEvents="none"
      colors={
        (reversed ? [...stops].reverse() : stops) as [
          string,
          string,
          ...string[],
        ]
      }
      locations={
        (reversed
          ? [...FADE_LOCS].reverse().map((l) => 1 - l)
          : FADE_LOCS) as unknown as [number, number, ...number[]]
      }
      start={{ x: 0, y: 0 }}
      end={horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 }}
      style={[{ position: "absolute" }, pos]}
    />
  );
}

/**
 * Memory detail: full-bleed photo with soft edge shadows, title, rating/tags, player, note.
 * Only the rating is editable (⋯ menu → Edit rating). The ⋯ menu also has View image and Delete.
 */
export default function MemoryDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // corner/edge shadow tone follows the theme
  const shade = isDark ? "#000000" : colors.ink;
  const shadeMax = isDark ? 0.6 : 0.45;

  const [memory, setMemory] = useState<Memory | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // full-bleed hero photo
  const heroH = insets.top + Math.min(width * 1.05, 460);

  // the fixed top bar turns into a solid bar (with the date) once the photo scrolls away
  const scrollY = useRef(new Animated.Value(0)).current;
  const barOpacity = scrollY.interpolate({
    inputRange: [heroH * 0.55, heroH * 0.8],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  useEffect(() => {
    getMemoryByDate(date)
      .then(setMemory)
      .finally(() => setLoaded(true));
  }, [date]);

  const saveRating = async (rating: number) => {
    if (!memory) return;
    try {
      // everything else is passed back unchanged (the photo is kept because its path is the same)
      setMemory(await updateMemory(date, { ...memory, rating }));
      setRatingOpen(false);
    } catch {
      Alert.alert("Could not save rating", "Please try again.");
    }
  };

  const toggleBookmark = async () => {
    if (!memory) return;
    const next = !memory.bookmarked;
    setMemory({ ...memory, bookmarked: next }); // instant feedback
    try {
      setMemory(await saveBookmark(date, next));
    } catch {
      setMemory((m) => (m ? { ...m, bookmarked: !next } : m));
      Alert.alert("Could not update bookmark", "Please try again.");
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete this memory?",
      "The recording and details will be removed for good.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMemory(date);
              router.back();
            } catch {
              Alert.alert("Could not delete", "Please try again.");
            }
          },
        },
      ],
    );
  };

  // close the menu first, then act (opening an Alert/Modal while another Modal is
  // still dismissing is unreliable on iOS)
  const fromMenu = (action: () => void) => {
    setMenuOpen(false);
    setTimeout(action, 250);
  };

  if (!loaded) return <View style={styles.screen} />;

  if (!memory) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.missing}>This memory no longer exists.</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const photoSource = memory.imageUri
    ? { uri: memory.imageUri }
    : DEFAULT_MEMORY_IMAGE;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
      >
        {/* Hero: full-bleed photo with soft shadow in the corners/edges, fading into the page */}
        <Pressable
          onPress={() => setViewerOpen(true)}
          accessibilityLabel="View image full screen"
          style={{ height: heroH, backgroundColor: colors.surface }}
        >
          <Image
            source={photoSource}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
          <EdgeFade side="top" size={140} color={shade} max={shadeMax} />
          <EdgeFade side="left" size={100} color={shade} max={shadeMax} />
          <EdgeFade side="right" size={100} color={shade} max={shadeMax} />
          <EdgeFade
            side="bottom"
            size={heroH * 0.5}
            color={colors.background}
            max={1}
          />
        </Pressable>

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{longDate(memory.date)}</Text>
          <Text style={styles.subtitle}>
            {formatTime(memory.durationMs / 1000)} recording
          </Text>

          {/* Rating + tags */}
          <View style={styles.chipsRow}>
            <View style={styles.ratingChip}>
              <Ionicons name="star" size={14} color={colors.star} />
              <Text style={styles.ratingText}>{memory.rating}</Text>
            </View>
            {memory.tags.map((t) => (
              <View key={t} style={styles.tagChip}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
          </View>

          <PlayerCard
            uri={memory.audioUri}
            fallbackMs={memory.durationMs}
            bookmarked={memory.bookmarked}
            onToggleBookmark={toggleBookmark}
          />

          {/* Notes */}
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.card}>
            {memory.description ? (
              <Text style={styles.notes}>{memory.description}</Text>
            ) : (
              <Text style={styles.notesEmpty}>No note for this day.</Text>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Fixed top bar: stays on screen while scrolling */}
      <View style={styles.stickyHeader} pointerEvents="box-none">
        <Animated.View
          style={[styles.barBg, { opacity: barOpacity }]}
          pointerEvents="none"
        />
        <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.roundButton}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>

          <Animated.Text
            style={[styles.headerTitle, { opacity: barOpacity }]}
            numberOfLines={1}
          >
            {longDate(memory.date)}
          </Animated.Text>

          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={12}
            style={styles.roundButton}
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-horizontal" size={22} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {/* ⋯ menu: View image · Edit rating · Delete memory */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setMenuOpen(false)}
        >
          <View style={[styles.menu, { top: insets.top + 56 }]}>
            <MenuItem
              icon="image-outline"
              label="View image"
              onPress={() => fromMenu(() => setViewerOpen(true))}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="star-outline"
              label="Edit rating"
              onPress={() => fromMenu(() => setRatingOpen(true))}
            />
            <View style={styles.menuDivider} />
            <MenuItem
              icon="trash-outline"
              label="Delete memory"
              danger
              onPress={() => fromMenu(confirmDelete)}
            />
          </View>
        </Pressable>
      </Modal>

      <RatingSheet
        visible={ratingOpen}
        initial={memory.rating}
        subtitle={longDate(memory.date)}
        onClose={() => setRatingOpen(false)}
        onSave={saveRating}
      />

      {/* Full-screen image viewer (own photo, or the default image) */}
      <Modal
        visible={viewerOpen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={styles.viewer}>
          <StatusBar hidden={viewerOpen} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setViewerOpen(false)}
          >
            <Image
              source={photoSource}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          </Pressable>
          <Pressable
            onPress={() => setViewerOpen(false)}
            hitSlop={12}
            style={[
              styles.roundButton,
              styles.viewerClose,
              { top: insets.top + 8 },
            ]}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color="#FFF" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   PLAYER                                   */
/* -------------------------------------------------------------------------- */

function PlayerCard({
  uri,
  fallbackMs,
  bookmarked,
  onToggleBookmark,
}: {
  uri: string;
  fallbackMs: number;
  bookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const [speedIdx, setSpeedIdx] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  const total = status.duration > 0 ? status.duration : fallbackMs / 1000;
  const current = scrub ?? Math.min(status.currentTime, total);
  const progress = total > 0 ? Math.min(1, current / total) : 0;

  // latest values for the PanResponder (it is created once)
  const live = useRef({ trackW: 0, total: 0 });
  live.current = { trackW, total };
  const startX = useRef(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  // when playback reaches the end, rewind so the next tap on play starts again
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const seek = (seconds: number) => {
    void player.seekTo(Math.max(0, Math.min(total, seconds)));
  };

  const togglePlay = () => {
    if (status.playing) player.pause();
    else player.play();
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    player.setPlaybackRate(SPEEDS[next]);
  };

  // tap or drag anywhere on the bar: position = where the finger started + how far it moved
  const secondsAt = (x: number) => {
    const { trackW: w, total: t } = live.current;
    return w > 0 ? Math.max(0, Math.min(1, x / w)) * t : 0;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        if (clearTimer.current) clearTimeout(clearTimer.current);
        startX.current = e.nativeEvent.locationX;
        setScrub(secondsAt(startX.current));
      },
      onPanResponderMove: (_, g) => setScrub(secondsAt(startX.current + g.dx)),
      onPanResponderRelease: (_, g) => {
        const t = secondsAt(startX.current + g.dx);
        setScrub(t);
        void player.seekTo(t);
        // keep the thumb where it was dropped until the player catches up
        clearTimer.current = setTimeout(() => setScrub(null), 350);
      },
      onPanResponderTerminate: () => setScrub(null),
    }),
  ).current;

  const scrubbing = scrub !== null;

  return (
    <View style={styles.player}>
      {/* progress: moves with the audio; tap or drag to seek */}
      <View
        style={styles.track}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.trackLine} />
          <View style={[styles.trackFill, { width: progress * trackW }]} />
          <View
            style={[
              styles.thumb,
              scrubbing && styles.thumbActive,
              { left: progress * trackW - (scrubbing ? 10 : 7) },
            ]}
          />
        </View>
      </View>

      <View style={styles.timesRow}>
        <Text style={styles.time}>{formatTime(current)}</Text>
        <Text style={styles.time}>{formatTime(total)}</Text>
      </View>

      {/* controls: speed · -10 · play/pause · +10 · bookmark */}
      <View style={styles.controls}>
        <Pressable
          onPress={cycleSpeed}
          hitSlop={10}
          style={styles.sideBtn}
          accessibilityLabel="Playback speed"
        >
          <Text style={styles.speedText}>{SPEEDS[speedIdx]}×</Text>
        </Pressable>

        <Pressable
          onPress={() => seek(current - SKIP_SECONDS)}
          hitSlop={10}
          style={styles.sideBtn}
          accessibilityLabel={`Back ${SKIP_SECONDS} seconds`}
        >
          <Ionicons
            name="refresh-outline"
            size={36}
            color={colors.ink}
            style={{ transform: [{ scaleX: -1 }] }}
          />
          <Text style={styles.skipLabel}>{SKIP_SECONDS}</Text>
        </Pressable>

        <Pressable
          onPress={togglePlay}
          style={({ pressed }) => [
            styles.playBtn,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityLabel={status.playing ? "Pause" : "Play"}
        >
          <Ionicons
            name={status.playing ? "pause" : "play"}
            size={36}
            color={colors.onBrand}
            style={status.playing ? undefined : { marginLeft: 4 }}
          />
        </Pressable>

        <Pressable
          onPress={() => seek(current + SKIP_SECONDS)}
          hitSlop={10}
          style={styles.sideBtn}
          accessibilityLabel={`Forward ${SKIP_SECONDS} seconds`}
        >
          <Ionicons name="refresh-outline" size={36} color={colors.ink} />
          <Text style={styles.skipLabel}>{SKIP_SECONDS}</Text>
        </Pressable>

        <Pressable
          onPress={onToggleBookmark}
          hitSlop={10}
          style={styles.sideBtn}
          accessibilityLabel={bookmarked ? "Remove bookmark" : "Bookmark"}
        >
          <Ionicons
            name={bookmarked ? "bookmark" : "bookmark-outline"}
            size={26}
            color={bookmarked ? colors.accent : colors.ink}
          />
        </Pressable>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    MENU                                    */
/* -------------------------------------------------------------------------- */

function MenuItem({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const color = danger ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.menuText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.background },
    center: { alignItems: "center", justifyContent: "center", gap: 12 },
    missing: { fontSize: 16, color: c.muted },
    backLink: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: c.surface,
    },
    backLinkText: { fontSize: 14, fontWeight: "600", color: c.ink },

    /* fixed top bar */
    stickyHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    barBg: {
      ...StyleSheet.absoluteFill,
      backgroundColor: c.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      marginHorizontal: 12,
      fontSize: 16,
      fontWeight: "700",
      fontFamily: SERIF,
      color: c.ink,
    },
    roundButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.4)",
    },

    /* title block */
    content: { paddingHorizontal: 24, marginTop: -64 },
    title: {
      textAlign: "center",
      fontSize: 28,
      fontFamily: SERIF,
      fontWeight: "700",
      color: c.ink,
    },
    subtitle: {
      marginTop: 4,
      textAlign: "center",
      fontSize: 15,
      color: c.inkSoft,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
      marginBottom: 22,
    },
    ratingChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: c.ratingBg,
    },
    ratingText: { fontSize: 13, fontWeight: "600", color: c.ratingText },
    tagChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: c.tagBg,
    },
    tagText: { fontSize: 13, fontWeight: "600", color: c.tagText },

    /* player (no card: sits directly on the dark page) */
    player: { paddingTop: 4 },
    track: { height: 40, justifyContent: "center" },
    trackLine: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 18,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.surfaceTint,
    },
    trackFill: {
      position: "absolute",
      left: 0,
      top: 18,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.accent,
    },
    thumb: {
      position: "absolute",
      top: 13,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: c.accent,
    },
    thumbActive: {
      top: 10,
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    timesRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    time: {
      fontSize: 13,
      color: c.inkSoft,
      fontVariant: ["tabular-nums"],
    },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 22,
    },
    sideBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    speedText: { fontSize: 14, fontWeight: "600", color: c.ink },
    skipLabel: {
      position: "absolute",
      fontSize: 11,
      fontWeight: "700",
      color: c.ink,
    },
    playBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.accent,
      ...Platform.select({
        ios: {
          shadowColor: c.accent,
          shadowOpacity: 0.3,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
        },
        default: { elevation: 8 },
      }),
    },

    /* notes */
    sectionTitle: {
      marginTop: 28,
      marginBottom: 10,
      fontSize: 20,
      fontFamily: SERIF,
      fontWeight: "700",
      color: c.ink,
    },
    card: {
      padding: 18,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    notes: { fontSize: 16, lineHeight: 25, color: c.body },
    notesEmpty: { fontSize: 15, color: c.hint },

    /* ⋯ menu */
    menu: {
      position: "absolute",
      right: 20,
      width: 220,
      borderRadius: 16,
      paddingVertical: 6,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
        },
        default: { elevation: 12 },
      }),
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    menuText: { fontSize: 15, fontWeight: "600" },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: 12,
      backgroundColor: c.border,
    },

    /* image viewer */
    viewer: { flex: 1, backgroundColor: "#000" },
    viewerImage: { width: "100%", height: "100%" },
    viewerClose: { position: "absolute", right: 20 },
  });
