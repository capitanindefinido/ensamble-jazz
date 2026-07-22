import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

/**
 * Selector de ensamble. Con uno solo, el título no es pinchable.
 * Con varios, el h1.be-ensemble actúa como botón y despliega .be-list/.be-row.
 */
export default function EnsemblePicker({
  ensambles,
  selectedId,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const multi = ensambles.length > 1;
  const current = ensambles.find((e) => e.id === selectedId) || ensambles[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [selectedId]);

  if (!current) {
    return <h1 className="be-ensemble">Sin ensamble</h1>;
  }

  if (!multi) {
    return <h1 className="be-ensemble">{current.nombre}</h1>;
  }

  return (
    <div className="be-ensemble-wrap" ref={rootRef}>
      <button
        type="button"
        className="be-ensemble be-ensemble-btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        {current.nombre}
        <ChevronRight
          size={18}
          className={"be-ensemble-chev" + (open ? " open" : "")}
          aria-hidden
        />
      </button>

      {open && (
        <ul className="be-list be-ensemble-menu" role="listbox">
          {ensambles.map((e) => {
            const active = e.id === selectedId;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={"be-row" + (active ? " active" : "")}
                  onClick={() => {
                    onSelect(e.id);
                    setOpen(false);
                  }}
                >
                  <span className="be-row-main">
                    <span className="be-row-title">{e.nombre}</span>
                    {e.horario ? (
                      <span className="be-row-sub">{e.horario}</span>
                    ) : null}
                  </span>
                  {!active && (
                    <ChevronRight size={16} className="be-row-chev" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
