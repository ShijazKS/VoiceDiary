import { useBackup } from "@/components/backup/useBackup";
import { useLock } from "@/components/lock/LockGate";
import {
  Card,
  Row,
  Section,
  Segmented,
  useSettingsStyles,
  type IconName,
} from "@/components/Settings-ui";
import NotificationSettings from "@/components/settings/NotificationSettings";
import UpdateRow from "@/components/settings/UpdateRow";
import { Alert } from "@/lib/alert";
import { getDb } from "@/lib/db";
import { removeAllFiles } from "@/lib/files";
import { refreshReminders } from "@/lib/reminders";
import { updatesVisible } from "@/lib/remote";
import {
  MAX_RATING,
  MIN_RATING,
  useDefaultRating,
  useDefaultTag,
  useMemoryDay,
  type MemoryDay,
} from "@/lib/settings";
import { ThemePreference, useTheme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: IconName;
}[] = [
  { value: "system", label: "System", icon: "phone-portrait-outline" },
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
];

const MEMORY_DAY_OPTIONS: {
  value: MemoryDay;
  label: string;
  icon: IconName;
}[] = [
  { value: "today", label: "Today", icon: "today-outline" },
  { value: "previous", label: "Previous day", icon: "arrow-undo-outline" },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, preference, setPreference } = useTheme();
  const styles = useSettingsStyles();
  const [memoryDay, setMemoryDay] = useMemoryDay();
  const [defaultRating, setDefaultRating] = useDefaultRating();
  const [defaultTag, setDefaultTag] = useDefaultTag();
  const [count, setCount] = useState<number | null>(null);
  const { type: lockType } = useLock();

  const loadCount = useCallback(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) AS c FROM memories",
    );
    setCount(row?.c ?? 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCount();
    }, [loadCount]),
  );

  const { exportData, importData, overlay } = useBackup(loadCount);

  const confirmClear = () =>
    Alert.alert(
      "Clear all data",
      "This permanently deletes every recording, photo and note. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: async () => {
            const db = await getDb();
            await db.runAsync("DELETE FROM memories");
            removeAllFiles();
            setCount(0);
            void refreshReminders(); // nothing is recorded any more, so today's reminder is back on
          },
        },
      ],
    );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={26} color={colors.ink} />
        </Pressable>
        <Text style={styles.topTitle}>Settings</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Section title="Appearance" />
        <Card>
          <Segmented
            options={THEME_OPTIONS}
            value={preference}
            onChange={setPreference}
          />
        </Card>

        <Section title="Recording" />
        <Card>
          <Row
            icon="calendar-outline"
            title="Memory date"
            subtitle="Which day a new recording is saved to"
          />
          <Segmented
            options={MEMORY_DAY_OPTIONS}
            value={memoryDay}
            onChange={(v: MemoryDay) => {
              setMemoryDay(v);
              void refreshReminders();
            }}
          />
        </Card>
        <Text style={styles.caption}>
          {memoryDay === "today"
            ? "New recordings are saved to today."
            : "New recordings are saved to yesterday. Useful if you record after midnight."}
        </Text>

        <View style={{ height: 14 }} />
        <Card>
          <Row
            icon="star-outline"
            title="Default rating"
            subtitle="Starting rating for new memories"
            right={
              <Stepper
                value={defaultRating}
                min={MIN_RATING}
                max={MAX_RATING}
                onChange={setDefaultRating}
              />
            }
          />
          <Row
            icon="pricetag-outline"
            title="Default tag"
            subtitle="Used when you don’t add a tag"
            right={<TagField value={defaultTag} onCommit={setDefaultTag} />}
          />
        </Card>

        <NotificationSettings />

        <Section title="Privacy & security" />
        <Card>
          <Row
            icon="lock-closed-outline"
            title="App lock"
            subtitle={
              lockType
                ? `Protected with a ${lockType === "pin" ? "PIN" : "pattern"}`
                : "PIN, pattern or biometrics"
            }
            right={<Text style={styles.value}>{lockType ? "On" : "Off"}</Text>}
            onPress={() => router.push("/security")}
          />
        </Card>

        <Section title="Data" />
        <Card>
          <Row
            icon="albums-outline"
            title="Memories saved"
            subtitle="Recordings stored on this device"
            right={<Text style={styles.value}>{count ?? "–"}</Text>}
          />
          <Row
            icon="cloud-upload-outline"
            title="Export data"
            subtitle="Save all memories as a backup file"
            onPress={exportData}
          />
          <Row
            icon="cloud-download-outline"
            title="Import data"
            subtitle="Restore from a backup file"
            onPress={importData}
          />
          <Row
            icon="trash-outline"
            title="Clear all data"
            subtitle="Permanently delete all recordings"
            danger
            onPress={confirmClear}
          />
        </Card>

        <Section title="About" />
        <Card>
          <Row
            icon="information-circle-outline"
            title="About VoiceDiary"
            subtitle={`Version ${Constants.expoConfig?.version ?? "1.2.0"}`}
          />
          {updatesVisible && <UpdateRow />}
        </Card>
      </ScrollView>

      {overlay}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  INPUTS                                    */
/* -------------------------------------------------------------------------- */

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useSettingsStyles();
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(value - 1)}
        disabled={atMin}
        hitSlop={8}
        accessibilityLabel="Decrease default rating"
        style={[styles.stepBtn, atMin && { opacity: 0.35 }]}
      >
        <Ionicons name="remove" size={18} color={colors.onTint} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        onPress={() => onChange(value + 1)}
        disabled={atMax}
        hitSlop={8}
        accessibilityLabel="Increase default rating"
        style={[styles.stepBtn, atMax && { opacity: 0.35 }]}
      >
        <Ionicons name="add" size={18} color={colors.onTint} />
      </Pressable>
    </View>
  );
}

/** Inline tag editor. `onCommit` saves and returns the cleaned-up tag that was stored. */
function TagField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (text: string) => string;
}) {
  const { colors, isDark } = useTheme();
  const styles = useSettingsStyles();
  const [text, setText] = useState(value);
  const commit = () => setText(onCommit(text));
  return (
    <View style={styles.tagField}>
      <Text style={styles.hash}>#</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={commit}
        onSubmitEditing={commit}
        placeholder="general"
        placeholderTextColor={colors.hint}
        keyboardAppearance={isDark ? "dark" : "light"}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={24}
        returnKeyType="done"
        selectTextOnFocus
        style={styles.tagInput}
      />
    </View>
  );
}
