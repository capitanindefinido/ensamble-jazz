/**
 * Audición de escalas (notas en orden) para el panel Ayuda.
 */

import { parsePitch } from "../chart/parse.js";
import { pitchClass } from "../chart/transpose.js";
import {
  getHarmonyBus,
  getSharedAudioContext,
  unlockAudio,
} from "./scheduler.js";

const NOTE_MS = 200;
const OCTAVE = 4;

let stopTimer = null;
let playingId = null;
let onEndCb = null;

export function noteNameToMidi(name, octave = OCTAVE) {
  const pitch = parsePitch(String(name || "").trim());
  if (!pitch) return null;
  const pc = pitchClass(pitch);
  if (pc == null) return null;
  return (octave + 1) * 12 + pc;
}

/** Midis ascendentes en una octava (sube octava si baja). */
export function scaleNotesToMidis(noteNames, octave = OCTAVE) {
  const midis = [];
  let prev = null;
  for (const name of noteNames || []) {
    let midi = noteNameToMidi(name, octave);
    if (midi == null) continue;
    if (prev != null) {
      while (midi <= prev) midi += 12;
    }
    midis.push(midi);
    prev = midi;
  }
  return midis;
}

function freqFromMidi(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playTone(ctx, time, freq, duration = 0.22, peak = 0.1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, time);
  osc.connect(gain);
  gain.connect(getHarmonyBus(ctx));
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

export function stopAudition() {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  playingId = null;
  if (onEndCb) {
    const cb = onEndCb;
    onEndCb = null;
    cb();
  }
}

export function isAuditionPlaying(id) {
  return playingId != null && (!id || playingId === id);
}

/**
 * @param {string[]} noteNames
 * @param {{ id?: string, msPerNote?: number, onEnd?: () => void }} [opts]
 */
export async function playScaleNotes(noteNames, opts = {}) {
  stopAudition();
  const midis = scaleNotesToMidis(noteNames);
  if (!midis.length) return { ok: false, count: 0 };

  await unlockAudio();
  const ctx = getSharedAudioContext();
  if (!ctx) return { ok: false, count: 0 };
  if (ctx.state === "suspended") await ctx.resume();

  const ms = opts.msPerNote || NOTE_MS;
  const id = opts.id || `scale-${Date.now()}`;
  playingId = id;
  onEndCb = typeof opts.onEnd === "function" ? opts.onEnd : null;

  const t0 = ctx.currentTime + 0.05;
  midis.forEach((midi, i) => {
    playTone(ctx, t0 + (i * ms) / 1000, freqFromMidi(midi));
  });

  const totalMs = midis.length * ms + 80;
  stopTimer = setTimeout(() => {
    stopTimer = null;
    playingId = null;
    if (onEndCb) {
      const cb = onEndCb;
      onEndCb = null;
      cb();
    }
  }, totalMs);

  return { ok: true, count: midis.length, id };
}
