import { ChevronRight } from "lucide-react";

export default function RepertorioList({ songs, query, onOpen }) {
  const q = (query || "").toLowerCase();
  const filtered = songs.filter(
    (s) =>
      (s.titulo || "").toLowerCase().includes(q) ||
      (s.compositor || "").toLowerCase().includes(q)
  );

  if (songs.length === 0) {
    return (
      <div className="be-msg">
        <strong>Sin repertorio</strong>
        Este ensamble aún no tiene repertorio. Agrega una fila en la pestaña
        Repertorio del Sheet y aparece acá.
      </div>
    );
  }

  return (
    <>
      <div className="be-cyclerow">
        <span>
          {songs.length} tema{songs.length === 1 ? "" : "s"} · ciclo actual
        </span>
        <span className="be-cyclerow-hint">
          la playlist = las referencias de cada tema
        </span>
      </div>

      <ul className="be-list">
        {filtered.map((s, i) => (
          <li key={`${s.ensamble_id}-${s.orden}-${s.titulo}`}>
            <button className="be-row" onClick={() => onOpen(s)}>
              <span className="be-row-idx">
                {String(s.orden ?? i + 1).padStart(2, "0")}
              </span>
              <span className="be-row-main">
                <span className="be-row-title">{s.titulo}</span>
                <span className="be-row-sub">
                  {s.compositor} · {s.feel}
                </span>
              </span>
              <span className="be-row-meta">
                <span className="be-key">{s.tono}</span>
                <span className="be-bpm">{s.bpm}</span>
              </span>
              <ChevronRight size={16} className="be-row-chev" />
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="be-noresults">
            Nada con “{query}”. Prueba con otro tema.
          </li>
        )}
      </ul>
    </>
  );
}
