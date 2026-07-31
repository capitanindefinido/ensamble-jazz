import { formatChord, parseChord } from "./parse.js";

export function cloneAst(ast) {
  return JSON.parse(JSON.stringify(ast));
}

export function findMeasure(ast, measureIndex) {
  if (!ast?.sections) return null;
  for (const sec of ast.sections) {
    for (const m of sec.measures || []) {
      if (m.index === measureIndex) return m;
    }
  }
  return null;
}

export function measureSlotTexts(measure) {
  if (!measure) return [];
  if (measure.repeatPrev || measure.noChord) return [];
  if (measure.invalid) {
    return String(measure.raw || "")
      .split(/\s+/)
      .filter(Boolean);
  }
  return (measure.chords || []).map((c) => formatChord(c));
}

export function measureEditMode(measure) {
  if (!measure) return "chords";
  if (measure.repeatPrev) return "repeat";
  if (measure.noChord) return "nc";
  return "chords";
}

/**
 * @param {object} ast
 * @param {number} measureIndex
 * @param {{ mode: 'chords'|'repeat'|'nc', slots?: string[] }} content
 * @returns {{ ast: object, error: string|null }}
 */
export function setMeasureContent(ast, measureIndex, content) {
  if (!ast) return { ast, error: "Sin chart" };
  const next = cloneAst(ast);
  const m = findMeasure(next, measureIndex);
  if (!m) return { ast: next, error: "Compás no encontrado" };

  if (content.mode === "repeat") {
    m.repeatPrev = true;
    m.noChord = false;
    m.invalid = false;
    m.chords = [];
    m.raw = undefined;
    return { ast: next, error: null };
  }

  if (content.mode === "nc") {
    m.noChord = true;
    m.repeatPrev = false;
    m.invalid = false;
    m.chords = [];
    m.raw = undefined;
    return { ast: next, error: null };
  }

  const slots = (content.slots || [])
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  if (slots.length === 0) {
    m.noChord = true;
    m.repeatPrev = false;
    m.invalid = false;
    m.chords = [];
    m.raw = undefined;
    return { ast: next, error: null };
  }

  if (slots.length > 4) {
    return { ast, error: "Máximo 4 acordes por compás" };
  }

  const parsed = [];
  for (const raw of slots) {
    const chord = parseChord(raw);
    if (!chord) {
      return { ast, error: `No entiendo «${raw}»` };
    }
    chord.raw = raw;
    parsed.push(chord);
  }

  m.chords = parsed;
  m.repeatPrev = false;
  m.noChord = false;
  m.invalid = false;
  m.raw = undefined;
  return { ast: next, error: null };
}
