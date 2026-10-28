import type { GlobeLevel, RevelationFilter } from '../components/globe/globeEngine';

/**
 * Tiny command channel between the guided tour and the globe screen.
 * The globe is lazy-loaded and unmounts while the tour visits other screens, so commands
 * sent while it is not mounted are queued and delivered as soon as it subscribes.
 */

/** Everything the tour can ask the globe screen to show. Each tour step describes the full state. */
export interface GlobeState {
  /** Outer globe (`surah: null`), inside a surah, or inside one of its sections. */
  place: { surah: number | null; section?: number };
  /** Text in the search box. */
  search: string;
  /** Surah whose hover card is pinned (outer globe only). */
  preview: number | null;
  /** Surah being recited, or null for no playback. */
  listen: number | null;
  /** Compare panel: null = closed, otherwise the two slots. */
  compare: { a: number | null; b: number | null } | null;
  view: { level: GlobeLevel; filter: RevelationFilter; menu: boolean };
}

export const DEFAULT_GLOBE: GlobeState = {
  place: { surah: null },
  search: '',
  preview: null,
  listen: null,
  compare: null,
  view: { level: 'surahs', filter: 'all', menu: false },
};

export type GlobeCmd = { type: 'apply'; s: GlobeState } | { type: 'restore' };

type Listener = (cmd: GlobeCmd) => void;

const listeners = new Set<Listener>();
let queue: GlobeCmd[] = [];
let saved: { level: GlobeLevel; filter: RevelationFilter } | null = null;

export const tourBus = {
  emit(cmd: GlobeCmd) {
    if (listeners.size) {
      listeners.forEach((l) => l(cmd));
      return;
    }
    // Only the latest wish matters while nobody is listening; "restore" supersedes everything.
    queue = cmd.type === 'restore' ? [cmd] : [...queue.filter((c) => c.type !== 'apply'), cmd];
  },

  subscribe(l: Listener): () => void {
    listeners.add(l);
    if (queue.length) {
      // Deliver on the next tick so React StrictMode's mount/unmount/mount settles first.
      setTimeout(() => {
        const q = queue;
        queue = [];
        q.forEach((c) => listeners.forEach((f) => f(c)));
      }, 0);
    }
    return () => {
      listeners.delete(l);
    };
  },

  /** The user's own view settings, captured when the tour first touches them and put back when it ends. */
  get saved() {
    return saved;
  },
  set saved(v: { level: GlobeLevel; filter: RevelationFilter } | null) {
    saved = v;
  },
};
