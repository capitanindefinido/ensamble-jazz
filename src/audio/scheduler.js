/**
 * Scheduler lookahead sobre AudioContext.currentTime
 * ("A Tale of Two Clocks"). setInterval solo despierta; el reloj es el de audio.
 * Compartido por Metronome y ChartPlayer — no duplicar esta lógica.
 */

export const LOOKAHEAD_MS = 25;
export const SCHEDULE_AHEAD_SEC = 0.1;

let sharedCtx = null;

export function getSharedAudioContext() {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

export async function resumeAudioContext() {
  const ctx = getSharedAudioContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") await ctx.resume();
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
   * Se llama en cada tick; debe agendar eventos con t < now + scheduleAheadSec
   * y avanzar su propio cursor.
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

/** Click de metrónomo / player. */
export function playClick(ctx, time, isDownbeat) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.setValueAtTime(isDownbeat ? 1000 : 800, time);
  osc.type = "square";

  const peak = isDownbeat ? 0.22 : 0.11;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

  osc.start(time);
  osc.stop(time + 0.05);
}
