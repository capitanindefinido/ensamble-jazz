import Papa from "papaparse";

export const ENSAMBLE_FIELDS = [
  "id",
  "nombre",
  "horario",
  "profe_titular",
  "profe_ayudante",
];
export const REPERTORIO_FIELDS = [
  "ensamble_id",
  "orden",
  "titulo",
  "compositor",
  "feel",
  "bpm",
  "tono",
  "chart",
  "chart_pdf_url",
  "ref_url",
  "notas",
];
export const INTEGRANTE_FIELDS = ["ensamble_id", "nombre", "rol", "instrumento"];

export const TABS = ["Ensambles", "Repertorio", "Integrantes"];

/** Columnas mínimas para detectar pestaña equivocada / headers malos. */
export const REQUIRED_HEADERS = {
  Ensambles: ["id", "nombre"],
  Repertorio: ["ensamble_id", "titulo"],
  Integrantes: ["ensamble_id", "nombre", "rol"],
};

export class SheetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SheetError";
    this.code = code;
  }
}

/** Errores de configuración (no se arreglan solos) vs red transitoria. */
export const CONFIG_ERROR_CODES = new Set(["permisos", "id", "pestana"]);

export function isConfigError(err) {
  return err instanceof SheetError && CONFIG_ERROR_CODES.has(err.code);
}

export function gvizUrl(sheetId, tabName) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
}

/** Normaliza headers: trim + lowercase. Campos ausentes = undefined. */
export function normalizeRow(row, fields) {
  const raw = {};
  for (const [key, value] of Object.entries(row || {})) {
    const k = String(key).trim().toLowerCase();
    if (!k) continue;
    if (value === null || value === undefined) {
      raw[k] = undefined;
    } else {
      const s = String(value);
      raw[k] = s === "" ? undefined : s;
    }
  }
  const out = {};
  for (const f of fields) {
    out[f] = raw[f];
  }
  return out;
}

function pestanaHeadersError(tabName, requiredKeys) {
  return new SheetError(
    "pestana",
    `La pestaña '${tabName}' no existe o sus columnas están mal escritas. Google devolvió otra pestaña en su lugar. Revisa el nombre y que la primera fila tenga: ${requiredKeys.join(", ")}.`
  );
}

function noCompartidoError() {
  return new SheetError(
    "permisos",
    "El Sheet existe pero no está compartido. Ábrelo, Compartir → Acceso general → Cualquiera con el enlace → Lector."
  );
}

function idIncorrectoError() {
  return new SheetError(
    "id",
    "No existe un Sheet con ese ID. Revisa VITE_SHEET_ID."
  );
}

function sinConexionError() {
  return new SheetError(
    "red",
    "Sin conexión. Revisa el wifi de la sala o espera un momento e intenta de nuevo."
  );
}

function looksLikeHtml(text) {
  const t = text.trim().slice(0, 200).toLowerCase();
  return (
    t.startsWith("<!doctype") || t.startsWith("<html") || t.includes("<head")
  );
}

/**
 * Parsea CSV y valida que los headers contengan las columnas clave.
 * gviz no reporta pestaña inexistente (devuelve la primera); la detección
 * es por mismatch de headers.
 */
export function parseCsv(text, fields, { tabName, requiredKeys } = {}) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors?.length) {
    const fatal = result.errors.find(
      (e) => e.type === "Quotes" && (!result.data || result.data.length === 0)
    );
    if (fatal) {
      throw new SheetError(
        "parse",
        "No pude leer el CSV del Sheet. Revisa que las celdas con saltos de línea estén bien entre comillas."
      );
    }
  }

  const headers = (result.meta?.fields || []).map((h) =>
    String(h ?? "")
      .trim()
      .toLowerCase()
  );

  if (requiredKeys?.length) {
    const missing = requiredKeys.filter((k) => !headers.includes(k));
    if (missing.length > 0) {
      throw pestanaHeadersError(tabName || "?", requiredKeys);
    }
  }

  return (result.data || [])
    .map((row) => normalizeRow(row, fields))
    .filter((row) => Object.values(row).some((v) => v !== undefined));
}

/** Coerción numérica que preserva 0 (a diferencia de `Number(x) || x`). */
export function coerceNumber(value) {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

export function coerceRepertorio(rows) {
  return rows.map((r) => ({
    ...r,
    orden: coerceNumber(r.orden),
    bpm: coerceNumber(r.bpm),
  }));
}

/**
 * Baja y parsea una pestaña.
 *
 * Taxonomía (verificada contra Sheet real):
 * - opaqueredirect → no compartido
 * - 404 → ID incorrecto
 * - headers no calzan → pestaña mal / columnas mal
 * - TypeError → sin conexión
 */
export async function fetchTab(sheetId, tabName, fields, fetchFn = fetch) {
  const url = gvizUrl(sheetId, tabName);
  const requiredKeys = REQUIRED_HEADERS[tabName];

  let res;
  try {
    // redirect:"manual": el Sheet restringido redirige a accounts.google.com
    // (sin CORS → TypeError si seguimos el redirect). Con manual llega
    // opaqueredirect y lo clasificamos bien.
    res = await fetchFn(url, { redirect: "manual" });
  } catch {
    throw sinConexionError();
  }

  if (res.type === "opaqueredirect") {
    throw noCompartidoError();
  }

  if (res.status === 404) {
    throw idIncorrectoError();
  }

  if (!res.ok) {
    throw new SheetError(
      "http",
      `No pude cargar la pestaña '${tabName}' (error ${res.status}). Revisa el enlace del Sheet e intenta de nuevo.`
    );
  }

  let text;
  try {
    text = await res.text();
  } catch {
    throw sinConexionError();
  }

  // HTML inesperado (login / error page) con 200 — trato como no compartido
  if (looksLikeHtml(text)) {
    throw noCompartidoError();
  }

  return parseCsv(text, fields, { tabName, requiredKeys });
}

/** Baja las tres pestañas y normaliza al dominio. */
export async function fetchLibrary(sheetId, fetchFn = fetch) {
  const [ensambles, repertorioRaw, integrantes] = await Promise.all([
    fetchTab(sheetId, "Ensambles", ENSAMBLE_FIELDS, fetchFn),
    fetchTab(sheetId, "Repertorio", REPERTORIO_FIELDS, fetchFn),
    fetchTab(sheetId, "Integrantes", INTEGRANTE_FIELDS, fetchFn),
  ]);

  return {
    ensambles,
    repertorio: coerceRepertorio(repertorioRaw),
    integrantes,
  };
}

/** Separa `generado_en` del payload de datos del snapshot. */
export function splitSnapshot(snap) {
  if (!snap || typeof snap !== "object") {
    return {
      generado_en: null,
      data: { ensambles: [], repertorio: [], integrantes: [] },
    };
  }
  const {
    generado_en = null,
    ensambles = [],
    repertorio = [],
    integrantes = [],
  } = snap;
  return {
    generado_en,
    data: { ensambles, repertorio, integrantes },
  };
}
