/**
 * Escritura al Google Sheet vía Apps Script (charts, notas, import iReal).
 * Content-Type text/plain para evitar preflight CORS.
 */

const KEY_STORAGE = "be_editor_clave";

export function loadClave() {
  try {
    return sessionStorage.getItem(KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function saveClave(clave) {
  try {
    sessionStorage.setItem(KEY_STORAGE, String(clave || ""));
  } catch {
    // ignore
  }
}

function appsScriptUrl() {
  return (import.meta.env.VITE_APPS_SCRIPT_URL || "").trim();
}

async function postJson(body) {
  const url = appsScriptUrl();
  if (!url) {
    return { ok: false, error: "Falta VITE_APPS_SCRIPT_URL en el entorno" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` };
  }
}

/**
 * @param {{
 *   clave: string,
 *   ensambleId: string,
 *   titulo: string,
 *   chart?: string,
 *   notas?: string,
 * }} fields
 * Solo se actualizan las columnas presentes (chart / notas).
 */
export async function saveRepertorioFields(fields) {
  const body = {
    clave: fields.clave,
    ensamble_id: fields.ensambleId,
    titulo: fields.titulo,
  };
  if (Object.prototype.hasOwnProperty.call(fields, "chart")) {
    body.chart = fields.chart;
  }
  if (Object.prototype.hasOwnProperty.call(fields, "notas")) {
    body.notas = fields.notas;
  }
  return postJson(body);
}

/**
 * Upsert idempotente de temas (import iReal).
 * @param {{
 *   clave: string,
 *   ensambleId: string,
 *   songs: Array<{
 *     titulo: string,
 *     compositor?: string,
 *     feel?: string,
 *     bpm?: string,
 *     tono?: string,
 *     chart?: string,
 *     notesText?: string,
 *   }>,
 * }} payload
 */
export async function upsertRepertorioSongs(payload) {
  return postJson({
    clave: payload.clave,
    ensamble_id: payload.ensambleId,
    songs: (payload.songs || []).map((s) => ({
      titulo: s.titulo,
      compositor: s.compositor || "",
      feel: s.feel || "",
      bpm: s.bpm || "",
      tono: s.tono || "",
      chart: s.chart || "",
      notesText: s.notesText || "",
    })),
  });
}
