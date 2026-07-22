#!/usr/bin/env node
/**
 * Regenera src/data/snapshot.json desde el Google Sheet.
 * Uso: npm run snapshot  (requiere VITE_SHEET_ID en .env)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLibrary } from "../src/data/sheetParse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env");
const outPath = resolve(root, "src/data/snapshot.json");

function loadSheetId() {
  if (process.env.VITE_SHEET_ID) {
    return process.env.VITE_SHEET_ID.trim().replace(/^["']|["']$/g, "");
  }
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key !== "VITE_SHEET_ID") continue;
      return trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    // sin .env
  }
  return "";
}

const sheetId = loadSheetId();
if (!sheetId) {
  console.error(
    "Falta VITE_SHEET_ID. Cópialo en .env (ver .env.example) y vuelve a correr npm run snapshot."
  );
  process.exit(1);
}

console.log(`Bajando Sheet ${sheetId}…`);

try {
  const data = await fetchLibrary(sheetId);
  const out = {
    generado_en: new Date().toISOString(),
    ...data,
  };
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(
    `Listo → src/data/snapshot.json (${out.ensambles.length} ensambles, ${out.repertorio.length} temas, ${out.integrantes.length} integrantes)`
  );
  console.log(`generado_en: ${out.generado_en}`);
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
