/**
 * Escritura al Google Sheet vía Apps Script (charts, notas, …).
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
  const url = (import.meta.env.VITE_APPS_SCRIPT_URL || "").trim();
  if (!url) {
    return { ok: false, error: "Falta VITE_APPS_SCRIPT_URL en el entorno" };
  }

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
