/**
 * Escalas de improvisación sugeridas a partir de un acorde parseado.
 */

import { QUALITY, formatPitch } from "../chart/parse.js";
import { pitchClass, spellPitchClass } from "../chart/transpose.js";

/** Intervalos en semitonos desde la tónica. */
export const SCALE_INTERVALS = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  locrianSharp2: [0, 2, 3, 5, 6, 8, 10],
  alt: [0, 1, 3, 4, 6, 8, 10],
  whDim: [0, 2, 3, 5, 6, 8, 9, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
};

const SCALE_LABELS = {
  ionian: "Ionian (mayor)",
  dorian: "Dorian",
  aeolian: "Aeolian (menor nat.)",
  mixolydian: "Mixolydian",
  lydian: "Lydian",
  locrian: "Locrian",
  locrianSharp2: "Locrian ♯2",
  alt: "Super Locrian (alt)",
  whDim: "Whole-half dim",
  wholeTone: "Whole tone",
};

function hasExt(ext, token) {
  return (ext || []).some((e) => e === token || e.replace(/^[#b]/, "") === token);
}

function hasAltExt(ext) {
  const e = ext || [];
  return e.some(
    (x) =>
      x === "b9" ||
      x === "#9" ||
      x === "b13" ||
      x === "#11" ||
      x === "alt" ||
      x === "b5" ||
      x === "#5"
  );
}

/**
 * @param {{ letter: string, alter: number }} root
 * @param {number[]} intervals
 * @returns {string[]}
 */
export function spellScaleNotes(root, intervals) {
  if (!root) return [];
  const rootPc = pitchClass(root);
  return intervals.map((iv) => {
    const pc = (rootPc + iv) % 12;
    const pitch = spellPitchClass(pc, root);
    return formatPitch(pitch);
  });
}

/**
 * @param {object} chord parseChord result
 * @returns {Array<{ id: string, name: string, notes: string[], primary?: boolean }>}
 */
export function suggestScales(chord) {
  if (!chord?.root) return [];
  const q = chord.quality;
  const ext = chord.ext || [];
  const has7 = hasExt(ext, "7");
  const picks = [];

  const add = (id, primary = false) => {
    if (picks.some((p) => p.id === id)) return;
    const intervals = SCALE_INTERVALS[id];
    if (!intervals) return;
    picks.push({
      id,
      name: SCALE_LABELS[id] || id,
      notes: spellScaleNotes(chord.root, intervals),
      primary,
    });
  };

  if (q === QUALITY.maj) {
    if (hasExt(ext, "#11")) {
      add("lydian", true);
      add("ionian");
    } else {
      add("ionian", true);
      if (has7 || hasExt(ext, "6")) add("lydian");
    }
  } else if (q === QUALITY.min) {
    if (has7) {
      add("dorian", true);
      add("aeolian");
    } else {
      add("aeolian", true);
      add("dorian");
    }
  } else if (q === QUALITY.dom) {
    if (hasAltExt(ext)) {
      add("alt", true);
      add("mixolydian");
    } else {
      add("mixolydian", true);
      if (hasExt(ext, "#11")) add("lydian"); // Lydian Dominant approx via mixo+#11 note set
      add("alt");
    }
  } else if (q === QUALITY.halfdim) {
    add("locrian", true);
    add("locrianSharp2");
  } else if (q === QUALITY.dim) {
    add("whDim", true);
  } else if (q === QUALITY.aug) {
    add("wholeTone", true);
    add("alt");
  } else if (q === QUALITY.sus) {
    add("mixolydian", true);
    add("dorian");
  } else {
    add("ionian", true);
  }

  if (picks.length && !picks.some((p) => p.primary)) {
    picks[0].primary = true;
  }
  return picks;
}

export function primaryScale(chord) {
  return suggestScales(chord).find((s) => s.primary) || suggestScales(chord)[0] || null;
}
