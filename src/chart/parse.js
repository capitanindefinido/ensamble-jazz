/**
 * Parser del formato de chart (PLAN.md).
 * Nunca lanza: devuelve { ast, warnings }.
 */

export const QUALITY = {
  maj: "maj",
  min: "min",
  halfdim: "halfdim",
  dim: "dim",
  aug: "aug",
  sus: "sus",
  dom: "dom",
};

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

export function emptyAst(timeSig = { num: 4, den: 4 }) {
  return { timeSig, sections: [] };
}

export function parsePitch(token) {
  if (!token || typeof token !== "string") return null;
  const m = token
    .trim()
    .replace(/♭/g, "b")
    .replace(/♯/g, "#")
    .match(/^([A-Ga-g])(bb|##|b|#)?$/);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  let alter = 0;
  if (m[2] === "b") alter = -1;
  else if (m[2] === "bb") alter = -2;
  else if (m[2] === "#") alter = 1;
  else if (m[2] === "##") alter = 2;
  return { letter, alter };
}

/**
 * @returns {null | { root, quality, ext, bass, susKind, raw }}
 * susKind: "" | "2" | "4" — solo con quality sus (Gsus / Gsus2 / G7sus4).
 */
export function parseChord(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s0 = raw.trim().replace(/♭/g, "b").replace(/♯/g, "#").replace(/°/g, "o");
  if (!s0) return null;

  const rootM = s0.match(/^([A-G])(bb|##|b|#)?/);
  if (!rootM) return null;
  const root = parsePitch(rootM[0]);
  if (!root) return null;
  let i = rootM[0].length;

  let quality = null;
  let susKind = "";
  const after = s0.slice(i);
  if (after.startsWith("^")) {
    quality = QUALITY.maj;
    i += 1;
  } else if (after.startsWith("sus")) {
    quality = QUALITY.sus;
    i += 3;
    if (after[3] === "2" || after[3] === "4") {
      susKind = after[3];
      i += 1;
    }
  } else if (after.startsWith("-")) {
    quality = QUALITY.min;
    i += 1;
  } else if (after.startsWith("h")) {
    quality = QUALITY.halfdim;
    i += 1;
  } else if (after.startsWith("o")) {
    quality = QUALITY.dim;
    i += 1;
  } else if (after.startsWith("+")) {
    quality = QUALITY.aug;
    i += 1;
  }

  let bass = null;
  let body = s0.slice(i);
  const slash = body.lastIndexOf("/");
  if (slash !== -1) {
    bass = parsePitch(body.slice(slash + 1));
    if (!bass) return null;
    body = body.slice(0, slash);
  }

  // G7sus / B7sus4 / Bb7sus2 — sus (opcional 2|4) tras la tensión
  const trailSus = body.match(/sus([24])?$/);
  if (trailSus) {
    quality = QUALITY.sus;
    susKind = trailSus[1] || "";
    body = body.slice(0, -trailSus[0].length);
  }

  const ext = [];
  let e = 0;
  while (e < body.length) {
    const tm = body.slice(e).match(/^([b#]?)(13|11|9|7|6|5)/);
    if (!tm) return null;
    ext.push((tm[1] || "") + tm[2]);
    e += tm[0].length;
  }
  if (e !== body.length) return null;

  if (!quality) {
    if (ext.length === 0) quality = QUALITY.maj;
    else if (ext.every((x) => x === "6" || x === "9")) quality = QUALITY.maj;
    else quality = QUALITY.dom;
  }

  return {
    root,
    quality,
    ext,
    bass,
    susKind: quality === QUALITY.sus ? susKind : "",
    raw: raw.trim(),
  };
}

export function formatPitch(p) {
  if (!p) return "";
  let s = p.letter;
  if (p.alter === -1) s += "b";
  if (p.alter === -2) s += "bb";
  if (p.alter === 1) s += "#";
  if (p.alter === 2) s += "##";
  return s;
}

export function formatChord(chord) {
  if (!chord) return "";
  let s = formatPitch(chord.root);

  switch (chord.quality) {
    case QUALITY.min:
      s += "-";
      break;
    case QUALITY.halfdim:
      s += "h";
      break;
    case QUALITY.dim:
      s += "o";
      break;
    case QUALITY.aug:
      s += "+";
      break;
    case QUALITY.sus:
      // sus va DESPUÉS de las tensiones: G7sus, no Gsus7
      break;
    case QUALITY.maj: {
      const only69 = chord.ext.length > 0 && chord.ext.every((x) => x === "6" || x === "9");
      const triad = chord.ext.length === 0;
      if (!triad && !only69) s += "^";
      break;
    }
    case QUALITY.dom:
    default:
      break;
  }

  s += (chord.ext || []).join("");
  if (chord.quality === QUALITY.sus) {
    s += "sus" + (chord.susKind || "");
  }
  if (chord.bass) s += "/" + formatPitch(chord.bass);
  return s;
}

export function parseKeyString(tono) {
  if (!tono) return null;
  const t = String(tono).trim().replace(/♭/g, "b").replace(/♯/g, "#");
  const m = t.match(/^([A-G][b#]?)/i);
  if (!m) return null;
  return parsePitch(m[1]);
}

export function formatKey(pitch) {
  if (!pitch) return "";
  return formatPitch(pitch).replace("bb", "♭♭").replace("b", "♭").replace("##", "♯♯").replace("#", "♯");
}

function cloneChord(c) {
  return {
    root: { ...c.root },
    quality: c.quality,
    ext: (c.ext || []).slice(),
    bass: c.bass ? { ...c.bass } : null,
    susKind: c.susKind || "",
    raw: c.raw,
  };
}

function tokenizeLine(line) {
  const tokens = [];
  let i = 0;
  const s = line;

  while (i < s.length) {
    if (/\s/.test(s[i])) {
      i += 1;
      continue;
    }

    if (s[i] === "[") {
      const end = s.indexOf("]", i);
      if (end !== -1) {
        tokens.push({ type: "section", value: s.slice(i + 1, end).trim() });
        i = end + 1;
        continue;
      }
    }

    if (s[i] === "{") {
      tokens.push({ type: "openRepeat" });
      i += 1;
      continue;
    }
    if (s[i] === "}") {
      tokens.push({ type: "closeRepeat" });
      i += 1;
      continue;
    }

    if (s[i] === "N" && (s[i + 1] === "1" || s[i + 1] === "2")) {
      tokens.push({ type: "ending", value: Number(s[i + 1]) });
      i += 2;
      continue;
    }

    if (s[i] === "(") {
      const end = s.indexOf(")", i);
      if (end !== -1) {
        tokens.push({ type: "alternate", value: s.slice(i + 1, end).trim(), raw: s.slice(i, end + 1) });
        i = end + 1;
        continue;
      }
    }

    if (s[i] === "|") {
      tokens.push({ type: "bar" });
      i += 1;
      continue;
    }

    let j = i;
    while (
      j < s.length &&
      !/\s/.test(s[j]) &&
      s[j] !== "|" &&
      s[j] !== "[" &&
      s[j] !== "{" &&
      s[j] !== "}" &&
      s[j] !== "("
    ) {
      j += 1;
    }
    const word = s.slice(i, j);
    if (word === "%") tokens.push({ type: "repeatPrev" });
    else if (word === "N.C." || word === "NC" || word === "n.c." || word === "nc") {
      tokens.push({ type: "noChord" });
    } else if (parseChord(word)) tokens.push({ type: "chord", value: word });
    else tokens.push({ type: "unknown", value: word });
    i = j;
  }

  return tokens;
}

/**
 * @param {string} text
 * @returns {{ ast: object, warnings: Array<{line:number,text:string,message:string}> }}
 */
export function parseChart(text) {
  const warnings = [];
  const ast = emptyAst();

  if (text == null || String(text).trim() === "") {
    return { ast, warnings };
  }

  const lines = String(text).split(/\r?\n/);
  let section = null;
  let measureIndex = 0;
  let pendingOpenRepeat = false;
  let pendingEnding = null;
  let pendingAlternate = null;
  let lastMeasure = null;

  const ensureSection = (label) => {
    section = { label: label ?? "", measures: [] };
    ast.sections.push(section);
  };

  const pushMeasure = ({
    chords = [],
    repeatPrev = false,
    noChord = false,
    invalid = false,
    raw,
    closeRepeat = false,
  }) => {
    if (!section) ensureSection("");
    const measure = {
      index: measureIndex++,
      chords:
        noChord || (repeatPrev && !lastMeasure)
          ? []
          : repeatPrev && lastMeasure
            ? lastMeasure.chords.map(cloneChord)
            : chords,
      alternate: pendingAlternate,
      repeatPrev,
      noChord: !!noChord,
      openRepeat: pendingOpenRepeat,
      closeRepeat,
      ending: pendingEnding,
      invalid,
      raw: invalid ? raw : undefined,
    };
    pendingAlternate = null;
    pendingOpenRepeat = false;
    pendingEnding = null;
    section.measures.push(measure);
    lastMeasure = measure;
  };

  for (let li = 0; li < lines.length; li++) {
    const lineNo = li + 1;
    let line = lines[li];
    if (!line.trim()) continue;

    const tMatch = line.match(/^\s*T(\d)(\d)\b\s*/i);
    if (tMatch) {
      ast.timeSig = { num: Number(tMatch[1]), den: Number(tMatch[2]) };
      line = line.slice(tMatch[0].length);
      if (!line.trim()) continue;
    }

    const tokens = tokenizeLine(line);
    /** @type {{ chords: any[], invalid: boolean, rawParts: string[], hasContent: boolean }} */
    let cell = { chords: [], invalid: false, rawParts: [], hasContent: false };

    const flush = (extra = {}) => {
      if (!cell.hasContent && !extra.repeatPrev && !extra.noChord) return;
      pushMeasure({
        chords: cell.chords,
        invalid: cell.invalid,
        raw: cell.rawParts.join(" "),
        repeatPrev: !!extra.repeatPrev,
        noChord: !!extra.noChord,
        closeRepeat: !!extra.closeRepeat,
      });
      cell = { chords: [], invalid: false, rawParts: [], hasContent: false };
    };

    for (const tok of tokens) {
      switch (tok.type) {
        case "section":
          flush();
          ensureSection(tok.value);
          break;
        case "openRepeat":
          pendingOpenRepeat = true;
          break;
        case "closeRepeat":
          if (lastMeasure && !cell.hasContent) {
            lastMeasure.closeRepeat = true;
          } else {
            flush({ closeRepeat: true });
          }
          break;
        case "ending":
          pendingEnding = tok.value;
          break;
        case "alternate": {
          const ch = parseChord(tok.value);
          if (ch) pendingAlternate = ch;
          else {
            warnings.push({
              line: lineNo,
              text: tok.raw || tok.value,
              message: `No entendí el acorde alternativo "${tok.value}"`,
            });
          }
          break;
        }
        case "bar":
          flush();
          break;
        case "repeatPrev":
          cell.hasContent = true;
          flush({ repeatPrev: true });
          break;
        case "noChord":
          cell.hasContent = true;
          flush({ noChord: true });
          break;
        case "chord": {
          cell.hasContent = true;
          const ch = parseChord(tok.value);
          if (ch) cell.chords.push(ch);
          else {
            cell.invalid = true;
            cell.rawParts.push(tok.value);
            warnings.push({
              line: lineNo,
              text: tok.value,
              message: `No entendí el acorde "${tok.value}"`,
            });
          }
          break;
        }
        case "unknown":
          cell.hasContent = true;
          cell.invalid = true;
          cell.rawParts.push(tok.value);
          warnings.push({
            line: lineNo,
            text: tok.value,
            message: `No entendí "${tok.value}"`,
          });
          break;
        default:
          break;
      }
    }

    flush();
  }

  return { ast, warnings };
}

export function deriveKeyFromAst(ast) {
  if (!ast?.sections?.length) return null;
  let last = null;
  for (const sec of ast.sections) {
    for (const m of sec.measures) {
      if (m.chords?.length) last = m.chords[m.chords.length - 1];
    }
  }
  return last ? { ...last.root } : null;
}

export function countMeasures(ast) {
  return (ast?.sections || []).reduce((n, s) => n + s.measures.length, 0);
}

/**
 * East of the Sun — forma AABA (32) + bridge extendido en C para 40 compases
 * (verificación PLAN.md: 40 compases, secciones A/B/A/C).
 */
export const EAST_OF_SUN_CHART = `T44
[A] Bb^7 | E7    | D-7      | G7   |
    C-7  | %     | Eb-7     | Ab7  |
[B] C-7  | F7    | Ah7 D7b13| G-7  |
    G-7  | C7    | C-7      | F7   |
[A] Bb^7 | E7    | D-7      | G7   |
    C-7  | %     | Eb-7     | Ab7  |
[C] C- C-7/Bb | Ah7 D7b9 | G-7 | C7 |
    C-7  | F7    | Bb^7     | E7   |
    D-7  | G7    | C-7      | F7   |
    Bb^7 | %     | Bb^7     | %    |`;
