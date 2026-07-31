import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  measureEditMode,
  measureSlotTexts,
} from "../chart/mutate.js";
import { parseChord } from "../chart/parse.js";

const QUICK = ["C", "C-", "C^7", "C-7", "C7", "C7b9", "Ch7", "Co7", "%", "N.C."];

/**
 * Panel de edición del compás seleccionado (1–4 slots).
 */
export default function MeasureInspector({
  measure,
  measureIndex,
  disabled,
  onApply,
}) {
  const [mode, setMode] = useState("chords");
  const [slots, setSlots] = useState([""]);
  const [error, setError] = useState(null);
  const [focusSlot, setFocusSlot] = useState(0);

  useEffect(() => {
    if (!measure) {
      setMode("chords");
      setSlots([""]);
      setError(null);
      return;
    }
    const nextMode = measureEditMode(measure);
    setMode(nextMode);
    const texts = measureSlotTexts(measure);
    setSlots(texts.length ? texts : [""]);
    setError(null);
    setFocusSlot(0);
  }, [measure, measureIndex]);

  if (measureIndex == null || !measure) {
    return (
      <div className="be-insp">
        <p className="be-insp-eyebrow">Inspector</p>
        <h3 className="be-insp-title">Tocá un compás</h3>
        <p className="be-insp-empty">
          El chart es la superficie. Elegí un compás a la izquierda y editá
          sus acordes acá.
        </p>
      </div>
    );
  }

  const commit = (nextMode, nextSlots) => {
    if (disabled) return;
    if (nextMode === "repeat") {
      setError(null);
      onApply?.({ mode: "repeat" });
      return;
    }
    if (nextMode === "nc") {
      setError(null);
      onApply?.({ mode: "nc" });
      return;
    }
    const cleaned = nextSlots.map((s) => String(s || "").trim());
    for (const raw of cleaned) {
      if (raw && !parseChord(raw)) {
        setError(`No entiendo «${raw}»`);
        return;
      }
    }
    setError(null);
    onApply?.({ mode: "chords", slots: cleaned.filter(Boolean) });
  };

  const setModeAndCommit = (next) => {
    setMode(next);
    if (next === "chords") {
      const base = slots.length ? slots : [""];
      setSlots(base);
      commit("chords", base);
    } else {
      commit(next, slots);
    }
  };

  const updateSlot = (i, value) => {
    const next = slots.slice();
    next[i] = value;
    setSlots(next);
    if (!value.trim() || parseChord(value.trim())) {
      commit("chords", next);
    } else {
      setError(`No entiendo «${value.trim()}»`);
    }
  };

  const addSlot = () => {
    if (slots.length >= 4) return;
    const next = [...slots, ""];
    setSlots(next);
    setFocusSlot(next.length - 1);
  };

  const removeSlot = (i) => {
    if (slots.length <= 1) {
      setSlots([""]);
      commit("chords", [""]);
      return;
    }
    const next = slots.filter((_, idx) => idx !== i);
    setSlots(next);
    commit("chords", next);
  };

  const insertQuick = (token) => {
    if (token === "%") {
      setModeAndCommit("repeat");
      return;
    }
    if (token === "N.C.") {
      setModeAndCommit("nc");
      return;
    }
    if (mode !== "chords") {
      setMode("chords");
      setSlots([token]);
      commit("chords", [token]);
      return;
    }
    const next = slots.slice();
    const i = Math.min(focusSlot, next.length - 1);
    next[i] = token;
    setSlots(next);
    commit("chords", next);
  };

  return (
    <div className="be-insp">
      <p className="be-insp-eyebrow">Compás {measureIndex + 1}</p>
      <h3 className="be-insp-title">Editar</h3>

      <div className="be-insp-modes" role="tablist" aria-label="Tipo de compás">
        <button
          type="button"
          role="tab"
          className={"be-insp-mode" + (mode === "chords" ? " on" : "")}
          aria-selected={mode === "chords"}
          disabled={disabled}
          onClick={() => setModeAndCommit("chords")}
        >
          Acordes
        </button>
        <button
          type="button"
          role="tab"
          className={"be-insp-mode" + (mode === "repeat" ? " on" : "")}
          aria-selected={mode === "repeat"}
          disabled={disabled}
          onClick={() => setModeAndCommit("repeat")}
        >
          %
        </button>
        <button
          type="button"
          role="tab"
          className={"be-insp-mode" + (mode === "nc" ? " on" : "")}
          aria-selected={mode === "nc"}
          disabled={disabled}
          onClick={() => setModeAndCommit("nc")}
        >
          N.C.
        </button>
      </div>

      {mode === "chords" ? (
        <div className="be-insp-slots">
          {slots.map((slot, i) => (
            <label key={i} className="be-insp-slot">
              <span className="be-insp-slot-label">Slot {i + 1}</span>
              <div className="be-insp-slot-row">
                <input
                  type="text"
                  value={slot}
                  disabled={disabled}
                  spellCheck={false}
                  placeholder="ej. D-7"
                  autoCapitalize="off"
                  autoCorrect="off"
                  onFocus={() => setFocusSlot(i)}
                  onChange={(e) => updateSlot(i, e.target.value)}
                />
                <button
                  type="button"
                  className="be-insp-icon-btn"
                  disabled={disabled}
                  aria-label="Quitar slot"
                  onClick={() => removeSlot(i)}
                >
                  <Minus size={14} />
                </button>
              </div>
            </label>
          ))}
          {slots.length < 4 ? (
            <button
              type="button"
              className="be-insp-add"
              disabled={disabled}
              onClick={addSlot}
            >
              <Plus size={14} /> Otro acorde
            </button>
          ) : null}
        </div>
      ) : (
        <p className="be-insp-hint">
          {mode === "repeat"
            ? "Este compás repite el anterior (%)."
            : "Sin acorde (N.C.)."}
        </p>
      )}

      <div className="be-insp-quick">
        <span className="be-insp-quick-label">Atajos</span>
        <div className="be-insp-chips">
          {QUICK.map((t) => (
            <button
              key={t}
              type="button"
              className="be-insp-chip"
              disabled={disabled}
              onClick={() => insertQuick(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="be-insp-error">{error}</p> : null}

      <div className="be-insp-soon" aria-disabled="true">
        <span className="be-insp-quick-label">Estructura</span>
        <p className="be-insp-hint">
          Agregar / borrar compases y secciones — pronto (fase 2–3).
        </p>
      </div>
    </div>
  );
}
