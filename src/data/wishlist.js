/**
 * Lógica pura de lista de deseos (ranking, tope de votos, dedupe).
 */

export const MAX_VOTES_PER_PERSON = 3;

export const DESEO_ESTADOS = ["abierta", "a_sacar", "archivada"];

export function normDeseoTitle(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function newDeseoId() {
  const hex = Math.random().toString(16).slice(2, 10);
  return `d_${hex}`;
}

/**
 * @param {Array<{ensamble_id?: string, nombre?: string}>} integrantes
 * @param {string} ensambleId
 * @param {string} nombre
 */
export function isIntegrante(integrantes, ensambleId, nombre) {
  const n = String(nombre || "").trim();
  if (!n) return false;
  return (integrantes || []).some(
    (m) =>
      String(m.ensamble_id || "") === ensambleId &&
      String(m.nombre || "").trim() === n
  );
}

/**
 * @param {Array} deseos
 * @param {string} ensambleId
 * @param {string} titulo
 * @param {string} [excludeId]
 */
export function findDuplicateDeseo(deseos, ensambleId, titulo, excludeId) {
  const key = normDeseoTitle(titulo);
  if (!key) return null;
  return (
    (deseos || []).find(
      (d) =>
        String(d.ensamble_id || "") === ensambleId &&
        d.id !== excludeId &&
        String(d.estado || "") !== "archivada" &&
        normDeseoTitle(d.titulo) === key
    ) || null
  );
}

/**
 * @param {Array<{ensamble_id?: string, deseo_id?: string, votante?: string}>} votos
 * @param {string} ensambleId
 * @param {string} votante
 */
export function votesUsedBy(votos, ensambleId, votante) {
  const v = String(votante || "").trim();
  if (!v) return 0;
  return (votos || []).filter(
    (row) =>
      String(row.ensamble_id || "") === ensambleId &&
      String(row.votante || "").trim() === v
  ).length;
}

export function hasVoted(votos, ensambleId, deseoId, votante) {
  const v = String(votante || "").trim();
  if (!v || !deseoId) return false;
  return (votos || []).some(
    (row) =>
      String(row.ensamble_id || "") === ensambleId &&
      String(row.deseo_id || "") === deseoId &&
      String(row.votante || "").trim() === v
  );
}

export function votesRemaining(votos, ensambleId, votante) {
  return Math.max(
    0,
    MAX_VOTES_PER_PERSON - votesUsedBy(votos, ensambleId, votante)
  );
}

/**
 * Ranking activo (abierta + a_sacar), ordenado por votos desc, empate por creado desc.
 * @returns {Array<{...deseo, votes: number, likedByMe: boolean}>}
 */
export function rankDeseos(deseos, votos, ensambleId, votante = "") {
  const list = (deseos || []).filter(
    (d) =>
      String(d.ensamble_id || "") === ensambleId &&
      (d.estado === "abierta" || d.estado === "a_sacar" || !d.estado)
  );

  const scored = list.map((d) => {
    const id = String(d.id || "");
    const votes = (votos || []).filter(
      (row) =>
        String(row.ensamble_id || "") === ensambleId &&
        String(row.deseo_id || "") === id
    ).length;
    return {
      ...d,
      votes,
      likedByMe: hasVoted(votos, ensambleId, id, votante),
    };
  });

  scored.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    const ca = String(a.creado || "");
    const cb = String(b.creado || "");
    if (ca !== cb) return cb.localeCompare(ca);
    return String(a.titulo || "").localeCompare(String(b.titulo || ""));
  });

  return scored;
}

export function archivedDeseos(deseos, ensambleId) {
  return (deseos || [])
    .filter(
      (d) =>
        String(d.ensamble_id || "") === ensambleId && d.estado === "archivada"
    )
    .slice()
    .sort((a, b) =>
      String(b.creado || "").localeCompare(String(a.creado || ""))
    );
}
