/**
 * Importa una playlist iReal Pro → plantilla-sheet/Repertorio.csv + .tsv
 *
 * Uso: npm run import-ireal -- ~/Downloads/Ensamble.html
 *      npm run import-ireal -- ~/Downloads/Ensamble.html --ensamble sabado-10
 *
 * No escribe al Google Sheet (eso es slice 6).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { parseChart, parseKeyString } from "../src/chart/parse.js";
import { transposeAst, serializeAst } from "../src/chart/transpose.js";
import { parseIrealPlaylist, resolvePlayedKey } from "../src/ireal/playlist.js";
import { translateIrealBody } from "../src/ireal/translate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const DEFAULT_CSV = resolve(root, "plantilla-sheet/Repertorio.csv");
const DEFAULT_TSV = resolve(root, "plantilla-sheet/Repertorio.tsv");

const HEADERS = [
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

function parseArgs(argv) {
  const args = { htmlPath: null, ensambleId: "sabado-10", csvPath: DEFAULT_CSV, tsvPath: DEFAULT_TSV };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--ensamble") args.ensambleId = argv[++i];
    else if (a === "--csv") args.csvPath = resolve(argv[++i]);
    else if (a === "--tsv") args.tsvPath = resolve(argv[++i]);
    else if (a.startsWith("-")) {
      console.error(`flag desconocida: ${a}`);
      process.exit(1);
    } else rest.push(a);
  }
  args.htmlPath = rest[0] ? resolve(rest[0]) : null;
  return args;
}

function normTitle(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Clave corta sin sufijos entre paréntesis / "with breaks" para matching. */
function matchKey(t) {
  return normTitle(String(t || "").replace(/\([^)]*\)/g, " "));
}

function findRowIndex(byTitle, title) {
  const full = normTitle(title);
  if (byTitle.has(full)) return byTitle.get(full);
  const short = matchKey(title);
  if (short && byTitle.has(short)) return byTitle.get(short);
  // Sheet "Route 66" ↔ iReal "Route 66 (with breaks)"
  for (const [k, idx] of byTitle) {
    if (k === short || k.startsWith(short + " ") || short.startsWith(k + " ")) {
      return idx;
    }
  }
  return null;
}

function emptyRow(ensambleId, orden) {
  return {
    ensamble_id: ensambleId,
    orden: String(orden),
    titulo: "",
    compositor: "",
    feel: "",
    bpm: "",
    tono: "",
    chart: "",
    chart_pdf_url: "",
    ref_url: "",
    notas: "",
  };
}

function loadCsv(path) {
  try {
    const text = readFileSync(path, "utf8");
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    return (parsed.data || [])
      .map((row) => {
        const out = {};
        for (const h of HEADERS) out[h] = row[h] != null ? String(row[h]) : "";
        return out;
      })
      .filter((row) => row.titulo || row.ensamble_id);
  } catch {
    return [];
  }
}

function writeCsv(path, rows) {
  const text = Papa.unparse(rows, { columns: HEADERS, newline: "\n" });
  writeFileSync(path, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

function writeTsv(path, rows) {
  const escape = (v) => String(v ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
  const lines = [HEADERS.join("\t")];
  for (const row of rows) {
    lines.push(HEADERS.map((h) => escape(row[h])).join("\t"));
  }
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function importSong(song) {
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
  // Una sola línea: pegable en Sheet y compatible con el CSV plantilla
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.htmlPath) {
    console.error("Uso: npm run import-ireal -- <archivo.html> [--ensamble sabado-10]");
    process.exit(1);
  }

  let html;
  try {
    html = readFileSync(args.htmlPath, "utf8");
  } catch (err) {
    console.error(`No se pudo leer ${args.htmlPath}: ${err.message}`);
    process.exit(1);
  }

  const playlist = parseIrealPlaylist(html);
  if (playlist.error) {
    console.error(playlist.error);
    process.exit(1);
  }

  console.log(
    `Playlist: ${playlist.playlistName || "(sin nombre)"} — ${playlist.songs.length} tema(s)`
  );

  const rows = loadCsv(args.csvPath);
  const byTitle = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].ensamble_id && rows[i].ensamble_id !== args.ensambleId) continue;
    byTitle.set(normTitle(rows[i].titulo), i);
    const short = matchKey(rows[i].titulo);
    if (short && !byTitle.has(short)) byTitle.set(short, i);
  }

  let maxOrden = 0;
  for (const row of rows) {
    if (row.ensamble_id !== args.ensambleId) continue;
    const n = Number(row.orden);
    if (Number.isFinite(n) && n > maxOrden) maxOrden = n;
  }

  const skipped = [];
  const bpmConflicts = [];
  const notesConflicts = [];
  const imported = [];

  for (const song of playlist.songs) {
    const result = importSong(song);
    if (result.skip) {
      skipped.push({ title: result.title, reason: result.reason });
      continue;
    }

    let idx = findRowIndex(byTitle, result.title);
    let row;
    if (idx == null) {
      maxOrden += 1;
      row = emptyRow(args.ensambleId, maxOrden);
      rows.push(row);
      idx = rows.length - 1;
      byTitle.set(normTitle(result.title), idx);
      const short = matchKey(result.title);
      if (short) byTitle.set(short, idx);
    } else {
      row = rows[idx];
    }

    const prevBpm = String(row.bpm ?? "").trim();
    const exportBpm =
      result.bpmExport != null && Number.isFinite(result.bpmExport)
        ? String(result.bpmExport)
        : "";

    if (prevBpm === "" && exportBpm !== "") {
      row.bpm = exportBpm;
    } else if (prevBpm !== "" && exportBpm !== "" && prevBpm !== exportBpm) {
      bpmConflicts.push({
        title: result.title,
        sheet: prevBpm,
        export: exportBpm,
      });
    }

    const prevNotas = String(row.notas ?? "").trim();
    const exportNotas = String(result.notesText ?? "").trim();
    if (exportNotas) {
      if (prevNotas === "") {
        row.notas = exportNotas;
      } else if (prevNotas !== exportNotas) {
        notesConflicts.push({
          title: result.title,
          sheet: prevNotas,
          export: exportNotas,
        });
      }
    }

    row.ensamble_id = args.ensambleId;
    if (!String(row.titulo || "").trim()) row.titulo = result.title;
    row.compositor = result.composer;
    row.feel = result.feel;
    row.tono = result.tono;
    row.chart = result.chart;
    if (!row.ref_url) {
      const q = encodeURIComponent(`${result.title} ${result.composer}`);
      row.ref_url = `https://www.youtube.com/results?search_query=${q}`;
    }

    imported.push(result);
  }

  writeCsv(args.csvPath, rows);
  writeTsv(args.tsvPath, rows.filter((r) => r.ensamble_id === args.ensambleId));

  console.log(`\nImportados: ${imported.length}`);
  for (const s of imported) {
    console.log(
      `  ✓ ${s.title}  (${s.storedKey} → ${s.tono}${s.delta ? ` Δ${s.delta}` : ""})`
    );
  }

  if (bpmConflicts.length) {
    console.log("\nBPM del export ≠ Sheet (no se pisó; revisar a mano):");
    for (const c of bpmConflicts) {
      console.log(`  · ${c.title}: Sheet=${c.sheet}  export=${c.export}`);
    }
  }

  if (notesConflicts.length) {
    console.log("\nAnotaciones iReal ≠ notas del Sheet (no se pisó; revisar a mano):");
    for (const c of notesConflicts) {
      console.log(`  · ${c.title}: Sheet="${c.sheet}"  export="${c.export}"`);
    }
  }

  if (skipped.length) {
    console.log("\nOmitidos:");
    for (const s of skipped) {
      console.log(`  ✗ ${s.title}: ${s.reason}`);
    }
  }

  console.log(`\nCSV → ${args.csvPath}`);
  console.log(`TSV → ${args.tsvPath}  (pegar en pestaña Repertorio)`);
}

main();
