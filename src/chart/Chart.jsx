import { useEffect, useRef } from "react";
import { formatPitch } from "./parse.js";

/**
 * Renderer del chart sobre el papel.
 * Grid de 4 compases por fila. data-measure={index} para el slice 7.
 */
export default function Chart({ ast, activeMeasure = null }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (activeMeasure == null || !rootRef.current) return;
    const el = rootRef.current.querySelector(
      `[data-measure="${activeMeasure}"]`
    );
    if (!el || typeof el.scrollIntoView !== "function") return;
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [activeMeasure]);

  if (!ast?.sections?.length) {
    return null;
  }

  return (
    <div className="be-chart" ref={rootRef}>
      {ast.sections.map((sec, si) => (
        <section key={`${sec.label}-${si}`} className="be-chart-section">
          {sec.label ? (
            <div className="be-chart-label">[{sec.label}]</div>
          ) : null}
          <div className="be-chart-grid">
            {chunk(sec.measures, 4).map((row, ri) => (
              <div key={ri} className="be-chart-row">
                {row.map((m) => (
                  <Measure
                    key={m.index}
                    measure={m}
                    active={activeMeasure === m.index}
                  />
                ))}
                {Array.from({ length: 4 - row.length }).map((_, i) => (
                  <div key={`pad-${i}`} className="be-chart-measure pad" />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Measure({ measure: m, active }) {
  const cls =
    "be-chart-measure" +
    (m.invalid ? " invalid" : "") +
    (m.openRepeat ? " open-rep" : "") +
    (m.closeRepeat ? " close-rep" : "") +
    (active ? " active" : "");

  return (
    <div className={cls} data-measure={m.index}>
      {m.ending ? <span className="be-chart-ending">N{m.ending}</span> : null}
      {m.alternate ? (
        <span className="be-chart-alt">
          <ChordView chord={m.alternate} />
        </span>
      ) : null}
      <div className="be-chart-chords">
        {m.repeatPrev ? (
          <span className="be-chart-pct" aria-label="repite compás anterior">
            <svg
              className="be-chart-pct-svg"
              viewBox="0 0 28 36"
              width="28"
              height="36"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="8" cy="8" r="3.2" fill="currentColor" />
              <line
                x1="22"
                y1="4"
                x2="6"
                y2="32"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
              <circle cx="20" cy="28" r="3.2" fill="currentColor" />
            </svg>
          </span>
        ) : m.invalid ? (
          <span className="be-chart-raw">{m.raw || "?"}</span>
        ) : (
          (m.chords || []).map((c, i) => (
            <ChordView key={i} chord={c} />
          ))
        )}
      </div>
    </div>
  );
}

function ChordView({ chord }) {
  const root = formatPitch(chord.root);
  const rootLetter = root[0];
  const rootAlter = root.slice(1);
  const qualityMark = qualitySymbol(chord.quality, chord.ext);
  const ext = (chord.ext || []).join("");
  const bass = chord.bass ? formatPitch(chord.bass) : null;

  return (
    <span className="be-chord">
      <span className="be-chord-root">
        {rootLetter}
        {rootAlter ? <sup className="be-chord-acc">{prettyAcc(rootAlter)}</sup> : null}
      </span>
      {qualityMark ? <span className="be-chord-qual">{qualityMark}</span> : null}
      {ext ? <sup className="be-chord-ext">{prettyAcc(ext)}</sup> : null}
      {bass ? (
        <span className="be-chord-bass">
          /{bass[0]}
          {bass.slice(1) ? (
            <sup className="be-chord-acc">{prettyAcc(bass.slice(1))}</sup>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/** Tonalidad con el mismo formateo visual que las raíces del chart. */
export function KeyDisplay({ pitch, fallback }) {
  if (!pitch) {
    return <span>{fallback || "—"}</span>;
  }
  const root = formatPitch(pitch);
  return (
    <span className="be-chord-root">
      {root[0]}
      {root.slice(1) ? (
        <sup className="be-chord-acc">{prettyAcc(root.slice(1))}</sup>
      ) : null}
    </span>
  );
}

function qualitySymbol(q, ext) {
  switch (q) {
    case "maj":
      // maj7 / maj9 → △
      if ((ext || []).some((e) => /^(7|9|11|13)$/.test(e))) return "△";
      return null;
    case "min":
      return "−";
    case "halfdim":
      return "ø";
    case "dim":
      return "°";
    case "aug":
      return "+";
    case "sus":
      return "sus";
    case "dom":
      return null;
    default:
      return null;
  }
}

function prettyAcc(s) {
  return String(s).replace(/b/g, "♭").replace(/#/g, "♯").replace(/\^/g, "△");
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Controles de tono − / + / volver */
export function TransposeBar({
  displayKey,
  isTransposed,
  onDown,
  onUp,
  onReset,
}) {
  return (
    <div className="be-transpose">
      <button type="button" className="be-transpose-btn" onClick={onDown} aria-label="Bajar un semitono">
        −
      </button>
      <span className="be-transpose-key">{displayKey || "—"}</span>
      <button type="button" className="be-transpose-btn" onClick={onUp} aria-label="Subir un semitono">
        +
      </button>
      {isTransposed ? (
        <button type="button" className="be-transpose-reset" onClick={onReset}>
          volver al original
        </button>
      ) : null}
    </div>
  );
}
