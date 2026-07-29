/**
 * Escalas “cómodas” para improvisar una sección entera ([A], [B], …).
 */

import { QUALITY, formatChord, formatPitch, parsePitch } from "../chart/parse.js";
import { pitchClass } from "../chart/transpose.js";
import {
  SCALE_INTERVALS,
  primaryScale,
  spellScaleNotes,
} from "./scales.js";

const SECTION_CANDIDATES = [
  { id: "ionian", label: "Ionian (mayor)" },
  { id: "dorian", label: "Dorian" },
  { id: "aeolian", label: "Aeolian (menor nat.)" },
  { id: "mixolydian", label: "Mixolydian" },
];

const PC_ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function chordTonePcs(chord) {
  if (!chord?.root) return [];
  const root = pitchClass(chord.root);
  const q = chord.quality;
  let third = 4;
  let fifth = 7;
  let seventh = null;
  if (q === QUALITY.min || q === QUALITY.halfdim || q === QUALITY.dim) third = 3;
  if (q === QUALITY.sus) third = 5;
  if (q === QUALITY.halfdim || q === QUALITY.dim) fifth = 6;
  if (q === QUALITY.aug) fifth = 8;
  const ext = chord.ext || [];
  if (ext.includes("7") || q === QUALITY.halfdim || q === QUALITY.dim) {
    if (q === QUALITY.maj) seventh = 11;
    else if (q === QUALITY.dim) seventh = 9;
    else seventh = 10;
  }
  const pcs = [root, (root + third) % 12, (root + fifth) % 12];
  if (seventh != null) pcs.push((root + seventh) % 12);
  return pcs;
}

function isOutlierChord(chord) {
  if (!chord) return false;
  const ext = chord.ext || [];
  if (chord.quality === QUALITY.dim || chord.quality === QUALITY.halfdim) return true;
  if (chord.quality === QUALITY.aug) return true;
  return ext.some((x) =>
    ["b9", "#9", "b13", "alt", "b5", "#5"].includes(x)
  );
}

function scaleSet(rootName, scaleId) {
  const root = parsePitch(rootName);
  const intervals = SCALE_INTERVALS[scaleId];
  if (!root || !intervals) return null;
  const notes = spellScaleNotes(root, intervals);
  const pcs = new Set(intervals.map((iv) => (pitchClass(root) + iv) % 12));
  return {
    id: `${scaleId}@${rootName}`,
    scaleId,
    rootName,
    name: `${rootName} ${SECTION_CANDIDATES.find((c) => c.id === scaleId)?.label || scaleId}`,
    notes,
    pcs,
  };
}

function scoreScaleAgainstChords(scale, chords) {
  let hit = 0;
  let total = 0;
  let weakChords = 0;
  for (const chord of chords) {
    const tones = chordTonePcs(chord);
    if (!tones.length) continue;
    let localHit = 0;
    for (const pc of tones) {
      total += 1;
      if (scale.pcs.has(pc)) {
        hit += 1;
        localHit += 1;
      }
    }
    if (localHit / tones.length < 0.75 || isOutlierChord(chord)) weakChords += 1;
  }
  if (!total) return { score: 0, coverage: 0, weakChords: 0 };
  return {
    score: hit / total,
    coverage: hit / total,
    weakChords,
  };
}

/**
 * @param {object[]} chords
 * @returns {{ scales: object[], outliers: Array<{ label: string, hint: string }> }}
 */
export function suggestSectionScales(chords) {
  const list = (chords || []).filter((c) => c?.root);
  if (!list.length) return { scales: [], outliers: [] };

  // Prefer roots that appear often as chord roots
  const rootCounts = new Map();
  for (const c of list) {
    const name = formatPitch(c.root);
    rootCounts.set(name, (rootCounts.get(name) || 0) + 1);
  }
  const preferredRoots = [...rootCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([n]) => n)
    .slice(0, 6);
  const roots = preferredRoots.length
    ? preferredRoots
    : PC_ROOTS.slice();

  const scored = [];
  for (const rootName of roots) {
    for (const cand of SECTION_CANDIDATES) {
      const scale = scaleSet(rootName, cand.id);
      if (!scale) continue;
      const { score, coverage, weakChords } = scoreScaleAgainstChords(scale, list);
      scored.push({
        ...scale,
        name: `${rootName} ${cand.label}`,
        score: score - weakChords * 0.02,
        coverage,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.coverage - a.coverage);
  const top = [];
  for (const s of scored) {
    if (top.length >= 2) break;
    if (top.some((t) => t.pcs.size === s.pcs.size && [...t.pcs].every((p) => s.pcs.has(p)))) {
      continue; // same pitch set
    }
    if (top.some((t) => t.rootName === s.rootName && t.scaleId === s.scaleId)) continue;
    top.push(s);
  }

  const best = top[0];
  const outliers = [];
  if (best) {
    for (const chord of list) {
      const tones = chordTonePcs(chord);
      const ok = tones.filter((pc) => best.pcs.has(pc)).length;
      if (isOutlierChord(chord) || (tones.length && ok / tones.length < 0.75)) {
        const prim = primaryScale(chord);
        outliers.push({
          label: formatChord(chord) || chord.raw || "?",
          hint: prim ? prim.name : "detalle",
        });
      }
    }
  }

  // unique outliers by label
  const seen = new Set();
  const uniqOutliers = [];
  for (const o of outliers) {
    if (seen.has(o.label)) continue;
    seen.add(o.label);
    uniqOutliers.push(o);
  }

  return {
    scales: top.map(({ id, name, notes, scaleId, rootName }) => ({
      id,
      name,
      notes,
      scaleId,
      rootName,
    })),
    outliers: uniqOutliers,
  };
}
