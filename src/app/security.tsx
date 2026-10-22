import { useLock } from "@/components/lock/LockGate";
import PatternPad from "@/components/lock/PatternPad";
import PinPad from "@/components/lock/PinPad";
import {
  Card,
  Row,
  Section,
  useSettingsStyles,
  type IconName,
} from "@/components/Settings-ui";
import { Alert } from "@/lib/alert";
import {
  authenticateBiometric,
  getAutoLock,
  getBiometricsEnabled,
  isBiometricAvailable,
  MIN_PATTERN_DOTS,
  PIN_LENGTH,
  removeLock,
  setBiometricsEnabled,
  setCredential,
  verifyCredential,
  type AutoLock,
  type LockType,
} from "@/lib/lock";
import { SERIF, useTheme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Flow =
  | { name: "menu" }
  | { name: "verify"; then: "change" | "remove" }
  | { name: "choose" }
  | { name: "enter"; lockType: LockType }
  | { name: "confirm"; lockType: LockType; first: string };

const AUTO_OPTIONS: { value: AutoLock; label: string; icon: IconName }[] = [
  { value: "now", label: "Immediately", icon: "flash-outline" },
  { value: "1m", label: "1 min", icon: "timer-outline" },
  { value: "5m", label: "5 min", icon: "time-outline" },
];

const typeName = (t: LockType) => (t === "pin" ? "PIN" : "pattern");

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useSettingsStyles();
  const { type, refresh, lockNow } = useLock();

  const [flow, setFlow] = useState<Flow>({ name: "menu" });
  const [error, setError] = useState("");
  const [bio, setBio] = useState(getBiometricsEnabled);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [after, setAfter] = useState<AutoLock>(getAutoLock);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 1800);
    return () => clearTimeout(t);
  }, [error]);

  const back = () => {
    setError("");
    if (flow.name === "menu") router.back();
    else setFlow({ name: "menu" });
  };

  /* ------------------------------- pad handlers ------------------------------ */

  const onVerify = async (secret: string) => {
    if (flow.name !== "verify") return;
    const res = await verifyCredential(secret);
    if (!res.ok) {
      setError(
        res.retryAfterMs > 0
          ? `Too many attempts. Try again in ${Math.ceil(res.retryAfterMs / 1000)}s.`
          : "Incorrect. Try again.",
      );
      return;
    }
    if (flow.then === "remove") {
      await removeLock();
      refresh();
      setFlow({ name: "menu" });
    } else {
      setFlow({ name: "choose" });
    }
  };

  const onEnter = (secret: string) => {
    if (flow.name !== "enter") return;
    setFlow({ name: "confirm", lockType: flow.lockType, first: secret });
  };

  const onConfirm = async (secret: string) => {
    if (flow.name !== "confirm") return;
    if (secret !== flow.first) {
      setError("Those didn’t match. Start again.");
      setFlow({ name: "enter", lockType: flow.lockType });
      return;
    }
    await setCredential(flow.lockType, secret);
    refresh();
    setFlow({ name: "menu" });
  };

  const toggleBiometrics = async (on: boolean) => {
    if (on) {
      if (!(await isBiometricAvailable())) {
        Alert.alert(
          "Not available",
          "Set up Face ID or a fingerprint in your phone’s settings first.",
        );
        return;
      }
      if (!(await authenticateBiometric("Turn on biometric unlock"))) return;
    }
    setBiometricsEnabled(on);
    setBio(on);
  };

  /* --------------------------------- screens --------------------------------- */

  const padFlow =
    flow.name === "verify" || flow.name === "enter" || flow.name === "confirm";
  const padType: LockType =
    flow.name === "verify"
      ? (type ?? "pin")
      : flow.name === "enter" || flow.name === "confirm"
        ? flow.lockType
        : "pin";

  const padTitle =
    flow.name === "verify"
      ? `Enter your current ${typeName(padType)}`
      : flow.name === "enter"
        ? padType === "pin"
          ? "Create a PIN"
          : "Draw a pattern"
        : padType === "pin"
          ? "Confirm your PIN"
          : "Draw it again";
  const padHint =
    flow.name === "enter"
      ? padType === "pin"
        ? `Choose ${PIN_LENGTH} digits.`
        : `Connect at least ${MIN_PATTERN_DOTS} dots.`
      : "";
  const onPad =
    flow.name === "verify"
      ? onVerify
      : flow.name === "enter"
        ? onEnter
        : onConfirm;

  const title =
    flow.name === "menu"
      ? "App lock"
      : flow.name === "choose"
        ? "Choose a lock"
        : "App lock";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={back}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={26} color={colors.ink} />
        </Pressable>
        <Text style={styles.topTitle}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>

      {padFlow ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            paddingTop: 32,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontFamily: SERIF,
              fontWeight: "700",
              color: colors.ink,
            }}
          >
            {padTitle}
          </Text>
          <Text
            style={{
              marginTop: 8,
              height: 22,
              fontSize: 15,
              color: error ? colors.danger : colors.muted,
            }}
          >
            {error || padHint}
          </Text>
          <View style={{ flex: 1, justifyContent: "center" }}>
            {padType === "pin" ? (
              <PinPad key={flow.name} error={!!error} onComplete={onPad} />
            ) : (
              <PatternPad
                key={flow.name}
                error={!!error}
                onComplete={onPad}
                onTooShort={() =>
                  setError(`Connect at least ${MIN_PATTERN_DOTS} dots.`)
                }
              />
            )}
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {flow.name === "choose" ? (
            <>
              <Text style={styles.caption}>
                How would you like to unlock VoiceDiary?
              </Text>
              <View style={{ height: 12 }} />
              <Card>
                <Row
                  icon="keypad-outline"
                  title="PIN"
                  subtitle={`${PIN_LENGTH} digits`}
                  onPress={() => setFlow({ name: "enter", lockType: "pin" })}
                />
                <Row
                  icon="grid-outline"
                  title="Pattern"
                  subtitle="Connect dots on a grid"
                  onPress={() =>
                    setFlow({ name: "enter", lockType: "pattern" })
                  }
                />
              </Card>
            </>
          ) : !type ? (
            <>
              <Section title="Protect your diary" />
              <Card>
                <Row
                  icon="shield-checkmark-outline"
                  title="Set up app lock"
                  subtitle="Ask for a PIN or pattern when opening the app"
                  onPress={() => setFlow({ name: "choose" })}
                />
              </Card>
              <Text style={styles.caption}>
                You can also unlock with Face ID or a fingerprint once a PIN or
                pattern is set.
              </Text>
            </>
          ) : (
            <>
              <Section title="Lock" />
              <Card>
                <Row
                  icon="swap-horizontal-outline"
                  title="Change lock"
                  subtitle={`Currently a ${typeName(type)}`}
                  onPress={() => setFlow({ name: "verify", then: "change" })}
                />
                <Row
                  icon="lock-closed-outline"
                  title="Lock now"
                  subtitle="Ask for the lock again right away"
                  onPress={lockNow}
                />
              </Card>

              {bioAvailable ? (
                <>
                  <Section title="Biometrics" />
                  <Card>
                    <Row
                      icon="finger-print-outline"
                      title="Face ID / fingerprint"
                      subtitle={`Faster than your ${typeName(type)}`}
                      right={
                        <Switch
                          value={bio}
                          onValueChange={toggleBiometrics}
                          trackColor={{
                            false: colors.border,
                            true: colors.brand,
                          }}
                          thumbColor="#FFF"
                        />
                      }
                    />
                  </Card>
                </>
              ) : null}

              {/* <Section title="Ask for the lock" />
              <Card>
                <Segmented
                  options={AUTO_OPTIONS}
                  value={after}
                  onChange={(v) => {
                    setAutoLock(v);
                    setAfter(v);
                  }}
                />
              </Card>
              <Text style={styles.caption}>How long the app can be in the background before it locks again.</Text> */}

              <View style={{ height: 14 }} />
              <Card>
                <Row
                  icon="close-circle-outline"
                  title="Remove app lock"
                  subtitle="Anyone with your phone could open VoiceDiary"
                  danger
                  onPress={() => setFlow({ name: "verify", then: "remove" })}
                />
              </Card>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
