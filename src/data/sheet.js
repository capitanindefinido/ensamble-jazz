import fixtures from "./fixtures.json";
import snapshot from "./snapshot.json";
import {
  SheetError,
  fetchLibrary,
  gvizUrl,
  isConfigError,
  normalizeRow,
  parseCsv,
  splitSnapshot,
  TABS,
} from "./sheetParse.js";

export { SheetError, isConfigError };

/** 7 días — caché más vieja se sirve igual pero marcada `stale: true`. */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const CACHE_PREFIX = "biblioteca-ensambles:v1:";

function cacheKey(sheetId) {
  return `${CACHE_PREFIX}${sheetId}`;
}

function readCache(sheetId) {
  try {
    const raw = localStorage.getItem(cacheKey(sheetId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.timestamp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(sheetId, data) {
  try {
    localStorage.setItem(
      cacheKey(sheetId),
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Quota o modo privado — silencioso
  }
}

export function formatFecha(ts) {
  try {
    return new Date(ts).toLocaleString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

/**
 * Cascada: red → localStorage → snapshot.json.
 * Sin VITE_SHEET_ID → fixtures.
 *
 * Errores TRANSITORIOS (red): caché + nota discreta.
 * Errores de CONFIGURACIÓN (permisos/id/pestaña): caché + aviso prominente.
 */
export async function loadLibrary() {
  const sheetId = import.meta.env.VITE_SHEET_ID;

  if (!sheetId) {
    return {
      data: fixtures,
      source: "fixtures",
    };
  }

  try {
    const data = await fetchLibrary(sheetId);
    writeCache(sheetId, data);
    return { data, source: "network" };
  } catch (err) {
    const configError = isConfigError(err);
    const cache = readCache(sheetId);

    if (cache) {
      const age = Date.now() - cache.timestamp;
      const stale = age > CACHE_MAX_AGE_MS;
      return {
        data: cache.data,
        source: "cache",
        cachedAt: cache.timestamp,
        stale,
        configError,
        message: `datos del ${formatFecha(cache.timestamp)}`,
        networkError: err,
      };
    }

    const { generado_en, data } = splitSnapshot(snapshot);
    return {
      data,
      source: "snapshot",
      generado_en,
      configError,
      message: generado_en
        ? `datos del snapshot (${formatFecha(Date.parse(generado_en))})`
        : "datos del snapshot del repo (aún no regenerado)",
      networkError: err,
    };
  }
}

/** Expone helpers para tests / depuración. */
export const _internal = {
  gvizUrl,
  normalizeRow,
  parseCsv,
  cacheKey,
  CACHE_PREFIX,
  TABS,
};
