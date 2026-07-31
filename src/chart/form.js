export function flattenMeasures(ast) {
  if (!ast?.sections?.length) return [];
  const out = [];
  for (const sec of ast.sections) {
    for (const m of sec.measures) out.push(m);
  }
  return out;
}

/**
 * Índice del `{` que cierra en `closeIdx` (sin anidar profundo: último open ≤ close).
 */
export function findRepeatOpen(measures, closeIdx) {
  for (let j = closeIdx; j >= 0; j--) {
    if (measures[j].openRepeat) return j;
  }
  return 0;
}

/**
 * Expande el form escrito a la secuencia de índices de compás para el player.
 * Soporta: { } + N1/N2/(N3), &lt;Nx&gt;, S/Q, D.C./D.S. (+ al Coda/Fine/Ending), Fine, U.
 *
 * @returns {number[]} measure.index en orden de escucha
 */
export function expandPlaybackForm(ast) {
  const measures = flattenMeasures(ast);
  const n = measures.length;
  if (!n) return [];

  const segnoPos = measures.findIndex((m) => m.segno);
  const codaPositions = [];
  for (let k = 0; k < n; k++) {
    if (measures[k].coda) codaPositions.push(k);
  }
  const toCodaPos = codaPositions.length >= 2 ? codaPositions[0] : null;
  const codaStartPos =
    codaPositions.length > 0 ? codaPositions[codaPositions.length - 1] : null;

  const seq = [];
  let i = 0;
  let guard = 0;
  const MAX = Math.max(64, n * 24);

  /** @type {{ open: number, pass: number, maxPass: number } | null} */
  let repeat = null;
  /** Pasada vigente para casillas N1/N2 (sigue válida al salir del `}`). */
  let endingPass = 1;
  let tookJump = false;
  /** @type {null|'coda'|'fine'|{ending:number}} */
  let seek = null;

  while (i < n && guard++ < MAX) {
    const m = measures[i];

    if (m.ending != null && m.ending !== endingPass) {
      i += 1;
      continue;
    }

    // Tras D.C./D.S. al Coda: en el primer Q saltamos al último Q
    if (
      seek === "coda" &&
      toCodaPos != null &&
      codaStartPos != null &&
      i === toCodaPos &&
      toCodaPos !== codaStartPos
    ) {
      i = codaStartPos;
      seek = null;
      continue;
    }
    if (
      seek === "coda" &&
      toCodaPos == null &&
      codaStartPos != null &&
      i === codaStartPos
    ) {
      seek = null;
    }

    if (seek && typeof seek === "object" && seek.ending != null) {
      if (m.ending == null) {
        // aún no llegamos a la casilla pedida — seguir
      } else if (m.ending !== seek.ending) {
        i += 1;
        continue;
      } else {
        seek = null;
      }
    }

    seq.push(m.index);

    // Fine / END solo cortan después de un salto "al Fine" (o END post-jump)
    if (m.fine && seek === "fine") break;
    if (m.endMark && tookJump && seek === "fine") break;

    // Salto D.C. / D.S. (una sola vez)
    if (m.jump && !tookJump) {
      tookJump = true;
      const target = m.jump.al?.target || null;
      if (target === "coda") seek = "coda";
      else if (target === "fine") seek = "fine";
      else if (target === "ending") {
        seek = { ending: m.jump.al.ending };
      } else {
        seek = null;
      }

      if (m.jump.kind === "ds") {
        i = segnoPos >= 0 ? segnoPos : 0;
      } else {
        i = 0;
      }
      repeat = null;
      continue;
    }

    if (m.closeRepeat) {
      const open = findRepeatOpen(measures, i);
      const maxPass = measures[open]?.repeatX || m.repeatX || 2;
      if (!repeat || repeat.open !== open) {
        repeat = { open, pass: 1, maxPass };
      }
      if (repeat.pass < repeat.maxPass) {
        repeat.pass += 1;
        endingPass = repeat.pass;
        i = open;
        continue;
      }
      endingPass = repeat.maxPass;
      repeat = null;
    }

    if (m.openRepeat) {
      const maxPass = m.repeatX || 2;
      if (!repeat || repeat.open !== i) {
        repeat = { open: i, pass: 1, maxPass };
        endingPass = 1;
      }
    }

    i += 1;
  }

  return seq;
}

/**
 * Timeline de objetos measure para el player (misma referencia del AST).
 */
export function playbackTimeline(ast) {
  const measures = flattenMeasures(ast);
  const byIndex = new Map(measures.map((m) => [m.index, m]));
  return expandPlaybackForm(ast)
    .map((idx) => byIndex.get(idx))
    .filter(Boolean);
}
