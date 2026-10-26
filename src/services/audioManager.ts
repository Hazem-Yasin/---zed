import { readStored, writeStored } from '../hooks/usePersistentState';

/**
 * Global Audio Manager (Singleton)
 * Ensures only ONE audio element plays at any given time across the entire application.
 */

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;
const RATE_KEY = 'playbackRate';

class AudioManager {
  private rate: number = readStored<number>(RATE_KEY, 1, (v) => typeof v === 'number' && PLAYBACK_RATES.some((r) => r === v));
  private currentAudio: HTMLAudioElement | null = null;
  private currentPlayingId: string | null = null;
  private listeners: Set<(playingId: string | null) => void> = new Set();

  public subscribe(listener: (playingId: string | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentPlayingId);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.currentPlayingId));
  }

  public getRate(): number {
    return this.rate;
  }

  public setRate(rate: number) {
    this.rate = rate;
    writeStored(RATE_KEY, rate);
    if (this.currentAudio) this.currentAudio.playbackRate = rate;
  }

  public play(id: string, url: string, onEnded?: () => void): HTMLAudioElement {
    // Stop any existing audio immediately
    this.stop();

    const audio = new Audio(url);
    audio.playbackRate = this.rate;
    this.currentAudio = audio;
    this.currentPlayingId = id;
    this.notify();

    audio.onended = () => {
      if (this.currentAudio === audio) {
        this.currentAudio = null;
        this.currentPlayingId = null;
        this.notify();
      }
      if (onEnded) onEnded();
    };

    audio.onerror = () => {
      if (this.currentAudio === audio) {
        this.currentAudio = null;
        this.currentPlayingId = null;
        this.notify();
      }
    };

    audio.play().catch((e) => {
      console.warn("Audio play prevented:", e);
      if (this.currentAudio === audio) {
        this.currentAudio = null;
        this.currentPlayingId = null;
        this.notify();
      }
    });

    return audio;
  }

  public stop() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {
        console.warn(e);
      }
      this.currentAudio = null;
      this.currentPlayingId = null;
      this.notify();
    }
  }

  public isPlaying(id?: string): boolean {
    if (!this.currentAudio) return false;
    if (id) return this.currentPlayingId === id;
    return !this.currentAudio.paused;
  }

  public getPlayingId(): string | null {
    return this.currentPlayingId;
  }
}

export const globalAudio = new AudioManager();
