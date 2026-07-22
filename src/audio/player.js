/**
 * Player del chart: click + bajo caminando (+ voicing 3ra/7ma).
 * Timing vía LookaheadScheduler — nunca setInterval para el tempo.
 */

import { pitchClass } from "../chart/transpose.js";
import {
  LookaheadScheduler,
  playClick,
  unlockAudio,
} from "./scheduler.js";

/** Intervalos (semitonos desde la raíz) por calidad del parser. */
export const QUALITY_INTERVALS = {
  maj: { third: 4, fifth: 7, seventh: 11 },
  min: { third: 3, fifth: 7, seventh: 10 },
  dom: { third: 4, fifth: 7, seventh: 10 },
  halfdim: { third: 3, fifth: 6, seventh: 10 },
  dim: { third: 3, fifth: 6, seventh: 9 },
  aug: { third: 4, fifth: 8, seventh: 11 },
  sus: { third: 5, fifth: 7, seventh: 10 },
};

const BASS_OCTAVE = 2;
const VOICE_OCTAVE = 4;

export function flattenMeasures(ast) {
  if (!ast?.sections?.length) return [];
  const out = [];
  for (const sec of ast.sections) {
    for (const m of sec.measures) out.push(m);
  }
  return out;
}

export function beatsPerMeasure(ast) {
  return ast?.timeSig?.num || 4;
}

export function midiFromPitch(pitch, octave = 3) {
  const pc = pitchClass(pitch);
  if (pc == null) return null;
  // C4 = 60 → (octave + 1) * 12 + pc
  return (octave + 1) * 12 + pc;
}

export function freqFromMidi(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function chordTones(chord) {
  if (!chord?.root) return null;
  const iv = QUALITY_INTERVALS[chord.quality] || QUALITY_INTERVALS.dom;
  const rootPc = pitchClass(chord.root);
  if (rootPc == null) return null;
  // Bajo usa el bajo slash si existe
  const bassPitch = chord.bass || chord.root;
  const bassPc = pitchClass(bassPitch);
  return {
    rootPc,
    bassPc: bassPc ?? rootPc,
    thirdPc: (rootPc + iv.third) % 12,
    fifthPc: (rootPc + iv.fifth) % 12,
    seventhPc: (rootPc + iv.seventh) % 12,
  };
}

/**
 * Asigna un acorde a cada beat del compás.
 * 1 acorde → todos los beats; 2 → mitad y mitad; N → repartidos.
 */
export function chordsForBeats(measure, beats) {
  const chords = (measure?.chords || []).filter(Boolean);
  if (!chords.length) return Array.from({ length: beats }, () => null);
  if (chords.length === 1) {
    return Array.from({ length: beats }, () => chords[0]);
  }
  return Array.from({ length: beats }, (_, i) => {
    const idx = Math.min(
      chords.length - 1,
      Math.floor((i * chords.length) / beats)
    );
    return chords[idx];
  });
}

/** Notas de bajo por beat: fund–5ta–fund–5ta (relativo al acorde del beat). */
export function bassMidiForBeat(chord, beatInBar) {
  const tones = chordTones(chord);
  if (!tones) return null;
  const useFifth = beatInBar % 2 === 1;
  const pc = useFifth ? tones.fifthPc : tones.bassPc;
  return (BASS_OCTAVE + 1) * 12 + pc;
}

export function voicingMidis(chord) {
  const tones = chordTones(chord);
  if (!tones) return null;
  return {
    third: (VOICE_OCTAVE + 1) * 12 + tones.thirdPc,
    seventh: (VOICE_OCTAVE + 1) * 12 + tones.seventhPc,
  };
}

function playTone(ctx, time, freq, { duration = 0.18, peak = 0.12, type = "triangle" } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function playBass(ctx, time, midi) {
  if (midi == null) return;
  playTone(ctx, time, freqFromMidi(midi), {
    duration: 0.28,
    peak: 0.16,
    type: "sine",
  });
}

function playVoicing(ctx, time, chord) {
  const v = voicingMidis(chord);
  if (!v) return;
  // Bien por debajo del bajo
  playTone(ctx, time, freqFromMidi(v.third), {
    duration: 0.35,
    peak: 0.035,
    type: "triangle",
  });
  playTone(ctx, time, freqFromMidi(v.seventh), {
    duration: 0.35,
    peak: 0.028,
    type: "triangle",
  });
}

/** Intervalo exacto entre negras. El feel no lo modifica (el swing es de corcheas). */
export function secondsPerBeat(bpm) {
  return 60.0 / Number(bpm);
}

/** Índice de partida acotado al largo del form. */
export function clampFromMeasure(fromMeasure, length) {
  if (!length || length < 1) return 0;
  if (fromMeasure == null || !Number.isFinite(Number(fromMeasure))) return 0;
  return Math.max(0, Math.min(length - 1, Math.floor(Number(fromMeasure))));
}

/**
 * Tiempos absolutos de las negras de un compás desde `startTime`.
 * `feel` se acepta y se ignora a propósito: las negras van derechas
 * independientemente del feel (regresión vs. “empujoncito” de swing).
 */
export function measureBeatTimes(bpm, beats = 4, feel = "", startTime = 0) {
  void feel;
  const spb = secondsPerBeat(bpm);
  return Array.from({ length: beats }, (_, i) => startTime + i * spb);
}

/**
 * @typedef {{
 *   onMeasure?: (index: number|null) => void,
 *   onPlayingChange?: (playing: boolean) => void,
 * }} ChartPlayerOpts
 */
export class ChartPlayer {
  constructor(opts = {}) {
    this.onMeasure = opts.onMeasure || (() => {});
    this.onPlayingChange = opts.onPlayingChange || (() => {});
    this.scheduler = new LookaheadScheduler();
    this._ast = null;
    this._bpm = 120;
    this._cursor = null; // { phase, measureIdx, beat, nextTime, beats, measures, startMeasureIdx }
    this._pausedAt = null;
    this._playing = false;
  }

  get playing() {
    return this._playing;
  }

  /** True si pause() guardó cursor (Play sin fromMeasure retoma). */
  get paused() {
    return this._pausedAt != null;
  }

  setAst(ast) {
    this._ast = ast;
  }

  setBpm(bpm) {
    const n = Number(bpm);
    if (Number.isFinite(n) && n > 0) this._bpm = n;
  }

  /**
   * @param {{ fromMeasure?: number }} [opts]
   * fromMeasure: índice global del compás tras la cuenta de entrada.
   * Si hay pausa y no se pasa fromMeasure, retoma sin cuenta.
   */
  async play(opts = {}) {
    if (!this._ast) return;
    const measures = flattenMeasures(this._ast);
    if (!measures.length) return;

    const ctx = await unlockAudio();
    if (!ctx) return;

    const beats = beatsPerMeasure(this._ast);
    const hasFrom =
      opts.fromMeasure != null && Number.isFinite(Number(opts.fromMeasure));
    const startMeasureIdx = hasFrom
      ? clampFromMeasure(opts.fromMeasure, measures.length)
      : 0;

    // Retomar desde pausa (solo si no pedimos un fromMeasure explícito)
    if (this._pausedAt && !hasFrom) {
      const saved = this._pausedAt;
      this._pausedAt = null;
      this.scheduler.stop();
      this._cursor = {
        phase: saved.phase === "countin" ? "play" : saved.phase,
        measureIdx: saved.measureIdx,
        beat: saved.beat,
        nextTime: ctx.currentTime + 0.05,
        beats,
        measures,
        startMeasureIdx: saved.startMeasureIdx ?? 0,
      };
      if (saved.phase === "countin") {
        this._cursor.phase = "play";
        this._cursor.measureIdx = this._cursor.startMeasureIdx;
        this._cursor.beat = 0;
      }
      this._playing = true;
      this.onPlayingChange(true);
      this.scheduler.start((api) => this._schedule(api));
      return;
    }

    this.stop({ silent: true });

    this._cursor = {
      phase: "countin",
      measureIdx: 0,
      beat: 0,
      nextTime: ctx.currentTime + 0.06,
      beats,
      measures,
      startMeasureIdx,
    };
    this._playing = true;
    this.onPlayingChange(true);
    this.onMeasure(null);

    this.scheduler.start((api) => this._schedule(api));
  }

  /** Para y vuelve a tocar desde el compás 0 con cuenta. */
  async restart() {
    this.stop({ silent: true });
    await this.play({ fromMeasure: 0 });
  }

  pause() {
    if (!this._playing || !this._cursor) {
      this.stop();
      return;
    }
    this._pausedAt = {
      phase: this._cursor.phase,
      measureIdx: this._cursor.measureIdx,
      beat: this._cursor.beat,
      startMeasureIdx: this._cursor.startMeasureIdx ?? 0,
    };
    this.scheduler.stop();
    this._cursor = null;
    this._playing = false;
    this.onPlayingChange(false);
    // Mantiene el último onMeasure (compás resaltado)
  }

  stop({ silent = false } = {}) {
    this.scheduler.stop();
    this._cursor = null;
    this._pausedAt = null;
    const was = this._playing;
    this._playing = false;
    this.onMeasure(null);
    if (was || !silent) this.onPlayingChange(false);
  }

  dispose() {
    this.stop({ silent: true });
  }

  _schedule({ ctx, now, scheduleAheadSec, scheduleVisual }) {
    const cur = this._cursor;
    if (!cur) return;

    const spb = secondsPerBeat(this._bpm);
    const { beats, measures } = cur;

    while (cur.nextTime < now + scheduleAheadSec) {
      const when = cur.nextTime;
      const isDownbeat = cur.beat === 0;

      if (cur.phase === "countin") {
        playClick(ctx, when, isDownbeat);
        if (isDownbeat) {
          scheduleVisual(when, () => this.onMeasure(null));
        }

        cur.beat += 1;
        if (cur.beat >= beats) {
          cur.phase = "play";
          cur.beat = 0;
          cur.measureIdx = cur.startMeasureIdx ?? 0;
        }
      } else {
        const measure = measures[cur.measureIdx];
        const measureIndex = measure?.index ?? cur.measureIdx;
        const perBeat = chordsForBeats(measure, beats);
        const chord = perBeat[cur.beat];

        playClick(ctx, when, isDownbeat);

        if (chord && !measure?.invalid) {
          playBass(ctx, when, bassMidiForBeat(chord, cur.beat));
          if (cur.beat === 0 || cur.beat === 2) {
            playVoicing(ctx, when, chord);
          }
        }

        if (isDownbeat) {
          const idx = measureIndex;
          scheduleVisual(when, () => this.onMeasure(idx));
        }

        cur.beat += 1;
        if (cur.beat >= beats) {
          cur.beat = 0;
          cur.measureIdx = (cur.measureIdx + 1) % measures.length;
        }
      }

      cur.nextTime += spb;
    }
  }
}
