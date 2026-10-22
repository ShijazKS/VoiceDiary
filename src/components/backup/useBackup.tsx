import ExportSheet from "@/components/backup/ExportSheet";
import { Alert } from "@/lib/alert";
import {
  applyBackup,
  discardStaged,
  exportBackup,
  inspectBackup,
  type DateRange,
  type ImportMode,
  type Progress,
  type StagedBackup,
} from "@/lib/backup";
import { whileExternalUi } from "@/lib/lock";
import { prettyDate } from "@/lib/memory";
import { Palette, SERIF, useTheme } from "@/lib/theme";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";

type Busy = { title: string; detail?: string; fraction?: number } | null;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const messageOf = (e: unknown) =>
  e instanceof Error && e.message
    ? e.message
    : "Something went wrong. Please try again.";

/**
 * Export / import logic + the progress overlay.
 *   const { exportData, importData, overlay } = useBackup(onChanged);
 * Render `{overlay}` anywhere inside the screen.
 */
export function useBackup(onChanged?: () => void) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState<Busy>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const showProgress =
    (title: string, asPercent = false) =>
    (p: Progress) =>
      setBusy({
        title,
        detail: asPercent
          ? `${Math.round((p.done / p.total) * 100)}%`
          : `${p.done} of ${p.total} files`,
        fraction: p.total ? p.done / p.total : undefined,
      });

  /* --------------------------------- export --------------------------------- */

  /** Opens the "what to export" sheet. */
  const exportData = () => {
    if (!busy) setSheetOpen(true);
  };

  const runExport = async (range: DateRange | null) => {
    setSheetOpen(false);
    await sleep(350); // let the sheet finish closing before the next modal opens (iOS)
    try {
      setBusy({ title: "Preparing your backup…" });
      const result = await exportBackup(showProgress("Exporting…"), range);
      setBusy(null);
      if (!result) {
        Alert.alert(
          "Nothing to export",
          range
            ? "There are no memories in that range."
            : "Record your first memory, then come back to make a backup.",
        );
        return;
      }
      await sleep(300);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Sharing isn’t available",
          "This device can’t open the share menu.",
        );
        return;
      }
      await whileExternalUi(() =>
        Sharing.shareAsync(result.file.uri, {
          mimeType: "application/zip",
          UTI: "public.zip-archive",
          dialogTitle: "Save your VoiceDiary backup",
        }),
      );
      if (result.skipped > 0) {
        Alert.alert(
          "Backup created",
          `${result.skipped} ${result.skipped === 1 ? "memory was" : "memories were"} left out because the recording file was missing.`,
        );
      }
    } catch (e) {
      setBusy(null);
      Alert.alert("Export failed", messageOf(e));
    }
  };

  /* --------------------------------- import --------------------------------- */

  const finish = (title: string, message: string, goHome: boolean) =>
    Alert.alert(title, message, [
      { text: "OK", onPress: () => goHome && router.navigate("/") },
    ]);

  const run = async (staged: StagedBackup, mode: ImportMode) => {
    try {
      setBusy({
        title:
          mode === "replace" ? "Replacing your diary…" : "Adding memories…",
      });
      const res = await applyBackup(staged, mode);
      setBusy(null);
      onChanged?.();
      const kept =
        res.skipped > 0
          ? ` ${res.skipped} ${res.skipped === 1 ? "day already had" : "days already had"} a memory, so yours ${res.skipped === 1 ? "was" : "were"} kept.`
          : "";
      finish(
        "Import complete",
        `${res.imported} ${res.imported === 1 ? "memory" : "memories"} imported.${kept}${res.settingsRestored ? " Your settings were restored too." : ""}`,
        res.settingsRestored, // settings screens would show stale values, so return to Today
      );
    } catch (e) {
      setBusy(null);
      discardStaged();
      Alert.alert(
        "Import failed",
        `${messageOf(e)}\n\nNothing in your diary was changed.`,
      );
    }
  };

  const importData = async () => {
    if (busy) return;
    try {
      const picked = await whileExternalUi(() =>
        DocumentPicker.getDocumentAsync({
          type: "*/*",
          copyToCacheDirectory: true,
          multiple: false,
        }),
      );
      if (picked.canceled || !picked.assets?.[0]) return;

      setBusy({ title: "Reading backup…" });
      const staged = await inspectBackup(
        picked.assets[0].uri,
        showProgress("Reading backup…", true),
      );
      setBusy(null);

      const first = prettyDate(staged.records[0].date);
      const last = prettyDate(staged.records[staged.records.length - 1].date);
      const made = staged.createdAt
        ? `\nMade on ${new Date(staged.createdAt).toLocaleDateString()}.`
        : "";
      const partial = staged.range
        ? `\nPartial backup: ${prettyDate(staged.range.from)} – ${prettyDate(staged.range.to)}.`
        : "";
      const bad = staged.invalid
        ? `\n${staged.invalid} unreadable ${staged.invalid === 1 ? "entry" : "entries"} will be skipped.`
        : "";

      Alert.alert(
        `${staged.records.length} ${staged.records.length === 1 ? "memory" : "memories"} found`,
        `${first} – ${last}.${made}${partial}${bad}\n\nMerge adds the days you don’t have yet and keeps your current memories.${staged.range ? "" : " Replace swaps your whole diary for this backup."}`,
        [
          { text: "Cancel", style: "cancel", onPress: discardStaged },
          { text: "Merge", onPress: () => run(staged, "merge") },
          ...(staged.range
            ? []
            : [
                {
                  text: "Replace all",
                  style: "destructive" as const,
                  onPress: () =>
                    Alert.alert(
                      "Replace everything?",
                      "All memories currently on this device will be deleted and replaced by the backup.",
                      [
                        {
                          text: "Cancel",
                          style: "cancel",
                          onPress: discardStaged,
                        },
                        {
                          text: "Replace",
                          style: "destructive",
                          onPress: () => run(staged, "replace"),
                        },
                      ],
                    ),
                },
              ]),
        ],
        { cancelable: true, onDismiss: discardStaged },
      );
    } catch (e) {
      setBusy(null);
      Alert.alert("Couldn’t read that file", messageOf(e));
    }
  };

  const overlay = (
    <>
      <ExportSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onExport={runExport}
      />
      <Modal
        visible={!!busy}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.title}>{busy?.title}</Text>
            {busy?.detail ? (
              <Text style={styles.detail}>{busy.detail}</Text>
            ) : null}
            {busy?.fraction != null ? (
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.round(busy.fraction * 100)}%` },
                  ]}
                />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );

  return { exportData, importData, overlay, busy: !!busy };
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.45)",
      padding: 32,
    },
    card: {
      width: "100%",
      maxWidth: 320,
      alignItems: "center",
      gap: 12,
      padding: 24,
      borderRadius: 20,
      backgroundColor: c.surface,
    },
    title: {
      fontSize: 18,
      fontFamily: SERIF,
      fontWeight: "700",
      color: c.ink,
      textAlign: "center",
    },
    detail: { fontSize: 13, color: c.muted },
    track: {
      alignSelf: "stretch",
      height: 6,
      borderRadius: 3,
      overflow: "hidden",
      backgroundColor: c.surfaceTint,
    },
    fill: { height: "100%", backgroundColor: c.brand },
  });
