import type { FREE_SOUND_PACK } from './freeSoundPack';

export type SoundClipKey = keyof typeof FREE_SOUND_PACK;
export type SoundLoadState = 'idle' | 'loading' | 'ready' | 'error';
export type EngineAudioState = 'stopped' | 'starting' | 'idling' | 'revving';
export interface SoundCreditItem {
  readonly title: string;
  readonly author: string;
  readonly url: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly changes: string;
}

export interface SoundEngineState {
  enabled: boolean;
  muted: boolean;
  volume: number;
  loadState: SoundLoadState;
  engineState: EngineAudioState;
  cockpit: boolean;
  rearCoverOpen: boolean;
  errorMessage: string | null;
  activeVoiceCount: number;
}

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): void;
  linearRampToValueAtTime(value: number, endTime: number): void;
  setTargetAtTime?(target: number, startTime: number, timeConstant: number): void;
  cancelScheduledValues?(startTime: number): void;
}

export interface AudioNodeLike {
  connect(destination: unknown): unknown;
  disconnect(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: BiquadFilterType;
  frequency: AudioParamLike;
  Q: AudioParamLike;
  gain: AudioParamLike;
}

export interface AudioBufferLike {
  duration: number;
}

export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  playbackRate: AudioParamLike;
  onended: (() => void) | null;
  start(when?: number, offset?: number, duration?: number): void;
  stop(when?: number): void;
}

export interface AudioContextLike {
  currentTime: number;
  state: AudioContextState;
  destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  decodeAudioData(audioData: ArrayBuffer): Promise<AudioBufferLike>;
  createGain(): GainNodeLike;
  createBiquadFilter(): BiquadFilterNodeLike;
  createBufferSource(): AudioBufferSourceNodeLike;
}

export interface SoundPackModule {
  FREE_SOUND_PACK: Record<SoundClipKey, string>;
  SOUND_CREDITS: readonly SoundCreditItem[];
}

export interface SoundEngineDeps {
  createAudioContext?: () => AudioContextLike;
  loadSoundPack?: () => Promise<SoundPackModule>;
  scheduleTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearScheduledTimeout?: (id: ReturnType<typeof setTimeout>) => void;
  nowMs?: () => number;
  doc?: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'> | null;
}

/**
 * Metadata mirror of SOUND_CREDITS from src/audio/freeSoundPack.ts so the
 * Reference & Credits modal can display human-readable linked attributions before
 * the audio pack is lazily imported on user opt-in.
 */
export const ILLUSTRATIVE_SOUND_CREDITS: readonly SoundCreditItem[] = [
  {
    "title": "PURE V12 SOUND | Ferrari Daytona SP3 (Assetto Corsa EVO 0.4)",
    "author": "DARK WORKS (video); Assetto Corsa EVO gameplay audio",
    "url": "https://www.youtube.com/watch?v=DbwVURaXI-Y",
    "license": "Reuse licence not verified",
    "licenseUrl": "https://www.youtube.com/watch?v=DbwVURaXI-Y",
    "changes": "User-selected gameplay reference. Startup: 9.25–11.30 s; running sustain: 11.05–12.15 s; high-RPM sustain: 114.92–115.651 s. Trimmed, filtered, phase-aligned loop overlaps and loudness matched to startup. Sustains use lossless PCM for seamless continuous playback. Game audio, not a real-car microphone recording. Reuse licence not verified; no Creative Commons or royalty-free licence is claimed."
  },
  {
    "title": "CAR DOOR OPEN CLOSE.wav",
    "author": "kennydoug",
    "url": "https://freesound.org/people/kennydoug/sounds/485993/",
    "license": "CC0 1.0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    "changes": "Trimmed and processed public HQ preview. Generic 2012 Chevrolet Impala door foley, not SP3-specific."
  }
] as const;

export const DEFAULT_SOUND_VOLUME = 0.65;
const DEBOUNCE_ENGINE_MS = 160;
const DEBOUNCE_FOLEY_MS = 90;
const MAX_FOLEY_VOICES = 3;

/**
 * Converts a base64 data URI (`data:audio/mpeg;base64,...`) into an ArrayBuffer
 * without triggering network fetch requests.
 */
export function dataUriToArrayBuffer(dataUri: string): ArrayBuffer {
  const commaIdx = dataUri.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUri.slice(commaIdx + 1) : dataUri;
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function defaultCreateAudioContext(): AudioContextLike {
  const Ctor =
    (globalThis as unknown as { AudioContext?: new () => AudioContextLike }).AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: new () => AudioContextLike })
      .webkitAudioContext;
  if (!Ctor) {
    throw new Error('Web Audio is not supported in this browser.');
  }
  return new Ctor();
}

interface ActiveVoice {
  source: AudioBufferSourceNodeLike;
  gainNode: GainNodeLike;
  kind: 'start' | 'idle' | 'rev' | 'foley';
  stopTimer?: ReturnType<typeof setTimeout>;
}

export class SoundEngine {
  private state: SoundEngineState = {
    enabled: false,
    muted: false,
    volume: DEFAULT_SOUND_VOLUME,
    loadState: 'idle',
    engineState: 'stopped',
    cockpit: false,
    rearCoverOpen: false,
    errorMessage: null,
    activeVoiceCount: 0,
  };

  private listeners = new Set<(state: SoundEngineState) => void>();
  private ctx: AudioContextLike | null = null;
  private masterGain: GainNodeLike | null = null;
  private engineFilter: BiquadFilterNodeLike | null = null;
  private presenceFilter: BiquadFilterNodeLike | null = null;
  private idleDuckGain: GainNodeLike | null = null;
  private foleyGain: GainNodeLike | null = null;

  private buffers: Partial<Record<SoundClipKey, AudioBufferLike>> = {};
  private credits: readonly SoundCreditItem[] = ILLUSTRATIVE_SOUND_CREDITS;
  private enablePromise: Promise<boolean> | null = null;
  private disposed = false;
  private opToken = 0;

  private activeEngineVoices = new Set<ActiveVoice>();
  private activeRevVoices = new Set<ActiveVoice>();
  private activeFoleyVoices: ActiveVoice[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private fadeCleanupTimers = new Set<ReturnType<typeof setTimeout>>();

  private lastStartClickMs = -Infinity;
  private lastRevClickMs = -Infinity;
  private lastFoleyMs: Record<'open' | 'close' | 'light', number> = {
    open: -Infinity,
    close: -Infinity,
    light: -Infinity,
  };

  private readonly createAudioContext: () => AudioContextLike;
  private readonly loadSoundPack: () => Promise<SoundPackModule>;
  private readonly scheduleTimeout: (
    fn: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout>;
  private readonly clearScheduledTimeout: (id: ReturnType<typeof setTimeout>) => void;
  private readonly nowMs: () => number;
  private readonly doc: Pick<
    Document,
    'hidden' | 'addEventListener' | 'removeEventListener'
  > | null;
  private readonly onVisibilityChange: () => void;

  constructor(deps: SoundEngineDeps = {}) {
    this.createAudioContext = deps.createAudioContext ?? defaultCreateAudioContext;
    this.loadSoundPack = deps.loadSoundPack ?? (() => import('./freeSoundPack'));
    this.scheduleTimeout = deps.scheduleTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearScheduledTimeout =
      deps.clearScheduledTimeout ?? ((id) => clearTimeout(id));
    this.nowMs = deps.nowMs ?? (() => performance.now());
    this.doc =
      deps.doc !== undefined
        ? deps.doc
        : typeof document !== 'undefined'
          ? document
          : null;

    this.onVisibilityChange = () => {
      if (this.doc?.hidden) {
        this.stopAllVoicesImmediateOrFade(true);
      }
    };

    if (this.doc && typeof this.doc.addEventListener === 'function') {
      this.doc.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  public getState(): SoundEngineState {
    return {
      ...this.state,
      activeVoiceCount:
        this.activeEngineVoices.size +
        this.activeRevVoices.size +
        this.activeFoleyVoices.length,
    };
  }

  public getCredits(): readonly SoundCreditItem[] {
    return this.credits;
  }

  public subscribe(listener: (state: SoundEngineState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private addTimer(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = this.scheduleTimeout(() => {
      this.timers.delete(id);
      if (!this.disposed) {
        fn();
      }
    }, Math.max(0, ms));
    this.timers.add(id);
    return id;
  }

  private clearAllEngineTimers(): void {
    for (const id of this.timers) {
      this.clearScheduledTimeout(id);
    }
    this.timers.clear();
  }

  private clearAllFadeCleanupTimers(): void {
    for (const id of this.fadeCleanupTimers) {
      this.clearScheduledTimeout(id);
    }
    this.fadeCleanupTimers.clear();
  }

  private rampParam(param: AudioParamLike, target: number, durationSec: number): void {
    if (!this.ctx) {
      param.value = target;
      return;
    }
    const now = this.ctx.currentTime;
    param.cancelScheduledValues?.(now);
    param.setValueAtTime(param.value, now);
    if (durationSec <= 0.001) {
      param.setValueAtTime(target, now);
    } else {
      param.linearRampToValueAtTime(target, now + durationSec);
    }
  }

  private ensureContextGraphSync(): AudioContextLike {
    if (!this.ctx) {
      const ctx = this.createAudioContext();
      const masterGain = ctx.createGain();
      const engineFilter = ctx.createBiquadFilter();
      const presenceFilter = ctx.createBiquadFilter();
      const idleDuckGain = ctx.createGain();
      const foleyGain = ctx.createGain();

      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 7600;
      engineFilter.Q.value = 0.7;

      presenceFilter.type = 'peaking';
      presenceFilter.frequency.value = 1800;
      presenceFilter.Q.value = 1.1;
      presenceFilter.gain.value = 0;

      idleDuckGain.gain.value = 1.0;
      foleyGain.gain.value = 0.42;
      masterGain.gain.value = this.state.muted ? 0 : this.state.volume;

      idleDuckGain.connect(engineFilter);
      engineFilter.connect(presenceFilter);
      presenceFilter.connect(masterGain);
      foleyGain.connect(masterGain);
      masterGain.connect(ctx.destination);

      this.ctx = ctx;
      this.masterGain = masterGain;
      this.engineFilter = engineFilter;
      this.presenceFilter = presenceFilter;
      this.idleDuckGain = idleDuckGain;
      this.foleyGain = foleyGain;
      this.applyAcousticsToNodes(0);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Must be invoked inside an explicit user click gesture.
   * Synchronously creates/resumes the AudioContext before lazily importing and decoding the WAV/MP3 pack.
   */
  public enable(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (this.state.loadState === 'ready' && this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      if (!this.state.enabled) {
        this.state.enabled = true;
        this.emit();
      }
      return Promise.resolve(true);
    }
    if (this.enablePromise) {
      return this.enablePromise;
    }

    try {
      // Synchronous AudioContext creation & resume inside the user gesture
      const ctx = this.ensureContextGraphSync();
      this.state.enabled = true;
      this.state.loadState = 'loading';
      this.state.errorMessage = null;
      this.emit();

      this.enablePromise = (async () => {
        try {
          const packModule = await this.loadSoundPack();
          if (this.disposed) return false;
          this.credits = packModule.SOUND_CREDITS;

          const keys: SoundClipKey[] = [
            'start',
            'idle',
            'rev',
            'panelOpen',
            'panelClose',
          ];
          await Promise.all(
            keys.map(async (key) => {
              const uri = packModule.FREE_SOUND_PACK[key];
              const ab = dataUriToArrayBuffer(uri);
              const decoded = await ctx.decodeAudioData(ab);
              this.buffers[key] = decoded;
            }),
          );

          if (this.disposed) return false;
          this.state.loadState = 'ready';
          this.state.errorMessage = null;
          this.emit();
          return true;
        } catch (err) {
          if (this.disposed) return false;
          this.state.loadState = 'error';
          this.state.errorMessage =
            err instanceof Error
              ? err.message
              : 'Could not decode the recorded audio pack.';
          this.emit();
          return false;
        } finally {
          this.enablePromise = null;
        }
      })();

      return this.enablePromise;
    } catch (err) {
      this.state.enabled = false;
      this.state.loadState = 'error';
      this.state.errorMessage =
        err instanceof Error ? err.message : 'Could not initialise Web Audio.';
      this.emit();
      return Promise.resolve(false);
    }
  }

  private fadeAndStopVoice(voice: ActiveVoice, fadeSec = 0.09): void {
    if (voice.stopTimer) {
      this.clearScheduledTimeout(voice.stopTimer);
      this.fadeCleanupTimers.delete(voice.stopTimer);
      voice.stopTimer = undefined;
    }
    this.activeEngineVoices.delete(voice);
    this.activeRevVoices.delete(voice);
    const foleyIdx = this.activeFoleyVoices.indexOf(voice);
    if (foleyIdx >= 0) {
      this.activeFoleyVoices.splice(foleyIdx, 1);
    }

    if (!this.ctx || fadeSec <= 0.005) {
      try {
        voice.source.onended = null;
        voice.source.stop();
      } catch {}
      try {
        voice.source.disconnect();
        voice.gainNode.disconnect();
      } catch {}
      return;
    }

    const now = this.ctx.currentTime;
    try {
      voice.gainNode.gain.cancelScheduledValues?.(now);
      voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
      voice.gainNode.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
      voice.source.onended = null;
      voice.source.stop(now + fadeSec + 0.01);
    } catch {}

    const cleanupId = this.scheduleTimeout(() => {
      this.fadeCleanupTimers.delete(cleanupId);
      voice.stopTimer = undefined;
      try {
        voice.source.disconnect();
        voice.gainNode.disconnect();
      } catch {}
      if (!this.disposed) {
        this.emit();
      }
    }, Math.ceil((fadeSec + 0.02) * 1000));
    this.fadeCleanupTimers.add(cleanupId);
    voice.stopTimer = cleanupId;
  }

  private stopAllVoicesImmediateOrFade(fade = true): void {
    this.opToken += 1;
    this.clearAllEngineTimers();
    const fadeSec = fade ? 0.1 : 0;

    for (const v of [...this.activeEngineVoices]) {
      this.fadeAndStopVoice(v, fadeSec);
    }
    for (const v of [...this.activeRevVoices]) {
      this.fadeAndStopVoice(v, fadeSec);
    }
    for (const v of [...this.activeFoleyVoices]) {
      this.fadeAndStopVoice(v, fadeSec);
    }
    if (this.idleDuckGain) {
      this.rampParam(this.idleDuckGain.gain, 1.0, 0.05);
    }
    if (this.state.engineState !== 'stopped') {
      this.state.engineState = 'stopped';
    }
    this.emit();
  }

  private startContinuousLoopVoice(
    kind: 'idle' | 'rev',
    fadeInSec = 0.18,
  ): ActiveVoice | null {
    if (
      this.disposed ||
      !this.ctx ||
      !this.idleDuckGain ||
      this.state.muted ||
      !this.state.enabled
    ) {
      return null;
    }
    const buf = this.buffers[kind];
    if (!buf) return null;

    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const gainNode = this.ctx.createGain();
    source.buffer = buf;
    source.loop = true;
    source.playbackRate.value = 1.0;

    const rampSec = Math.max(0.02, fadeInSec);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(1.0, now + rampSec);

    source.connect(gainNode);
    gainNode.connect(this.idleDuckGain);

    const voiceSet =
      kind === 'rev' ? this.activeRevVoices : this.activeEngineVoices;
    const voice: ActiveVoice = { source, gainNode, kind };
    voiceSet.add(voice);

    source.onended = () => {
      voiceSet.delete(voice);
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch {}
    };

    source.start(now);
    return voice;
  }

  /**
   * From stopped: plays the startup clip once, then crossfades into a continuous
   * native running-engine loop at the same perceived loudness until Stop.
   * From revving: smoothly crossfades directly from the high-RPM rev loop into
   * the continuous running-engine loop without re-cranking the starter.
   */
  public startEngine(): boolean {
    if (
      this.disposed ||
      !this.state.enabled ||
      this.state.muted ||
      this.state.loadState !== 'ready' ||
      !this.ctx ||
      !this.engineFilter ||
      !this.idleDuckGain
    ) {
      return false;
    }

    if (
      this.state.engineState === 'starting' ||
      this.state.engineState === 'idling'
    ) {
      return false;
    }

    const nowMs = this.nowMs();
    if (nowMs - this.lastStartClickMs < DEBOUNCE_ENGINE_MS) {
      return false;
    }
    this.lastStartClickMs = nowMs;
    this.lastRevClickMs = -Infinity;

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    const wasRevving = this.state.engineState === 'revving';

    this.opToken += 1;
    const token = this.opToken;
    this.clearAllEngineTimers();

    const crossfadeFromActiveSec = 0.18;
    for (const v of [...this.activeEngineVoices]) {
      this.fadeAndStopVoice(v, crossfadeFromActiveSec);
    }
    for (const v of [...this.activeRevVoices]) {
      this.fadeAndStopVoice(v, crossfadeFromActiveSec);
    }
    this.rampParam(this.idleDuckGain.gain, 1.0, 0.04);

    // Switching from Rev to running: smoothly crossfade directly into the native idle loop
    // without replaying the starter cranking clip.
    if (wasRevving) {
      if (!this.buffers.idle) return false;
      this.state.engineState = 'idling';
      this.startContinuousLoopVoice('idle', crossfadeFromActiveSec);
      this.emit();
      return true;
    }

    const startBuf = this.buffers.start;
    if (!startBuf) return false;

    const now = this.ctx.currentTime;
    const dur = Math.max(0.25, startBuf.duration);
    const crossfadeSec = Math.min(0.24, dur * 0.2);

    const source = this.ctx.createBufferSource();
    const gainNode = this.ctx.createGain();
    source.buffer = startBuf;
    source.loop = false;
    source.playbackRate.value = 1.0;

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(1.0, now + 0.025);
    gainNode.gain.setValueAtTime(1.0, now + Math.max(0.04, dur - crossfadeSec));
    gainNode.gain.linearRampToValueAtTime(0.0001, now + dur);

    source.connect(gainNode);
    gainNode.connect(this.idleDuckGain);

    const startVoice: ActiveVoice = { source, gainNode, kind: 'start' };
    this.activeEngineVoices.add(startVoice);
    this.state.engineState = 'starting';
    this.emit();

    source.onended = () => {
      this.activeEngineVoices.delete(startVoice);
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch {}
    };

    source.start(now);
    source.stop(now + dur + 0.02);

    const crossfadeStartMs = Math.max(
      50,
      Math.round((dur - crossfadeSec) * 1000),
    );
    this.addTimer(() => {
      if (token !== this.opToken || this.state.muted || !this.state.enabled) {
        return;
      }
      this.fadeAndStopVoice(startVoice, crossfadeSec);
      this.state.engineState = 'idling';
      this.startContinuousLoopVoice('idle', crossfadeSec);
      this.emit();
    }, crossfadeStartMs);

    return true;
  }

  /**
   * Smoothly crossfades into a continuous native high-RPM rev loop at unity loudness
   * and holds it indefinitely until Stop (or until switched back to running via Start engine).
   */
  public revEngine(): boolean {
    if (
      this.disposed ||
      !this.state.enabled ||
      this.state.muted ||
      this.state.loadState !== 'ready' ||
      !this.ctx ||
      !this.engineFilter ||
      !this.idleDuckGain
    ) {
      return false;
    }

    if (this.state.engineState === 'revving') {
      return false;
    }

    const nowMs = this.nowMs();
    if (nowMs - this.lastRevClickMs < DEBOUNCE_ENGINE_MS) {
      return false;
    }
    this.lastRevClickMs = nowMs;
    this.lastStartClickMs = -Infinity;

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    if (!this.buffers.rev) return false;

    this.opToken += 1;
    this.clearAllEngineTimers();

    const crossfadeSec = 0.18;
    for (const v of [...this.activeEngineVoices]) {
      this.fadeAndStopVoice(v, crossfadeSec);
    }
    for (const rv of [...this.activeRevVoices]) {
      this.fadeAndStopVoice(rv, crossfadeSec);
    }

    this.rampParam(this.idleDuckGain.gain, 1.0, 0.04);
    this.state.engineState = 'revving';
    this.startContinuousLoopVoice('rev', crossfadeSec);
    this.emit();

    return true;
  }

  /**
   * Stops the engine, cancels pending startup/rev tasks, and fades out all engine voices.
   */
  public stopEngine(): void {
    this.stopAllVoicesImmediateOrFade(true);
  }

  /**
   * Mutes or unmutes all sound. Muting cancels pending startup/rev tasks and stops all voices.
   * Unmuting never restarts a stopped engine.
   */
  public setMuted(muted: boolean): void {
    if (this.state.muted === muted) return;
    this.state.muted = muted;
    if (muted) {
      this.stopAllVoicesImmediateOrFade(true);
      if (this.masterGain) {
        this.rampParam(this.masterGain.gain, 0, 0.06);
      }
    } else {
      if (this.masterGain) {
        this.rampParam(this.masterGain.gain, this.state.volume, 0.06);
      }
      // Explicitly ensure engine stays stopped on unmute
      this.state.engineState = 'stopped';
    }
    this.emit();
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.state.volume = clamped;
    if (this.masterGain && !this.state.muted) {
      this.rampParam(this.masterGain.gain, clamped, 0.04);
    }
    this.emit();
  }

  private applyAcousticsToNodes(rampSec = 0.14): void {
    if (!this.engineFilter || !this.presenceFilter) return;
    const { cockpit, rearCoverOpen } = this.state;
    // Cockpit: warmer/muffled low-pass filter; Open Engine Cover: brighter exhaust presence
    const targetFreq = cockpit ? 1350 : rearCoverOpen ? 13000 : 7600;
    const targetPresenceDb = cockpit ? -3.0 : rearCoverOpen ? 3.5 : 0;
    this.rampParam(this.engineFilter.frequency, targetFreq, rampSec);
    this.rampParam(this.presenceFilter.gain, targetPresenceDb, rampSec);
  }

  public setAcoustics(options: {
    cockpit?: boolean;
    rearCoverOpen?: boolean;
  }): void {
    let changed = false;
    if (
      options.cockpit !== undefined &&
      options.cockpit !== this.state.cockpit
    ) {
      this.state.cockpit = options.cockpit;
      changed = true;
    }
    if (
      options.rearCoverOpen !== undefined &&
      options.rearCoverOpen !== this.state.rearCoverOpen
    ) {
      this.state.rearCoverOpen = options.rearCoverOpen;
      changed = true;
    }
    if (changed) {
      this.applyAcousticsToNodes(0.14);
      this.emit();
    }
  }

  /**
   * Plays subtle panel open/close foley when doors, front lid, or engine cover are toggled.
   */
  public playPanelFoley(direction: 'open' | 'close'): boolean {
    if (
      this.disposed ||
      !this.state.enabled ||
      this.state.muted ||
      this.state.loadState !== 'ready' ||
      !this.ctx ||
      !this.foleyGain
    ) {
      return false;
    }

    const nowMs = this.nowMs();
    if (nowMs - this.lastFoleyMs[direction] < DEBOUNCE_FOLEY_MS) {
      return false;
    }
    this.lastFoleyMs[direction] = nowMs;

    const clipKey: SoundClipKey =
      direction === 'open' ? 'panelOpen' : 'panelClose';
    const buf = this.buffers[clipKey];
    if (!buf) return false;

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    while (this.activeFoleyVoices.length >= MAX_FOLEY_VOICES) {
      const oldest = this.activeFoleyVoices.shift();
      if (oldest) {
        this.fadeAndStopVoice(oldest, 0.04);
      }
    }

    const now = this.ctx.currentTime;
    const dur = Math.max(0.15, buf.duration);
    const source = this.ctx.createBufferSource();
    const gainNode = this.ctx.createGain();
    source.buffer = buf;
    source.loop = false;
    source.playbackRate.value = 1.0;

    const peakGain = direction === 'open' ? 0.36 : 0.38;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peakGain, now + 0.015);
    gainNode.gain.setValueAtTime(peakGain, now + Math.max(0.03, dur - 0.06));
    gainNode.gain.linearRampToValueAtTime(0.0001, now + dur);

    source.connect(gainNode);
    gainNode.connect(this.foleyGain);

    const voice: ActiveVoice = { source, gainNode, kind: 'foley' };
    this.activeFoleyVoices.push(voice);

    source.onended = () => {
      const idx = this.activeFoleyVoices.indexOf(voice);
      if (idx >= 0) this.activeFoleyVoices.splice(idx, 1);
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch {}
      this.emit();
    };

    source.start(now);
    source.stop(now + dur + 0.02);
    this.emit();
    return true;
  }

  /**
   * Plays a restrained, soft mechanical relay click when toggling Front or Rear Lights.
   */
  public playLightRelayClick(): boolean {
    if (
      this.disposed ||
      !this.state.enabled ||
      this.state.muted ||
      this.state.loadState !== 'ready' ||
      !this.ctx ||
      !this.foleyGain
    ) {
      return false;
    }

    const nowMs = this.nowMs();
    if (nowMs - this.lastFoleyMs.light < 65) {
      return false;
    }
    this.lastFoleyMs.light = nowMs;

    const buf = this.buffers.panelClose ?? this.buffers.panelOpen;
    if (!buf) return false;

    const now = this.ctx.currentTime;
    const sliceDur = Math.min(0.045, buf.duration);
    const source = this.ctx.createBufferSource();
    const gainNode = this.ctx.createGain();
    source.buffer = buf;
    source.loop = false;
    source.playbackRate.value = 1.0;

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.11, now + 0.004);
    gainNode.gain.linearRampToValueAtTime(0.0001, now + sliceDur);

    source.connect(gainNode);
    gainNode.connect(this.foleyGain);

    const voice: ActiveVoice = { source, gainNode, kind: 'foley' };
    this.activeFoleyVoices.push(voice);

    source.onended = () => {
      const idx = this.activeFoleyVoices.indexOf(voice);
      if (idx >= 0) this.activeFoleyVoices.splice(idx, 1);
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch {}
    };

    source.start(now, 0, sliceDur);
    source.stop(now + sliceDur + 0.01);
    return true;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAllVoicesImmediateOrFade(false);
    this.clearAllFadeCleanupTimers();
    if (this.doc && typeof this.doc.removeEventListener === 'function') {
      this.doc.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.listeners.clear();
  }
}
