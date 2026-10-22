export const MAX_MS = 7 * 60 * 1000;
export const MAX_TAGS = 3;
export const MAX_DESCRIPTION = 1000;
export const DEFAULT_TAG = "general";
export const DEFAULT_RATING = 5;

/** Every photo is cropped to this ratio (portrait 4:5). Cards, thumbnails and the picker all use it. */
export const PHOTO_ASPECT: [number, number] = [4, 5];
export const PHOTO_RATIO = PHOTO_ASPECT[0] / PHOTO_ASPECT[1];

/** The optional parts of a memory the user can edit. */
export type Details = {
  imageUri: string | null; // null → the app shows the default image
  description: string;
  tags: string[]; // 0–3 (an empty list is saved as the default tag)
  rating: number; // 1–10
};

export type Memory = Details & {
  id: number;
  date: string; // YYYY-MM-DD, unique: one memory per day
  audioUri: string; // absolute file:// uri, ready to play
  durationMs: number;
  bookmarked: boolean; // toggled from the player; not part of the editable Details
  createdAt: string;
  updatedAt: string;
};

export const EMPTY_DETAILS: Details = {
  imageUri: null,
  description: "",
  tags: [],
  rating: DEFAULT_RATING,
};

export const hasAnyDetail = (d: Details) =>
  !!(
    d.imageUri ||
    d.description ||
    d.tags.length ||
    d.rating !== DEFAULT_RATING
  );

/** "#Travel " → "travel" (letters, digits, underscore; max 20 chars). */
export const normalizeTag = (raw: string) =>
  raw
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);

export const todayKey = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

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

export const prettyDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export const formatTime = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 'YYYY-MM-DD' → Date at local midnight. */
export const parseDateKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const toDateKey = (y: number, monthIndex: number, day: number) =>
  `${y}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** "Sat, 4 Oct 2026" */
export const longDate = (key: string) => {
  const d = parseDateKey(key);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** Lightweight row used by the Insights tab (no description / paths). */
export type InsightRow = {
  date: string;
  rating: number;
  durationMs: number;
  createdAt: string; // UTC 'YYYY-MM-DD HH:MM:SS'
  tags: string[];
};
