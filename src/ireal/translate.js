/**
 * Traduce el cuerpo desofuscado de iReal Pro a nuestro formato de chart.
 * Tokens de relleno se mapean o se descartan.
 * Si aparece un token desconocido, error (no escribir a medias).
 */

import { parseChart } from "../chart/parse.js";

function emptyMeasure() {
  return {
    chords: [],
    alternate: null,
    repeatPrev: false,
    noChord: false,
    openRepeat: false,
    closeRepeat: false,
    ending: null,
  };
}

function hasContent(m) {
  return (
    m.chords.length > 0 ||
    m.alternate != null ||
    m.repeatPrev ||
    m.noChord ||
    m.ending != null
  );
}

function cloneMeasure(m) {
  return {
    chords: (m.chords || []).slice(),
    alternate: m.alternate,
    repeatPrev: !!m.repeatPrev,
    noChord: !!m.noChord,
    openRepeat: false,
    closeRepeat: false,
    ending: null,
  };
}

/** Limpia el interior de <...> para la columna notas. */
export function cleanAnnotation(inner) {
  return String(inner || "")
    .replace(/^\*+\d*\s*/, "")
    .replace(/^\[\s*/, "")
    .replace(/\s*\]$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} raw cuerpo ya desofuscado (music.raw de ireal-reader)
 * @returns {{ chartText: string|null, error: string|null, notes: string[] }}
 */
export function translateIrealBody(raw) {
  if (raw == null || String(raw).trim() === "") {
    return { chartText: null, error: "cuerpo vacío", notes: [] };
  }

  const unknown = [];
  const notes = [];
  const s = String(raw);
  let i = 0;
  let timeSig = null;
  const sections = [];
  let section = null;
  let measure = emptyMeasure();
  let openRepeatPending = false;

  function ensureSection(label) {
    if (!section) {
      section = { label: label || "", measures: [] };
      sections.push(section);
      return;
    }
    if (label != null) {
      flushMeasure();
      section = { label, measures: [] };
      sections.push(section);
    }
  }

  function flushMeasure() {
    if (!section) ensureSection("");
    if (!hasContent(measure) && !measure.openRepeat && !measure.closeRepeat) {
      measure = emptyMeasure();
      return;
    }
    if (openRepeatPending) {
      measure.openRepeat = true;
      openRepeatPending = false;
    }
    section.measures.push(measure);
    measure = emptyMeasure();
  }

  function skipSpaces() {
    while (i < s.length && /\s/.test(s[i])) i += 1;
  }

  /** Repite los dos últimos compases ya flusheados (token `r` / `r|`). */
  function repeatTwoMeasures() {
    flushMeasure();
    if (!section || section.measures.length < 2) {
      unknown.push("r");
      return;
    }
    const a = section.measures[section.measures.length - 2];
    const b = section.measures[section.measures.length - 1];
    section.measures.push(cloneMeasure(a));
    section.measures.push(cloneMeasure(b));
  }

  while (i < s.length) {
    skipSpaces();
    if (i >= s.length) break;

    if (s.startsWith("XyQ", i)) {
      i += 3;
      continue;
    }
    if (s.startsWith("Kcl", i)) {
      flushMeasure();
      measure.repeatPrev = true;
      flushMeasure();
      i += 3;
      continue;
    }
    if (s.startsWith("LZ", i)) {
      flushMeasure();
      i += 2;
      continue;
    }
    if (s.startsWith("r|", i) || (s[i] === "r" && (i + 1 >= s.length || /[\s|LZ\]\[]/.test(s[i + 1]) || s.startsWith("XyQ", i + 1)))) {
      // `r` o `r|` — repite dos compases
      if (s.startsWith("r|", i)) i += 2;
      else i += 1;
      repeatTwoMeasures();
      continue;
    }

    const tMatch = s.slice(i).match(/^T(\d{2})/);
    if (tMatch) {
      // Solo la primera métrica del chart (cambios locales tipo T34n se ignoran)
      if (timeSig == null) timeSig = tMatch[1];
      i += tMatch[0].length;
      continue;
    }

    // *A[ / *A{ / *AT44 — no confundir con tipografía *7sus4*
    const secMatch = s.slice(i).match(/^\*([A-Z0-9])(?![a-z])([\[{])?/);
    if (secMatch) {
      flushMeasure();
      ensureSection(secMatch[1]);
      if (secMatch[2] === "{") openRepeatPending = true;
      i += secMatch[0].length;
      continue;
    }

    if (s[i] === "<") {
      const end = s.indexOf(">", i);
      if (end === -1) {
        unknown.push("<");
        break;
      }
      const cleaned = cleanAnnotation(s.slice(i + 1, end));
      if (cleaned) notes.push(cleaned);
      i = end + 1;
      continue;
    }

    if (s[i] === "{") {
      openRepeatPending = true;
      i += 1;
      continue;
    }
    if (s[i] === "}") {
      measure.closeRepeat = true;
      flushMeasure();
      i += 1;
      continue;
    }
    if (s[i] === "[" || s[i] === "]") {
      i += 1;
      continue;
    }
    if (s[i] === "Z") {
      flushMeasure();
      i += 1;
      continue;
    }
    if (s[i] === "Y" || s[i] === "y") {
      while (i < s.length && (s[i] === "Y" || s[i] === "y")) i += 1;
      continue;
    }
    // Q coda, S segno, U ending player, f fine, p pause;
    // s/l = tamaño de acorde (solo visual)
    if ("QSUfpl".includes(s[i]) || s[i] === "s") {
      i += 1;
      continue;
    }
    if (s[i] === "n") {
      flushMeasure();
      measure.noChord = true;
      flushMeasure();
      i += 1;
      continue;
    }
    if (s[i] === "|") {
      flushMeasure();
      i += 1;
      continue;
    }
    if (s[i] === "x") {
      measure.repeatPrev = true;
      flushMeasure();
      i += 1;
      continue;
    }
    if (s[i] === ",") {
      i += 1;
      continue;
    }

    const endMatch = s.slice(i).match(/^N(\d)/);
    if (endMatch) {
      measure.ending = Number(endMatch[1]);
      i += 2;
      continue;
    }

    if (s[i] === "(") {
      const end = s.indexOf(")", i);
      if (end === -1) {
        unknown.push("(");
        break;
      }
      measure.alternate = s.slice(i + 1, end).trim();
      i = end + 1;
      continue;
    }

    if (/[A-GW]/.test(s[i])) {
      let j = i + 1;
      if (s[j] === "#" || s[j] === "b") j += 1;
      while (
        j < s.length &&
        !/[\s|\[\]\{\}\(\)x]/.test(s[j]) &&
        !s.startsWith("XyQ", j) &&
        !s.startsWith("LZ", j) &&
        !s.startsWith("Kcl", j) &&
        s[j] !== "Y" &&
        s[j] !== "y" &&
        s[j] !== "Z" &&
        s[j] !== "Q" &&
        s[j] !== ","
      ) {
        if (s[j] === "*" && /[A-Z0-9]/.test(s[j + 1] || "")) {
          const look = s.slice(j).match(/^\*([A-Z0-9])(?![a-z])/);
          // sección *A[ — no tipografía *7
          if (look && /[A-Z]/.test(look[1]) && !/\d/.test(look[1])) break;
        }
        j += 1;
      }
      const chord = s.slice(i, j).replace(/\*/g, "");
      if (chord && chord !== "W") measure.chords.push(chord);
      i = j;
      continue;
    }

    if (s[i] === "*") {
      i += 1;
      continue;
    }

    unknown.push(s[i]);
    i += 1;
  }

  flushMeasure();

  if (unknown.length) {
    return {
      chartText: null,
      error: `tokens no traducibles: ${[...new Set(unknown)].join("; ")}`,
      notes,
    };
  }

  const lines = [timeSig ? `T${timeSig}` : "T44"];
  for (const sec of sections) {
    if (!sec.measures.length) continue;
    const cells = [];
    for (const m of sec.measures) {
      let cell = "";
      if (m.openRepeat) cell += "{ ";
      if (m.ending != null) cell += `N${m.ending} `;
      if (m.alternate) cell += `(${m.alternate}) `;
      if (m.noChord) cell += "N.C.";
      else if (m.repeatPrev) cell += "%";
      else cell += m.chords.join(" ");
      if (m.closeRepeat) cell += " }";
      cells.push(cell.trim());
    }
    for (let k = 0; k < cells.length; k += 4) {
      const row = cells.slice(k, k + 4).join(" | ");
      const prefix = k === 0 && sec.label ? `[${sec.label}] ` : "    ";
      lines.push(`${prefix}${row} |`);
    }
  }

  const chartText = lines.join("\n");
  const { ast } = parseChart(chartText);
  for (const sec of ast.sections) {
    for (const m of sec.measures) {
      if (m.invalid) {
        return {
          chartText: null,
          error: `compás inválido: ${m.raw || "?"}`,
          notes,
        };
      }
    }
  }
  if (!ast.sections.some((sec) => sec.measures.length > 0)) {
    return { chartText: null, error: "sin compases tras traducir", notes };
  }

  return { chartText, error: null, notes };
}
