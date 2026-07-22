/**
 * Transposición por semitonos con respelling según tonalidad destino.
 *
 * Camino: calcular la tónica destino (preferKeySpelling) y deletrear cada
 * pitch class eligiendo la enarmónica que mejor calza con esa armadura.
 * Nunca preferir dobles alteraciones si existe alternativa.
 */

import { LETTERS, formatChord, formatPitch, parseKeyString } from "./parse.js";

/** Pitch class desde C: C D E F G A B */
const PC = [0, 2, 4, 5, 7, 9, 11];

/** Orden del ciclo de quintas / cuartas para armaduras */
const SHARP_LETTERS = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_LETTERS = ["B", "E", "A", "D", "G", "C", "F"];

/** Una ortografía "limpia" por pitch class (sin dobles). */
const PC_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function letterIndex(letter) {
  return LETTERS.indexOf(letter.toUpperCase());
}

export function pitchClass(pitch) {
  if (!pitch) return null;
  const i = letterIndex(pitch.letter);
  if (i < 0) return null;
  return ((PC[i] + pitch.alter) % 12 + 12) % 12;
}

/**
 * Semitonos entre dos pitches (0..11) hacia arriba desde `from` hasta `to`.
 */
export function semitonesBetween(from, to) {
  const a = pitchClass(from);
  const b = pitchClass(to);
  if (a == null || b == null) return 0;
  return (b - a + 12) % 12;
}

/**
 * Número de alteraciones de una tonalidad mayor (positivo = ♯, negativo = ♭).
 */
export function keySignatureAccidentals(pitch) {
  const name = formatPitch(pitch);
  const sharpKeys = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7 };
  const flatKeys = { F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
  if (name in sharpKeys) return sharpKeys[name];
  if (name in flatKeys) return flatKeys[name];
  if (name === "G#") return 8;
  if (name === "D#") return 9;
  if (name === "A#") return 10;
  return 0;
}

/** Todas las enarmónicas de un pitch class. */
function enharmonics(pc) {
  const out = [];
  for (let li = 0; li < 7; li++) {
    for (let alter = -2; alter <= 2; alter++) {
      const p = { letter: LETTERS[li], alter };
      if (pitchClass(p) === pc) out.push(p);
    }
  }
  return out;
}

/**
 * Elige la enarmónica de una tonalidad con ≤6 alteraciones.
 * Rechaza dobles alteraciones salvo que no haya alternativa.
 */
export function preferKeySpelling(pitch) {
  const pc = pitchClass(pitch);
  const candidates = enharmonics(pc);
  candidates.sort((a, b) => {
    const pen = (p) =>
      Math.abs(p.alter) >= 2
        ? 50
        : Math.abs(keySignatureAccidentals(p)) > 6
          ? 40
          : 0;
    return (
      pen(a) - pen(b) ||
      Math.min(Math.abs(keySignatureAccidentals(a)), 6) -
        Math.min(Math.abs(keySignatureAccidentals(b)), 6) ||
      Math.abs(a.alter) - Math.abs(b.alter)
    );
  });
  for (const c of candidates) {
    if (Math.abs(keySignatureAccidentals(c)) <= 6 && Math.abs(c.alter) < 2) {
      return c;
    }
  }
  for (const c of candidates) {
    if (Math.abs(keySignatureAccidentals(c)) <= 6) return c;
  }
  // Último recurso: sin doble alter si se puede
  const simple = candidates.find((c) => Math.abs(c.alter) < 2);
  return simple || candidates[0] || pitch;
}

/** Alteración esperada de una letra en la armadura (0 / ±1). */
function keyAlterForLetter(destKey, letter) {
  const n = keySignatureAccidentals(destKey);
  if (n > 0) {
    const idx = SHARP_LETTERS.indexOf(letter);
    return idx >= 0 && idx < n ? 1 : 0;
  }
  if (n < 0) {
    const idx = FLAT_LETTERS.indexOf(letter);
    return idx >= 0 && idx < -n ? -1 : 0;
  }
  return 0;
}

/**
 * Deletrea un pitch class según la armadura destino.
 * Reusa el criterio de preferKeySpelling: sin dobles si hay alternativa,
 * y calce con la armadura.
 */
export function spellPitchClass(pc, destKey) {
  const key = preferKeySpelling(destKey);
  const preferFlats = keySignatureAccidentals(key) <= 0;
  const candidates = enharmonics(pc);

  const simple = candidates.filter((c) => Math.abs(c.alter) < 2);
  const pool = simple.length ? simple : candidates;

  pool.sort((a, b) => score(a) - score(b));
  return pool[0];

  function score(p) {
    let s = 0;
    if (Math.abs(p.alter) >= 2) s += 100;
    s += Math.abs(p.alter) * 10;
    const expected = keyAlterForLetter(key, p.letter);
    if (p.alter === expected) s -= 8; // pertenece a la armadura (o natural en ella)
    else s += 4;
    if (preferFlats && p.alter > 0) s += 3;
    if (!preferFlats && keySignatureAccidentals(key) > 0 && p.alter < 0) s += 3;
    return s;
  }
}

/**
 * Transpone un pitch `semitones` semitonos.
 * 1) Calcula la tonalidad destino (tónica + n → preferKeySpelling).
 * 2) Deletrea el pitch class resultante contra esa armadura.
 */
export function transposePitch(pitch, semitones, preferFlats = true, destKey = null) {
  if (!pitch) return null;
  const n = ((semitones % 12) + 12) % 12;
  if (n === 0) return { letter: pitch.letter, alter: pitch.alter };

  const targetPc = (pitchClass(pitch) + n) % 12;

  let key = destKey ? preferKeySpelling(destKey) : null;
  if (!key) {
    // Tónica destino = el mismo pc tratado como tonalidad, con ortografía limpia
    key = preferKeySpelling(parseKeyString(PC_FLAT[targetPc]));
  }

  return spellPitchClass(targetPc, key);
}

export function transposeChord(chord, semitones, preferFlats = true, destKey = null) {
  if (!chord) return null;
  return {
    ...chord,
    root: transposePitch(chord.root, semitones, preferFlats, destKey),
    bass: chord.bass
      ? transposePitch(chord.bass, semitones, preferFlats, destKey)
      : null,
    // Conservar raw: un acorde inválido debe seguir mostrando el texto crudo
    raw: chord.raw,
  };
}

/**
 * Transpone un AST completo. Devuelve un AST nuevo.
 * `destKey` opcional: si se pasa, se usa para decidir sostenidos/bemoles.
 */
export function transposeAst(ast, semitones, destKey = null) {
  if (!ast) return ast;
  const n = ((semitones % 12) + 12) % 12;

  let key = destKey ? preferKeySpelling(destKey) : null;
  if (!key && n !== 0) {
    // Inferir tónica destino desde preferKeySpelling del pc corrido
    // (los callers suelen pasar destKey; esto cubre el caso suelto)
    key = null;
  }

  const preferFlats = key ? keySignatureAccidentals(key) <= 0 : true;

  return {
    timeSig: { ...ast.timeSig },
    sections: ast.sections.map((sec) => ({
      label: sec.label,
      measures: sec.measures.map((m) => ({
        ...m,
        chords: (m.chords || []).map((c) =>
          transposeChord(c, n, preferFlats, key)
        ),
        alternate: m.alternate
          ? transposeChord(m.alternate, n, preferFlats, key)
          : null,
      })),
    })),
  };
}

/**
 * Semitonos para ir de la tonalidad del chart a la del Sheet.
 */
export function deltaToKey(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  return semitonesBetween(fromKey, toKey);
}

/**
 * Serializa el AST de vuelta a texto (para tests de roundtrip).
 */
export function serializeAst(ast) {
  if (!ast) return "";
  const lines = [`T${ast.timeSig.num}${ast.timeSig.den}`];
  for (const sec of ast.sections) {
    const cells = [];
    for (const m of sec.measures) {
      let cell = "";
      if (m.openRepeat) cell += "{ ";
      if (m.ending) cell += `N${m.ending} `;
      if (m.alternate) cell += `(${formatChord(m.alternate)}) `;
      if (m.noChord) cell += "N.C.";
      else if (m.repeatPrev) cell += "%";
      else if (m.invalid) cell += m.raw || "?";
      else cell += (m.chords || []).map(formatChord).join(" ");
      if (m.closeRepeat) cell += " }";
      cells.push(cell.trim());
    }
    for (let i = 0; i < cells.length; i += 4) {
      const row = cells.slice(i, i + 4).join(" | ");
      const prefix = i === 0 && sec.label ? `[${sec.label}] ` : "    ";
      lines.push(prefix + row + " |");
    }
  }
  return lines.join("\n");
}

/**
 * Roundtrip de prueba: lista de raw de todos los acordes en orden.
 */
export function chordRaws(ast) {
  const out = [];
  for (const sec of ast.sections) {
    for (const m of sec.measures) {
      for (const c of m.chords || []) {
        out.push(formatChord(c));
      }
    }
  }
  return out;
}
