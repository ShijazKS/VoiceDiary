import Constants, { ExecutionEnvironment } from "expo-constants";
import { router } from "expo-router";
import Storage from "expo-sqlite/kv-store";
import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";

import { getDb } from "./db";
import { parseDateKey, toDateKey } from "./memory";
import { recordingDayKey } from "./settings";

/* -------------------------------------------------------------------------- */
/*                                 SETTINGS                                   */
/* -------------------------------------------------------------------------- */

export type ReminderSettings = {
  enabled: boolean;
  hour: number; // 0–23
  minute: number; // 0–59
  days: number[]; // 0 = Sunday … 6 = Saturday
};

const DEFAULTS: ReminderSettings = {
  enabled: false,
  hour: 20,
  minute: 0,
  days: [0, 1, 2, 3, 4, 5, 6],
};

const KEY = "reminder-settings";

function load(): ReminderSettings {
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return DEFAULTS;
    // older versions also saved skipIfRecorded / varyMessages; those are fixed now, so drop them
    const { skipIfRecorded: _a, varyMessages: _b, ...saved } = JSON.parse(raw);
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

let cache = load();
const listeners = new Set<() => void>();

export const getReminderSettings = () => cache;

/** Saves the change and re-schedules the notifications to match. */
export function setReminderSettings(patch: Partial<ReminderSettings>) {
  cache = { ...cache, ...patch };
  Storage.setItemSync(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
  void refreshReminders();
}

export function useReminderSettings() {
  const settings = useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, getReminderSettings);
  return [settings, setReminderSettings] as const;
}

/* -------------------------------------------------------------------------- */
/*                                 FORMATTING                                 */
/* -------------------------------------------------------------------------- */

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Display order for the day chips: Monday first. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LETTERS: Record<number, string> = {
  0: "S",
  1: "M",
  2: "T",
  3: "W",
  4: "T",
  5: "F",
  6: "S",
};

export function formatClock(hour: number, minute: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function describeDays(days: number[]) {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d)))
    return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return [...set]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => DAY_NAMES[d])
    .join(", ");
}

/* -------------------------------------------------------------------------- */
/*                               NOTIFICATIONS                                */
/* -------------------------------------------------------------------------- */

type NotificationsModule = typeof import("expo-notifications");

/**
 * Since SDK 53, merely *importing* expo-notifications throws inside Expo Go on Android.
 * So it is loaded lazily, and never in Expo Go. Everything below degrades to a no-op there.
 */
const inExpoGoAndroid =
  Platform.OS === "android" &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** false in Expo Go on Android: use a development build to get reminders. */
export const remindersSupported = !inExpoGoAndroid;

let cachedModule: NotificationsModule | null | undefined;
function getNotifications(): NotificationsModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (inExpoGoAndroid) return (cachedModule = null);
  try {
    cachedModule = require("expo-notifications") as NotificationsModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

const CHANNEL = "daily-reminder";
const WINDOW_DAYS = 30; // how far ahead reminders are scheduled (iOS allows 64 pending)

// Developer decisions (not user settings):
const SKIP_IF_RECORDED = true; // no reminder on a day whose memory is already saved
const VARY_MESSAGES = true; // rotate between the gentle prompts below

const MESSAGES = [
  {
    title: "How was your day?",
    body: "Take a minute to capture it in your own voice.",
  },
  {
    title: "Your diary is listening",
    body: "A few words now will mean a lot later.",
  },
  {
    title: "Capture today before it fades",
    body: "Tap to record your memory.",
  },
  { title: "Time to reflect", body: "What stood out today?" },
  { title: "A voice for today", body: "Record a quick note about your day." },
];

async function ensureChannel(N: NotificationsModule) {
  if (Platform.OS !== "android") return;
  await N.setNotificationChannelAsync(CHANNEL, {
    name: "Daily reminder",
    importance: N.AndroidImportance.DEFAULT,
  });
}

export async function getPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined"
> {
  const N = getNotifications();
  if (!N) return "denied";
  const p = await N.getPermissionsAsync();
  if (p.granted) return "granted";
  return p.canAskAgain ? "undetermined" : "denied";
}

/** Asks the OS for permission (only prompts if it hasn't been refused for good). */
export async function requestPermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await N.requestPermissionsAsync();
  return res.granted;
}

const shiftKey = (key: string, days: number) => {
  const d = parseDateKey(key);
  const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return toDateKey(n.getFullYear(), n.getMonth(), n.getDate());
};

/**
 * Reminders are scheduled as one-off notifications for the next 30 days (rather than one
 * repeating trigger). That lets us skip a day that is already recorded. They are rebuilt
 * whenever settings change, a memory is saved/deleted, and the app comes to the foreground.
 */
async function rebuild() {
  const N = getNotifications();
  if (!N) return;

  // Only reminders are scheduled by this app, so clearing everything is safe.
  await N.cancelAllScheduledNotificationsAsync();

  const s = cache;
  if (!s.enabled || s.days.length === 0) return;
  if (!(await N.getPermissionsAsync()).granted) return;
  await ensureChannel(N);

  const db = await getDb();
  const now = new Date();
  const todayMemoryKey = recordingDayKey(); // the day a recording made right now would belong to

  for (let k = 0; k < WINDOW_DAYS; k++) {
    const when = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + k,
      s.hour,
      s.minute,
      0,
      0,
    );
    if (when.getTime() <= now.getTime() + 5000) continue; // already passed
    if (!s.days.includes(when.getDay())) continue;

    if (SKIP_IF_RECORDED) {
      const row = await db.getFirstAsync(
        "SELECT 1 AS x FROM memories WHERE date = ?",
        shiftKey(todayMemoryKey, k),
      );
      if (row) continue;
    }

    const msg = VARY_MESSAGES
      ? MESSAGES[Math.floor(when.getTime() / 86400000) % MESSAGES.length]
      : MESSAGES[0];
    await N.scheduleNotificationAsync({
      content: { title: msg.title, body: msg.body },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: CHANNEL,
      },
    });
  }
}

// run rebuilds one at a time so quick toggles can't create duplicates
let chain: Promise<void> = Promise.resolve();
export function refreshReminders() {
  chain = chain.then(rebuild).catch(() => {});
  return chain;
}

/** Mount once in the root layout: shows reminders in the foreground, keeps the schedule fresh, opens Today on tap. */
export function useReminderSync() {
  useEffect(() => {
    const N = getNotifications();
    if (!N) return; // Expo Go on Android: nothing to do

    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    void refreshReminders();
    const appState = AppState.addEventListener("change", (st) => {
      if (st === "active") void refreshReminders();
    });
    const tap = N.addNotificationResponseReceivedListener(() =>
      router.navigate("/"),
    );

    return () => {
      appState.remove();
      tap.remove();
    };
  }, []);
}
