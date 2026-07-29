import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  isAuditionPlaying,
  playScaleNotes,
  stopAudition,
} from "../audio/audition.js";

function ListenButton({ scaleId, notes }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => stopAudition(), []);

  const toggle = async () => {
    if (playing && isAuditionPlaying(scaleId)) {
      stopAudition();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await playScaleNotes(notes, {
      id: scaleId,
      onEnd: () => setPlaying(false),
    });
  };

  return (
    <button
      type="button"
      className={"be-improv-listen" + (playing ? " on" : "")}
      onClick={toggle}
      aria-label={playing ? "Detener escala" : "Escuchar escala"}
    >
      {playing ? <VolumeX size={12} /> : <Volume2 size={12} />}
      {playing ? "Detener" : "Escuchar"}
    </button>
  );
}

function ChordDetail({ c }) {
  return (
    <div className="be-improv-chord">
      <div className="be-improv-chord-name">{c.chordLabel}</div>
      {c.primary ? (
        <div className="be-improv-row">
          <span className="be-improv-k">Escala</span>
          <span className="be-improv-v">
            <strong>{c.primary.name}</strong>
            {" · "}
            {c.primary.notes.join(" ")}
            <ListenButton
              scaleId={`chord-${c.chordLabel}-${c.primary.id}`}
              notes={c.primary.notes}
            />
          </span>
        </div>
      ) : null}
      {c.scales?.length > 1 ? (
        <div className="be-improv-row alt">
          <span className="be-improv-k">Alt.</span>
          <span className="be-improv-v">
            {c.scales
              .filter((s) => !s.primary)
              .map((s) => s.name)
              .join(" · ")}
          </span>
        </div>
      ) : null}
      {c.voicings?.shell?.notes?.length ? (
        <div className="be-improv-row">
          <span className="be-improv-k">Piano LH</span>
          <span className="be-improv-v">
            {c.voicings.shell.notes.join("–")}
          </span>
        </div>
      ) : null}
      {c.voicings?.rootless?.notes?.length ? (
        <div className="be-improv-row">
          <span className="be-improv-k">Piano RH</span>
          <span className="be-improv-v">
            {c.voicings.rootless.notes.join("–")}
            <span className="be-improv-form">
              {" "}
              ({c.voicings.rootless.form})
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Panel de ayuda de improvisación (escalas + voicings).
 */
export default function ImprovGuide({
  mode = "chord",
  onModeChange,
  guide,
  sectionGuide,
}) {
  return (
    <div className="be-improv no-print">
      <div className="be-improv-modes">
        <button
          type="button"
          className={"be-improv-mode" + (mode === "chord" ? " on" : "")}
          onClick={() => onModeChange?.("chord")}
        >
          Por acorde
        </button>
        <button
          type="button"
          className={"be-improv-mode" + (mode === "section" ? " on" : "")}
          onClick={() => onModeChange?.("section")}
        >
          Por sección
        </button>
      </div>

      {mode === "section" ? (
        <SectionBody sectionGuide={sectionGuide} />
      ) : (
        <ChordBody guide={guide} />
      )}
    </div>
  );
}

function ChordBody({ guide }) {
  if (!guide?.chords?.length) {
    return (
      <p className="be-improv-empty">
        No hay acordes en este compás. Elige otro o reproduce el chart.
      </p>
    );
  }
  return (
    <>
      <div className="be-improv-head">
        <span className="be-improv-label">
          Compás {guide.measureIndex + 1}
        </span>
        {guide.progression ? (
          <span className="be-improv-prog">{guide.progression}</span>
        ) : null}
      </div>
      {guide.chords.map((c, i) => (
        <ChordDetail key={`${c.chordLabel}-${i}`} c={c} />
      ))}
    </>
  );
}

function SectionBody({ sectionGuide }) {
  if (!sectionGuide?.scales?.length) {
    return (
      <p className="be-improv-empty">
        No hay suficientes acordes en esta sección para sugerir una escala.
      </p>
    );
  }
  const [a, b] = sectionGuide.scales;
  return (
    <>
      <div className="be-improv-head">
        <span className="be-improv-label">
          Sección [{sectionGuide.label}]
        </span>
      </div>
      <p className="be-improv-section-lead">
        En esta parte puedes quedarte en{" "}
        <strong>{a.name}</strong>
        {b ? (
          <>
            {" "}
            (o <strong>{b.name}</strong>)
          </>
        ) : null}
        {" "}sin cambiar de escala en cada acorde.
      </p>
      {sectionGuide.scales.map((s) => (
        <div key={s.id} className="be-improv-chord">
          <div className="be-improv-row">
            <span className="be-improv-k">Escala</span>
            <span className="be-improv-v">
              <strong>{s.name}</strong>
              {" · "}
              {s.notes.join(" ")}
              <ListenButton scaleId={`sec-${s.id}`} notes={s.notes} />
            </span>
          </div>
        </div>
      ))}
      {sectionGuide.outliers?.length ? (
        <p className="be-improv-outliers">
          <strong>Excepciones:</strong>{" "}
          {sectionGuide.outliers
            .map((o) => `${o.label} → ${o.hint}`)
            .join(" · ")}
          . Cambia a “Por acorde” para el detalle.
        </p>
      ) : null}
    </>
  );
}
