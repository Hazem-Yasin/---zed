import { describe, expect, it } from 'vitest';
import { DAY_MS, computeStreak, dayKey, isDue, nextReview } from './srs';

const T0 = new Date(2025, 0, 10, 12).getTime();

describe('nextReview', () => {
  it('moves up a box on good and schedules by interval', () => {
    const s = nextReview(undefined, 'good', T0);
    expect(s.box).toBe(2);
    expect(s.due).toBe(T0 + 3 * DAY_MS); // box 2 => 3 days
  });

  it('jumps two boxes on easy but never above the max', () => {
    expect(nextReview({ box: 4, due: 0, last: 0, lapses: 0 }, 'easy', T0).box).toBe(5);
  });

  it('resets to box 1, counts a lapse and is due immediately on again', () => {
    const s = nextReview({ box: 4, due: 0, last: 0, lapses: 1 }, 'again', T0);
    expect(s.box).toBe(1);
    expect(s.lapses).toBe(2);
    expect(isDue(s, T0)).toBe(true);
  });

  it('keeps the box on hard and is not due right away', () => {
    const s = nextReview({ box: 3, due: 0, last: 0, lapses: 0 }, 'hard', T0);
    expect(s.box).toBe(3);
    expect(isDue(s, T0)).toBe(false);
  });
});

describe('computeStreak', () => {
  const days = (n: number[]) => n.map((off) => dayKey(T0 - off * DAY_MS));

  it('counts consecutive days ending today', () => {
    expect(computeStreak(days([0, 1, 2]), T0)).toBe(3);
  });

  it('keeps the streak alive until the end of today when only yesterday is logged', () => {
    expect(computeStreak(days([1, 2]), T0)).toBe(2);
  });

  it('breaks on a gap', () => {
    expect(computeStreak(days([0, 2, 3]), T0)).toBe(1);
  });

  it('is zero with no recent activity', () => {
    expect(computeStreak(days([5]), T0)).toBe(0);
    expect(computeStreak([], T0)).toBe(0);
  });
});
