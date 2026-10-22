import AlertHost from "@/components/AlertHost";
import { LockGate } from "@/components/lock/LockGate";
import { useReminderSync } from "@/lib/reminders";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

function Shell() {
  const { colors, isDark } = useTheme();

  useReminderSync();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="security" />
      </Stack>

      <AlertHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LockGate>
        <Shell />
      </LockGate>
    </ThemeProvider>
  );
}
