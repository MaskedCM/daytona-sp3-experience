import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SoundEngine,
  ILLUSTRATIVE_SOUND_CREDITS,
  DEFAULT_SOUND_VOLUME,
  dataUriToArrayBuffer,
  type AudioContextLike,
  type AudioParamLike,
  type GainNodeLike,
  type BiquadFilterNodeLike,
  type AudioBufferSourceNodeLike,
  type AudioBufferLike,
  type SoundClipKey,
} from './soundEngine';
import { FREE_SOUND_PACK, SOUND_CREDITS } from './freeSoundPack';

interface ScheduledTask {
  id: number;
  runAtMs: number;
  fn: () => void;
  cancelled: boolean;
}

interface AutomationEvent {
  type: 'set' | 'linear';
  time: number;
  value: number;
}

/**
 * Models real Web Audio AudioParam automation:
 * - setValueAtTime(v, t) and linearRampToValueAtTime(v, t) append timeline events.
 * - Assigning `.value = x` behaves like Web Audio's intrinsic value setter
 *   (equivalent to setValueAtTime(x, currentTime), which would clobber an active ramp
 *   if called immediately after linearRampToValueAtTime).
 * - Reading `.value` evaluates the piecewise-linear automation timeline at currentTime.
 */
function createFakeAudioParam(
  initial: number,
  getCurrentTime: () => number,
): AudioParamLike {
  let intrinsicValue = initial;
  const events: AutomationEvent[] = [];

  function evaluateAt(time: number): number {
    if (events.length === 0) return intrinsicValue;
    let current = intrinsicValue;
    let prevEvent: AutomationEvent | null = null;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (time < ev.time) {
        if (ev.type === 'linear' && prevEvent) {
          const span = ev.time - prevEvent.time;
          if (span <= 1e-6) return ev.value;
          const alpha = Math.max(0, Math.min(1, (time - prevEvent.time) / span));
          return prevEvent.value + (ev.value - prevEvent.value) * alpha;
        }
        return current;
      }
      current = ev.value;
      prevEvent = ev;
    }
    return current;
  }

  return {
    get value(): number {
      return evaluateAt(getCurrentTime());
    },
    set value(v: number) {
      const now = getCurrentTime();
      intrinsicValue = v;
      events.push({ type: 'set', time: now, value: v });
    },
    setValueAtTime(v: number, startTime: number) {
      events.push({ type: 'set', time: startTime, value: v });
    },
    linearRampToValueAtTime(v: number, endTime: number) {
      events.push({ type: 'linear', time: endTime, value: v });
    },
    setTargetAtTime(v: number, startTime: number) {
      events.push({ type: 'set', time: startTime, value: v });
    },
    cancelScheduledValues(startTime: number) {
      const currentVal = evaluateAt(startTime);
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].time >= startTime) {
          events.splice(i, 1);
        }
      }
      intrinsicValue = currentVal;
    },
  };
}

function createTestHarness() {
  let currentMs = 1000;
  let nextTimerId = 1;
  const tasks: ScheduledTask[] = [];
  let contextCreatedCount = 0;
  let resumeCount = 0;
  let closeCount = 0;
  let packLoadedCount = 0;
  const decodedKeys: number[] = [];
  const createdGains: GainNodeLike[] = [];
  const createdFilters: BiquadFilterNodeLike[] = [];
  const createdSources: (AudioBufferSourceNodeLike & {
    started: boolean;
    stopped: boolean;
    disconnected: boolean;
  })[] = [];

  const visibilityListeners = new Set<() => void>();
  const fakeDoc = {
    hidden: false,
    addEventListener(type: string, listener: unknown) {
      if (type === 'visibilitychange' && typeof listener === 'function') {
        visibilityListeners.add(listener as () => void);
      }
    },
    removeEventListener(type: string, listener: unknown) {
      if (type === 'visibilitychange' && typeof listener === 'function') {
        visibilityListeners.delete(listener as () => void);
      }
    },
  };

  const getCurrentTime = () => fakeCtx.currentTime;

  const fakeCtx: AudioContextLike = {
    currentTime: 0,
    state: 'suspended',
    destination: {},
    async resume() {
      resumeCount += 1;
      this.state = 'running';
    },
    async close() {
      closeCount += 1;
      this.state = 'closed';
    },
    async decodeAudioData(ab: ArrayBuffer): Promise<AudioBufferLike> {
      decodedKeys.push(ab.byteLength);
      return { duration: 1.6 };
    },
    createGain(): GainNodeLike {
      const g: GainNodeLike = {
        gain: createFakeAudioParam(1, getCurrentTime),
        connect() {
          return {};
        },
        disconnect() {},
      };
      createdGains.push(g);
      return g;
    },
    createBiquadFilter(): BiquadFilterNodeLike {
      const f: BiquadFilterNodeLike = {
        type: 'lowpass',
        frequency: createFakeAudioParam(7600, getCurrentTime),
        Q: createFakeAudioParam(0.7, getCurrentTime),
        gain: createFakeAudioParam(0, getCurrentTime),
        connect() {
          return {};
        },
        disconnect() {},
      };
      createdFilters.push(f);
      return f;
    },
    createBufferSource() {
      const src = {
        buffer: null as AudioBufferLike | null,
        loop: false,
        playbackRate: createFakeAudioParam(1.0, getCurrentTime),
        onended: null as (() => void) | null,
        started: false,
        stopped: false,
        disconnected: false,
        connect() {
          return {};
        },
        disconnect() {
          this.disconnected = true;
        },
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        },
      };
      createdSources.push(src);
      return src;
    },
  };

  const scheduleTimeout = (fn: () => void, ms: number) => {
    const id = nextTimerId++;
    tasks.push({ id, runAtMs: currentMs + ms, fn, cancelled: false });
    return id as unknown as ReturnType<typeof setTimeout>;
  };

  const clearScheduledTimeout = (id: ReturnType<typeof setTimeout>) => {
    const numId = id as unknown as number;
    const task = tasks.find((t) => t.id === numId);
    if (task) task.cancelled = true;
  };

  const advanceTime = (deltaMs: number) => {
    const targetMs = currentMs + deltaMs;
    while (true) {
      const ready = tasks
        .filter((t) => !t.cancelled && t.runAtMs <= targetMs)
        .sort((a, b) => a.runAtMs - b.runAtMs);
      if (ready.length === 0) break;
      const next = ready[0];
      const stepMs = next.runAtMs - currentMs;
      if (stepMs > 0) {
        currentMs = next.runAtMs;
        fakeCtx.currentTime += stepMs / 1000;
      }
      next.cancelled = true;
      next.fn();
    }
    const remainingMs = targetMs - currentMs;
    if (remainingMs > 0) {
      currentMs = targetMs;
      fakeCtx.currentTime += remainingMs / 1000;
    }
  };

  const fakePack: Record<SoundClipKey, string> = {
    start: 'data:audio/mpeg;base64,SUQzBAAAAAA=',
    idle: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    rev: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    panelOpen: 'data:audio/mpeg;base64,SUQzBAAAAAA=',
    panelClose: 'data:audio/mpeg;base64,SUQzBAAAAAA=',
  };

  const engine = new SoundEngine({
    createAudioContext: () => {
      contextCreatedCount += 1;
      return fakeCtx;
    },
    loadSoundPack: async () => {
      packLoadedCount += 1;
      return {
        FREE_SOUND_PACK: fakePack,
        SOUND_CREDITS,
      };
    },
    scheduleTimeout,
    clearScheduledTimeout,
    nowMs: () => currentMs,
    doc: fakeDoc,
  });

  return {
    engine,
    fakeCtx,
    fakeDoc,
    visibilityListeners,
    advanceTime,
    getStats: () => ({
      contextCreatedCount,
      resumeCount,
      closeCount,
      packLoadedCount,
      decodedCount: decodedKeys.length,
      activeTasks: tasks.filter((t) => !t.cancelled).length,
      createdGains,
      createdFilters,
      createdSources,
    }),
  };
}

test('Opt-in only: no AudioContext or audio pack loading occurs before explicit enable()', () => {
  const { engine, getStats } = createTestHarness();
  const state = engine.getState();

  assert.equal(state.enabled, false);
  assert.equal(state.loadState, 'idle');
  assert.equal(state.engineState, 'stopped');
  assert.equal(state.volume, DEFAULT_SOUND_VOLUME);
  assert.equal(getStats().contextCreatedCount, 0);
  assert.equal(getStats().packLoadedCount, 0);

  // Calling playback methods while disabled must be a safe no-op
  assert.equal(engine.startEngine(), false);
  assert.equal(engine.revEngine(), false);
  assert.equal(engine.playPanelFoley('open'), false);
  assert.equal(engine.playLightRelayClick(), false);
  assert.equal(getStats().contextCreatedCount, 0);
  engine.dispose();
});

test('SOUND_CREDITS and FREE_SOUND_PACK integrity: credits match and WAV/MP3 data URIs decode cleanly', () => {
  assert.equal(ILLUSTRATIVE_SOUND_CREDITS.length, 2);
  assert.equal(SOUND_CREDITS.length, 2);
  assert.deepEqual(ILLUSTRATIVE_SOUND_CREDITS, SOUND_CREDITS, 'Credits shown before opt-in must exactly match loaded pack metadata');
  assert.ok(
    ILLUSTRATIVE_SOUND_CREDITS[0].changes.includes('12.20–19.37 s'),
    'Credits must document the original stationary rev passage',
  );

  for (const key of ['start', 'panelOpen', 'panelClose'] as const) {
    const uri = FREE_SOUND_PACK[key];
    assert.ok(
      uri.startsWith('data:audio/mpeg;base64,'),
      `${key} must be a base64 MP3 data URI`,
    );
    const ab = dataUriToArrayBuffer(uri);
    assert.ok(ab.byteLength > 1000, `${key} decoded buffer should be non-trivial`);
  }

  for (const key of ['idle', 'rev'] as const) {
    const uri = FREE_SOUND_PACK[key];
    assert.ok(
      uri.startsWith('data:audio/wav;base64,') ||
        uri.startsWith('data:audio/mpeg;base64,'),
      `${key} must be a base64 WAV (or MP3) data URI`,
    );
    const ab = dataUriToArrayBuffer(uri);
    assert.ok(ab.byteLength > 1000, `${key} decoded buffer should be non-trivial`);
  }
});

test('Rev asset preserves a full recorded passage and natural dynamics instead of a frozen sub-second sustain', () => {
  const wav = Buffer.from(dataUriToArrayBuffer(FREE_SOUND_PACK.rev));
  assert.equal(wav.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(wav.subarray(8, 12).toString('ascii'), 'WAVE');
  let byteRate = 0;
  let samples: Buffer | null = null;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const id = wav.subarray(offset, offset + 4).toString('ascii');
    const size = wav.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      assert.equal(wav.readUInt16LE(offset + 8), 1, 'Lossless PCM');
      assert.equal(wav.readUInt16LE(offset + 10), 2, 'Original stereo');
      assert.equal(wav.readUInt32LE(offset + 12), 48000);
      assert.equal(wav.readUInt16LE(offset + 22), 16);
      byteRate = wav.readUInt32LE(offset + 16);
    }
    if (id === 'data') samples = wav.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  assert.ok(samples && byteRate, 'Valid PCM data and format chunks');
  assert.ok(samples.length / byteRate >= 6, 'Keep complete recorded revs; do not freeze a sub-second high note');
  const levels: number[] = [];
  const windowBytes = Math.round(byteRate * 0.2);
  for (let offset = windowBytes; offset + windowBytes < samples.length; offset += windowBytes) {
    let energy = 0;
    for (let i = offset; i < offset + windowBytes; i += 2) {
      const value = samples.readInt16LE(i) / 32768;
      energy += value * value;
    }
    levels.push(Math.sqrt(energy / (windowBytes / 2)));
  }
  assert.ok(Math.min(...levels) > 0, 'The passage must not contain silent holes');
  assert.ok(Math.max(...levels) / Math.min(...levels) > 2, 'Preserve the original rev dynamics instead of rapid automatic levelling');
});

test('enable() synchronously creates and resumes AudioContext in user gesture, then decodes all 5 clips', async () => {
  const { engine, getStats } = createTestHarness();

  const promise = engine.enable();
  // Synchronous check before promise resolves
  assert.equal(getStats().contextCreatedCount, 1);
  assert.equal(getStats().resumeCount, 1);
  assert.equal(engine.getState().enabled, true);
  assert.equal(engine.getState().loadState, 'loading');

  const ok = await promise;
  assert.equal(ok, true);
  assert.equal(engine.getState().loadState, 'ready');
  assert.equal(getStats().packLoadedCount, 1);
  assert.equal(getStats().decodedCount, 5);
  engine.dispose();
});

test('startEngine() plays startup once then native-loops running idle at matched 1.0 gain beyond 60s until Stop', async () => {
  const { engine, advanceTime, getStats } = createTestHarness();
  await engine.enable();

  const started = engine.startEngine();
  assert.equal(started, true);
  assert.equal(engine.getState().engineState, 'starting');
  assert.equal(getStats().createdSources.length, 1);

  const startSrc = getStats().createdSources[0];
  const startVoiceGain = getStats().createdGains[3]; // [0]=master, [1]=idleDuck, [2]=foley, [3]=startVoice
  assert.equal(startSrc.loop, false, 'Startup clip must play once (loop = false)');
  assert.equal(startSrc.playbackRate.value, 1.0);

  // 100ms into startup: gain has reached unity 1.0
  advanceTime(100);
  assert.ok(
    Math.abs(startVoiceGain.gain.value - 1.0) < 1e-4,
    `Expected startup gain 1.0, got ${startVoiceGain.gain.value}`,
  );

  // Advance past startup crossfade point (duration 1.6s, crossfade 0.24s -> 1360ms) + crossfade completion
  advanceTime(1600);
  assert.equal(engine.getState().engineState, 'idling');
  assert.equal(
    getStats().createdSources.length,
    2,
    'Exactly 1 startup source + 1 native loop idle source must be created',
  );

  const idleSrc = getStats().createdSources[1];
  const idleVoiceGain = getStats().createdGains[4];
  assert.equal(idleSrc.loop, true, 'Running engine must use native AudioBufferSource loop = true');
  assert.equal(idleSrc.stopped, false, 'Native running loop must not schedule a finite stop');
  assert.ok(
    Math.abs(idleVoiceGain.gain.value - 1.0) < 1e-4,
    `Running loop gain must match startup at 1.0, got ${idleVoiceGain.gain.value}`,
  );
  assert.equal(engine.getState().activeVoiceCount, 1);

  // Sustain beyond 60 seconds (advance 65,000 ms): no extra sources or fade dips!
  advanceTime(65_000);
  assert.equal(engine.getState().engineState, 'idling');
  assert.equal(engine.getState().activeVoiceCount, 1);
  assert.equal(
    getStats().createdSources.length,
    2,
    'Native loop must sustain >60s without spawning repeating JS grains',
  );
  assert.equal(idleSrc.stopped, false);
  assert.ok(
    Math.abs(idleVoiceGain.gain.value - 1.0) < 1e-4,
    'Running loop gain must remain steady at 1.0 beyond 60s',
  );

  // Stop engine ends loop cleanly
  engine.stopEngine();
  assert.equal(engine.getState().engineState, 'stopped');
  assert.equal(engine.getState().activeVoiceCount, 0);
  engine.dispose();
});

test('stopEngine() during startup cancels pending crossfade so idle never starts', async () => {
  const { engine, advanceTime, getStats } = createTestHarness();
  await engine.enable();

  assert.equal(engine.startEngine(), true);
  assert.equal(engine.getState().engineState, 'starting');

  // Stop mid-startup before crossfade timer fires
  advanceTime(300);
  engine.stopEngine();
  assert.equal(engine.getState().engineState, 'stopped');

  const sourcesAfterStop = getStats().createdSources.length;
  // Advance well past original startup duration
  advanceTime(5000);
  assert.equal(engine.getState().engineState, 'stopped');
  assert.equal(
    getStats().createdSources.length,
    sourcesAfterStop,
    'No idle loop should be spawned after stopEngine()',
  );
  engine.dispose();
});

test('revEngine() repeats recorded revs beyond 60s until Stop; Start/Rev switches crossfade smoothly without starter re-crank or stacked voices', async () => {
  const { engine, advanceTime, getStats } = createTestHarness();
  await engine.enable();

  // 1. Start engine and reach continuous idle loop
  assert.equal(engine.startEngine(), true);
  advanceTime(1700);
  assert.equal(engine.getState().engineState, 'idling');
  assert.equal(engine.getState().activeVoiceCount, 1);
  assert.equal(getStats().createdSources.length, 2); // [0]=start, [1]=idle

  // 2. Switch to Rev: smoothly crossfades into native rev loop (loop = true, gain 1.0)
  assert.equal(engine.revEngine(), true);
  assert.equal(engine.getState().engineState, 'revving');
  assert.equal(engine.getState().activeVoiceCount, 1);
  assert.equal(getStats().createdSources.length, 3); // [2]=rev
  const revSrc = getStats().createdSources[2];
  const revGain = getStats().createdGains[5];
  assert.equal(revSrc.loop, true, 'Rev must use native AudioBufferSource loop = true');
  assert.equal(revSrc.stopped, false, 'Rev loop must not have a finite duration cap');

  // Mid-crossfade (+50ms of 180ms): rev gain is smoothly ramping up (not jumped)
  advanceTime(50);
  assert.ok(
    revGain.gain.value > 0.15 && revGain.gain.value < 0.9,
    `Expected smooth crossfade ramp on rev gain at +50ms, got ${revGain.gain.value}`,
  );

  // Sustain Rev beyond 60 seconds (+65,000 ms): must stay in 'revving' indefinitely until Stop
  advanceTime(65_000);
  assert.equal(
    engine.getState().engineState,
    'revving',
    'Rev must hold indefinitely beyond 60s and never auto-return to idle',
  );
  assert.equal(engine.getState().activeVoiceCount, 1);
  assert.equal(getStats().createdSources.length, 3);
  assert.ok(Math.abs(revGain.gain.value - 1.0) < 1e-4);

  // 3. Switch from Rev back to Start engine (running): must crossfade directly to 'idling'
  //    WITHOUT playing starter cranking ('starting')
  assert.equal(engine.startEngine(), true);
  assert.equal(
    engine.getState().engineState,
    'idling',
    'Switching from Rev to Start engine must transition directly to idling without starter cranking',
  );
  assert.equal(engine.getState().activeVoiceCount, 1);
  assert.equal(getStats().createdSources.length, 4); // [3]=new idle loop (no start clip!)
  assert.equal(getStats().createdSources[3].loop, true);

  // 4. Repeated Start <-> Rev switching keeps voices bounded to 1
  advanceTime(250);
  assert.equal(engine.revEngine(), true);
  assert.equal(engine.getState().engineState, 'revving');
  assert.equal(engine.getState().activeVoiceCount, 1);

  advanceTime(250);
  assert.equal(engine.startEngine(), true);
  assert.equal(engine.getState().engineState, 'idling');
  assert.equal(engine.getState().activeVoiceCount, 1);

  advanceTime(250);
  assert.equal(engine.revEngine(), true);
  assert.equal(engine.getState().engineState, 'revving');
  assert.equal(engine.getState().activeVoiceCount, 1);

  // 5. Mute during sustained rev stops all voices; unmuting never resurrects stopped engine
  engine.setMuted(true);
  assert.equal(engine.getState().muted, true);
  assert.equal(engine.getState().engineState, 'stopped');
  assert.equal(engine.getState().activeVoiceCount, 0);

  advanceTime(65_000);
  assert.equal(engine.getState().engineState, 'stopped');

  engine.setMuted(false);
  assert.equal(engine.getState().muted, false);
  assert.equal(engine.getState().engineState, 'stopped');
  assert.equal(engine.getState().activeVoiceCount, 0);
  engine.dispose();
});

test('Debounces rapid clicks, caps foley voices, ramps cockpit/cover acoustics smoothly, and clears fade cleanup timers on dispose', async () => {
  const { engine, fakeDoc, visibilityListeners, advanceTime, getStats } =
    createTestHarness();
  await engine.enable();

  // Rapid repeated rev clicks within debounce window only spawn 1 rev
  assert.equal(engine.revEngine(), true);
  assert.equal(engine.revEngine(), false);
  assert.equal(engine.revEngine(), false);

  // Rapid panel foley clicks within debounce window
  assert.equal(engine.playPanelFoley('open'), true);
  assert.equal(engine.playPanelFoley('open'), false);
  assert.equal(engine.playPanelFoley('close'), true);

  // Advance past foley debounce and test voice cap (MAX_FOLEY_VOICES = 3)
  advanceTime(120);
  assert.equal(engine.playPanelFoley('open'), true);
  advanceTime(120);
  assert.equal(engine.playPanelFoley('close'), true);
  advanceTime(120);
  assert.equal(engine.playPanelFoley('open'), true);

  // Check cockpit and rear engine cover acoustic filtering over 140ms ramp
  const engineFilter = getStats().createdFilters[0];
  const presenceFilter = getStats().createdFilters[1];
  engine.setAcoustics({ cockpit: true, rearCoverOpen: false });
  // Mid-ramp (+70ms of 140ms): frequency is halfway between 7600 and 1350
  advanceTime(70);
  assert.ok(
    engineFilter.frequency.value > 3000 && engineFilter.frequency.value < 6000,
    `Expected mid-ramp filter frequency, got ${engineFilter.frequency.value}`,
  );
  // End of ramp (+80ms): reaches target 1350 Hz and -3.0 dB
  advanceTime(80);
  assert.ok(Math.abs(engineFilter.frequency.value - 1350) < 1e-3);
  assert.ok(Math.abs(presenceFilter.gain.value - -3.0) < 1e-3);

  engine.setAcoustics({ cockpit: false, rearCoverOpen: true });
  advanceTime(150);
  assert.ok(Math.abs(engineFilter.frequency.value - 13000) < 1e-3);
  assert.ok(Math.abs(presenceFilter.gain.value - 3.5) < 1e-3);

  // Document visibility hidden triggers fadeAndStopVoice (which schedules fade cleanup timers)
  fakeDoc.hidden = true;
  for (const listener of visibilityListeners) {
    listener();
  }
  assert.equal(engine.getState().engineState, 'stopped');
  assert.ok(
    getStats().activeTasks > 0,
    'Fade cleanup timers should be pending before dispose()',
  );

  // Dispose must clear all engine timers AND fade cleanup timers even after voices were removed from active sets
  engine.dispose();
  assert.equal(
    getStats().activeTasks,
    0,
    'dispose() must cancel all pending timers including fadeAndStopVoice cleanup timers',
  );
  assert.equal(getStats().closeCount, 1);
  assert.equal(visibilityListeners.size, 0);
});
