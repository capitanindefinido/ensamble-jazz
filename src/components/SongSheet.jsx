import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileText, Maximize2, Pause, Play, Printer, RotateCcw, Save, Upload, X } from "lucide-react";
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
import { ChartPlayer } from "../audio/player.js";
import {
  DEFAULT_CLICK_VOLUME,
  DEFAULT_HARMONY_VOLUME,
  setClickVolume,
  setHarmonyVolume,
} from "../audio/scheduler.js";
import {
  loadClave,
  saveClave,
  saveRepertorioFields,
} from "../data/sheetWrite.js";

const BPM_MIN = 40;
const BPM_MAX = 200;

function clampBpm(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 120;
  return Math.max(BPM_MIN, Math.min(BPM_MAX, v));
}

function drivePreviewUrl(url) {
  if (!url) return null;
  const idMatch = String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  return url;
}

export default function SongSheet({ song, onClose, onSongUpdate }) {
  const sheetBpm = clampBpm(Number(song.bpm) || 120);
  const [showChart, setShowChart] = useState(false);
  const [shift, setShift] = useState(0);
  const [iframeOk, setIframeOk] = useState(true);
  const [activeMeasure, setActiveMeasure] = useState(null);
  const [startMeasure, setStartMeasure] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(sheetBpm);
  const [clickVol, setClickVol] = useState(DEFAULT_CLICK_VOLUME);
  const [harmonyVol, setHarmonyVol] = useState(DEFAULT_HARMONY_VOLUME);
  const [atril, setAtril] = useState(false);
  const [notas, setNotas] = useState(String(song.notas || ""));
  const [clave, setClave] = useState(() => loadClave());
  const [notesStatus, setNotesStatus] = useState(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const playerRef = useRef(null);
  const paperRef = useRef(null);
  const wakeLockRef = useRef(null);

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
    const player = new ChartPlayer({
      onMeasure: setActiveMeasure,
      onPlayingChange: setPlaying,
    });
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    p.setAst(displayAst);
    p.setBpm(bpm);
  }, [displayAst, bpm]);

  useEffect(() => {
    setClickVolume(clickVol);
  }, [clickVol]);

  useEffect(() => {
    setHarmonyVolume(harmonyVol);
  }, [harmonyVol]);

  useEffect(() => {
    playerRef.current?.stop();
    setActiveMeasure(null);
  }, [totalShift]);

  useEffect(() => {
    playerRef.current?.stop();
    setShift(0);
    setShowChart(false);
    setIframeOk(true);
    setActiveMeasure(null);
    setStartMeasure(null);
    setBpm(clampBpm(Number(song.bpm) || 120));
    setNotas(String(song.notas || ""));
    setNotesStatus(null);
  }, [song.titulo, song.chart, song.tono, song.bpm, song.notas]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      playerRef.current?.stop();
      setActiveMeasure(null);
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleClose = () => {
    playerRef.current?.stop();
    setActiveMeasure(null);
    onClose();
  };

  const togglePlay = async () => {
    const p = playerRef.current;
    if (!p || !displayAst) return;
    if (playing) {
      p.pause();
    } else {
      p.setAst(displayAst);
      p.setBpm(bpm);
      if (startMeasure != null) {
        await p.play({ fromMeasure: startMeasure });
      } else {
        await p.play();
      }
    }
  };

  const handleRestart = async () => {
    const p = playerRef.current;
    if (!p || !displayAst) return;
    p.setAst(displayAst);
    p.setBpm(bpm);
    setStartMeasure(null);
    await p.restart();
  };

  const handleMeasureSelect = (index) => {
    setStartMeasure((prev) => (prev === index ? null : index));
    playerRef.current?.discardPause?.();
    setActiveMeasure(null);
  };

  const handleSaveNotes = async () => {
    saveClave(clave);
    setSavingNotes(true);
    setNotesStatus(null);
    try {
      const result = await saveRepertorioFields({
        clave,
        ensambleId: song.ensamble_id,
        titulo: song.titulo,
        notas,
      });
      if (result.ok) {
        setNotesStatus({ type: "ok", message: "Notas guardadas" });
        onSongUpdate?.({ ...song, notas });
      } else {
        setNotesStatus({
          type: "err",
          message: result.error || "No se pudieron guardar",
        });
      }
    } catch (err) {
      setNotesStatus({
        type: "err",
        message: err?.message || "Error de red",
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const notesDirty = notas !== String(song.notas || "");

  const bumpBpm = (delta) => setBpm((b) => clampBpm(b + delta));

  const releaseWakeLock = async () => {
    try {
      await wakeLockRef.current?.release?.();
    } catch {
      // ignore
    }
    wakeLockRef.current = null;
  };

  const enterAtril = async () => {
    setShowChart(true);
    setAtril(true);
    try {
      const el = paperRef.current?.closest(".be-sheet") || paperRef.current;
      if (el?.requestFullscreen) await el.requestFullscreen();
    } catch {
      // fullscreen puede fallar en iOS; el layout atril igual ayuda
    }
    try {
      if (navigator.wakeLock?.request) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // fallback silencioso
    }
  };

  const exitAtril = async () => {
    setAtril(false);
    await releaseWakeLock();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!atril) return;
    const onFs = () => {
      if (!document.fullscreenElement) {
        setAtril(false);
        releaseWakeLock();
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [atril]);

  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, []);

  const isTransposed = shift !== 0;
  const previewUrl = hasPdf ? drivePreviewUrl(song.chart_pdf_url) : null;
  const bpmDirty = bpm !== sheetBpm;

  return (
    <div className={"be-sheet-scrim" + (atril ? " atril" : "")} onClick={handleClose}>
      <div
        className={"be-sheet" + (atril ? " atril" : "")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={song.titulo}
      >
        <button
          className="be-sheet-close no-print"
          onClick={atril ? exitAtril : handleClose}
          aria-label={atril ? "Salir de atril" : "Cerrar"}
        >
          <X size={18} />
        </button>

        <div className="be-paper" ref={paperRef}>
          <div className="be-paper-eyebrow">Del repertorio del ensamble</div>
          <h2 className="be-paper-title">{song.titulo}</h2>
          <div className="be-paper-composer">{song.compositor}</div>

          <div className="be-readout no-print">
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
              <Metronome bpm={bpm} />
              <div className="be-bpm-ctrl">
                <button type="button" onClick={() => bumpBpm(-5)} aria-label="Bajar bpm">
                  −
                </button>
                <input
                  type="range"
                  min={BPM_MIN}
                  max={BPM_MAX}
                  value={bpm}
                  onChange={(e) => setBpm(clampBpm(e.target.value))}
                  aria-label="BPM"
                />
                <button type="button" onClick={() => bumpBpm(5)} aria-label="Subir bpm">
                  +
                </button>
                {bpmDirty ? (
                  <button
                    type="button"
                    className="be-bpm-reset"
                    onClick={() => setBpm(sheetBpm)}
                  >
                    {sheetBpm}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="be-mix no-print">
            <label className="be-mix-row">
              <span>Click</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(clickVol * 100)}
                onChange={(e) => setClickVol(Number(e.target.value) / 100)}
              />
            </label>
            <label className="be-mix-row">
              <span>Acordes</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(harmonyVol * 100)}
                onChange={(e) => setHarmonyVol(Number(e.target.value) / 100)}
              />
            </label>
          </div>

          {showChart ? (
            hasChart && displayAst ? (
              <div className="be-chart-wrap">
                <div className="be-chart-toolbar">
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
                  <div className="be-play-controls no-print">
                    <button
                      type="button"
                      className="be-play-btn"
                      onClick={togglePlay}
                      aria-label={playing ? "Pausar chart" : "Reproducir chart"}
                    >
                      {playing ? <Pause size={14} /> : <Play size={14} />}
                      <span>{playing ? "Pausa" : "Play"}</span>
                    </button>
                    <button
                      type="button"
                      className="be-play-btn ghost"
                      onClick={handleRestart}
                      aria-label="Reiniciar desde el inicio"
                    >
                      <RotateCcw size={14} />
                      <span>Reiniciar</span>
                    </button>
                    <button
                      type="button"
                      className="be-play-btn ghost"
                      onClick={enterAtril}
                      aria-label="Modo atril"
                    >
                      <Maximize2 size={14} />
                      <span>Atril</span>
                    </button>
                    <button
                      type="button"
                      className="be-play-btn ghost"
                      onClick={() => window.print()}
                      aria-label="Imprimir chart"
                    >
                      <Printer size={14} />
                      <span>Imprimir</span>
                    </button>
                  </div>
                </div>
                {startMeasure != null ? (
                  <p className="be-play-from">
                    Parte desde compás {startMeasure + 1}
                    <button type="button" onClick={() => setStartMeasure(null)}>
                      quitar
                    </button>
                  </p>
                ) : (
                  <p className="be-play-from">
                    Tocá un compás para partir desde ahí
                  </p>
                )}
                {warnings.length > 0 ? (
                  <p className="be-chart-warn">
                    Hay {warnings.length} aviso
                    {warnings.length === 1 ? "" : "s"} en el chart — los
                    compases raros aparecen marcados.
                  </p>
                ) : null}
                <Chart
                  ast={displayAst}
                  activeMeasure={activeMeasure}
                  startMeasure={startMeasure}
                  onMeasureSelect={handleMeasureSelect}
                />
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
                  Deja el PDF en la carpeta del ensamble y aparece acá para
                  todos.
                </p>
                <button className="be-chart-upload" disabled>
                  <Upload size={14} /> Subir chart
                </button>
              </div>
            )
          ) : (
            <button className="be-chart-open no-print" onClick={() => setShowChart(true)}>
              <FileText size={15} /> Ver chart
            </button>
          )}

          <div className="be-notes no-print">
            <span className="be-notes-label">Notas de ensayo (grupales)</span>
            <textarea
              className="be-notes-ta"
              rows={3}
              value={notas}
              onChange={(e) => {
                setNotas(e.target.value);
                setNotesStatus(null);
              }}
              placeholder="Cortes, quién solea, tono de ensayo…"
            />
            <div className="be-notes-actions">
              <input
                type="password"
                className="be-notes-clave"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="Clave de edición"
                autoComplete="off"
                aria-label="Clave de edición"
              />
              <button
                type="button"
                className="be-play-btn"
                onClick={handleSaveNotes}
                disabled={savingNotes || !notesDirty}
              >
                <Save size={14} />
                {savingNotes ? "Guardando…" : "Guardar notas"}
              </button>
            </div>
            {notesStatus ? (
              <p
                className={
                  "be-notes-status" +
                  (notesStatus.type === "ok" ? " ok" : " err")
                }
              >
                {notesStatus.message}
              </p>
            ) : notesDirty ? (
              <p className="be-notes-status">Hay cambios sin guardar</p>
            ) : null}
          </div>

          {song.ref_url ? (
            <a
              className="be-ref no-print"
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
