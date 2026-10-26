/** Pure spaced-repetition + streak logic (Leitner boxes). No browser APIs so it is trivially testable. */

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface ReviewState {
  /** Leitner box 1..5 (higher = better known). */
  box: number;
  /** Epoch ms when the item is next due. */
  due: number;
  /** Epoch ms of the last review. */
  last: number;
  /** Number of times the item was forgotten. */
  lapses: number;
}

export const DAY_MS = 86_400_000;
/** Days until the next review, per box. */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const MAX_BOX = BOX_INTERVAL_DAYS.length - 1;

export function nextReview(prev: ReviewState | undefined, rating: Rating, now: number): ReviewState {
  const box0 = prev?.box ?? 1;
  const lapses0 = prev?.lapses ?? 0;
  let box = box0;
  let lapses = lapses0;
  if (rating === 'again') {
    box = 1;
    lapses += 1;
  } else if (rating === 'good') box = Math.min(MAX_BOX, box0 + 1);
  else if (rating === 'easy') box = Math.min(MAX_BOX, box0 + 2);
  // 'hard' keeps the box but is rescheduled for tomorrow-ish
  const days = rating === 'again' ? 0 : rating === 'hard' ? Math.max(1, BOX_INTERVAL_DAYS[box] / 2) : BOX_INTERVAL_DAYS[box];
  return { box, lapses, last: now, due: now + days * DAY_MS };
}

export function isDue(state: ReviewState, now: number): boolean {
  return state.due <= now;
}

/** Local calendar day key, e.g. "2025-03-07". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Consecutive active days ending today (or yesterday, so the streak is not lost before you practise today). */
export function computeStreak(activeDays: readonly string[], now: number): number {
  const set = new Set(activeDays);
  let cursor = now;
  if (!set.has(dayKey(cursor))) cursor -= DAY_MS;
  let streak = 0;
  while (set.has(dayKey(cursor))) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}
