import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Save,
  Upload,
} from "lucide-react";
import Chart from "../chart/Chart.jsx";
import { parseChart } from "../chart/parse.js";
import { setMeasureContent, findMeasure } from "../chart/mutate.js";
import { serializeAst } from "../chart/transpose.js";
import {
  loadClave,
  saveClave,
  saveRepertorioFields,
  upsertRepertorioSongs,
} from "../data/sheetWrite.js";
import { importSongsFromHtml } from "../ireal/importSongs.js";
import MeasureInspector from "./MeasureInspector.jsx";

/**
 * Editor visual en #/editor — chart como superficie + inspector por compás.
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
  const [selectedMeasure, setSelectedMeasure] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      setSelectedMeasure(null);
      return;
    }
    setChartText(String(selected.chart || ""));
    setSelectedMeasure(null);
    setStatus(null);
  }, [selected]);

  const { ast, warnings } = useMemo(() => parseChart(chartText), [chartText]);

  const selectedMeasureObj = useMemo(
    () => (ast && selectedMeasure != null ? findMeasure(ast, selectedMeasure) : null),
    [ast, selectedMeasure]
  );

  const dirty = useMemo(() => {
    if (!selected) return false;
    return chartText !== String(selected.chart || "");
  }, [selected, chartText]);

  const applyMeasure = (content) => {
    if (!ast || selectedMeasure == null) return;
    const { ast: next, error } = setMeasureContent(ast, selectedMeasure, content);
    if (error) {
      setStatus({ type: "err", message: error });
      return;
    }
    setChartText(serializeAst(next));
    setStatus(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(chartText);
      setStatus({ type: "ok", message: "Chart copiado al portapapeles" });
    } catch {
      setStatus({
        type: "err",
        message: "No se pudo copiar — abrí modo avanzado y seleccioná el texto",
      });
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
        <header className="be-editor-top">
          <button type="button" className="be-editor-back" onClick={onBack}>
            <ArrowLeft size={14} /> Volver
          </button>
          <div className="be-editor-top-main">
            <div>
              <div className="be-eyebrow">Editor de chart</div>
              <h1 className="be-editor-brand">Partitura viva</h1>
            </div>
            <div className="be-editor-toolbar">
              <label className="be-editor-song">
                <span>Tema</span>
                <select
                  value={songKey}
                  onChange={(e) => setSongKey(e.target.value)}
                >
                  <option value="">Elegí un tema…</option>
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
              <label className="be-editor-clave">
                <span>Clave</span>
                <input
                  type="password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  autoComplete="off"
                  placeholder="Sheet"
                />
              </label>
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
                disabled={!selected || saving || !dirty}
              >
                <Save size={14} /> {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
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
          ) : dirty ? (
            <p className="be-editor-status warn">Cambios sin guardar</p>
          ) : null}
        </header>

        <div className="be-editor-stage">
          <div className="be-editor-canvas">
            {!selected ? (
              <div className="be-editor-empty">
                <p className="be-editor-empty-title">Elegí un tema</p>
                <p className="be-editor-empty-copy">
                  Después tocá un compás en el papel para editarlo.
                </p>
              </div>
            ) : (
              <div className="be-editor-paper be-paper">
                <div className="be-paper-eyebrow">
                  {selected.ensamble_id} · editando
                  {dirty ? " · sin guardar" : ""}
                </div>
                <h2 className="be-paper-title">{selected.titulo}</h2>
                {selected.compositor ? (
                  <div className="be-paper-composer">{selected.compositor}</div>
                ) : null}
                {warnings.length > 0 ? (
                  <p className="be-chart-warn">
                    {warnings.length} aviso
                    {warnings.length === 1 ? "" : "s"} en el chart.
                  </p>
                ) : null}
                {ast?.sections?.length ? (
                  <Chart
                    ast={ast}
                    selectedMeasure={selectedMeasure}
                    onMeasureSelect={setSelectedMeasure}
                    selectLabel="Editar"
                  />
                ) : (
                  <p className="be-notes-empty">
                    Este tema aún no tiene chart. Importá desde iReal o usá
                    modo avanzado.
                  </p>
                )}
              </div>
            )}
          </div>

          <aside className="be-editor-side">
            <MeasureInspector
              measure={selectedMeasureObj}
              measureIndex={selectedMeasure}
              disabled={!selected}
              onApply={applyMeasure}
            />
          </aside>
        </div>

        <details
          className="be-editor-drawer"
          open={showImport}
          onToggle={(e) => setShowImport(e.target.open)}
        >
          <summary>
            <Upload size={14} /> Importar iReal
            <ChevronDown size={14} className="be-editor-drawer-chev" />
          </summary>
          <div className="be-editor-drawer-body">
            <p className="be-editor-hint">
              HTML de un tema o playlist. Idempotente: actualiza si existe,
              crea si falta. No pisa notas ni PDFs.
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
                placeholder="HTML exportado de iReal Pro…"
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
          </div>
        </details>

        <details
          className="be-editor-drawer"
          open={showAdvanced}
          onToggle={(e) => setShowAdvanced(e.target.open)}
        >
          <summary>
            Modo avanzado (texto)
            <ChevronDown size={14} className="be-editor-drawer-chev" />
          </summary>
          <div className="be-editor-drawer-body">
            <label className="be-editor-field">
              <span>Chart raw</span>
              <textarea
                className="be-editor-ta"
                rows={8}
                value={chartText}
                onChange={(e) => setChartText(e.target.value)}
                disabled={!selected}
                placeholder={"T44\n[A] Bb^7 | (Eb7) % | D-7 | G7 |"}
                spellCheck={false}
              />
            </label>
          </div>
        </details>

        <p className="be-editor-hint be-editor-foot">
          Ruta discreta <code>#/editor</code>. Guardar escribe en el Sheet.
        </p>
      </div>
    </div>
  );
}
