/**
 * Traduce HTML iReal (1 tema o playlist) a filas listas para Sheet/CSV.
 * Compartido entre CLI y la app (#/editor).
 */

import { parseChart } from "../chart/parse.js";
import { serializeAst, transposeAst } from "../chart/transpose.js";
import { parseIrealPlaylist, resolvePlayedKey } from "./playlist.js";
import { translateIrealBody } from "./translate.js";

export function normTitle(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Clave corta sin sufijos entre paréntesis. */
export function matchKey(t) {
  return normTitle(String(t || "").replace(/\([^)]*\)/g, " "));
}

/**
 * @param {Map<string, number>} byTitle
 * @param {string} title
 * @returns {number|null}
 */
export function findRowIndex(byTitle, title) {
  const full = normTitle(title);
  if (byTitle.has(full)) return byTitle.get(full);
  const short = matchKey(title);
  if (short && byTitle.has(short)) return byTitle.get(short);
  for (const [k, idx] of byTitle) {
    if (k === short || k.startsWith(short + " ") || short.startsWith(k + " ")) {
      return idx;
    }
  }
  return null;
}

/**
 * Traduce un tema parseado de la playlist.
 * @param {object} song entrada de parseIrealPlaylist
 */
export function importSong(song) {
  if (!song.ok) return { skip: true, title: song.title, reason: song.error };

  const translated = translateIrealBody(song.bodyRaw);
  if (translated.error) {
    return { skip: true, title: song.title, reason: translated.error };
  }

  const keyInfo = resolvePlayedKey(song.storedKey, song.transposePc);
  if (keyInfo.error) {
    return { skip: true, title: song.title, reason: keyInfo.error };
  }

  const { ast } = parseChart(translated.chartText);

  let chartText = translated.chartText;
  if (keyInfo.delta !== 0) {
    const dest = keyInfo.playedPitch;
    chartText = serializeAst(transposeAst(ast, keyInfo.delta, dest));
  }
  chartText = chartText.replace(/\r?\n/g, " ").replace(/  +/g, " ").trim();

  const notesText = (translated.notes || []).filter(Boolean).join("; ");

  return {
    skip: false,
    title: song.title,
    composer: song.composer,
    feel: song.feel,
    bpmExport: song.bpmExport,
    tono: keyInfo.tono,
    chart: chartText,
    notesText,
    storedKey: song.storedKey,
    delta: keyInfo.delta,
  };
}

/**
 * Parsea HTML y traduce todos los temas.
 * @param {string} html
 * @returns {{
 *   error: string|null,
 *   playlistName: string|null,
 *   songs: Array<{
 *     titulo: string,
 *     compositor: string,
 *     feel: string,
 *     bpm: string,
 *     tono: string,
 *     chart: string,
 *     notesText: string,
 *   }>,
 *   skipped: Array<{ title: string, reason: string }>,
 * }}
 */
export function importSongsFromHtml(html) {
  const playlist = parseIrealPlaylist(html);
  if (playlist.error) {
    return {
      error: playlist.error,
      playlistName: null,
      songs: [],
      skipped: [],
    };
  }

  const songs = [];
  const skipped = [];

  for (const song of playlist.songs) {
    const result = importSong(song);
    if (result.skip) {
      skipped.push({ title: result.title, reason: result.reason });
      continue;
    }
    songs.push({
      titulo: result.title,
      compositor: result.composer || "",
      feel: result.feel || "",
      bpm:
        result.bpmExport != null && Number.isFinite(result.bpmExport)
          ? String(result.bpmExport)
          : "",
      tono: result.tono || "",
      chart: result.chart || "",
      notesText: result.notesText || "",
      storedKey: result.storedKey,
      delta: result.delta,
    });
  }

  return {
    error: null,
    playlistName: playlist.playlistName,
    songs,
    skipped,
  };
}
