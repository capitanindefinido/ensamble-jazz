import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Music4, Users } from "lucide-react";
import { loadLibrary } from "./data/sheet.js";
import SearchBar from "./components/SearchBar.jsx";
import RepertorioList from "./components/RepertorioList.jsx";
import Roster from "./components/Roster.jsx";
import SongSheet from "./components/SongSheet.jsx";
import EnsemblePicker from "./components/EnsemblePicker.jsx";

function parseEnsambleHash() {
  const raw = window.location.hash || "";
  const m = raw.match(/^#\/ensamble\/([^/?#]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function ensambleHash(id) {
  return `#/ensamble/${encodeURIComponent(id)}`;
}

export default function App() {
  const [tab, setTab] = useState("repertorio");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [bundle, setBundle] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  const [hashId, setHashId] = useState(() =>
    typeof window !== "undefined" ? parseEnsambleHash() : null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await loadLibrary();
        if (cancelled) return;
        setBundle(result.data);
        setMeta(result);
        setStatus("ready");

        if (
          result.networkError &&
          !result.data?.ensambles?.length &&
          !result.data?.repertorio?.length
        ) {
          setError(result.networkError);
          setStatus("error");
        }
      } catch (err) {
        if (cancelled) return;
        setError(err);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onHash = () => setHashId(parseEnsambleHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const ensambles = bundle?.ensambles || [];

  // Sin hash → primer ensamble (replaceState para no ensuciar el historial)
  useEffect(() => {
    if (status !== "ready" || !ensambles.length) return;
    if (hashId) return;
    const first = ensambles[0];
    if (!first?.id) return;
    const next = ensambleHash(first.id);
    if (window.location.hash !== next) {
      window.history.replaceState(null, "", next);
      setHashId(first.id);
    }
  }, [status, ensambles, hashId]);

  const selectedId = hashId;
  const ensambleExists =
    !selectedId || ensambles.some((e) => e.id === selectedId);
  const ensamble = ensambles.find((e) => e.id === selectedId) || null;

  // Al cambiar de ensamble: limpiar búsqueda y sheet abierto
  useEffect(() => {
    setQ("");
    setOpen(null);
  }, [selectedId]);

  const songs = useMemo(() => {
    if (!ensamble) return [];
    return (bundle?.repertorio || [])
      .filter((s) => s.ensamble_id === ensamble.id)
      .slice()
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  }, [bundle, ensamble]);

  const integrantes = useMemo(() => {
    if (!ensamble) return [];
    return (bundle?.integrantes || []).filter(
      (m) => m.ensamble_id === ensamble.id
    );
  }, [bundle, ensamble]);

  const selectEnsamble = (id) => {
    const next = ensambleHash(id);
    if (window.location.hash !== next) {
      window.location.hash = next;
    } else {
      setHashId(id);
    }
  };

  if (status === "loading") {
    return (
      <div className="be-root">
        <div className="be-glow" />
        <div className="be-app">
          <div className="be-msg">Cargando el repertorio…</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="be-root">
        <div className="be-glow" />
        <div className="be-app">
          <div className="be-msg">
            <strong>No pude cargar los datos</strong>
            {error?.message ||
              "Revisa el Sheet y la conexión, e intenta de nuevo."}
          </div>
        </div>
      </div>
    );
  }

  // Ensambles vacío (headers mal / sin filas) — no confundir con repertorio vacío
  if (ensambles.length === 0) {
    const repertorioCount = bundle?.repertorio?.length || 0;
    return (
      <div className="be-root">
        <div className="be-glow" />
        <div className="be-app">
          <header className="be-head">
            <div className="be-eyebrow">Biblioteca de ensambles</div>
            <h1 className="be-ensemble">Sin ensambles</h1>
          </header>
          <div className="be-msg">
            <strong>No hay ensambles cargados</strong>
            Agrega una fila en la pestaña Ensambles del Sheet con id, nombre y
            horario.
            {repertorioCount > 0 ? (
              <>
                {" "}
                Ojo: hay {repertorioCount} tema
                {repertorioCount === 1 ? "" : "s"} en Repertorio, pero sin
                ensamble no se pueden mostrar. Revisa que la pestaña Ensambles
                tenga filas y que los headers digan exactamente id, nombre,
                horario, profe_titular, profe_ayudante.
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Hash apunta a un ensamble que no existe
  if (selectedId && !ensambleExists) {
    return (
      <div className="be-root">
        <div className="be-glow" />
        <div className="be-app">
          <header className="be-head">
            <div className="be-eyebrow">Biblioteca de ensambles</div>
            <h1 className="be-ensemble">Ensamble no encontrado</h1>
          </header>
          <div className="be-msg">
            <strong>No hay un ensamble «{selectedId}»</strong>
            Revisa el link o elige uno de la lista:
          </div>
          {ensambles.length === 0 ? (
            <div className="be-msg">
              Todavía no hay ensambles en los datos. Agrega filas en la pestaña
              Ensambles del Sheet.
            </div>
          ) : (
            <ul className="be-list">
              {ensambles.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="be-row"
                    onClick={() => selectEnsamble(e.id)}
                  >
                    <span className="be-row-main">
                      <span className="be-row-title">{e.nombre}</span>
                      {e.horario ? (
                        <span className="be-row-sub">{e.horario}</span>
                      ) : null}
                    </span>
                    <ChevronRight size={16} className="be-row-chev" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  const showConfigAlert = meta?.configError === true;
  const showStale = !showConfigAlert && meta?.stale === true;
  const showCacheNote =
    !showConfigAlert &&
    !showStale &&
    (meta?.source === "cache" || meta?.source === "snapshot");

  return (
    <div className="be-root">
      <div className="be-glow" />
      <div className="be-app">
        <header className="be-head">
          <div className="be-eyebrow">Biblioteca de ensambles</div>
          <EnsemblePicker
            ensambles={ensambles}
            selectedId={ensamble?.id}
            onSelect={selectEnsamble}
          />
          <div className="be-profes">
            {ensamble?.profe_titular && (
              <span className="be-profe">
                <span className="be-profe-role">Profe titular</span>{" "}
                {ensamble.profe_titular}
              </span>
            )}
            {ensamble?.profe_ayudante && (
              <span className="be-profe">
                <span className="be-profe-role">Profe ayudante</span>{" "}
                {ensamble.profe_ayudante}
              </span>
            )}
          </div>
        </header>

        {showConfigAlert && (
          <div className="be-alert" role="alert">
            <strong>Hay un problema con el Sheet</strong>
            {meta.networkError?.message ||
              "Revisa el Sheet (compartir, ID o nombre de pestaña)."}
            {meta.message ? (
              <>
                {" "}
                Mientras, estás viendo {meta.message}.
              </>
            ) : null}
          </div>
        )}

        {showStale && (
          <div className="be-alert" role="alert">
            <strong>
              Estos datos tienen más de una semana y el Sheet no responde.
            </strong>
            Avísale al profe. Mientras, estás viendo la última copia buena
            {meta.cachedAt
              ? ` (del ${new Date(meta.cachedAt).toLocaleDateString("es-CL")})`
              : ""}
            .
            {meta.networkError?.message
              ? ` Motivo: ${meta.networkError.message}`
              : ""}
          </div>
        )}

        {showCacheNote && (
          <div className="be-status be-status-cache">
            {meta.message || "datos en caché"}
            {meta.networkError?.message
              ? ` · ${meta.networkError.message}`
              : ""}
          </div>
        )}

        <nav className="be-tabs">
          <button
            className={"be-tab" + (tab === "repertorio" ? " active" : "")}
            onClick={() => setTab("repertorio")}
          >
            <Music4 size={15} /> Repertorio
          </button>
          <button
            className={"be-tab" + (tab === "integrantes" ? " active" : "")}
            onClick={() => setTab("integrantes")}
          >
            <Users size={15} /> Integrantes
          </button>
        </nav>

        {tab === "repertorio" && (
          <section>
            <SearchBar value={q} onChange={setQ} />
            <RepertorioList songs={songs} query={q} onOpen={setOpen} />
          </section>
        )}

        {tab === "integrantes" && <Roster integrantes={integrantes} />}

        <footer className="be-foot">
          <span>Club de Jazz de Santiago · Casa Maroto</span>
          <span className="be-foot-credit">prototipo v0 · hecho por Diego</span>
        </footer>
      </div>

      {open && <SongSheet song={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
