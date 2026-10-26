/**
 * Atmospheric Procedural Sound Effects Engine (Pure Web Audio API)
 * Generates natural air breeze, wind sweeps, and subtle UI breath sounds.
 * Zero external audio assets, zero music, completely non-intrusive and soothing.
 */

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted: boolean = false;
  
  // Continuous air flow for globe rotation
  private rotateSource: AudioBufferSourceNode | null = null;
  private rotateFilter: BiquadFilterNode | null = null;
  private rotateGain: GainNode | null = null;
  private lastRotateTime: number = 0;
  private rotateTargetGain: number = 0;

  constructor() {
    // Check localStorage for mute preference
    const saved = localStorage.getItem('quran_globe_sound_muted');
    if (saved !== null) {
      this.isMuted = saved === 'true';
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.createNoiseBuffer();
        this.setupContinuousRotate();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Generates 3 seconds of high quality pink/brownish-filtered noise for realistic air sounds
   */
  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    
    // Pink noise generation algorithm (Paul Kellet's method)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buffer;
  }

  private setupContinuousRotate() {
    if (!this.ctx || !this.noiseBuffer) return;
    try {
      this.rotateSource = this.ctx.createBufferSource();
      this.rotateSource.buffer = this.noiseBuffer;
      this.rotateSource.loop = true;

      this.rotateFilter = this.ctx.createBiquadFilter();
      this.rotateFilter.type = 'bandpass';
      this.rotateFilter.frequency.value = 350;
      this.rotateFilter.Q.value = 1.2;

      this.rotateGain = this.ctx.createGain();
      this.rotateGain.gain.value = 0;

      this.rotateSource.connect(this.rotateFilter);
      this.rotateFilter.connect(this.rotateGain);
      this.rotateGain.connect(this.ctx.destination);

      this.rotateSource.start(0);
    } catch (e) {
      console.warn('Continuous rotate audio setup warning:', e);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('quran_globe_sound_muted', String(muted));
    if (muted && this.rotateGain && this.ctx) {
      this.rotateGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Gentle airy whoosh when dragging or orbiting the globe.
   * `speed` is rotational velocity (0 to 1+).
   */
  public playRotateAir(speed: number) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.rotateGain || !this.rotateFilter) return;

    const now = this.ctx.currentTime;
    const clampedSpeed = Math.min(1.5, Math.max(0, speed));
    
    // Smooth target gain based on rotation speed
    const targetVolume = clampedSpeed > 0.02 ? Math.min(0.065, clampedSpeed * 0.045) : 0;
    const targetFreq = 260 + clampedSpeed * 320; // 260Hz to ~740Hz bandpass

    this.rotateGain.gain.setTargetAtTime(targetVolume, now, 0.08);
    this.rotateFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.lastRotateTime = Date.now();
  }

  public stopRotateAir() {
    if (!this.ctx || !this.rotateGain) return;
    this.rotateGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
  }

  /**
   * Air sweep when zooming in (frequency sweeps up) or zooming out (frequency sweeps down).
   */
  public playZoomAir(direction: 'in' | 'out', intensity: number = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;

    const gain = this.ctx.createGain();
    const peakVol = Math.min(0.07, 0.035 * Math.min(2, Math.max(0.5, intensity)));

    if (direction === 'in') {
      // Zoom in: soft rising airy sweep (e.g. 280Hz -> 720Hz)
      filter.frequency.setValueAtTime(280, now);
      filter.frequency.exponentialRampToValueAtTime(720, now + 0.22);
    } else {
      // Zoom out: soft descending airy sweep (e.g. 680Hz -> 220Hz)
      filter.frequency.setValueAtTime(680, now);
      filter.frequency.exponentialRampToValueAtTime(220, now + 0.22);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakVol, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    source.start(now);
    source.stop(now + 0.25);
  }

  /**
   * Ultra-light subtle breath/air chime when hovering over a surah, topic or ayah node.
   */
  public playHoverAir() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Soft sine resonance + gentle filtered air pop
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.09);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.018, now + 0.02);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  /**
   * Ambient breeze swell when transitioning into or out of a surah
   */
  public playTransitionAir() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.4);
    filter.frequency.exponentialRampToValueAtTime(250, now + 1.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    source.start(now);
    source.stop(now + 1.25);
  }
}

export const soundEffects = new SoundEffectsEngine();
