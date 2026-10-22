import { FULL_MONTHS, parseDateKey, toDateKey, type InsightRow } from './memory';

export type Period = 'month' | 'year' | 'all';

export type TrendBar = { key: string; label: string; value: number | null; highlight?: boolean };

const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function periodRange(period: Period, year: number, month: number) {
  if (period === 'month') return { from: toDateKey(year, month, 1), to: toDateKey(year, month, lastDay(year, month)) };
  if (period === 'year') return { from: toDateKey(year, 0, 1), to: toDateKey(year, 11, 31) };
  return { from: '0000-01-01', to: '9999-12-31' };
}

const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);

/** group rows by a key and return {key → ratings[]} */
function groupRatings(rows: InsightRow[], keyOf: (r: InsightRow) => string) {
  const map = new Map<string, number[]>();
  for (const r of rows) {
    const k = keyOf(r);
    (map.get(k) ?? map.set(k, []).get(k)!).push(r.rating);
  }
  return map;
}

export const WEEKDAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const weekdayIndex = (dateKey: string) => (parseDateKey(dateKey).getDay() + 6) % 7; // Mon = 0

export const TIME_SLOTS = [
  { id: 'morning', label: 'Morning', hint: '5 am – 12 pm' },
  { id: 'afternoon', label: 'Afternoon', hint: '12 – 5 pm' },
  { id: 'evening', label: 'Evening', hint: '5 – 10 pm' },
  { id: 'night', label: 'Night', hint: '10 pm – 5 am' },
] as const;
type SlotId = (typeof TIME_SLOTS)[number]['id'];

const slotOf = (createdAtUtc: string): SlotId => {
  const h = new Date(createdAtUtc.replace(' ', 'T') + 'Z').getHours(); // local hour
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
};

export const RATING_GROUPS = [
  { id: 'great', label: 'Great', range: '9–10', min: 9, max: 10, color: '#7FBF9A' },
  { id: 'good', label: 'Good', range: '7–8', min: 7, max: 8, color: '#9CC3F0' },
  { id: 'okay', label: 'Okay', range: '5–6', min: 5, max: 6, color: '#F2C879' },
  { id: 'low', label: 'Low', range: '1–4', min: 1, max: 4, color: '#E58C7B' },
] as const;

export function computeInsights(rows: InsightRow[], period: Period, year: number, month: number) {
  const count = rows.length;
  const totalMs = rows.reduce((s, r) => s + r.durationMs, 0);
  const average = avg(rows.map((r) => r.rating));

  /* ---- trend bars ---- */
  let trend: TrendBar[];
  if (period === 'month') {
    const byDay = new Map(rows.map((r) => [Number(r.date.slice(8, 10)), r.rating]));
    trend = Array.from({ length: lastDay(year, month) }, (_, i) => ({
      key: String(i + 1),
      label: String(i + 1),
      value: byDay.get(i + 1) ?? null,
    }));
  } else if (period === 'year') {
    const g = groupRatings(rows, (r) => r.date.slice(5, 7));
    trend = Array.from({ length: 12 }, (_, i) => {
      const k = String(i + 1).padStart(2, '0');
      return { key: k, label: FULL_MONTHS[i][0], value: avg(g.get(k) ?? []) };
    });
  } else {
    const g = groupRatings(rows, (r) => r.date.slice(0, 4));
    trend = [...g.keys()].sort().map((k) => ({ key: k, label: k.slice(2), value: avg(g.get(k)!) }));
  }
  const maxTrend = Math.max(0, ...trend.map((b) => b.value ?? 0));
  trend = trend.map((b) => ({ ...b, highlight: b.value != null && b.value === maxTrend && maxTrend > 0 }));

  /* ---- highlights ---- */
  const topRated = rows.reduce<InsightRow | null>(
    (best, r) => (!best || r.rating > best.rating || (r.rating === best.rating && r.date > best.date) ? r : best),
    null,
  );
  const longest = rows.reduce<InsightRow | null>((best, r) => (!best || r.durationMs > best.durationMs ? r : best), null);

  let bestMonth: { year: number; month: number; avg: number; n: number } | null = null;
  if (period !== 'month') {
    const g = groupRatings(rows, (r) => r.date.slice(0, 7));
    for (const [k, ratings] of g) {
      const a = avg(ratings)!;
      const cand = { year: Number(k.slice(0, 4)), month: Number(k.slice(5, 7)) - 1, avg: a, n: ratings.length };
      if (!bestMonth || a > bestMonth.avg || (a === bestMonth.avg && ratings.length > bestMonth.n)) bestMonth = cand;
    }
  }

  /* ---- weekday averages ---- */
  const wd = groupRatings(rows, (r) => String(weekdayIndex(r.date)));
  const weekdays: TrendBar[] = WEEKDAYS_SHORT.map((label, i) => ({
    key: String(i),
    label,
    value: avg(wd.get(String(i)) ?? []),
  }));
  const maxWd = Math.max(0, ...weekdays.map((b) => b.value ?? 0));
  weekdays.forEach((b) => (b.highlight = b.value != null && b.value === maxWd && maxWd > 0));
  const bestWeekdayIndex = maxWd > 0 ? weekdays.findIndex((b) => b.highlight) : -1;

  /* ---- rating breakdown ---- */
  const breakdown = RATING_GROUPS.map((g) => {
    const n = rows.filter((r) => r.rating >= g.min && r.rating <= g.max).length;
    return { ...g, n, pct: count ? Math.round((n / count) * 100) : 0 };
  });

  /* ---- top tags ---- */
  const tagCounts = new Map<string, number>();
  rows.forEach((r) => r.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([name, n]) => ({ name, n }));

  /* ---- time of day ---- */
  const slotCounts = { morning: 0, afternoon: 0, evening: 0, night: 0 } as Record<SlotId, number>;
  rows.forEach((r) => slotCounts[slotOf(r.createdAt)]++);
  const timeOfDay = TIME_SLOTS.map((s) => ({ ...s, n: slotCounts[s.id], pct: count ? Math.round((slotCounts[s.id] / count) * 100) : 0 }));
  const bestSlot = count ? timeOfDay.reduce((a, b) => (b.n > a.n ? b : a)) : null;

  return {
    count,
    totalMs,
    average,
    trend,
    topRated,
    longest,
    bestMonth,
    weekdays,
    bestWeekdayIndex,
    bestWeekdayAvg: bestWeekdayIndex >= 0 ? weekdays[bestWeekdayIndex].value : null,
    breakdown,
    topTags,
    timeOfDay,
    bestSlot,
  };
}

/** Streaks use ALL dates (a streak doesn't care which period is selected). */
export function computeStreaks(dates: string[], today: string) {
  const dayNumber = (key: string) => Math.round(parseDateKey(key).getTime() / 86400000);
  const set = new Set(dates);

  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of dates) {
    const n = dayNumber(d);
    run = prev !== null && n - prev === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = n;
  }

  // current streak: counts back from today (or yesterday if today isn't recorded yet)
  const t = parseDateKey(today);
  const keyAt = (offset: number) => {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + offset);
    return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
  };
  let offset = set.has(today) ? 0 : -1;
  let current = 0;
  while (set.has(keyAt(offset))) {
    current++;
    offset--;
  }
  return { current, longest };
}

export function formatTotal(ms: number) {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin >= 60) return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`;
  if (totalMin >= 1) return `${totalMin}m`;
  return `${Math.round(ms / 1000)}s`;
}