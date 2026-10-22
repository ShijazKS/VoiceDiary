import { Card, Row, Section } from "@/components/Settings-ui";
import TimePickerModal from "@/components/settings/TimePickerModal";
import { Alert } from "@/lib/alert";
import {
  DAY_NAMES,
  describeDays,
  formatClock,
  getPermissionStatus,
  refreshReminders,
  remindersSupported,
  requestPermission,
  useReminderSettings,
} from "@/lib/reminders";
import { useTheme, type Palette } from "@/lib/theme";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
/* TEMP-PREVIEW ───────────────────────────────────────────────────────────────
 * Expo Go can't schedule notifications, so this section normally shows a
 * "not available" card there. While this is true you can see and click through
 * the real UI in Expo Go (nothing is actually scheduled or sent).
 * To undo: set it to false, or delete every line marked TEMP-PREVIEW.
 * It only ever applies in development (__DEV__) AND when reminders are
 * unsupported, so it can't change a real build.
 * ──────────────────────────────────────────────────────────────────────────── */
const PREVIEW_IN_EXPO_GO = true; // TEMP-PREVIEW
const preview = __DEV__ && PREVIEW_IN_EXPO_GO && !remindersSupported; // TEMP-PREVIEW

/** Weekday chips: Sun–Wed on the first row, Thu–Sat centred on the second (0 = Sunday). */
const DAY_ROWS = [
  [0, 1, 2, 3],
  [4, 5, 6],
];
const DAY_GAP = 8;

/** The whole "Notifications" block of the Settings screen. */
export default function NotificationSettings() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [s, update] = useReminderSettings();
  const [timeOpen, setTimeOpen] = useState(false);
  const [dayAreaWidth, setDayAreaWidth] = useState(0);
  const [permission, setPermission] = useState<
    "granted" | "denied" | "undetermined"
  >("undetermined");

  // re-check permission when returning from the system settings, and keep the schedule fresh
  useFocusEffect(
    useCallback(() => {
      getPermissionStatus().then((p) => setPermission(preview ? "granted" : p)); // TEMP-PREVIEW (was: setPermission)
      void refreshReminders();
    }, []),
  );

  const askToOpenSettings = () =>
    Alert.alert(
      "Notifications are off",
      "Turn them on for VoiceDiary in your phone’s settings to get reminders.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Open settings", onPress: () => Linking.openSettings() },
      ],
    );

  const toggleEnabled = async (on: boolean) => {
    if (!on) return update({ enabled: false });
    if (preview) return update({ enabled: true }); // TEMP-PREVIEW: skip the permission prompt
    const granted = await requestPermission();
    setPermission(granted ? "granted" : "denied");
    if (!granted) return askToOpenSettings();
    update({ enabled: true });
  };

  const toggleDay = (day: number) => {
    const has = s.days.includes(day);
    if (has && s.days.length === 1) return; // keep at least one day
    update({ days: has ? s.days.filter((d) => d !== day) : [...s.days, day] });
  };

  if (!remindersSupported && !preview) {
    // TEMP-PREVIEW (was: if (!remindersSupported) {)
    return (
      <>
        <Section title="Notifications" />
        <Card>
          <Row
            icon="notifications-off-outline"
            title="Daily reminder"
            subtitle="Not available in Expo Go on Android. Use a development build to turn reminders on."
          />
        </Card>
      </>
    );
  }

  // every chip is the width of one of four equal columns, so both rows line up
  const chipWidth = dayAreaWidth
    ? Math.min(76, Math.floor((dayAreaWidth - DAY_GAP * 3) / 4))
    : 0;

  const switchProps = (
    value: boolean,
    onValueChange: (v: boolean) => void,
  ) => ({
    value,
    onValueChange,
    trackColor: { false: colors.faint, true: colors.accent },
    thumbColor: "#FFF",
    ios_backgroundColor: colors.faint,
  });

  return (
    <>
      <Section title="Notifications" />

      {preview && ( // TEMP-PREVIEW
        <View style={styles.previewBanner}>
          <Text style={styles.previewText}>
            Preview mode: you’re in Expo Go, so reminders won’t actually fire.
          </Text>
        </View>
      )}

      {/* Each row is its own child of <Card> so the card can draw dividers between them. */}
      <Card>
        <Row
          icon="notifications-outline"
          title="Daily reminder"
          subtitle="A gentle nudge to record your day"
          right={<Switch {...switchProps(s.enabled, toggleEnabled)} />}
        />

        {s.enabled && permission === "denied" && (
          <Pressable onPress={askToOpenSettings} style={styles.warning}>
            <Text style={styles.warningText}>
              Notifications are blocked for VoiceDiary. Tap to open settings.
            </Text>
          </Pressable>
        )}

        {s.enabled && (
          <Row
            icon="time-outline"
            title="Reminder time"
            subtitle={`${describeDays(s.days)} at ${formatClock(s.hour, s.minute)}`}
            right={
              <View style={styles.timePill}>
                <Text style={styles.timeText}>
                  {formatClock(s.hour, s.minute)}
                </Text>
              </View>
            }
            onPress={() => setTimeOpen(true)}
          />
        )}

        {s.enabled && (
          <View>
            <Row
              icon="repeat-outline"
              title="Repeat on"
              subtitle={describeDays(s.days)}
            />
            <View style={styles.dayOuter}>
              <View
                style={styles.dayArea}
                onLayout={(e) => setDayAreaWidth(e.nativeEvent.layout.width)}
              >
                {DAY_ROWS.map((row, i) => (
                  <View key={i} style={styles.dayRow}>
                    {row.map((d) => {
                      const on = s.days.includes(d);
                      return (
                        <Pressable
                          key={d}
                          onPress={() => toggleDay(d)}
                          accessibilityRole="button"
                          accessibilityLabel={DAY_NAMES[d]}
                          accessibilityState={{ selected: on }}
                          style={[
                            styles.dayChip,
                            { width: chipWidth },
                            on && styles.dayChipOn,
                          ]}
                        >
                          <Text
                            style={[styles.dayText, on && styles.dayTextOn]}
                          >
                            {DAY_NAMES[d]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </Card>

      {s.enabled && (
        <Text style={styles.caption}>
          You won’t be reminded on a day you’ve already recorded.
        </Text>
      )}

      <TimePickerModal
        visible={timeOpen}
        hour={s.hour}
        minute={s.minute}
        onCancel={() => setTimeOpen(false)}
        onConfirm={(hour, minute) => {
          setTimeOpen(false);
          update({ hour, minute });
        }}
      />
    </>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    timePill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: c.surfaceTint,
    },
    timeText: {
      fontSize: 15,
      fontWeight: "700",
      color: c.onTint,
      fontVariant: ["tabular-nums"],
    },

    // Same side padding as a Row (16). Two rows of chips; the second row is centred.
    dayOuter: { paddingHorizontal: 16, paddingBottom: 14 },
    dayArea: { gap: DAY_GAP },
    dayRow: { flexDirection: "row", justifyContent: "center", gap: DAY_GAP },
    dayChip: {
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceTint,
    },
    dayChipOn: { backgroundColor: c.accent },
    dayText: { fontSize: 14, fontWeight: "700", color: c.muted },
    dayTextOn: { color: "#FFF" },

    warning: {
      marginHorizontal: 16,
      marginVertical: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor: c.dangerBg,
    },
    warningText: {
      fontSize: 13,
      lineHeight: 18,
      color: c.danger,
      fontWeight: "600",
    },

    previewBanner: {
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.surfaceTint,
    }, // TEMP-PREVIEW
    previewText: {
      fontSize: 13,
      lineHeight: 18,
      color: c.onTint,
      fontWeight: "600",
    }, // TEMP-PREVIEW

    caption: {
      marginTop: 10,
      paddingHorizontal: 4,
      fontSize: 13,
      lineHeight: 18,
      color: c.muted,
    },
  });
