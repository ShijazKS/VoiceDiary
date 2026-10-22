import * as SQLite from "expo-sqlite";

const DB_NAME = "voicediary.db";

/**
 * Migrations run in order, once each. The index + 1 is stored in
 * PRAGMA user_version. To change the schema later, APPEND a new entry
 * (never edit an old one).
 */
const MIGRATIONS: string[] = [
  /* v1 — initial schema */
  `
  CREATE TABLE memories (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT    NOT NULL UNIQUE,                       -- 'YYYY-MM-DD' → one memory per day
    audio_path   TEXT    NOT NULL,                              -- relative to the documents folder
    duration_ms  INTEGER NOT NULL CHECK (duration_ms BETWEEN 0 AND 420000),
    image_path   TEXT,                                          -- NULL → default image
    description  TEXT    NOT NULL DEFAULT '',
    rating       INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 10),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE memory_tags (
    memory_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    tag_id    INTEGER NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
    PRIMARY KEY (memory_id, tag_id)
  );

  CREATE INDEX idx_memory_tags_tag ON memory_tags(tag_id);
  CREATE INDEX idx_memories_rating ON memories(rating);

  -- Safety net: a memory can never have more than 3 tags.
  CREATE TRIGGER memory_tags_max_3
  BEFORE INSERT ON memory_tags
  WHEN (SELECT COUNT(*) FROM memory_tags WHERE memory_id = NEW.memory_id) >= 3
  BEGIN
    SELECT RAISE(ABORT, 'A memory can have at most 3 tags');
  END;

  INSERT INTO tags (name) VALUES ('general');                   -- default tag
  `,

  /* v2 — bookmarks (0 = not bookmarked, 1 = bookmarked) */
  `
  ALTER TABLE memories ADD COLUMN bookmarked INTEGER NOT NULL DEFAULT 0 CHECK (bookmarked IN (0, 1));
  CREATE INDEX idx_memories_bookmarked ON memories(bookmarked) WHERE bookmarked = 1;
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Opens the database once and runs pending migrations. Safe to call anywhere. */
export function getDb() {
  if (!dbPromise) {
    dbPromise = init().catch((e) => {
      dbPromise = null; // allow a retry
      throw e;
    });
  }
  return dbPromise;
}

async function init() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const current = row?.user_version ?? 0;

  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return db;
}
