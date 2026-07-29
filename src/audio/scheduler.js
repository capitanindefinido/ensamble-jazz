/**
 * Scheduler lookahead sobre AudioContext.currentTime
 * ("A Tale of Two Clocks"). setInterval solo despierta; el reloj es el de audio.
 * Compartido por Metronome y ChartPlayer — no duplicar esta lógica.
 */

export const LOOKAHEAD_MS = 25;
export const SCHEDULE_AHEAD_SEC = 0.1;

/** Defaults de mezcla: click más bajo, armonía más presente. */
export const DEFAULT_CLICK_VOLUME = 0.4;
export const DEFAULT_HARMONY_VOLUME = 0.9;

let sharedCtx = null;
let clickBus = null;
let harmonyBus = null;
let clickVolume = DEFAULT_CLICK_VOLUME;
let harmonyVolume = DEFAULT_HARMONY_VOLUME;

export function getSharedAudioContext() {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

function ensureBuses(ctx) {
  if (!ctx) return;
  if (!clickBus || clickBus.context !== ctx) {
    clickBus = ctx.createGain();
    clickBus.gain.value = clickVolume;
    clickBus.connect(ctx.destination);
  }
  if (!harmonyBus || harmonyBus.context !== ctx) {
    harmonyBus = ctx.createGain();
    harmonyBus.gain.value = harmonyVolume;
    harmonyBus.connect(ctx.destination);
  }
}

/** Bus de clicks (metrónomo + player). */
export function getClickBus(ctx) {
  ensureBuses(ctx);
  return clickBus;
}

/** Bus de bajo/voicing. */
export function getHarmonyBus(ctx) {
  ensureBuses(ctx);
  return harmonyBus;
}

/** @param {number} v 0..1 */
export function setClickVolume(v) {
  clickVolume = Math.max(0, Math.min(1, Number(v) || 0));
  if (clickBus) clickBus.gain.value = clickVolume;
}

/** @param {number} v 0..1 */
export function setHarmonyVolume(v) {
  harmonyVolume = Math.max(0, Math.min(1, Number(v) || 0));
  if (harmonyBus) harmonyBus.gain.value = harmonyVolume;
}

export function getClickVolume() {
  return clickVolume;
}

export function getHarmonyVolume() {
  return harmonyVolume;
}

export async function resumeAudioContext() {
  const ctx = getSharedAudioContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}

/**
 * Desbloquea audio en iOS/Android: resume + buffer silencioso de 1 sample
 * en el mismo gesto del usuario. Idempotente y seguro sin `window` (tests).
 */
export async function unlockAudio() {
  const ctx = await resumeAudioContext();
  if (!ctx) return null;
  ensureBuses(ctx);
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // Algunos entornos de test no implementan createBuffer; el resume basta.
  }
  return ctx;
}

export class LookaheadScheduler {
  constructor({
    lookaheadMs = LOOKAHEAD_MS,
    scheduleAheadSec = SCHEDULE_AHEAD_SEC,
  } = {}) {
    this.lookaheadMs = lookaheadMs;
    this.scheduleAheadSec = scheduleAheadSec;
    this._timer = null;
    this._visualTimers = [];
    this._running = false;
    this._scheduleFn = null;
  }

  get running() {
    return this._running;
  }

  /**
   * @param {(api: {
   *   ctx: AudioContext,
   *   now: number,
   *   scheduleAheadSec: number,
   *   scheduleVisual: (when: number, fn: () => void) => void
   * }) => void} scheduleFn
   */
  start(scheduleFn) {
    this.stop();
    this._scheduleFn = scheduleFn;
    this._running = true;

    const tick = () => {
      if (!this._running || !this._scheduleFn) return;
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      this._scheduleFn({
        ctx,
        now: ctx.currentTime,
        scheduleAheadSec: this.scheduleAheadSec,
        scheduleVisual: (when, fn) => this.scheduleVisual(when, fn),
      });
    };

    tick();
    this._timer = window.setInterval(tick, this.lookaheadMs);
  }

  scheduleVisual(when, fn) {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const delayMs = Math.max(0, (when - ctx.currentTime) * 1000);
    const tid = window.setTimeout(() => {
      try {
        fn();
      } finally {
        this._visualTimers = this._visualTimers.filter((id) => id !== tid);
      }
    }, delayMs);
    this._visualTimers.push(tid);
  }

  stop() {
    this._running = false;
    this._scheduleFn = null;
    if (this._timer != null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._visualTimers.forEach(clearTimeout);
    this._visualTimers = [];
  }
}

/** Click de metrónomo / player → bus de click. */
export function playClick(ctx, time, isDownbeat) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(getClickBus(ctx));

  osc.frequency.setValueAtTime(isDownbeat ? 1000 : 800, time);
  osc.type = "square";

  const peak = isDownbeat ? 0.22 : 0.11;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

  osc.start(time);
  osc.stop(time + 0.05);
}
