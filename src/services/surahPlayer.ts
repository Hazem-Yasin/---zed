import { SURAHS_LIST } from '../data/surahs';
import { getSurahMindMap } from '../data/mindmaps/mindmapData';
import { getAyahAudioUrl, RECITERS } from './quranApi';
import { globalAudio } from './audioManager';
import { readStored, writeStored } from '../hooks/usePersistentState';

/**
 * Plays a whole surah ayah-by-ayah through the shared AudioManager and rolls over
 * to the next surah automatically. UI / 3D layers subscribe to follow along.
 */

const ID_PREFIX = 'listen-';

/** Global (1..6236) number of the first ayah of every surah, indexed by surah number. */
const FIRST_GLOBAL: number[] = (() => {
  const out: number[] = [0, 1];
  for (let s = 1; s < SURAHS_LIST.length; s++) {
    out[s + 1] = out[s] + SURAHS_LIST[s - 1].totalVerses;
  }
  return out;
})();

/** Why playback stopped on its own: no internet, the CDN keeps failing, or the browser blocked autoplay. */
export type ListenError = 'offline' | 'network' | 'blocked' | null;

export interface ListenState {
  active: boolean;
  surah: number | null;
  ayah: number;
  total: number;
  playing: boolean;
  loading: boolean;
  autoNext: boolean;
  reciterId: string;
  error: ListenError;
}

/** Shared with the mushaf viewer so one reciter choice applies everywhere. */
export const RECITER_STORAGE_KEY = 'reciter';
export const readStoredReciter = (): string =>
  readStored<string>(RECITER_STORAGE_KEY, RECITERS[0].id, (v) => typeof v === 'string' && RECITERS.some((r) => r.id === v));

/** What changed: a new ayah began, a new surah began, only flags changed, or the session ended. */
export type ListenEvent = 'ayah' | 'surah' | 'state' | 'stop';
type Listener = (state: ListenState, event: ListenEvent) => void;

class SurahPlayer {
  private state: ListenState = {
    active: false,
    surah: null,
    ayah: 1,
    total: 0,
    playing: false,
    loading: false,
    autoNext: true,
    reciterId: readStoredReciter(),
    error: null,
  };
  private listeners = new Set<Listener>();
  private audio: HTMLAudioElement | null = null;
  private token = 0;
  private errorCount = 0;
  private skipCount = 0;

  constructor() {
    // If anything else (ayah modal, quiz, ...) starts audio, our session is over.
    globalAudio.subscribe((id) => {
      if (this.state.active && id && !id.startsWith(ID_PREFIX)) this.end(false);
    });
  }

  getState(): ListenState {
    return this.state;
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  private emit(event: ListenEvent) {
    this.listeners.forEach((l) => l(this.state, event));
  }

  private patch(p: Partial<ListenState>, event: ListenEvent = 'state') {
    this.state = { ...this.state, ...p };
    this.emit(event);
  }

  /* ------------------------------ controls ------------------------------ */

  start(surah: number, reciterId?: string, startAyah: number = 1) {
    if (surah < 1 || surah > 114) return;
    if (reciterId) this.state = { ...this.state, reciterId };
    this.errorCount = 0;
    this.skipCount = 0;
    const clampedAyah = Math.max(1, Math.min(startAyah, SURAHS_LIST[surah - 1].totalVerses));
    this.playAyah(surah, clampedAyah, 'surah');
  }

  startAtAyah(surah: number, ayah: number, reciterId?: string) {
    this.start(surah, reciterId, ayah);
  }

  /** Picks a random Surah, random Mehwar branch, and random Ayah within that branch */
  pickRandomAyah(): { surah: number; branchIndex: number; ayah: number } {
    const surah = Math.floor(Math.random() * 114) + 1;
    const total = SURAHS_LIST[surah - 1].totalVerses;
    const map = getSurahMindMap(surah);
    const branches = map.branches && map.branches.length > 0 ? map.branches : null;

    let branchIndex = 0;
    let ayah = 1;

    if (branches) {
      branchIndex = Math.floor(Math.random() * branches.length);
      const b = branches[branchIndex];
      const start = b.ayahRange?.start || 1;
      const end = b.ayahRange?.end || total;
      ayah = Math.floor(Math.random() * (end - start + 1)) + start;
    } else {
      ayah = Math.floor(Math.random() * total) + 1;
    }

    ayah = Math.max(1, Math.min(ayah, total));
    return { surah, branchIndex, ayah };
  }

  /** Shuffles and starts playback of a random Ayah, returning its metadata */
  shuffle(reciterId?: string): { surah: number; branchIndex: number; ayah: number } {
    const pick = this.pickRandomAyah();
    this.startAtAyah(pick.surah, pick.ayah, reciterId);
    return pick;
  }

  togglePlay() {
    if (!this.state.active) return;
    if (this.state.playing) this.pause();
    else this.resume();
  }

  pause() {
    if (!this.state.active) return;
    this.audio?.pause();
    this.patch({ playing: false, loading: false });
  }

  resume() {
    const { active, surah, ayah } = this.state;
    if (!active || surah === null) return;
    if (this.audio && !this.audio.ended) {
      this.patch({ playing: true });
      this.audio.play().catch(() => this.patch({ playing: false, loading: false }));
    } else {
      this.playAyah(surah, ayah, 'ayah');
    }
  }

  nextAyah() {
    const { active, surah, ayah, total } = this.state;
    if (!active || surah === null) return;
    if (ayah < total) this.playAyah(surah, ayah + 1, 'ayah');
    else if (surah < 114) this.playAyah(surah + 1, 1, 'surah');
  }

  prevAyah() {
    const { active, surah, ayah } = this.state;
    if (!active || surah === null) return;
    if (ayah > 1) this.playAyah(surah, ayah - 1, 'ayah');
    else if (surah > 1) this.playAyah(surah - 1, SURAHS_LIST[surah - 2].totalVerses, 'surah');
  }

  nextSurah() {
    const s = this.state.surah;
    if (this.state.active && s !== null && s < 114) this.playAyah(s + 1, 1, 'surah');
  }

  prevSurah() {
    const s = this.state.surah;
    if (this.state.active && s !== null && s > 1) this.playAyah(s - 1, 1, 'surah');
  }

  setAutoNext(v: boolean) {
    this.patch({ autoNext: v });
  }

  setReciter(reciterId: string) {
    writeStored(RECITER_STORAGE_KEY, reciterId);
    this.patch({ reciterId });
    const { active, surah, ayah, playing } = this.state;
    if (active && surah !== null && playing) this.playAyah(surah, ayah, 'state');
  }

  stop() {
    this.end(true);
  }

  /* ----------------------------- internals ------------------------------ */

  private playAyah(surah: number, ayah: number, event: ListenEvent) {
    const meta = SURAHS_LIST[surah - 1];
    const t = ++this.token;
    const url = getAyahAudioUrl(FIRST_GLOBAL[surah] + ayah - 1, this.state.reciterId);

    this.state = {
      ...this.state,
      active: true,
      surah,
      ayah,
      total: meta.totalVerses,
      playing: true,
      loading: true,
      error: null,
    };

    const audio = globalAudio.play(`${ID_PREFIX}${surah}:${ayah}`, url, () => {
      if (t === this.token) this.advance();
    });
    this.audio = audio;
    this.emit(event);

    audio.addEventListener('playing', () => {
      if (t !== this.token) return;
      this.errorCount = 0;
      this.skipCount = 0;
      if (this.state.loading || !this.state.playing || this.state.error) {
        this.patch({ loading: false, playing: true, error: null });
      }
    });
    audio.addEventListener('waiting', () => {
      if (t === this.token && this.state.playing) this.patch({ loading: true });
    });
    audio.addEventListener('error', () => {
      if (t !== this.token) return;
      if (this.errorCount < 1) {
        this.errorCount++;
        this.playAyah(surah, ayah, 'state'); // one retry
        return;
      }
      this.errorCount = 0;
      this.skipCount++;
      // Offline, or several ayat in a row failed: stop and say why instead of racing through the surah.
      if (!navigator.onLine || this.skipCount >= 3) {
        this.audio?.pause();
        this.patch({ playing: false, loading: false, error: navigator.onLine ? 'network' : 'offline' });
      } else {
        this.advance(); // skip a single broken ayah rather than stalling the whole session
      }
    });

    // Autoplay blocked by the browser => audio stays paused; reflect that in the UI.
    window.setTimeout(() => {
      if (t === this.token && audio.paused && this.state.playing && !this.state.error) {
        this.patch({ playing: false, loading: false, error: 'blocked' });
      }
    }, 1200);
  }

  private advance() {
    const { surah, ayah, total, autoNext } = this.state;
    if (surah === null) return;
    if (ayah < total) this.playAyah(surah, ayah + 1, 'ayah');
    else if (autoNext && surah < 114) this.playAyah(surah + 1, 1, 'surah');
    else this.end(false);
  }

  private end(stopAudio: boolean) {
    this.token++;
    if (stopAudio && globalAudio.getPlayingId()?.startsWith(ID_PREFIX)) globalAudio.stop();
    this.audio = null;
    this.state = { ...this.state, active: false, surah: null, ayah: 1, total: 0, playing: false, loading: false, error: null };
    this.emit('stop');
  }
}

export const surahPlayer = new SurahPlayer();
