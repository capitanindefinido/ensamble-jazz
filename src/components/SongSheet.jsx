import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Play, Upload, X } from "lucide-react";
import Metronome from "./Metronome.jsx";
import Chart, { KeyDisplay, TransposeBar } from "../chart/Chart.jsx";
import {
  deriveKeyFromAst,
  parseChart,
  parseKeyString,
} from "../chart/parse.js";
import {
  deltaToKey,
  preferKeySpelling,
  transposeAst,
  transposePitch,
} from "../chart/transpose.js";

function drivePreviewUrl(url) {
  if (!url) return null;
  const idMatch = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  return url;
}

export default function SongSheet({ song, onClose }) {
  const [showChart, setShowChart] = useState(false);
  const [shift, setShift] = useState(0);
  const [iframeOk, setIframeOk] = useState(true);

  const hasChart = Boolean(song.chart && String(song.chart).trim());
  const hasPdf = Boolean(song.chart_pdf_url && String(song.chart_pdf_url).trim());

  const { ast: baseAst, warnings } = useMemo(
    () => (hasChart ? parseChart(song.chart) : { ast: null, warnings: [] }),
    [hasChart, song.chart]
  );

  const chartKey = useMemo(
    () => (baseAst ? deriveKeyFromAst(baseAst) : null),
    [baseAst]
  );
  const sheetKey = useMemo(() => parseKeyString(song.tono), [song.tono]);

  // Si el Sheet pide otro tono, el chart se muestra en ese tono por defecto
  const baseShift = useMemo(() => {
    if (!chartKey || !sheetKey) return 0;
    return deltaToKey(chartKey, sheetKey);
  }, [chartKey, sheetKey]);

  const totalShift = baseShift + shift;

  const displayKeyPitch = useMemo(() => {
    if (!chartKey) return sheetKey;
    return preferKeySpelling(transposePitch(chartKey, totalShift, true));
  }, [chartKey, sheetKey, totalShift]);

  const displayAst = useMemo(() => {
    if (!baseAst) return null;
    if (totalShift === 0) return baseAst;
    return transposeAst(baseAst, totalShift, displayKeyPitch);
  }, [baseAst, totalShift, displayKeyPitch]);

  useEffect(() => {
    setShift(0);
    setShowChart(false);
    setIframeOk(true);
  }, [song.titulo, song.chart, song.tono]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isTransposed = shift !== 0;
  const previewUrl = hasPdf ? drivePreviewUrl(song.chart_pdf_url) : null;

  return (
    <div className="be-sheet-scrim" onClick={onClose}>
      <div
        className="be-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={song.titulo}
      >
        <button className="be-sheet-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        <div className="be-paper">
          <div className="be-paper-eyebrow">Del repertorio del ensamble</div>
          <h2 className="be-paper-title">{song.titulo}</h2>
          <div className="be-paper-composer">{song.compositor}</div>

          <div className="be-readout">
            <div className="be-readout-cell">
              <span className="be-readout-label">Tono</span>
              <span className="be-readout-key">
                <KeyDisplay
                  pitch={displayKeyPitch || sheetKey}
                  fallback={song.tono || "—"}
                />
              </span>
            </div>
            <div className="be-readout-cell">
              <span className="be-readout-label">Feel</span>
              <span className="be-readout-val">{song.feel}</span>
            </div>
            <div className="be-readout-cell">
              <span className="be-readout-label">Tempo</span>
              <Metronome bpm={Number(song.bpm) || 120} />
            </div>
          </div>

          {showChart ? (
            hasChart && displayAst ? (
              <div className="be-chart-wrap">
                <TransposeBar
                  displayKey={
                    <KeyDisplay
                      pitch={displayKeyPitch || sheetKey}
                      fallback="—"
                    />
                  }
                  isTransposed={isTransposed}
                  onDown={() => setShift((s) => s - 1)}
                  onUp={() => setShift((s) => s + 1)}
                  onReset={() => setShift(0)}
                />
                {warnings.length > 0 ? (
                  <p className="be-chart-warn">
                    Hay {warnings.length} aviso
                    {warnings.length === 1 ? "" : "s"} en el chart — los compases
                    raros aparecen marcados.
                  </p>
                ) : null}
                <Chart ast={displayAst} />
              </div>
            ) : hasPdf && previewUrl && iframeOk ? (
              <div className="be-chart-pdf">
                <iframe
                  title={`Chart PDF — ${song.titulo}`}
                  src={previewUrl}
                  className="be-chart-iframe"
                  onError={() => setIframeOk(false)}
                />
                <a
                  className="be-chart-open-drive"
                  href={song.chart_pdf_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir en Drive <ExternalLink size={13} />
                </a>
              </div>
            ) : hasPdf ? (
              <div className="be-chart-empty">
                <FileText size={26} strokeWidth={1.4} />
                <p className="be-chart-empty-t">No pude mostrar el PDF acá</p>
                <p className="be-chart-empty-s">
                  Ábrelo directo en Drive — el preview no cargó.
                </p>
                <a
                  className="be-chart-open"
                  href={song.chart_pdf_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir en Drive <ExternalLink size={13} />
                </a>
              </div>
            ) : (
              <div className="be-chart-empty">
                <FileText size={26} strokeWidth={1.4} />
                <p className="be-chart-empty-t">Aún no hay chart cargado</p>
                <p className="be-chart-empty-s">
                  Deja el PDF en la carpeta del ensamble y aparece acá para todos.
                </p>
                <button className="be-chart-upload" disabled>
                  <Upload size={14} /> Subir chart
                </button>
              </div>
            )
          ) : (
            <button className="be-chart-open" onClick={() => setShowChart(true)}>
              <FileText size={15} /> Ver chart
            </button>
          )}

          <div className="be-notes">
            <span className="be-notes-label">Notas de ensayo</span>
            {song.notas ? (
              <p className="be-notes-text">{song.notas}</p>
            ) : (
              <p className="be-notes-empty">
                Sin notas todavía. Agrega tono de ensayo, cortes o quién solea.
              </p>
            )}
          </div>

          {song.ref_url ? (
            <a
              className="be-ref"
              href={song.ref_url}
              target="_blank"
              rel="noreferrer"
            >
              <Play size={14} /> Escuchar referencia
              <ExternalLink size={13} className="be-ref-ext" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
