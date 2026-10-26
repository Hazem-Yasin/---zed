import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from '../hooks/usePersistentState';
import { Rating, ReviewState, computeStreak, dayKey, isDue, nextReview } from './srs';

/**
 * Everything the reader accumulates over time, kept in localStorage:
 * last-read position, bookmarks, memorised pages, spaced-repetition state per page, daily activity.
 */

export interface Bookmark {
  surah: number;
  ayah: number;
  page: number;
  surahName: string;
  at: number;
}

export interface Library {
  lastReadPage: number | null;
  lastReadAt: number | null;
  bookmarks: Bookmark[];
  /** Pages the user marked as memorised. */
  memorized: number[];
  /** Spaced-repetition state, keyed by mushaf page number. */
  reviews: Record<string, ReviewState>;
  /** Days (YYYY-MM-DD) with any reading/practice, newest last, capped. */
  activeDays: string[];
}

const KEY = 'library-v1';
const MAX_DAYS = 400;

const EMPTY: Library = {
  lastReadPage: null,
  lastReadAt: null,
  bookmarks: [],
  memorized: [],
  reviews: {},
  activeDays: [],
};

const isLibrary = (v: unknown): boolean =>
  !!v && typeof v === 'object' && Array.isArray((v as Library).bookmarks) && Array.isArray((v as Library).memorized);

let state: Library = { ...EMPTY, ...readStored<Library>(KEY, EMPTY, isLibrary) };
const listeners = new Set<() => void>();

function commit(next: Library) {
  state = next;
  writeStored(KEY, state);
  listeners.forEach((l) => l());
}

function withToday(days: string[], now = Date.now()): string[] {
  const today = dayKey(now);
  if (days[days.length - 1] === today) return days;
  return [...days.filter((d) => d !== today), today].slice(-MAX_DAYS);
}

export const library = {
  get: (): Library => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },

  setLastRead(page: number) {
    if (state.lastReadPage === page) return;
    commit({ ...state, lastReadPage: page, lastReadAt: Date.now(), activeDays: withToday(state.activeDays) });
  },

  isBookmarked: (surah: number, ayah: number) => state.bookmarks.some((b) => b.surah === surah && b.ayah === ayah),

  toggleBookmark(b: Omit<Bookmark, 'at'>) {
    const exists = state.bookmarks.some((x) => x.surah === b.surah && x.ayah === b.ayah);
    commit({
      ...state,
      bookmarks: exists
        ? state.bookmarks.filter((x) => !(x.surah === b.surah && x.ayah === b.ayah))
        : [{ ...b, at: Date.now() }, ...state.bookmarks],
    });
  },

  toggleMemorized(page: number) {
    const has = state.memorized.includes(page);
    commit({
      ...state,
      memorized: has ? state.memorized.filter((p) => p !== page) : [...state.memorized, page].sort((a, b) => a - b),
    });
  },

  /** Record a self-assessed review of a page and schedule the next one. */
  rate(page: number, rating: Rating) {
    const now = Date.now();
    commit({
      ...state,
      reviews: { ...state.reviews, [page]: nextReview(state.reviews[page], rating, now) },
      activeDays: withToday(state.activeDays, now),
    });
  },

  /** Count practice activity without a rating (e.g. finishing a word-reveal run). */
  touchToday() {
    const days = withToday(state.activeDays);
    if (days !== state.activeDays) commit({ ...state, activeDays: days });
  },

  /** Memorised/reviewed pages whose review is due, most overdue first. */
  duePages(now = Date.now()): number[] {
    return Object.entries(state.reviews)
      .filter(([, r]) => isDue(r, now))
      .sort((a, b) => a[1].due - b[1].due)
      .map(([p]) => Number(p));
  },

  streak: (now = Date.now()) => computeStreak(state.activeDays, now),
};

/** React hook: re-renders whenever the library changes. */
export function useLibrary(): Library {
  return useSyncExternalStore(library.subscribe, library.get, library.get);
}
