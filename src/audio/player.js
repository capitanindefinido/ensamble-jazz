/**
 * Player del chart: click + bajo caminando (+ voicing 3ra/7ma).
 * Timing vía LookaheadScheduler — nunca setInterval para el tempo.
 */

import { playbackTimeline } from "../chart/form.js";
import { pitchClass } from "../chart/transpose.js";
import {
  LookaheadScheduler,
  playClick,
  unlockAudio,
  getHarmonyBus,
} from "./scheduler.js";

export { flattenMeasures } from "../chart/form.js";

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

/** Notas de bajo por beat: fund–5ta–fund–5ta; con ≥3 acordes, siempre la fundamental. */
export function bassMidiForBeat(chord, beatInBar, chordCount = 1) {
  const tones = chordTones(chord);
  if (!tones) return null;
  const useFifth = chordCount < 3 && beatInBar % 2 === 1;
  const pc = useFifth ? tones.fifthPc : tones.bassPc;
  return (BASS_OCTAVE + 1) * 12 + pc;
}

/**
 * Voicing close: 3ra + 7ma + 9na (o 5ta si no hay 7 útil), en registro medio.
 * Evita saltos raros ordenando midis ascendentes cerca de C4.
 */
export function voicingMidis(chord) {
  const tones = chordTones(chord);
  if (!tones) return null;

  const pcs = [tones.thirdPc, tones.seventhPc, (tones.rootPc + 2) % 12];
  // Si es tríada “vacía” de color, incluir 5ta en vez de 9na
  const hasSeventh =
    chord.ext?.includes("7") ||
    chord.ext?.includes("6") ||
    chord.quality === "halfdim" ||
    chord.quality === "dim";
  if (!hasSeventh && !(chord.ext || []).length) {
    pcs[1] = tones.fifthPc;
    pcs[2] = tones.seventhPc; // color suave
  }

  const midis = placeClose(pcs, VOICE_OCTAVE);
  return {
    low: midis[0],
    mid: midis[1],
    high: midis[2],
    // compat tests antiguos
    third: midis[0],
    seventh: midis[1],
  };
}

/** Coloca pitch classes en octava base, ordenadas y compactas (±1 octava). */
export function placeClose(pcs, octave = 4) {
  const base = (octave + 1) * 12;
  let midis = pcs.map((pc) => base + (pc % 12));
  midis.sort((a, b) => a - b);
  // Compactar: si el span > 8 semitonos, bajar la más aguda una octava si ayuda
  for (let i = 1; i < midis.length; i++) {
    while (midis[i] - midis[0] > 14) midis[i] -= 12;
    while (midis[i] < midis[i - 1]) midis[i] += 12;
  }
  midis.sort((a, b) => a - b);
  return midis;
}

function chordKey(chord) {
  if (!chord?.root) return "";
  return [
    chord.root.letter,
    chord.root.alter,
    chord.quality,
    (chord.ext || []).join(""),
    chord.bass ? `${chord.bass.letter}${chord.bass.alter}` : "",
  ].join(":");
}

/** ¿Hay que atacar voicing en este beat? */
export function shouldPlayVoicing(beat, chord, prevChord, chordCount) {
  if (!chord) return false;
  if (beat === 0) return true;
  if (chordKey(chord) !== chordKey(prevChord)) return true;
  // Un solo acorde (o dos): refuerzo en el beat 2
  if (chordCount <= 2 && beat === 2) return true;
  return false;
}

function playTone(ctx, time, freq, { duration = 0.18, peak = 0.12, type = "triangle" } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  osc.connect(gain);
  gain.connect(getHarmonyBus(ctx));
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function playBass(ctx, time, midi) {
  if (midi == null) return;
  playTone(ctx, time, freqFromMidi(midi), {
    duration: 0.36,
    peak: 0.18,
    type: "sine",
  });
}

function playVoicing(ctx, time, chord) {
  const v = voicingMidis(chord);
  if (!v) return;
  const peaks = [0.07, 0.055, 0.045];
  const midis = [v.low, v.mid, v.high].filter((m) => m != null);
  midis.forEach((midi, i) => {
    playTone(ctx, time, freqFromMidi(midi), {
      duration: 0.55,
      peak: peaks[i] ?? 0.04,
      type: "triangle",
    });
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
    // Form expandido: reps, casillas, D.C./D.S., coda, Fine
    const measures = playbackTimeline(this._ast);
    if (!measures.length) return;

    const ctx = await unlockAudio();
    if (!ctx) return;

    const beats = beatsPerMeasure(this._ast);
    const hasFrom =
      opts.fromMeasure != null && Number.isFinite(Number(opts.fromMeasure));
    let startMeasureIdx = 0;
    if (hasFrom) {
      const want = Math.floor(Number(opts.fromMeasure));
      const at = measures.findIndex((m) => m.index === want);
      startMeasureIdx = at >= 0 ? at : 0;
    }

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

  /** Descarta cursor de pausa (p.ej. al marcar otro compás de partida). */
  discardPause() {
    this._pausedAt = null;
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
      if (cur.phase === "done") return;

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
        const prevChord = cur.beat > 0 ? perBeat[cur.beat - 1] : null;
        const chordCount = (measure?.chords || []).filter(Boolean).length;

        playClick(ctx, when, isDownbeat);

        if (chord && !measure?.invalid) {
          playBass(ctx, when, bassMidiForBeat(chord, cur.beat, chordCount));
          if (shouldPlayVoicing(cur.beat, chord, prevChord, chordCount)) {
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
          const next = cur.measureIdx + 1;
          if (next >= measures.length) {
            // Fin del form expandido (no loop del chart crudo)
            cur.phase = "done";
            scheduleVisual(when + spb * 0.05, () => {
              this.stop({ silent: false });
            });
          } else {
            cur.measureIdx = next;
          }
        }
      }

      cur.nextTime += spb;
    }
  }
}
