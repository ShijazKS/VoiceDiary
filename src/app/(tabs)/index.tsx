import TodayRecording from "@/components/TodayRecording";
import { Palette, SERIF, useTheme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatToday() {
  const d = new Date();
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { colors, backgroundImage } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ImageBackground
      source={backgroundImage}
      style={styles.background}
      resizeMode="cover"
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>
            <Text style={styles.appNameBold}>Voice</Text>Diary
          </Text>

          <Pressable
            onPress={() => router.push("/settings")}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings" size={26} color={colors.ink} />
          </Pressable>
        </View>

        {/* Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.date}>{formatToday()}</Text>
          <Text style={styles.heading}>{"A voice\nfor today"}</Text>
          <Text style={styles.quote}>Same moments. A richer tomorrow.</Text>
        </View>

        {/* Pushes the card toward the bottom so the artwork shows above it */}
        <View style={styles.spacer} />

        <TodayRecording />
      </ScrollView>
    </ImageBackground>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    background: { flex: 1, backgroundColor: c.background },
    content: { flexGrow: 1, paddingHorizontal: 20 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    appName: {
      fontSize: 24,
      fontFamily: SERIF,
      fontWeight: "400",
      color: c.ink,
    },
    appNameBold: { fontWeight: "700" },
    titleBlock: { marginTop: 28 },
    date: { fontSize: 15, fontWeight: "500", color: c.inkSoft },
    heading: {
      marginTop: 6,
      fontSize: 40,
      lineHeight: 46,
      fontFamily: SERIF,
      fontWeight: "700",
      color: c.ink,
    },
    quote: { marginTop: 10, fontSize: 16, lineHeight: 24, color: c.muted },
    // minimum gap keeps the artwork visible on short screens
    spacer: { flexGrow: 1, minHeight: 74 },
  });
