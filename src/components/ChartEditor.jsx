import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Save } from "lucide-react";
import Chart from "../chart/Chart.jsx";
import { parseChart } from "../chart/parse.js";
import {
  loadClave,
  saveClave,
  saveRepertorioFields,
} from "../data/sheetWrite.js";

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
export default function ChartEditor({ bundle, ensambles, onBack }) {
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
      setStatus({ type: "err", message: "No pude copiar — seleccioná el texto a mano" });
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

        <label className="be-editor-field">
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
            <p className="be-notes-empty">El preview aparece acá.</p>
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
          Ruta discreta <code>#/editor</code>. Sin Apps Script, usá Copiar y
          pegá en la celda chart del Sheet.
        </p>
      </div>
    </div>
  );
}
