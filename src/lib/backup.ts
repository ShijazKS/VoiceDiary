import Constants from "expo-constants";
import { Directory, File, Paths } from "expo-file-system";
import {
  Unzip,
  UnzipInflate,
  UnzipPassThrough,
  Zip,
  ZipPassThrough,
  strFromU8,
  strToU8,
} from "fflate";

import { getDb } from "./db";
import {
  DEFAULT_RATING,
  DEFAULT_TAG,
  MAX_DESCRIPTION,
  MAX_MS,
  MAX_TAGS,
  normalizeTag,
} from "./memory";
import {
  getPermissionStatus,
  getReminderSettings,
  refreshReminders,
  setReminderSettings,
  type ReminderSettings,
} from "./reminders";
import {
  getDefaultRating,
  getDefaultTag,
  getMemoryDay,
  setDefaultRating,
  setDefaultTag,
  setMemoryDay,
} from "./settings";

/**
 * BACKUP FILE = a normal .zip:
 *   manifest.json     { app, format, createdAt, appVersion, memories }
 *   memories.json     [{ date, audioPath, durationMs, imagePath, description, rating, tags, createdAt, updatedAt }]
 *   settings.json     recording + reminder preferences (NOT the app lock, NOT the theme)
 *   memories/<date>/voice.m4a, memories/<date>/image-….jpg   (same relative paths as the database)
 *
 * Why JSON instead of the raw .db file: it survives schema changes, can be merged into an
 * existing diary, and never carries a half-written database.
 * Files are streamed in 512 KB chunks, so a multi-hundred-MB diary never sits in memory.
 */

const FORMAT = 1;
const CHUNK = 512 * 1024;
const BACKUP_PREFIX = "voicediary-backup-";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
/** Only these entry names are ever extracted (blocks "../" tricks in a hand-made zip). */
const MEDIA_RE = /^memories\/(\d{4}-\d{2}-\d{2})\/([A-Za-z0-9._-]+)$/;
const JSON_NAMES = new Set(["manifest.json", "memories.json", "settings.json"]);

export type BackupMemory = {
  date: string;
  audioPath: string;
  durationMs: number;
  imagePath: string | null;
  description: string;
  rating: number;
  tags: string[];
  createdAt: string | null; // UTC 'YYYY-MM-DD HH:MM:SS' (Insights uses it for time of day)
  updatedAt: string | null;
};

/** Export: files written. Import: bytes of the zip read. */
/** Inclusive 'YYYY-MM-DD' bounds. */
export type DateRange = { from: string; to: string };

export type Progress = { done: number; total: number };

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

function enoughSpace(bytesNeeded: number) {
  const free = Paths.availableDiskSpace;
  if (typeof free === "number" && free < bytesNeeded * 1.15 + 10_000_000) {
    throw new Error("Not enough free storage on this device for that.");
  }
}

/* -------------------------------------------------------------------------- */
/*                                   EXPORT                                   */
/* -------------------------------------------------------------------------- */

type ExportRow = {
  date: string;
  audio_path: string;
  duration_ms: number;
  image_path: string | null;
  description: string;
  rating: number;
  created_at: string;
  updated_at: string;
  tag_list: string | null;
};

const EXPORT_SQL = `
  SELECT m.date, m.audio_path, m.duration_ms, m.image_path, m.description, m.rating, m.created_at, m.updated_at,
    (SELECT group_concat(name, ',') FROM (
       SELECT t.name FROM memory_tags mt JOIN tags t ON t.id = mt.tag_id
       WHERE mt.memory_id = m.id ORDER BY mt.rowid)) AS tag_list
  FROM memories m WHERE m.date BETWEEN ? AND ? ORDER BY m.date`;

const pad2 = (n: number) => String(n).padStart(2, "0");
const dayStamp = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** "2026-09" for a whole month, otherwise "2026-09-05_to_2026-09-20". */
function rangeSlug({ from, to }: DateRange) {
  const lastDay = new Date(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)),
    0,
  ).getDate();
  const wholeMonth =
    from.slice(0, 7) === to.slice(0, 7) &&
    from.endsWith("-01") &&
    Number(to.slice(8, 10)) === lastDay;
  return wholeMonth ? from.slice(0, 7) : `${from}_to_${to}`;
}

/** Removes backups left in the cache by earlier exports. */
function cleanOldExports() {
  try {
    for (const item of Paths.cache.list()) {
      if (item instanceof File && item.name.startsWith(BACKUP_PREFIX))
        item.delete();
    }
  } catch {}
}

/** Builds the zip in the cache folder. Returns null when there is nothing to export. */
export async function exportBackup(
  onProgress?: (p: Progress) => void,
  range?: DateRange | null,
) {
  const db = await getDb();
  const rows = await db.getAllAsync<ExportRow>(
    EXPORT_SQL,
    range?.from ?? "0000-01-01",
    range?.to ?? "9999-12-31",
  );

  const records: BackupMemory[] = [];
  const media: { rel: string; file: File }[] = [];
  let skipped = 0;
  let bytes = 0;

  for (const r of rows) {
    const audio = new File(Paths.document, r.audio_path);
    if (!MEDIA_RE.test(r.audio_path) || !audio.exists) {
      skipped++; // a memory without its recording can't be restored, so it's left out
      continue;
    }
    const image = r.image_path ? new File(Paths.document, r.image_path) : null;
    const hasImage = !!image && image.exists && MEDIA_RE.test(r.image_path!);

    records.push({
      date: r.date,
      audioPath: r.audio_path,
      durationMs: r.duration_ms,
      imagePath: hasImage ? r.image_path : null,
      description: r.description,
      rating: r.rating,
      tags: r.tag_list ? r.tag_list.split(",") : [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
    media.push({ rel: r.audio_path, file: audio });
    bytes += audio.size ?? 0;
    if (hasImage) {
      media.push({ rel: r.image_path!, file: image! });
      bytes += image!.size ?? 0;
    }
  }
  if (!records.length) return null;

  enoughSpace(bytes);
  cleanOldExports();

  const stamp = new Date();
  const name = `${BACKUP_PREFIX}${range ? rangeSlug(range) : dayStamp(stamp)}.zip`;
  const out = new File(Paths.cache, name);
  if (out.exists) out.delete();
  out.create();
  const handle = out.open();

  const zip = new Zip((err, chunk) => {
    if (err) throw err;
    handle.writeBytes(chunk);
  });
  const addBytes = (path: string, data: Uint8Array) => {
    const entry = new ZipPassThrough(path); // audio/images are already compressed: store as-is
    zip.add(entry);
    entry.push(data, true);
  };

  try {
    addBytes(
      "manifest.json",
      strToU8(
        JSON.stringify({
          app: "voicediary",
          format: FORMAT,
          createdAt: stamp.toISOString(),
          appVersion: Constants.expoConfig?.version ?? null,
          memories: records.length,
          range: range ?? null, // null = the whole diary
        }),
      ),
    );
    addBytes("memories.json", strToU8(JSON.stringify(records)));
    if (!range) {
      // settings only travel with a full backup
      addBytes(
        "settings.json",
        strToU8(
          JSON.stringify({
            memoryDay: getMemoryDay(),
            defaultRating: getDefaultRating(),
            defaultTag: getDefaultTag(),
            reminders: getReminderSettings(),
          }),
        ),
      );
    }

    for (let i = 0; i < media.length; i++) {
      const { rel, file } = media[i];
      const entry = new ZipPassThrough(rel);
      zip.add(entry);
      const src = file.open();
      try {
        const size = file.size ?? 0;
        let offset = 0;
        if (size === 0) entry.push(new Uint8Array(0), true);
        while (offset < size) {
          const chunk = src.readBytes(Math.min(CHUNK, size - offset));
          if (!chunk.length) break;
          offset += chunk.length;
          entry.push(chunk, offset >= size);
        }
      } finally {
        src.close();
      }
      onProgress?.({ done: i + 1, total: media.length });
      await yieldToUi(); // keeps the progress screen alive
    }
    zip.end();
  } catch (e) {
    zip.terminate();
    handle.close();
    try {
      out.delete();
    } catch {}
    throw e;
  }
  handle.close();

  return {
    file: out,
    memories: records.length,
    skipped,
    bytes: out.size ?? bytes,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   IMPORT                                   */
/* -------------------------------------------------------------------------- */

export type StagedBackup = {
  dir: Directory; // extracted files wait here until you choose Merge / Replace
  records: BackupMemory[];
  invalid: number;
  createdAt: string | null;
  settings: unknown;
  range: DateRange | null; // null = a full backup
};

const stagingDir = () => new Directory(Paths.cache, "import-staging");

export function discardStaged() {
  try {
    const d = stagingDir();
    if (d.exists) d.delete();
  } catch {}
}

type Handle = ReturnType<File["open"]>;

/** Reads the zip, extracts it to a staging folder and validates it. Nothing in your diary changes yet. */
export async function inspectBackup(
  uri: string,
  onProgress?: (p: Progress) => void,
): Promise<StagedBackup> {
  discardStaged();
  const zipFile = new File(uri);
  const zipSize = zipFile.size ?? 0;
  if (!zipFile.exists || zipSize === 0) throw new Error("That file is empty.");
  enoughSpace(zipSize * 1.05);

  const staging = stagingDir();
  staging.create({ intermediates: true, idempotent: true });

  const json = new Map<string, Uint8Array>();
  const open = new Set<Handle>();
  let failure: Error | null = null;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);

  unzip.onfile = (entry) => {
    const { name } = entry;
    if (JSON_NAMES.has(name)) {
      const parts: Uint8Array[] = [];
      let total = 0;
      entry.ondata = (err, chunk, final) => {
        if (err) return void (failure = err);
        total += chunk.length;
        if (total > 50_000_000)
          return void (failure = new Error("This backup looks damaged."));
        parts.push(chunk);
        if (final) json.set(name, concat(parts));
      };
      entry.start();
      return;
    }
    const m = MEDIA_RE.exec(name);
    if (!m) return; // not started = skipped (folders, unknown files, anything unsafe)

    const dayDir = new Directory(staging, "memories", m[1]);
    dayDir.create({ intermediates: true, idempotent: true });
    const dest = new File(dayDir, m[2]);
    if (dest.exists) dest.delete();
    dest.create();
    const handle = dest.open();
    open.add(handle);
    entry.ondata = (err, chunk, final) => {
      if (err) {
        failure = err;
        return;
      }
      if (chunk.length) handle.writeBytes(chunk);
      if (final) {
        handle.close();
        open.delete(handle);
      }
    };
    entry.start();
  };

  const src = zipFile.open();
  try {
    let offset = 0;
    while (offset < zipSize) {
      const chunk = src.readBytes(Math.min(CHUNK, zipSize - offset));
      if (!chunk.length) break;
      offset += chunk.length;
      unzip.push(chunk, offset >= zipSize);
      onProgress?.({ done: offset, total: zipSize }); // bytes of the zip read so far
      if (failure) throw failure;
      await yieldToUi();
    }
  } catch (e) {
    discardStaged();
    throw new Error(
      e instanceof Error && e.message
        ? e.message
        : "That file isn’t a valid backup.",
    );
  } finally {
    src.close();
    open.forEach((h) => {
      try {
        h.close();
      } catch {}
    });
  }

  try {
    const read = (name: string) => {
      const bytes = json.get(name);
      return bytes ? JSON.parse(strFromU8(bytes)) : null;
    };
    const manifest = read("manifest.json");
    if (!manifest || manifest.app !== "voicediary")
      throw new Error("This isn’t a VoiceDiary backup.");
    if (typeof manifest.format !== "number" || manifest.format > FORMAT) {
      throw new Error(
        "This backup was made by a newer version of VoiceDiary. Update the app first.",
      );
    }
    const { records, invalid } = parseRecords(read("memories.json"), staging);
    if (!records.length)
      throw new Error("There are no memories in this backup.");
    const r = manifest.range;
    const range =
      r &&
      typeof r.from === "string" &&
      typeof r.to === "string" &&
      DATE_RE.test(r.from) &&
      DATE_RE.test(r.to)
        ? { from: r.from as string, to: r.to as string }
        : null;
    return {
      dir: staging,
      range,
      records,
      invalid,
      createdAt:
        typeof manifest.createdAt === "string" ? manifest.createdAt : null,
      settings: read("settings.json"),
    };
  } catch (e) {
    discardStaged();
    throw e instanceof SyntaxError
      ? new Error("This backup looks damaged.")
      : e;
  }
}

function sanitizeRecord(x: any, staging: Directory): BackupMemory {
  const fail = (): never => {
    throw new Error("invalid");
  };
  const date = x?.date;
  if (typeof date !== "string" || !DATE_RE.test(date)) fail();

  const pathFor = (p: unknown) => {
    const m = typeof p === "string" ? MEDIA_RE.exec(p) : null;
    return m && m[1] === date && new File(staging, p as string).exists
      ? (p as string)
      : null;
  };
  const audioPath = pathFor(x.audioPath);
  if (!audioPath) fail(); // a memory needs its recording

  const tags: string[] = Array.isArray(x.tags)
    ? [
        ...new Set<string>(
          x.tags
            .filter((t: unknown) => typeof t === "string")
            .map(normalizeTag)
            .filter(Boolean),
        ),
      ].slice(0, MAX_TAGS)
    : [];

  return {
    date,
    audioPath: audioPath!,
    durationMs: clamp(Math.round(Number(x.durationMs) || 0), 0, MAX_MS),
    imagePath: pathFor(x.imagePath),
    description:
      typeof x.description === "string"
        ? x.description.slice(0, MAX_DESCRIPTION)
        : "",
    rating: clamp(Math.round(Number(x.rating) || DEFAULT_RATING), 1, 10),
    tags: tags.length ? tags : [DEFAULT_TAG],
    createdAt:
      typeof x.createdAt === "string" && TIMESTAMP_RE.test(x.createdAt)
        ? x.createdAt
        : null,
    updatedAt:
      typeof x.updatedAt === "string" && TIMESTAMP_RE.test(x.updatedAt)
        ? x.updatedAt
        : null,
  };
}

function parseRecords(raw: unknown, staging: Directory) {
  if (!Array.isArray(raw)) throw new Error("This backup has no memories list.");
  const seen = new Set<string>();
  const records: BackupMemory[] = [];
  let invalid = 0;
  for (const item of raw) {
    try {
      const rec = sanitizeRecord(item, staging);
      if (seen.has(rec.date)) throw new Error("duplicate");
      seen.add(rec.date);
      records.push(rec);
    } catch {
      invalid++;
    }
  }
  return {
    records: records.sort((a, b) => a.date.localeCompare(b.date)),
    invalid,
  };
}

export type ImportMode = "merge" | "replace";
export type ImportResult = {
  imported: number;
  skipped: number;
  settingsRestored: boolean;
};

/**
 * merge   → adds memories for days you don't have yet; a day that already has a memory keeps yours.
 * replace → your current diary is swapped for the backup (and its settings are restored).
 */
export async function applyBackup(
  staged: StagedBackup,
  mode: ImportMode,
): Promise<ImportResult> {
  if (mode === "replace" && staged.range)
    throw new Error(
      "A partial backup can only be merged, not used to replace everything.",
    );
  const db = await getDb();
  const existing = new Set(
    (await db.getAllAsync<{ date: string }>("SELECT date FROM memories")).map(
      (r) => r.date,
    ),
  );
  const toImport =
    mode === "replace"
      ? staged.records
      : staged.records.filter((r) => !existing.has(r.date));

  const moveFiles = () => {
    for (const rec of toImport) {
      const dayDir = new Directory(Paths.document, "memories", rec.date);
      if (dayDir.exists) dayDir.delete(); // never leave stale files from an older memory behind
      dayDir.create({ intermediates: true, idempotent: true });
      for (const rel of [rec.audioPath, rec.imagePath]) {
        if (!rel) continue;
        const dest = new File(Paths.document, rel);
        if (dest.exists) dest.delete();
        new File(staged.dir, rel).move(dest);
      }
    }
  };

  // Database first, inside one transaction: if anything is wrong, nothing is changed.
  await db.withTransactionAsync(async () => {
    if (mode === "replace") await db.runAsync("DELETE FROM memories"); // memory_tags cascade
    for (const rec of toImport) {
      await db.runAsync(
        `INSERT INTO memories (date, audio_path, duration_ms, image_path, description, rating, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))`,
        rec.date,
        rec.audioPath,
        rec.durationMs,
        rec.imagePath,
        rec.description,
        rec.rating,
        rec.createdAt,
        rec.updatedAt,
      );
      const row = await db.getFirstAsync<{ id: number }>(
        "SELECT id FROM memories WHERE date = ?",
        rec.date,
      );
      for (const tag of rec.tags) {
        await db.runAsync("INSERT OR IGNORE INTO tags (name) VALUES (?)", tag);
        const t = await db.getFirstAsync<{ id: number }>(
          "SELECT id FROM tags WHERE name = ?",
          tag,
        );
        await db.runAsync(
          "INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) VALUES (?, ?)",
          row!.id,
          t!.id,
        );
      }
    }
    moveFiles();
  });

  if (mode === "replace")
    removeFoldersNotIn(new Set(toImport.map((r) => r.date)));

  const settingsRestored =
    mode === "replace" ? await restoreSettings(staged.settings) : false;
  discardStaged();
  void refreshReminders(); // "skip if already recorded" depends on which days have memories
  return {
    imported: toImport.length,
    skipped: staged.records.length - toImport.length,
    settingsRestored,
  };
}

function removeFoldersNotIn(keep: Set<string>) {
  try {
    const root = new Directory(Paths.document, "memories");
    if (!root.exists) return;
    for (const item of root.list()) {
      if (item instanceof Directory && !keep.has(item.name)) item.delete();
    }
  } catch {}
}

async function restoreSettings(raw: any) {
  if (!raw || typeof raw !== "object") return false;
  if (raw.memoryDay === "today" || raw.memoryDay === "previous")
    setMemoryDay(raw.memoryDay);
  if (Number.isInteger(raw.defaultRating)) setDefaultRating(raw.defaultRating);
  if (typeof raw.defaultTag === "string") setDefaultTag(raw.defaultTag);

  const r = raw.reminders;
  if (r && typeof r === "object") {
    const patch: Partial<ReminderSettings> = {};
    if (Number.isInteger(r.hour) && r.hour >= 0 && r.hour <= 23)
      patch.hour = r.hour;
    if (Number.isInteger(r.minute) && r.minute >= 0 && r.minute <= 59)
      patch.minute = r.minute;
    if (Array.isArray(r.days))
      patch.days = r.days.filter(
        (d: unknown) =>
          Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6,
      );
    // Notification permission belongs to this device, so reminders only come back on if it's already granted.
    patch.enabled =
      r.enabled === true && (await getPermissionStatus()) === "granted";
    setReminderSettings(patch);
  }
  return true;
}
