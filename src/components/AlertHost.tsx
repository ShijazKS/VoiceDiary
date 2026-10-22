import { Ionicons } from "@expo/vector-icons";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    Animated,
    Easing,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { FullWindowOverlay } from "react-native-screens";

import {
    subscribeAlerts,
    type AlertButton,
    type AlertRequest,
} from "@/lib/alert";
import { SERIF, useTheme, type Palette } from "@/lib/theme";

/** Mount once, near the root (inside ThemeProvider). Shows alerts one at a time. */
export default function AlertHost() {
  const [queue, setQueue] = useState<AlertRequest[]>([]);

  useEffect(() => subscribeAlerts((req) => setQueue((q) => [...q, req])), []);

  const current = queue[0];
  const next = useCallback(() => setQueue((q) => q.slice(1)), []);

  if (!current) return null;
  return <AlertDialog key={current.id} request={current} onDone={next} />;
}

/**
 * iOS: a Modal can't open on top of another open Modal (e.g. when an alert is raised from inside a
 * bottom sheet), so iOS uses a full-window overlay that always sits above everything.
 * Android: a normal transparent Modal, which stacks fine.
 */
function Surface({
  children,
  onRequestClose,
}: {
  children: ReactNode;
  onRequestClose: () => void;
}) {
  if (Platform.OS === "ios")
    return <FullWindowOverlay>{children}</FullWindowOverlay>;
  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType="none"
      visible
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
}

function AlertDialog({
  request,
  onDone,
}: {
  request: AlertRequest;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { title, message, buttons, options } = request;
  const cancelBtn = buttons.find((b) => b.style === "cancel");
  const cancelable = options?.cancelable ?? !!cancelBtn;
  const hasDestructive = buttons.some((b) => b.style === "destructive");

  // layout: 1–2 short buttons sit side by side, otherwise they stack (cancel last, like iOS)
  const stacked =
    buttons.length > 2 || buttons.some((b) => (b.text?.length ?? 0) > 16);
  const ordered = stacked
    ? [
        ...buttons.filter((b) => b.style !== "cancel"),
        ...buttons.filter((b) => b.style === "cancel"),
      ]
    : [
        ...buttons.filter((b) => b.style === "cancel"),
        ...buttons.filter((b) => b.style !== "cancel"),
      ];

  /* ---- enter / exit animation ---- */
  const anim = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  // run the button's action AFTER the fade-out, then advance the queue
  // (so an alert raised from inside onPress is queued before this one is removed → no flicker)
  const close = (after?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(anim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      after?.();
      onDone();
    });
  };

  const press = (b: AlertButton) => close(() => b.onPress?.());
  const dismiss = () => {
    if (!cancelable) return;
    close(() => {
      cancelBtn?.onPress?.();
      options?.onDismiss?.();
    });
  };

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  return (
    <Surface onRequestClose={dismiss}>
      <Animated.View style={[styles.root, { opacity: anim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessible={false}
        />

        <Animated.View
          style={[styles.card, { transform: [{ scale }] }]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          {hasDestructive && (
            <View style={styles.iconCircle}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </View>
          )}

          <Text style={styles.title}>{title}</Text>

          {message ? (
            <ScrollView
              style={styles.messageBox}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.message}>{message}</Text>
            </ScrollView>
          ) : null}

          <View style={stacked ? styles.stack : styles.row}>
            {ordered.map((b, i) => {
              const kind = b.style ?? "default";
              return (
                <Pressable
                  key={`${b.text}-${i}`}
                  onPress={() => press(b)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.button,
                    !stacked && styles.buttonFlex,
                    kind === "cancel" && styles.btnCancel,
                    kind === "default" && styles.btnDefault,
                    kind === "destructive" && styles.btnDestructive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      kind === "cancel"
                        ? { color: colors.onTint }
                        : { color: "#FFF" },
                    ]}
                  >
                    {b.text ?? "OK"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Surface>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    card: {
      width: "100%",
      maxWidth: 340,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 18,
      borderRadius: 26,
      backgroundColor: c.surface,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
        },
        default: { elevation: 12 },
      }),
    },
    iconCircle: {
      alignSelf: "center",
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      backgroundColor: c.dangerBg,
    },
    title: {
      textAlign: "center",
      fontSize: 20,
      lineHeight: 26,
      fontFamily: SERIF,
      fontWeight: "700",
      color: c.ink,
    },
    messageBox: { maxHeight: 240, marginTop: 8 },
    message: {
      textAlign: "center",
      fontSize: 15,
      lineHeight: 22,
      color: c.muted,
    },

    row: { flexDirection: "row", gap: 10, marginTop: 20 },
    stack: { gap: 10, marginTop: 20 },
    button: {
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    buttonFlex: { flex: 1 },
    buttonText: { fontSize: 16, fontWeight: "700" },
    btnCancel: { backgroundColor: c.surfaceTint },
    btnDefault: { backgroundColor: c.accent },
    btnDestructive: { backgroundColor: c.record },
  });
