/**
 * Directivas de navegación tipo iReal (<D.S. al Coda>, <Fine>, <3x>, …).
 */

export function parseAlTarget(raw) {
  if (raw == null || String(raw).trim() === "") {
    return { target: null, ending: null };
  }
  const x = String(raw).trim().toLowerCase();
  if (x.includes("coda")) return { target: "coda", ending: null };
  if (x.includes("fine")) return { target: "fine", ending: null };
  const end = x.match(/(\d+)/);
  if (x.includes("end") && end) {
    return { target: "ending", ending: Number(end[1]) };
  }
  return { target: null, ending: null };
}

/**
 * @param {string} text contenido de <...> ya limpio
 * @returns {null|{type:'fine'}|{type:'repeatX',times:number}|{type:'jump',kind:'dc'|'ds',al:{target,ending}}}
 */
export function parseNavDirective(text) {
  const t = String(text || "")
    .replace(/^\*+\d*\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;

  if (/^fine\.?$/i.test(t)) return { type: "fine" };

  const rx = /^(\d+)\s*x$/i.exec(t);
  if (rx) return { type: "repeatX", times: Number(rx[1]) };

  const dc = /^d\.?\s*c\.?(?:\s*\.?\s*al\s+(.+))?$/i.exec(t);
  if (dc) {
    return { type: "jump", kind: "dc", al: parseAlTarget(dc[1]) };
  }
  const ds = /^d\.?\s*s\.?(?:\s*\.?\s*al\s+(.+))?$/i.exec(t);
  if (ds) {
    return { type: "jump", kind: "ds", al: parseAlTarget(ds[1]) };
  }
  return null;
}

export function formatJump(jump) {
  if (!jump?.kind) return "";
  const head = jump.kind === "ds" ? "D.S." : "D.C.";
  const al = jump.al;
  if (!al?.target) return head;
  if (al.target === "coda") return `${head} al Coda`;
  if (al.target === "fine") return `${head} al Fine`;
  if (al.target === "ending" && al.ending) {
    const ord =
      al.ending === 1 ? "1st" : al.ending === 2 ? "2nd" : `${al.ending}rd`;
    return `${head} al ${ord} End.`;
  }
  return head;
}

export function formatNavPrefix(m) {
  let s = "";
  if (m.segno) s += "S ";
  if (m.coda) s += "Q ";
  if (m.fermata) s += "f ";
  if (m.endMark) s += "U ";
  if (m.fine) s += "<Fine> ";
  if (m.jump) s += `<${formatJump(m.jump)}> `;
  if (m.repeatX) s += `<${m.repeatX}x> `;
  return s;
}
