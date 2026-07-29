/**
 * Guía de improvisación por compás / chart.
 */

import { formatChord } from "../chart/parse.js";
import { primaryScale, suggestScales } from "./scales.js";
import {
  findIiVI,
  suggestVoicings,
  voicingFormForProgression,
} from "./voicings.js";

/**
 * Aplana acordes del AST en orden de reproducción.
 * @returns {Array<{ chord: object, measureIndex: number, chordIndex: number }>}
 */
export function flattenAstChords(ast) {
  const out = [];
  if (!ast?.sections) return out;
  for (const sec of ast.sections) {
    for (const m of sec.measures || []) {
      (m.chords || []).forEach((chord, chordIndex) => {
        if (chord) {
          out.push({
            chord,
            measureIndex: m.index,
            chordIndex,
          });
        }
      });
    }
  }
  return out;
}

/**
 * Mapa measureIndex → rol en ii–V–I ("ii"|"V"|"I") si aplica al primer acorde.
 */
export function progressionRoles(ast) {
  const flat = flattenAstChords(ast);
  const roles = new Map();
  const hits = findIiVI(flat.map((f) => f.chord));
  for (const hit of hits) {
    const labels = ["ii", "V", "I"];
    for (let k = 0; k < 3; k++) {
      const entry = flat[hit.start + k];
      if (!entry) continue;
      // Solo primer acorde del compás conserva el rol si no hay otro
      if (!roles.has(entry.measureIndex)) {
        roles.set(entry.measureIndex, labels[k]);
      }
    }
  }
  return roles;
}

/**
 * @param {object} chord
 * @param {{ form?: "A"|"B", progression?: string }} [opts]
 */
export function buildChordGuide(chord, opts = {}) {
  if (!chord?.root) return null;
  const scales = suggestScales(chord);
  const primary = scales.find((s) => s.primary) || scales[0] || null;
  const form = opts.form || "A";
  const voicings = suggestVoicings(chord, form);
  return {
    chordLabel: formatChord(chord) || chord.raw || "?",
    scales,
    primary,
    voicings,
    progression: opts.progression || null,
    form,
  };
}

/**
 * Guía del compás (todos sus acordes).
 * @param {object} measure
 * @param {{ roles?: Map<number,string> }} [opts]
 */
export function buildMeasureGuide(measure, opts = {}) {
  if (!measure) return null;
  const role = opts.roles?.get(measure.index) || null;
  const form = role ? voicingFormForProgression(role) : "A";
  const chords = (measure.chords || [])
    .map((c) =>
      buildChordGuide(c, {
        form,
        progression: role ? `ii–V–I (${role})` : null,
      })
    )
    .filter(Boolean);

  return {
    measureIndex: measure.index,
    progression: role ? `ii–V–I (${role})` : null,
    chords,
  };
}

/**
 * Encuentra un measure por index en el AST.
 */
export function findMeasure(ast, index) {
  if (ast == null || index == null) return null;
  for (const sec of ast.sections || []) {
    for (const m of sec.measures || []) {
      if (m.index === index) return m;
    }
  }
  return null;
}

/**
 * Guía para el compás activo (o el primero si null).
 */
export function guideForActiveMeasure(ast, activeMeasure, startMeasure) {
  if (!ast) return null;
  const roles = progressionRoles(ast);
  let idx = activeMeasure;
  if (idx == null) idx = startMeasure;
  if (idx == null) {
    const first = ast.sections?.[0]?.measures?.[0];
    idx = first?.index ?? 0;
  }
  const measure = findMeasure(ast, idx);
  if (!measure) return null;
  return buildMeasureGuide(measure, { roles });
}

export { primaryScale, suggestScales, suggestVoicings, findIiVI };
