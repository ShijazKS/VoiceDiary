import Storage from 'expo-sqlite/kv-store';
import { useState } from 'react';

import {
  DEFAULT_TAG,
  EMPTY_DETAILS,
  normalizeTag,
  toDateKey,
  todayKey,
  type Details,
} from '@/lib/memory';

/**
 * Small typed wrapper over the key-value store for user settings.
 * To add a setting: add a key + default here, then read it with a getter or a hook.
 *
 * NOTE: settings live in the kv-store, NOT in voicediary.db. A memory in the database
 * only stores its final date ('YYYY-MM-DD'), so it never needs to "remember" whether it
 * was recorded in Today or Previous-day mode.
 */

/* ------------------------------ memory date ------------------------------ */

export type MemoryDay = 'today' | 'previous';
const MEMORY_DAY_KEY = 'memory-day';

export const getMemoryDay = (): MemoryDay =>
  Storage.getItemSync(MEMORY_DAY_KEY) === 'previous' ? 'previous' : 'today';

export const setMemoryDay = (v: MemoryDay) => Storage.setItemSync(MEMORY_DAY_KEY, v);

export function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The date a NEW recording is saved to ('YYYY-MM-DD'), based on the setting. */
export const recordingDayKey = (): string =>
  getMemoryDay() === 'today' ? todayKey() : yesterdayKey();

export function useMemoryDay() {
  const [value, setValue] = useState<MemoryDay>(getMemoryDay);
  const update = (next: MemoryDay) => {
    setMemoryDay(next);
    setValue(next);
  };
  return [value, update] as const;
}

/** "Today’s" / "Yesterday’s" for a memory's date, so titles always match the data. */
export function dayPossessive(dateKey: string): string {
  if (dateKey === todayKey()) return 'Today’s';
  if (dateKey === yesterdayKey()) return 'Yesterday’s';
  return 'This day’s';
}

/* ----------------------------- default rating ---------------------------- */

export const MIN_RATING = 1;
export const MAX_RATING = 10;
const RATING_KEY = 'default-rating';

export function getDefaultRating(): number {
  const n = Number(Storage.getItemSync(RATING_KEY));
  return Number.isInteger(n) && n >= MIN_RATING && n <= MAX_RATING ? n : EMPTY_DETAILS.rating;
}

/** Saves the rating (clamped to 1–10) and returns what was stored. */
export function setDefaultRating(next: number): number {
  const clamped = Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(next)));
  Storage.setItemSync(RATING_KEY, String(clamped));
  return clamped;
}

export function useDefaultRating() {
  const [value, setValue] = useState(getDefaultRating);
  const update = (next: number) => setValue(setDefaultRating(next));
  return [value, update] as const;
}

/* ------------------------------ default tag ------------------------------ */

const TAG_KEY = 'default-tag';

export const getDefaultTag = (): string => normalizeTag(Storage.getItemSync(TAG_KEY) ?? '') || DEFAULT_TAG;

/** Saves the tag (cleaned up) and returns what was actually stored. Empty → built-in default. */
export function setDefaultTag(text: string): string {
  const tag = normalizeTag(text);
  if (tag) Storage.setItemSync(TAG_KEY, tag);
  else Storage.removeItemSync(TAG_KEY);
  return tag || DEFAULT_TAG;
}

export function useDefaultTag() {
  const [value, setValue] = useState(getDefaultTag);
  const update = (text: string) => {
    const saved = setDefaultTag(text);
    setValue(saved);
    return saved;
  };
  return [value, update] as const;
}

/* ------------------------- starting values for a new memory ------------------------- */

/** Blank details for a brand-new memory, using the default rating from Settings. */
export const freshDetails = (): Details => ({
  ...EMPTY_DETAILS,
  tags: [],
  rating: getDefaultRating(),
});

/** If no tag was chosen, apply the default tag from Settings. */
export const withDefaultTag = (d: Details): Details =>
  d.tags.length ? d : { ...d, tags: [getDefaultTag()] };