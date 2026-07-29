import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Save, Upload } from "lucide-react";
import Chart from "../chart/Chart.jsx";
import { parseChart } from "../chart/parse.js";
import {
  loadClave,
  saveClave,
  saveRepertorioFields,
  upsertRepertorioSongs,
} from "../data/sheetWrite.js";
import { importSongsFromHtml } from "../ireal/importSongs.js";

const CHORD_PALETTE = [
  "C", "C-", "C^7", "C-7", "C7", "Co7", "Ch7",
  "Db", "D", "D-", "D^7", "D-7", "D7",
  "Eb", "E", "E-", "E7", "F", "F-", "F^7", "F-7", "F7",
  "G", "G-", "G^7", "G-7", "G7", "Ab", "A", "A-", "A-7", "A7",
  "Bb", "B", "B-", "B7", "%", "|", "[A]", "[B]", "T44",
];

/**
 * Editor discreto en #/editor — no linkeado desde la nav pública.
 */
export default function ChartEditor({ bundle, ensambles, onBack, onLibraryRefresh }) {
  const songs = useMemo(() => {
    const list = (bundle?.repertorio || []).slice();
    list.sort((a, b) => {
      const ea = String(a.ensamble_id || "");
      const eb = String(b.ensamble_id || "");
      if (ea !== eb) return ea.localeCompare(eb);
      return (Number(a.orden) || 0) - (Number(b.orden) || 0);
    });
    return list;
  }, [bundle]);

  const [songKey, setSongKey] = useState("");
  const [chartText, setChartText] = useState("");
  const [clave, setClave] = useState(() => loadClave());
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const [importEnsamble, setImportEnsamble] = useState(
    () => ensambles[0]?.id || ""
  );
  const [importHtml, setImportHtml] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  useEffect(() => {
    if (!importEnsamble && ensambles[0]?.id) {
      setImportEnsamble(ensambles[0].id);
    }
  }, [ensambles, importEnsamble]);

  const selected = useMemo(() => {
    if (!songKey) return null;
    return songs.find((s) => `${s.ensamble_id}::${s.titulo}` === songKey) || null;
  }, [songs, songKey]);

  useEffect(() => {
    if (!selected) {
      setChartText("");
      return;
    }
    setChartText(String(selected.chart || ""));
    setStatus(null);
  }, [selected]);

  const { ast, warnings } = useMemo(
    () => parseChart(chartText),
    [chartText]
  );

  const insertToken = (token) => {
    setChartText((prev) => {
      const pad = prev && !/\s$/.test(prev) ? " " : "";
      return prev + pad + token;
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(chartText);
      setStatus({ type: "ok", message: "Chart copiado al portapapeles" });
    } catch {
      setStatus({ type: "err", message: "No se pudo copiar — selecciona el texto a mano" });
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    saveClave(clave);
    setSaving(true);
    setStatus(null);
    try {
      const result = await saveRepertorioFields({
        clave,
        ensambleId: selected.ensamble_id,
        titulo: selected.titulo,
        chart: chartText,
      });
      if (result.ok) {
        setStatus({ type: "ok", message: "Guardado en el Sheet" });
        onLibraryRefresh?.();
      } else {
        setStatus({
          type: "err",
          message: result.error || "No se pudo guardar",
        });
      }
    } catch (err) {
      setStatus({
        type: "err",
        message: err?.message || "Error de red al guardar",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setImportHtml(text);
      setImportFileName(file.name);
      setImportStatus(null);
    } catch (err) {
      setImportStatus({
        type: "err",
        message: err?.message || "No se pudo leer el archivo",
      });
    }
  };

  const handleImport = async () => {
    if (!importEnsamble) {
      setImportStatus({ type: "err", message: "Elige un ensamble" });
      return;
    }
    if (!importHtml.trim()) {
      setImportStatus({ type: "err", message: "Sube o pega un HTML de iReal" });
      return;
    }

    const parsed = importSongsFromHtml(importHtml);
    if (parsed.error) {
      setImportStatus({ type: "err", message: parsed.error });
      return;
    }
    if (!parsed.songs.length) {
      const reason = parsed.skipped[0]
        ? `${parsed.skipped[0].title}: ${parsed.skipped[0].reason}`
        : "No hay temas para importar";
      setImportStatus({ type: "err", message: reason });
      return;
    }

    saveClave(clave);
    setImporting(true);
    setImportStatus(null);
    try {
      const result = await upsertRepertorioSongs({
        clave,
        ensambleId: importEnsamble,
        songs: parsed.songs,
      });
      if (result.ok) {
        const created = result.createdCount ?? result.created?.length ?? 0;
        const updated = result.updatedCount ?? result.updated?.length ?? 0;
        const skippedN = parsed.skipped.length;
        const parts = [
          `${updated} actualizada${updated === 1 ? "" : "s"}`,
          `${created} nueva${created === 1 ? "" : "s"}`,
        ];
        if (skippedN) parts.push(`${skippedN} omitida${skippedN === 1 ? "" : "s"}`);
        const name = parsed.playlistName ? ` «${parsed.playlistName}»` : "";
        setImportStatus({
          type: "ok",
          message: `Import${name}: ${parts.join(", ")}`,
        });
        await onLibraryRefresh?.();
      } else {
        setImportStatus({
          type: "err",
          message: result.error || "No se pudo importar",
        });
      }
    } catch (err) {
      setImportStatus({
        type: "err",
        message: err?.message || "Error de red al importar",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="be-root be-editor-root">
      <div className="be-glow" />
      <div className="be-app be-editor-app">
        <header className="be-head">
          <button type="button" className="be-editor-back" onClick={onBack}>
            <ArrowLeft size={14} /> Volver
          </button>
          <div className="be-eyebrow">Editor de chart</div>
          <h1 className="be-ensemble">Armar / pegar chart</h1>
        </header>

        <section className="be-editor-import">
          <h2 className="be-editor-section-title">Importar iReal</h2>
          <p className="be-editor-hint">
            HTML de un tema o playlist. Idempotente: actualiza si existe, crea
            si falta. No pisa notas ni PDFs ya cargados.
          </p>

          <label className="be-editor-field">
            <span>Ensamble destino</span>
            <select
              value={importEnsamble}
              onChange={(e) => setImportEnsamble(e.target.value)}
            >
              <option value="">Elige ensamble…</option>
              {ensambles.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre || e.id}
                </option>
              ))}
            </select>
          </label>

          <label className="be-editor-field">
            <span>Archivo .html</span>
            <input type="file" accept=".html,text/html" onChange={handleFile} />
            {importFileName ? (
              <span className="be-editor-file-name">{importFileName}</span>
            ) : null}
          </label>

          <label className="be-editor-field">
            <span>O pega el HTML</span>
            <textarea
              className="be-editor-ta be-editor-ta-sm"
              rows={4}
              value={importHtml}
              onChange={(e) => {
                setImportHtml(e.target.value);
                setImportFileName("");
                setImportStatus(null);
              }}
              placeholder="Pega aquí el HTML exportado de iReal Pro…"
              spellCheck={false}
            />
          </label>

          <div className="be-editor-actions">
            <button
              type="button"
              className="be-play-btn"
              onClick={handleImport}
              disabled={importing || !importHtml.trim()}
            >
              <Upload size={14} />
              {importing ? "Importando…" : "Importar al Sheet"}
            </button>
          </div>

          {importStatus ? (
            <p
              className={
                "be-editor-status" +
                (importStatus.type === "ok" ? " ok" : " err")
              }
            >
              {importStatus.type === "ok" ? <Check size={14} /> : null}
              {importStatus.message}
            </p>
          ) : null}
        </section>

        <hr className="be-editor-sep" />

        <h2 className="be-editor-section-title">Editar chart</h2>

        <label className="be-editor-field">
          <span>Tema</span>
          <select
            value={songKey}
            onChange={(e) => setSongKey(e.target.value)}
          >
            <option value="">Elige un tema…</option>
            {songs.map((s) => (
              <option
                key={`${s.ensamble_id}::${s.titulo}`}
                value={`${s.ensamble_id}::${s.titulo}`}
              >
                [{s.ensamble_id}] {s.titulo}
              </option>
            ))}
          </select>
        </label>

        <div className="be-editor-palette">
          {CHORD_PALETTE.map((t) => (
            <button
              key={t}
              type="button"
              className="be-editor-chip"
              onClick={() => insertToken(t)}
              disabled={!selected}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="be-editor-field">
          <span>Chart</span>
          <textarea
            className="be-editor-ta"
            rows={10}
            value={chartText}
            onChange={(e) => setChartText(e.target.value)}
            disabled={!selected}
            placeholder="T44&#10;[A] Bb^7 | (Eb7) % | D-7 | G7 |"
            spellCheck={false}
          />
        </label>

        {warnings.length > 0 ? (
          <p className="be-chart-warn">
            {warnings.length} aviso{warnings.length === 1 ? "" : "s"} en el
            preview.
          </p>
        ) : null}

        <div className="be-editor-preview be-paper">
          {selected && ast?.sections?.length ? (
            <Chart ast={ast} />
          ) : (
            <p className="be-notes-empty">El preview aparece aquí.</p>
          )}
        </div>

        <label className="be-editor-field">
          <span>Clave de edición</span>
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete="off"
            placeholder="clave del Sheet (Config)"
          />
        </label>

        <div className="be-editor-actions">
          <button
            type="button"
            className="be-play-btn ghost"
            onClick={handleCopy}
            disabled={!chartText}
          >
            <Copy size={14} /> Copiar
          </button>
          <button
            type="button"
            className="be-play-btn"
            onClick={handleSave}
            disabled={!selected || saving}
          >
            <Save size={14} /> {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>

        {status ? (
          <p
            className={
              "be-editor-status" + (status.type === "ok" ? " ok" : " err")
            }
          >
            {status.type === "ok" ? <Check size={14} /> : null}
            {status.message}
          </p>
        ) : null}

        <p className="be-editor-hint">
          Ruta discreta <code>#/editor</code>. Sin Apps Script, usa Copiar y
          pega en la celda chart del Sheet.
        </p>
      </div>
    </div>
  );
}
