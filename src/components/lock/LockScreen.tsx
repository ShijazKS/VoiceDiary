import PatternPad from "@/components/lock/PatternPad";
import PinPad from "@/components/lock/PinPad";
import { Alert } from "@/lib/alert";
import { getDb } from "@/lib/db";
import { removeAllFiles } from "@/lib/files";
import {
  authenticateBiometric,
  getBiometricsEnabled,
  isBiometricAvailable,
  lockoutRemainingMs,
  removeLock,
  verifyCredential,
  type LockType,
} from "@/lib/lock";
import { Palette, SERIF, useTheme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = { type: LockType; onUnlock: () => void; onReset: () => void };

export default function LockScreen({ type, onUnlock, onReset }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [retryAt, setRetryAt] = useState(
    () => Date.now() + lockoutRemainingMs(),
  );
  const [now, setNow] = useState(Date.now());
  const [bio, setBio] = useState(false);
  const waiting = retryAt > now;

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [waiting]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(false), 800);
    return () => clearTimeout(t);
  }, [error]);

  const tryBiometric = useCallback(async () => {
    if (await authenticateBiometric()) onUnlock();
  }, [onUnlock]);

  // Offer biometrics straight away when they're switched on.
  useEffect(() => {
    (async () => {
      if (!getBiometricsEnabled() || !(await isBiometricAvailable())) return;
      setBio(true);
      tryBiometric();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (secret: string) => {
    const res = await verifyCredential(secret);
    if (res.ok) return onUnlock();
    setError(true);
    if (res.retryAfterMs > 0) {
      setRetryAt(Date.now() + res.retryAfterMs);
      setNow(Date.now());
    } else {
      setMessage(
        type === "pin" ? "Wrong PIN. Try again." : "Wrong pattern. Try again.",
      );
    }
  };

  const forgot = () =>
    Alert.alert(
      `Forgot your ${type === "pin" ? "PIN" : "pattern"}?`,
      "You can reset the lock, but this permanently deletes all memories on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset and delete",
          style: "destructive",
          onPress: async () => {
            const db = await getDb();
            await db.runAsync("DELETE FROM memories");
            removeAllFiles();
            await removeLock();
            onReset();
          },
        },
      ],
    );

  const secondsLeft = Math.max(1, Math.ceil((retryAt - now) / 1000));
  const prompt = waiting
    ? `Too many attempts. Try again in ${secondsLeft}s.`
    : message || (type === "pin" ? "Enter your PIN" : "Draw your pattern");

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Ionicons name="lock-closed" size={30} color={colors.brand} />
      <Text style={styles.name}>
        <Text style={styles.bold}>Voice</Text>Diary
      </Text>
      <Text
        style={[styles.prompt, (error || waiting) && { color: colors.danger }]}
      >
        {prompt}
      </Text>

      <View style={styles.pad}>
        {type === "pin" ? (
          <PinPad disabled={waiting} error={error} onComplete={submit} />
        ) : (
          <PatternPad
            disabled={waiting}
            error={error}
            onComplete={submit}
            onTooShort={() => {
              setError(true);
              setMessage("Connect at least 4 dots.");
            }}
          />
        )}
      </View>

      <View style={styles.footer}>
        {bio ? (
          <Pressable
            onPress={tryBiometric}
            style={styles.link}
            accessibilityRole="button"
          >
            <Ionicons name="finger-print" size={20} color={colors.brand} />
            <Text style={styles.linkText}>Use Face ID / fingerprint</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={forgot} hitSlop={10}>
          <Text style={styles.forgot}>
            Forgot {type === "pin" ? "PIN" : "pattern"}?
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      backgroundColor: c.background,
    },
    name: {
      marginTop: 10,
      fontSize: 26,
      fontFamily: SERIF,
      fontWeight: "400",
      color: c.ink,
    },
    bold: { fontWeight: "700" },
    prompt: { marginTop: 10, height: 22, fontSize: 15, color: c.muted },
    pad: { flex: 1, justifyContent: "center" },
    footer: { alignItems: "center", gap: 16, minHeight: 64 },
    link: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
    linkText: { fontSize: 15, fontWeight: "600", color: c.brand },
    forgot: { fontSize: 14, color: c.muted },
  });
