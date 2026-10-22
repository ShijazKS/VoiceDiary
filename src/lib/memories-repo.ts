import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "./db";
import { removeDayFolder, removeFile, resolvePath, storeFile } from "./files";
import {
  DEFAULT_RATING,
  DEFAULT_TAG,
  MAX_MS,
  MAX_TAGS,
  normalizeTag,
  type Details,
  type InsightRow,
  type Memory,
} from "./memory";

/* ----------------------------- row mapping -------------------------------- */

type Row = {
  id: number;
  date: string;
  audio_path: string;
  duration_ms: number;
  image_path: string | null;
  description: string;
  rating: number;
  bookmarked: number; // 0 | 1
  created_at: string;
  updated_at: string;
  tag_list: string | null;
};

const SELECT_MEMORY = `
  SELECT m.*,
    (SELECT group_concat(name, ',') FROM (
       SELECT t.name FROM memory_tags mt
       JOIN tags t ON t.id = mt.tag_id
       WHERE mt.memory_id = m.id
       ORDER BY mt.rowid
    )) AS tag_list
  FROM memories m
`;

const toMemory = (r: Row): Memory => ({
  id: r.id,
  date: r.date,
  audioUri: resolvePath(r.audio_path),
  durationMs: r.duration_ms,
  imageUri: r.image_path ? resolvePath(r.image_path) : null,
  description: r.description,
  rating: r.rating,
  bookmarked: r.bookmarked === 1,
  tags: r.tag_list ? r.tag_list.split(",") : [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Normalise, de-duplicate, cap at 3, and fall back to the default tag. */
const cleanTags = (tags: string[]) => {
  const unique = [...new Set(tags.map(normalizeTag).filter(Boolean))].slice(
    0,
    MAX_TAGS,
  );
  return unique.length ? unique : [DEFAULT_TAG];
};

const cleanRating = (n: number | undefined) =>
  Math.min(10, Math.max(1, Math.round(n ?? DEFAULT_RATING)));

async function writeTags(db: SQLiteDatabase, memoryId: number, tags: string[]) {
  await db.runAsync("DELETE FROM memory_tags WHERE memory_id = ?", memoryId);
  for (const name of cleanTags(tags)) {
    await db.runAsync("INSERT OR IGNORE INTO tags (name) VALUES (?)", name);
    const tag = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM tags WHERE name = ?",
      name,
    );
    await db.runAsync(
      "INSERT OR IGNORE INTO memory_tags (memory_id, tag_id) VALUES (?, ?)",
      memoryId,
      tag!.id,
    );
  }
}

/* -------------------------------- reads ----------------------------------- */

export async function getMemoryByDate(date: string): Promise<Memory | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    `${SELECT_MEMORY} WHERE m.date = ?`,
    date,
  );
  return row ? toMemory(row) : null;
}

/** Newest first. For the Memories tab. */
export async function listMemories(limit = 50, offset = 0): Promise<Memory[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    `${SELECT_MEMORY} ORDER BY m.date DESC LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
  return rows.map(toMemory);
}

/* ------------------------------- writes ----------------------------------- */

type CreateInput = Partial<Details> & {
  date: string;
  audioUri: string; // temporary recording file
  durationMs: number;
};

/** Saves today's memory (files + database). One per day: re-saving replaces it. */
export async function createMemory(input: CreateInput): Promise<Memory> {
  const db = await getDb();
  const { date } = input;

  removeDayFolder(date); // replace any previous memory for this date

  const audioPath = storeFile(date, input.audioUri, "voice", "m4a");
  const imagePath = input.imageUri
    ? storeFile(date, input.imageUri, `image-${Date.now()}`, "jpg")
    : null;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO memories (date, audio_path, duration_ms, image_path, description, rating)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         audio_path = excluded.audio_path,
         duration_ms = excluded.duration_ms,
         image_path = excluded.image_path,
         description = excluded.description,
         rating = excluded.rating,
         updated_at = datetime('now')`,
      date,
      audioPath,
      Math.min(Math.max(Math.round(input.durationMs), 0), MAX_MS),
      imagePath,
      (input.description ?? "").trim(),
      cleanRating(input.rating),
    );
    const row = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM memories WHERE date = ?",
      date,
    );
    await writeTags(db, row!.id, input.tags ?? []);
  });

  return (await getMemoryByDate(date))!;
}

/** Edits photo / description / tags / rating. The recording is untouched. */
export async function updateMemory(
  date: string,
  details: Details,
): Promise<Memory> {
  const db = await getDb();
  const current = await db.getFirstAsync<{
    id: number;
    image_path: string | null;
  }>("SELECT id, image_path FROM memories WHERE date = ?", date);
  if (!current) throw new Error(`No memory for ${date}`);

  let imagePath = current.image_path;

  if (details.imageUri === null) {
    if (imagePath) removeFile(imagePath); // photo removed → back to default image
    imagePath = null;
  } else if (!imagePath || details.imageUri !== resolvePath(imagePath)) {
    // new photo picked: unique file name so the image cache never shows the old one
    const old = imagePath;
    imagePath = storeFile(date, details.imageUri, `image-${Date.now()}`, "jpg");
    if (old) removeFile(old);
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE memories
       SET image_path = ?, description = ?, rating = ?, updated_at = datetime('now')
       WHERE id = ?`,
      imagePath,
      details.description.trim(),
      cleanRating(details.rating),
      current.id,
    );
    await writeTags(db, current.id, details.tags);
  });

  return (await getMemoryByDate(date))!;
}

/** Bookmark / un-bookmark a memory. Leaves everything else (and updated_at) untouched. */
export async function setBookmarked(
  date: string,
  bookmarked: boolean,
): Promise<Memory> {
  const db = await getDb();
  const res = await db.runAsync(
    "UPDATE memories SET bookmarked = ? WHERE date = ?",
    bookmarked ? 1 : 0,
    date,
  );
  if (res.changes === 0) throw new Error(`No memory for ${date}`);
  return (await getMemoryByDate(date))!;
}

export async function deleteMemory(date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM memories WHERE date = ?", date); // memory_tags rows cascade
  removeDayFolder(date);
}

/* -------------------------------- stats ----------------------------------- */

export async function getStats() {
  const db = await getDb();
  const summary = await db.getFirstAsync<{ total: number; avg: number | null }>(
    "SELECT COUNT(*) AS total, AVG(rating) AS avg FROM memories",
  );
  const topTags = await db.getAllAsync<{ name: string; count: number }>(
    `SELECT t.name AS name, COUNT(*) AS count
     FROM memory_tags mt JOIN tags t ON t.id = mt.tag_id
     GROUP BY t.id ORDER BY count DESC, t.name LIMIT 5`,
  );
  return {
    total: summary?.total ?? 0,
    averageRating: summary?.avg ?? null,
    topTags,
  };
}

/** Rating per day, newest first (for a chart). */
export async function getRatingHistory(limit = 30) {
  const db = await getDb();
  return db.getAllAsync<{ date: string; rating: number }>(
    "SELECT date, rating FROM memories ORDER BY date DESC LIMIT ?",
    limit,
  );
}

/* ------------------------------ insights data ------------------------------ */

/** Small rows for a date range (inclusive, 'YYYY-MM-DD'). Cheap even for many years. */
export async function getInsightRows(
  from: string,
  to: string,
): Promise<InsightRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    date: string;
    rating: number;
    duration_ms: number;
    created_at: string;
    tag_list: string | null;
  }>(
    `SELECT m.date, m.rating, m.duration_ms, m.created_at,
       (SELECT group_concat(t.name, ',')
          FROM memory_tags mt JOIN tags t ON t.id = mt.tag_id
         WHERE mt.memory_id = m.id) AS tag_list
     FROM memories m
     WHERE m.date BETWEEN ? AND ?
     ORDER BY m.date`,
    from,
    to,
  );
  return rows.map((r) => ({
    date: r.date,
    rating: r.rating,
    durationMs: r.duration_ms,
    createdAt: r.created_at,
    tags: r.tag_list ? r.tag_list.split(",") : [],
  }));
}

/** Every recorded date, oldest first (for streaks and the earliest year). */
export async function getAllDates(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string }>(
    "SELECT date FROM memories ORDER BY date",
  );
  return rows.map((r) => r.date);
}
