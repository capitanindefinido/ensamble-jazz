/**
 * Voicings de piano (shell + rootless) a partir de un acorde parseado.
 */

import { QUALITY, formatPitch } from "../chart/parse.js";
import { pitchClass, spellPitchClass } from "../chart/transpose.js";

function hasExt(ext, token) {
  return (ext || []).some((e) => e === token);
}

function chordToneIntervals(chord) {
  const q = chord.quality;
  const ext = chord.ext || [];
  const has7 = hasExt(ext, "7");
  const has6 = hasExt(ext, "6");

  let third = 4;
  let fifth = 7;
  let seventh = null;

  if (q === QUALITY.min || q === QUALITY.halfdim || q === QUALITY.dim) {
    third = 3;
  }
  if (q === QUALITY.sus) {
    third = 5; // sus4 as "third" slot
  }
  if (q === QUALITY.dim || q === QUALITY.halfdim) {
    fifth = 6;
  }
  if (q === QUALITY.aug) {
    fifth = 8;
  }

  if (q === QUALITY.maj) {
    seventh = has7 ? 11 : has6 ? 9 : null;
  } else if (q === QUALITY.min) {
    seventh = has7 ? 10 : null;
  } else if (q === QUALITY.dom || q === QUALITY.sus) {
    seventh = has7 ? 10 : null;
  } else if (q === QUALITY.halfdim) {
    seventh = has7 ? 10 : null;
  } else if (q === QUALITY.dim) {
    seventh = has7 ? 9 : null;
  } else if (q === QUALITY.aug) {
    seventh = has7 ? 10 : null;
  }

  const ninth = 2;
  const thirteenth = 9;

  return { third, fifth, seventh, ninth, thirteenth };
}

function spellFromRoot(root, interval) {
  const pc = (pitchClass(root) + interval) % 12;
  return formatPitch(spellPitchClass(pc, root));
}

/**
 * @param {object} chord
 * @param {"A"|"B"} [form] rootless form
 * @returns {{
 *   shell: { label: string, notes: string[] },
 *   rootless: { label: string, notes: string[], form: string } | null,
 * }}
 */
export function suggestVoicings(chord, form = "A") {
  if (!chord?.root) {
    return {
      shell: { label: "LH shell", notes: [] },
      rootless: null,
    };
  }

  const { third, fifth, seventh, ninth, thirteenth } = chordToneIntervals(chord);
  const rootName = formatPitch(chord.root);

  let shellNotes;
  if (seventh != null) {
    // Shell: root + 7 (classic LH)
    shellNotes = [rootName, spellFromRoot(chord.root, seventh)];
  } else {
    shellNotes = [rootName, spellFromRoot(chord.root, third)];
  }

  // Slash: prefer bass in shell if present
  if (chord.bass) {
    const bassName = formatPitch(chord.bass);
    if (seventh != null) {
      shellNotes = [bassName, spellFromRoot(chord.root, seventh)];
    } else {
      shellNotes = [bassName, spellFromRoot(chord.root, third)];
    }
  }

  let rootless = null;
  if (seventh != null) {
    let notes;
    let label;
    const isDom = chord.quality === QUALITY.dom;
    if (form === "B") {
      // Form B: 7–9–3–5 (drop / alternate)
      notes = [
        spellFromRoot(chord.root, seventh),
        spellFromRoot(chord.root, ninth),
        spellFromRoot(chord.root, third),
        spellFromRoot(chord.root, fifth),
      ];
      label = "RH rootless B";
    } else if (isDom) {
      notes = [
        spellFromRoot(chord.root, third),
        spellFromRoot(chord.root, seventh),
        spellFromRoot(chord.root, ninth),
        spellFromRoot(chord.root, thirteenth),
      ];
      label = "RH rootless A (3–7–9–13)";
    } else {
      notes = [
        spellFromRoot(chord.root, third),
        spellFromRoot(chord.root, fifth),
        spellFromRoot(chord.root, seventh),
        spellFromRoot(chord.root, ninth),
      ];
      label = "RH rootless A (3–5–7–9)";
    }
    rootless = { label, notes, form };
  }

  return {
    shell: { label: "LH shell", notes: shellNotes },
    rootless,
  };
}

/**
 * Detecta ii–V–I en una secuencia plana de acordes.
 * @param {object[]} chords
 * @returns {Array<{ start: number, chords: object[], label: string }>}
 */
export function findIiVI(chords) {
  const list = (chords || []).filter(Boolean);
  const out = [];
  for (let i = 0; i < list.length - 2; i++) {
    const a = list[i];
    const b = list[i + 1];
    const c = list[i + 2];
    if (!a?.root || !b?.root || !c?.root) continue;

    const isIi =
      a.quality === QUALITY.min && (a.ext || []).includes("7");
    const isV =
      (b.quality === QUALITY.dom || b.quality === QUALITY.sus) &&
      (b.ext || []).includes("7");
    const iOk =
      c.quality === QUALITY.maj &&
      ((c.ext || []).includes("7") ||
        (c.ext || []).includes("6") ||
        (c.ext || []).length === 0);

    if (!isIi || !isV || !iOk) continue;

    const pcA = pitchClass(a.root);
    const pcB = pitchClass(b.root);
    const pcC = pitchClass(c.root);
    if ((pcA + 5) % 12 !== pcB) continue;
    if ((pcB + 5) % 12 !== pcC) continue;

    out.push({
      start: i,
      chords: [a, b, c],
      label: "ii–V–I",
    });
  }
  return out;
}

/**
 * Forma rootless sugerida según posición en ii–V–I (A en ii/I, B en V).
 */
export function voicingFormForProgression(role) {
  if (role === "V") return "B";
  return "A";
}
