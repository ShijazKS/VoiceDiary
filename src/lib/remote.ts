import Constants from "expo-constants";
import Storage from "expo-sqlite/kv-store";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { setRemoteReminderMessages, type ReminderMessage } from "./reminders";

/**
 * Online content, served from a public GitHub repo as two small JSON files:
 *   latest.json   → is a newer version available, and where to download it
 *   content.json  → reminder messages (one is picked at random for each reminder)
 *
 * By default NOTHING runs in the background: the files are only downloaded when the user taps
 * "Check for updates" in Settings → About. (Set AUTO_REFRESH_HOURS below if you ever want more.)
 *
 * Safe by default: until you put your real GitHub username below, the app makes no network calls,
 * the update row is hidden in release builds, and reminders use the built-in messages. If the repo
 * is missing, offline, or the JSON is broken, everything falls back quietly. It never crashes.
 *
 * Privacy: plain anonymous GET requests for public files. Nothing about the user is sent.
 * Safety: the files are treated as DATA: validated, length-limited, and the download link must start
 * with DOWNLOAD_PREFIX, so a bad edit in the repo can't send people to another site.
 */

/* ───── EDIT THIS when the repo exists ───── */
const OWNER: string = "shijaz-ks";
const CONFIG_REPO = "voicediary-config"; // the public repo that holds the two JSON files
/* ────────────────────────────────────────── */

const BASE_URL = `https://raw.githubusercontent.com/${OWNER}/${CONFIG_REPO}/main`;
const DOWNLOAD_PREFIX = `https://github.com/${OWNER}/`;

/** false until OWNER is set. Nothing is fetched while false. */
export const onlineConfigured =
  OWNER.trim() !== "" && OWNER !== "YOUR_GITHUB_USERNAME";
/** Show the "Check for updates" row? Always in development (so you can see it), only when configured in release. */
export const updatesVisible = onlineConfigured || __DEV__;

/** 0 = manual only (recommended). Otherwise refresh quietly at launch / app resume at most this often. */
const AUTO_REFRESH_HOURS = 0;

const TIMEOUT_MS = 8000;
const VERSION_RE = /^\d+(\.\d+){0,3}$/;
const STATE_KEY = "remote-update-state";
const SYNC_KEY = "remote-last-sync";

/* --------------------------------- versions --------------------------------- */

export const currentVersion = () => Constants.expoConfig?.version ?? "0.0.0";

/** -1 / 0 / 1 like a normal compare: "1.10.0" > "1.9.0". */
export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/* ------------------------------ update info ------------------------------ */

export type UpdateInfo = {
  latestVersion: string;
  minSupportedVersion: string | null;
  downloadUrl: string;
  notes: string[];
  publishedAt: string | null;
};
type UpdateState = { info: UpdateInfo | null; checkedAt: number | null };

const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

function parseUpdate(raw: any): UpdateInfo | null {
  const a = raw?.android;
  if (
    !a ||
    typeof a.latestVersion !== "string" ||
    !VERSION_RE.test(a.latestVersion)
  )
    return null;
  if (
    typeof a.downloadUrl !== "string" ||
    !a.downloadUrl.startsWith(DOWNLOAD_PREFIX)
  )
    return null;
  return {
    latestVersion: a.latestVersion,
    minSupportedVersion:
      typeof a.minSupportedVersion === "string" &&
      VERSION_RE.test(a.minSupportedVersion)
        ? a.minSupportedVersion
        : null,
    downloadUrl: a.downloadUrl,
    notes: Array.isArray(a.releaseNotes)
      ? a.releaseNotes
          .map((n: unknown) => text(n, 120))
          .filter(Boolean)
          .slice(0, 8)
      : [],
    publishedAt: text(a.publishedAt, 20) || null,
  };
}

function loadState(): UpdateState {
  try {
    const raw = Storage.getItemSync(STATE_KEY);
    return raw ? JSON.parse(raw) : { info: null, checkedAt: null };
  } catch {
    return { info: null, checkedAt: null };
  }
}
let state = loadState();
const stateListeners = new Set<() => void>();
function setState(next: UpdateState) {
  state = next;
  Storage.setItemSync(STATE_KEY, JSON.stringify(next));
  stateListeners.forEach((l) => l());
}

export const getUpdateState = () => state;

/** Latest known update info + whether it applies to the installed version. */
export function describeUpdate(s: UpdateState = state) {
  const current = currentVersion();
  return {
    ...s,
    current,
    available: !!s.info && compareVersions(s.info.latestVersion, current) > 0,
    required:
      !!s.info?.minSupportedVersion &&
      compareVersions(current, s.info.minSupportedVersion) < 0,
  };
}

export function useUpdateState() {
  const s = useSyncExternalStore((cb) => {
    stateListeners.add(cb);
    return () => stateListeners.delete(cb);
  }, getUpdateState);
  return describeUpdate(s);
}

/* ------------------------------ reminder messages ------------------------------ */

/** A valid list of messages, or null (→ the built-in messages stay in use). */
function parseMessages(raw: any): ReminderMessage[] | null {
  if (!Array.isArray(raw?.reminders)) return null;
  const list = raw.reminders
    .map((m: any) => ({ title: text(m?.title, 60), body: text(m?.body, 140) }))
    .filter((m: ReminderMessage) => m.title && m.body)
    .slice(0, 30);
  return list.length ? list : null;
}

/* ---------------------------------- fetching ---------------------------------- */

async function fetchJson(file: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/${file}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`); // 404 = repo / file doesn't exist (yet)
    return await res.json(); // throws if the body isn't JSON
  } finally {
    clearTimeout(timer);
  }
}

export type CheckResult = "ok" | "failed" | "not-configured";

let inFlight: Promise<CheckResult> | null = null;

/**
 * Downloads latest.json and content.json.
 *  'ok'             latest.json was read and understood (content.json is updated too when it works)
 *  'failed'         offline, repo/file missing, or latest.json isn't valid. Nothing is changed.
 *  'not-configured' OWNER hasn't been set. No network call was made.
 * Each file is independent, and a failure keeps whatever was saved before.
 */
export function checkForUpdates(): Promise<CheckResult> {
  if (!onlineConfigured) return Promise.resolve("not-configured");
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<CheckResult> => {
    const [update, content] = await Promise.allSettled([
      fetchJson("latest.json"),
      fetchJson("content.json"),
    ]);

    if (content.status === "fulfilled") {
      const messages = parseMessages(content.value);
      if (messages) setRemoteReminderMessages(messages);
    }

    if (update.status !== "fulfilled") return "failed";
    const info = parseUpdate(update.value);
    if (!info) return "failed"; // reachable but not a valid file: don't claim "up to date"
    setState({ info, checkedAt: Date.now() });
    Storage.setItemSync(SYNC_KEY, String(Date.now()));
    return "ok";
  })()
    .catch((): CheckResult => "failed")
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Optional background refresh. Does NOTHING unless AUTO_REFRESH_HOURS > 0 (and the repo is configured),
 * so adding it to the root layout is harmless; you can also just leave it out.
 */
export function useRemoteSync() {
  useEffect(() => {
    if (!onlineConfigured || AUTO_REFRESH_HOURS <= 0) return;
    const run = () => {
      const last = Number(Storage.getItemSync(SYNC_KEY) ?? 0);
      if (Date.now() - last >= AUTO_REFRESH_HOURS * 3600_000)
        void checkForUpdates();
    };
    run();
    const sub = AppState.addEventListener(
      "change",
      (st) => st === "active" && run(),
    );
    return () => sub.remove();
  }, []);
}
