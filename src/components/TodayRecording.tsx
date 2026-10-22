import AudioPlayer from "@/components/AudioPlayer";
import DetailsSheet from "@/components/DetailsSheet";
import { Alert } from "@/lib/alert";
import { VOICE_RECORDING } from "@/lib/audio";
import {
  createMemory,
  deleteMemory as deleteMemoryFromDb,
  getMemoryByDate,
  updateMemory,
} from "@/lib/memories-repo";
import {
  MAX_MS,
  PHOTO_RATIO,
  formatTime,
  hasAnyDetail,
  prettyDate,
  todayKey,
  type Details,
  type Memory,
} from "@/lib/memory";
import { refreshReminders } from "@/lib/reminders";
import {
  dayPossessive,
  freshDetails,
  recordingDayKey,
  withDefaultTag,
} from "@/lib/settings";
import {
  DEFAULT_MEMORY_IMAGE,
  SERIF,
  useTheme,
  type Palette,
} from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

type Phase = "idle" | "recording" | "paused";
const MIN_MS = 1000; // anything shorter isn't worth saving

export default function TodayRecording() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const recState = useAudioRecorderState(recorder, 250);

  const [memory, setMemory] = useState<Memory | null>(null);
  const [draft, setDraft] = useState<Details | null>(null); // null = untouched → defaults come from Settings
  const [dayKey, setDayKey] = useState(recordingDayKey);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhaseState] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const stopping = useRef(false);

  /* Load today's memory from SQLite — on mount AND every time this tab regains focus,
     so changes made on the Memories tab (rating edit, delete) show up immediately. */
  useFocusEffect(
    useCallback(() => {
      if (phaseRef.current !== "idle") return; // never replace the UI mid-recording (recording OR paused)
      const key = recordingDayKey();
      setDayKey(key);
      getMemoryByDate(key)
        .then(setMemory)
        .catch(() => {})
        .finally(() => setLoaded(true));
    }, []),
  );

  /* Recording controls:  start → pause ⇄ resume → finish (or discard) */
  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Microphone needed",
          "Allow microphone access in Settings to record your day.",
        );
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      stopping.current = false;
      recorder.record();
      setPhase("recording");
    } catch {
      Alert.alert("Could not start recording", "Please try again.");
    }
  };

  const pauseRecording = useCallback(() => {
    try {
      recorder.pause();
      setPhase("paused");
    } catch {
      /* nothing to pause */
    }
  }, [recorder, setPhase]);

  const resumeRecording = async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      recorder.record(); // record() continues a paused recording
      setPhase("recording");
    } catch {
      Alert.alert(
        "Could not resume",
        "Tap “Finish & save” to keep what you've recorded so far.",
      );
    }
  };

  const finishRecording = useCallback(async () => {
    if (stopping.current) return;
    if (recState.durationMillis < MIN_MS) {
      Alert.alert("Too short", "Record a little longer, or discard it.");
      return;
    }
    stopping.current = true;
    const durationMs = Math.min(recState.durationMillis, MAX_MS);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      setPhase("idle");
      if (recorder.uri) {
        // copies the audio (and photo) into permanent storage + inserts the SQLite rows
        const saved = await createMemory({
          ...withDefaultTag(draft ?? freshDetails()),
          date: recordingDayKey(),
          audioUri: recorder.uri,
          durationMs,
        });
        setMemory(saved);
        void refreshReminders(); // today is recorded → drop today's reminder
        setDraft(null);
      }
    } catch {
      setPhase("idle");
      Alert.alert("Could not save recording", "Please try again.");
    }
  }, [recorder, recState.durationMillis, draft, setPhase]);

  const discardRecording = () => {
    const doDiscard = async () => {
      if (stopping.current) return;
      stopping.current = true;
      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
      } catch {
        /* already stopped */
      }
      setPhase("idle");
    };

    if (recState.durationMillis < 2000) {
      void doDiscard(); // a few seconds: no need to ask
      return;
    }
    Alert.alert(
      "Discard this recording?",
      "What you've recorded so far will be deleted.",
      [
        { text: "Keep recording", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => void doDiscard(),
        },
      ],
    );
  };

  const onPrimary = () => {
    if (phase === "idle") void startRecording();
    else if (phase === "recording") pauseRecording();
    else void resumeRecording();
  };

  /* Auto-finish at 7 minutes */
  useEffect(() => {
    if (phase === "recording" && recState.durationMillis >= MAX_MS)
      void finishRecording();
  }, [phase, recState.durationMillis, finishRecording]);

  /* Leaving the app pauses the recording instead of silently losing audio */
  useEffect(() => {
    if (phase !== "recording") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") pauseRecording();
    });
    return () => sub.remove();
  }, [phase, pauseRecording]);

  /* Sheet handlers */
  const saveDetails = async (details: Details) => {
    try {
      if (memory)
        setMemory(await updateMemory(memory.date, withDefaultTag(details)));
      else setDraft(details); // no recording yet: keep until the recording is saved
      setSheetOpen(false);
    } catch {
      Alert.alert("Could not save details", "Please try again.");
    }
  };

  const deleteMemory = () => {
    if (!memory) return;
    Alert.alert(
      `Delete ${dayPossessive(memory.date).toLowerCase()} memory?`,
      "The recording and details will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMemoryFromDb(memory.date);
              setMemory(null);
              void refreshReminders(); // today is empty again → bring the reminder back
              setDraft(null);
              setSheetOpen(false);
            } catch {
              Alert.alert("Could not delete", "Please try again.");
            }
          },
        },
      ],
    );
  };

  if (!loaded) return <View style={styles.card} />;

  return (
    <>
      {memory ? (
        <RecordedMemory memory={memory} onEdit={() => setSheetOpen(true)} />
      ) : (
        <EmptyRecording
          hasDraft={draft !== null && hasAnyDetail(draft)}
          dayKey={dayKey}
          previous={dayKey !== todayKey()}
          phase={phase}
          elapsedMs={recState.durationMillis}
          onPrimary={onPrimary}
          onFinish={finishRecording}
          onDiscard={discardRecording}
          onOpenDetails={() => setSheetOpen(true)}
        />
      )}

      <DetailsSheet
        visible={sheetOpen}
        initial={memory ?? draft ?? freshDetails()}
        title={
          memory
            ? `Edit ${dayPossessive(memory.date).toLowerCase()} memory`
            : "Add details"
        }
        onDelete={memory ? deleteMemory : undefined}
        onClose={() => setSheetOpen(false)}
        onSave={saveDetails}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                         EMPTY / RECORDING STATE                            */
/* -------------------------------------------------------------------------- */

const WAVE = [10, 18, 32, 46, 32, 18, 10];

function EmptyRecording({
  hasDraft,
  dayKey,
  previous,
  phase,
  elapsedMs,
  onPrimary,
  onFinish,
  onDiscard,
  onOpenDetails,
}: {
  hasDraft: boolean;
  dayKey: string;
  previous: boolean;
  phase: Phase;
  elapsedMs: number;
  onPrimary: () => void;
  onFinish: () => void;
  onDiscard: () => void;
  onOpenDetails: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const active = phase === "recording";
  const paused = phase === "paused";
  const live = phase !== "idle";

  // the pulsing ring only runs while audio is actually being captured
  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const ringStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
    transform: [
      {
        scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }),
      },
    ],
  };

  const title = active
    ? "Listening…"
    : paused
      ? "Paused"
      : previous
        ? "How was yesterday?"
        : "How was your day?";

  const subtitle = active
    ? "Tap the button to pause."
    : paused
      ? "Tap play to keep going."
      : "Capture a memory before it fades away.";

  return (
    <View style={styles.card}>
      <View style={styles.micArea}>
        <WaveBars active={active} side="left" />

        <Pressable
          onPress={onPrimary}
          accessibilityRole="button"
          accessibilityLabel={
            active
              ? "Pause recording"
              : paused
                ? "Resume recording"
                : "Start recording"
          }
          style={styles.micTouch}
        >
          {active && <Animated.View style={[styles.pulseRing, ringStyle]} />}
          <View style={styles.micOuter}>
            <View style={styles.micMiddle}>
              <View
                style={[styles.micButton, active && styles.micButtonRecording]}
              >
                {/* idle → mic · recording → pause · paused → play */}
                <Ionicons
                  name={active ? "pause" : paused ? "play" : "mic"}
                  size={active || paused ? 36 : 40}
                  color="#FFF"
                  style={paused ? { marginLeft: 4 } : undefined}
                />
              </View>
            </View>
          </View>
        </Pressable>

        <WaveBars active={active} side="right" />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {previous && !live ? (
        <Text style={styles.dayNote}>
          Saving to yesterday · {prettyDate(dayKey)}
        </Text>
      ) : null}

      <View style={styles.badge}>
        {active ? (
          <Ionicons name="ellipse" size={10} color={colors.record} />
        ) : paused ? (
          <Ionicons name="pause" size={14} color={colors.inkSoft} />
        ) : (
          <Ionicons name="time-outline" size={16} color={colors.inkSoft} />
        )}
        <Text style={styles.badgeText}>
          {live ? `${formatTime(elapsedMs / 1000)} / 07:00` : "Up to 7 minutes"}
        </Text>
      </View>

      {/* Same slot, same height: "Add details" becomes Discard / Finish while recording */}
      {live ? (
        <View style={styles.controlsRow}>
          <Pressable
            onPress={onDiscard}
            accessibilityRole="button"
            accessibilityLabel="Discard recording"
            style={({ pressed }) => [
              styles.controlBtn,
              styles.discardBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.controlText, { color: colors.danger }]}>
              Discard
            </Text>
          </Pressable>

          <Pressable
            onPress={onFinish}
            accessibilityRole="button"
            accessibilityLabel="Finish and save recording"
            style={({ pressed }) => [
              styles.controlBtn,
              styles.finishBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="checkmark" size={18} color="#FFF" />
            <Text style={[styles.controlText, { color: "#FFF" }]}>
              Finish & save
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={onOpenDetails}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons
            name={hasDraft ? "create-outline" : "add"}
            size={16}
            color={colors.onTint}
          />
          <Text style={styles.secondaryText}>
            {hasDraft ? "Edit details" : "Add photo, note, tag or rating"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function WaveBars({
  active,
  side,
}: {
  active: boolean;
  side: "left" | "right";
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bars = side === "left" ? WAVE : [...WAVE].reverse();
  return (
    <View style={styles.wave}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={[
            styles.waveBar,
            {
              height: h,
              backgroundColor: active ? colors.waveActive : colors.waveIdle,
            },
          ]}
        />
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                              RECORDED STATE                                */
/* -------------------------------------------------------------------------- */

const DESCRIPTION_LINES = 5;
/** Notes shorter than this many lines (in the normal size) are shown a little larger. */
const SHORT_NOTE_LINES = 4;
/** Larger text takes more room, so it shows one line fewer. */
const LARGE_NOTE_MAX_LINES = DESCRIPTION_LINES - 1;
/** Rough characters per line of the normal size; only used until the real layout is measured. */
const EST_CHARS_PER_LINE = 26;

function RecordedMemory({
  memory,
  onEdit,
}: {
  memory: Memory;
  onEdit: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const note = memory.description.trim();
  const hasNote = note.length > 0;

  // Line count of the note at the NORMAL size, measured by an invisible copy of the text.
  // (Measuring the visible text would loop: bigger font → more lines → smaller font → …)
  // Starts from an estimate so the first render doesn't jump.
  const [noteLines, setNoteLines] = useState(() =>
    Math.ceil(note.length / EST_CHARS_PER_LINE),
  );
  const largeNote = hasNote && noteLines < SHORT_NOTE_LINES;

  // same chips, laid out beside the photo (no note) or below it (with a note)
  const tagChips = memory.tags.map((t) => (
    <View key={t} style={styles.tag}>
      <Text style={styles.tagText}>#{t}</Text>
    </View>
  ));

  return (
    <View style={styles.card}>
      <View style={styles.recHeader}>
        <View style={styles.recTitleRow}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={14} color="#FFF" />
          </View>
          <Text style={styles.recTitle}>
            {dayPossessive(memory.date)} memory
          </Text>
        </View>
        <Text style={styles.recDate}>{prettyDate(memory.date)}</Text>
      </View>

      <AudioPlayer
        uri={memory.audioUri}
        fallbackDurationMs={memory.durationMs}
        style={styles.audioRow}
      />

      {/* Photo on the left · rating, then the note (or the tags when there is no note) on the right */}
      <View style={styles.contentRow}>
        <Image
          source={
            memory.imageUri ? { uri: memory.imageUri } : DEFAULT_MEMORY_IMAGE
          }
          style={styles.photo}
          resizeMode="cover"
        />

        <View style={styles.contentRight}>
          <View style={styles.rating}>
            <Ionicons name="star" size={15} color={colors.star} />
            <Text style={styles.ratingText}>{memory.rating} </Text>
          </View>

          {hasNote ? (
            <>
              {/* invisible copy, normal size, only to count lines */}
              <Text
                style={[styles.recDescription, styles.measure]}
                onTextLayout={(e) => setNoteLines(e.nativeEvent.lines.length)}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {note}
              </Text>

              <Text
                style={[
                  styles.recDescription,
                  styles.noteGap,
                  largeNote && styles.recDescriptionLarge,
                ]}
                numberOfLines={
                  largeNote ? LARGE_NOTE_MAX_LINES : DESCRIPTION_LINES
                }
                ellipsizeMode="tail"
              >
                {note}
              </Text>
            </>
          ) : (
            // no note → the tags take its place
            memory.tags.length > 0 && (
              <View style={styles.tagsInColumn}>{tagChips}</View>
            )
          )}
        </View>
      </View>

      {/* With a note, tags (max 3) stay below the photo */}
      {hasNote && memory.tags.length > 0 && (
        <View style={styles.tagsRow}>{tagChips}</View>
      )}

      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Ionicons name="pencil" size={14} color={colors.onTint} />
        <Text style={styles.secondaryText}>
          Edit {dayPossessive(memory.date).toLowerCase()} memory
        </Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  STYLES                                    */
/* -------------------------------------------------------------------------- */

/** How solid the Today card is (1 = opaque). Lower it to let more of the artwork show through. */
const CARD_OPACITY = 0.94;

/** 'rgba(r, g, b, a)' → same colour with a new alpha. Other formats are returned unchanged. */
const withAlpha = (color: string, alpha: number) => {
  const m = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})` : color;
};

const makeShadow = (c: Palette) =>
  Platform.select({
    ios: {
      shadowColor: c.brand,
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
    },
    default: { elevation: 6 },
  });

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      borderRadius: 28,
      padding: 16,
      paddingTop: 22,
      backgroundColor: withAlpha(c.cardBg, CARD_OPACITY),
      ...makeShadow(c),
    },

    /* mic */
    micArea: {
      height: 150,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    micTouch: {
      alignItems: "center",
      justifyContent: "center",
      marginHorizontal: 10,
    },
    pulseRing: {
      position: "absolute",
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: c.accent,
    },
    micOuter: {
      width: 136,
      height: 136,
      borderRadius: 68,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.micOuter,
    },
    micMiddle: {
      width: 112,
      height: 112,
      borderRadius: 56,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.micInner,
    },
    micButton: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.accent,
    },
    micButtonRecording: { backgroundColor: c.record },
    wave: { flexDirection: "row", alignItems: "center", gap: 5 },
    waveBar: { width: 4, borderRadius: 2 },

    title: {
      marginTop: 12,
      textAlign: "center",
      fontSize: 26,
      fontWeight: "700",
      fontFamily: SERIF,
      color: c.ink,
    },
    subtitle: {
      marginTop: 4,
      textAlign: "center",
      fontSize: 16,
      color: c.muted,
    },
    dayNote: {
      marginTop: 6,
      textAlign: "center",
      fontSize: 13,
      fontWeight: "600",
      color: c.accent,
    },
    badge: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginTop: 14,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.chip,
    },
    badgeText: {
      fontSize: 14,
      color: c.inkSoft,
      fontVariant: ["tabular-nums"],
    },

    /* shared secondary button */
    secondaryButton: {
      height: 46,
      marginTop: 16,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.surfaceTint,
    },
    secondaryText: { fontSize: 14, fontWeight: "600", color: c.onTint },

    /* recording controls (same 46px slot as the secondary button) */
    controlsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
    controlBtn: {
      height: 46,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    discardBtn: { flex: 1, backgroundColor: c.dangerBg },
    finishBtn: { flex: 1.6, backgroundColor: c.accent },
    controlText: { fontSize: 14, fontWeight: "700" },

    /* recorded */
    recHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    recTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    checkCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.success,
    },
    recTitle: { fontSize: 16, fontWeight: "700", color: c.ink },
    recDate: { fontSize: 13, color: c.inkSoft },

    audioRow: { marginTop: 14 },

    contentRow: { flexDirection: "row", gap: 14, marginTop: 14 },
    photo: {
      width: 118,
      aspectRatio: PHOTO_RATIO,
      borderRadius: 16,
      backgroundColor: c.placeholder,
    },
    // rating on top, then the note (or the tags) right under it
    contentRight: { flex: 1, alignItems: "flex-start" },
    recDescription: { fontSize: 15, lineHeight: 22, color: c.body },
    // notes under 4 lines: a little larger (and one line fewer is shown)
    recDescriptionLarge: { fontSize: 17, lineHeight: 25 },
    noteGap: { marginTop: 10 },
    // invisible line counter: same width as the note, takes no space
    measure: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      opacity: 0,
    },

    tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
    tagsInColumn: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    tag: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: c.tagBg,
    },
    tagText: { fontSize: 13, color: c.tagText, fontWeight: "500" },
    rating: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: c.ratingBg,
    },
    ratingText: { fontSize: 13, color: c.ratingText, fontWeight: "500" },
  });
