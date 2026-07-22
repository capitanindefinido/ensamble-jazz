/**
 * Metadatos crudos del link irealb:// (no de ireal-reader).
 * Layout (separador `=`, temas con `===`, último segmento = playlist):
 *   [0] título  [1] compositor  [3] estilo  [4] tono guardado
 *   [5] tono tocado (pc)  [6] cuerpo scrambled  [7] feel  [8] bpm
 */

import { createRequire } from "node:module";
import { parseKeyString, formatKey } from "../chart/parse.js";
import { pitchClass } from "../chart/transpose.js";

const require = createRequire(import.meta.url);
const unscramble = require("ireal-reader/unscramble.js");

const MUSIC_PREFIX = "1r34LbKcu7";
const PROTOCOL_RE = /irealb:\/\/([^"'\s]+)/i;

/** Pitch class 0=C … 10=Bb — ortografía preferida en bemoles. */
const PC_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function cleanTitle(title) {
  return String(title || "")
    .replace(/\s*-\s*\d{10,}\s*$/, "")
    .trim();
}

/** "Strayhorn Billy" → "Billy Strayhorn" */
export function flipComposer(composer) {
  const parts = String(composer || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts.join(" ");
  const last = parts[0];
  const first = parts.slice(1).join(" ");
  return `${first} ${last}`;
}

/** "Jazz-Medium Up Swing" → "Medium Up Swing" */
export function feelFrom(compStyle) {
  return String(compStyle || "").replace(/^Jazz-/i, "").trim();
}

/**
 * [4] tono guardado (ej. G, A-); [5] pc del tono en que se toca.
 * Si [4] es menor, [5] es la relativa mayor del tono de performance.
 */
export function resolvePlayedKey(storedKeyRaw, transposePc) {
  const storedRaw = String(storedKeyRaw || "C").trim();
  const isMinor = /-$/.test(storedRaw) || /m$/i.test(storedRaw);
  const tonicStr = storedRaw.replace(/-$/, "").replace(/m$/i, "");
  const storedPitch = parseKeyString(tonicStr);
  if (!storedPitch) {
    return { error: `tono guardado inválido: ${storedKeyRaw}` };
  }

  const pc = Number(transposePc);
  if (!Number.isFinite(pc) || pc < 0 || pc > 11) {
    return { error: `transpose pc inválido: ${transposePc}` };
  }

  const relMajorPc = isMinor
    ? (pitchClass(storedPitch) + 3) % 12
    : pitchClass(storedPitch);
  const delta = (pc - relMajorPc + 12) % 12;
  const playedTonicPc = isMinor ? (pc - 3 + 12) % 12 : pc;
  const playedPitch = parseKeyString(PC_NAMES[playedTonicPc]);
  const tono = formatKey(playedPitch) + (isMinor ? "-" : "");

  return {
    storedPitch,
    playedPitch,
    isMinor,
    delta,
    tono,
    error: null,
  };
}

/**
 * Extrae canciones del HTML (o URL irealb://) exportado por iReal.
 * Usa ireal-reader SOLO para unscramble del cuerpo.
 */
export function parseIrealPlaylist(htmlOrUrl) {
  const text = String(htmlOrUrl || "");
  const m = PROTOCOL_RE.exec(text);
  if (!m) {
    return { error: "no se encontró enlace irealb://", playlistName: null, songs: [] };
  }

  let decoded;
  try {
    decoded = decodeURIComponent(m[1]);
  } catch {
    return { error: "URI irealb mal codificada", playlistName: null, songs: [] };
  }

  const parts = decoded.split("===");
  const playlistName = parts.length > 1 ? parts.pop() : null;
  const songs = [];

  for (const part of parts) {
    if (!part || !part.trim()) continue;
    const musicIdx = part.indexOf(MUSIC_PREFIX);
    if (musicIdx === -1) {
      songs.push({
        ok: false,
        error: "sin cuerpo 1r34LbKcu7",
        title: part.split("=")[0] || "?",
      });
      continue;
    }

    const headFields = part.slice(0, musicIdx).split("=");
    const afterFields = part.slice(musicIdx + MUSIC_PREFIX.length).split("=");
    const scrambled = afterFields[0] || "";
    const bodyRaw = unscramble.ireal(scrambled);

    const titleRaw = headFields[0] ?? "";
    const composerRaw = headFields[1] ?? "";
    const styleShort = headFields[3] ?? "";
    const storedKey = headFields[4] ?? "C";
    const transposePc = headFields[5] ?? "0";
    const feelRaw = afterFields[1] ?? "";
    const bpmRaw = afterFields[2] ?? "";

    songs.push({
      ok: true,
      titleRaw,
      title: cleanTitle(titleRaw),
      composerRaw,
      composer: flipComposer(composerRaw),
      styleShort,
      storedKey,
      transposePc: Number(transposePc),
      bodyRaw,
      feel: feelFrom(feelRaw),
      bpmExport: bpmRaw === "" ? null : Number(bpmRaw),
      error: null,
    });
  }

  return { error: null, playlistName, songs };
}

export { MUSIC_PREFIX, PC_NAMES };
