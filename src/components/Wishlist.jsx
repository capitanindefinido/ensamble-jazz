import { useEffect, useMemo, useState } from "react";
import { Archive, Heart, Sparkles } from "lucide-react";
import {
  loadClave,
  loadWishlistMe,
  saveClave,
  saveWishlistMe,
  wishlistPropose,
  wishlistSetEstado,
  wishlistVote,
} from "../data/sheetWrite.js";
import {
  MAX_VOTES_PER_PERSON,
  archivedDeseos,
  findDuplicateDeseo,
  newDeseoId,
  rankDeseos,
  votesRemaining,
} from "../data/wishlist.js";

export default function Wishlist({
  ensambleId,
  integrantes,
  deseos,
  votos,
  onLocalUpdate,
  onRefresh,
}) {
  const roster = useMemo(
    () =>
      (integrantes || [])
        .filter((m) => m.ensamble_id === ensambleId && m.nombre)
        .slice()
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))),
    [integrantes, ensambleId]
  );

  const [me, setMe] = useState(() => loadWishlistMe(ensambleId));
  const [titulo, setTitulo] = useState("");
  const [clave, setClave] = useState(() => loadClave());
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setMe(loadWishlistMe(ensambleId));
    setStatus(null);
    setShowArchived(false);
  }, [ensambleId]);

  const ranked = useMemo(
    () => rankDeseos(deseos, votos, ensambleId, me),
    [deseos, votos, ensambleId, me]
  );
  const archived = useMemo(
    () => archivedDeseos(deseos, ensambleId),
    [deseos, ensambleId]
  );
  const remaining = votesRemaining(votos, ensambleId, me);

  const pickMe = (nombre) => {
    setMe(nombre);
    saveWishlistMe(ensambleId, nombre);
    setStatus(null);
  };

  const handlePropose = async (e) => {
    e.preventDefault();
    if (!me) {
      setStatus({ type: "err", message: "Elegí quién sos primero" });
      return;
    }
    const t = titulo.trim();
    if (!t) return;
    const dup = findDuplicateDeseo(deseos, ensambleId, t);
    if (dup) {
      setStatus({ type: "err", message: `Ya está en la lista: ${dup.titulo}` });
      return;
    }

    const id = newDeseoId();
    setBusy(true);
    setStatus(null);
    try {
      const result = await wishlistPropose({
        ensambleId,
        titulo: t,
        propuestoPor: me,
        id,
      });
      if (result.ok) {
        const row = result.deseo || {
          id,
          ensamble_id: ensambleId,
          titulo: t,
          propuesto_por: me,
          estado: "abierta",
          creado: new Date().toISOString().slice(0, 10),
        };
        onLocalUpdate?.({
          deseos: [...(deseos || []), row],
          votos,
        });
        setTitulo("");
        setStatus({ type: "ok", message: "Tema propuesto" });
        onRefresh?.();
      } else {
        setStatus({ type: "err", message: result.error || "No se pudo proponer" });
      }
    } catch (err) {
      setStatus({ type: "err", message: err?.message || "Error de red" });
    } finally {
      setBusy(false);
    }
  };

  const handleVote = async (deseoId, likedByMe) => {
    if (!me) {
      setStatus({ type: "err", message: "Elegí quién sos para votar" });
      return;
    }
    if (!likedByMe && remaining <= 0) {
      setStatus({
        type: "err",
        message: `Ya usaste tus ${MAX_VOTES_PER_PERSON} votos`,
      });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const result = await wishlistVote({
        ensambleId,
        deseoId,
        votante: me,
      });
      if (result.ok) {
        let nextVotos = [...(votos || [])];
        if (result.liked) {
          nextVotos.push({
            ensamble_id: ensambleId,
            deseo_id: deseoId,
            votante: me,
          });
        } else {
          nextVotos = nextVotos.filter(
            (v) =>
              !(
                v.ensamble_id === ensambleId &&
                v.deseo_id === deseoId &&
                v.votante === me
              )
          );
        }
        onLocalUpdate?.({ deseos, votos: nextVotos });
        onRefresh?.();
      } else {
        setStatus({ type: "err", message: result.error || "No se pudo votar" });
      }
    } catch (err) {
      setStatus({ type: "err", message: err?.message || "Error de red" });
    } finally {
      setBusy(false);
    }
  };

  const handleEstado = async (deseoId, estado) => {
    saveClave(clave);
    setBusy(true);
    setStatus(null);
    try {
      const result = await wishlistSetEstado({
        clave,
        ensambleId,
        deseoId,
        estado,
      });
      if (result.ok) {
        const next = (deseos || []).map((d) =>
          d.id === deseoId ? { ...d, estado } : d
        );
        onLocalUpdate?.({ deseos: next, votos });
        setStatus({
          type: "ok",
          message:
            estado === "a_sacar"
              ? "Marcado para sacar"
              : estado === "archivada"
                ? "Archivado"
                : "Reabierto",
        });
        onRefresh?.();
      } else {
        setStatus({
          type: "err",
          message: result.error || "No se pudo cambiar el estado",
        });
      }
    } catch (err) {
      setStatus({ type: "err", message: err?.message || "Error de red" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="be-wishlist">
      <p className="be-wishlist-lead">
        Proponé temas para sacar y repartí hasta {MAX_VOTES_PER_PERSON} me gusta.
        La lista se ordena por votos.
      </p>

      <label className="be-wishlist-field">
        <span>Yo soy</span>
        <select
          value={me}
          onChange={(e) => pickMe(e.target.value)}
          aria-label="Elegí tu nombre"
        >
          <option value="">Elegí tu nombre…</option>
          {roster.map((m) => (
            <option key={m.nombre} value={m.nombre}>
              {m.nombre}
            </option>
          ))}
        </select>
      </label>

      {me ? (
        <p className="be-wishlist-remaining">
          Te quedan <strong>{remaining}</strong> de {MAX_VOTES_PER_PERSON} votos
        </p>
      ) : null}

      <form className="be-wishlist-propose" onSubmit={handlePropose}>
        <label className="be-wishlist-field">
          <span>Proponer tema</span>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Autumn Leaves"
            disabled={!me || busy}
          />
        </label>
        <button
          type="submit"
          className="be-play-btn"
          disabled={!me || busy || !titulo.trim()}
        >
          <Sparkles size={14} /> Proponer
        </button>
      </form>

      <ol className="be-wishlist-list">
        {ranked.length === 0 ? (
          <li className="be-wishlist-empty">Todavía no hay propuestas.</li>
        ) : (
          ranked.map((d, i) => (
            <li
              key={d.id}
              className={
                "be-wishlist-item" + (d.estado === "a_sacar" ? " a-sacar" : "")
              }
            >
              <span className="be-wishlist-rank">{i + 1}</span>
              <div className="be-wishlist-main">
                <span className="be-wishlist-title">{d.titulo}</span>
                <span className="be-wishlist-meta">
                  {d.votes} voto{d.votes === 1 ? "" : "s"}
                  {d.propuesto_por
                    ? ` · propuso ${d.propuesto_por}`
                    : ""}
                  {d.estado === "a_sacar" ? " · a sacar" : ""}
                </span>
              </div>
              <button
                type="button"
                className={
                  "be-wishlist-like" + (d.likedByMe ? " on" : "")
                }
                onClick={() => handleVote(d.id, d.likedByMe)}
                disabled={busy || !me || (!d.likedByMe && remaining <= 0)}
                aria-label={d.likedByMe ? "Quitar me gusta" : "Me gusta"}
                aria-pressed={d.likedByMe}
              >
                <Heart size={16} fill={d.likedByMe ? "currentColor" : "none"} />
                <span>{d.votes}</span>
              </button>
              <div className="be-wishlist-admin">
                {d.estado !== "a_sacar" ? (
                  <button
                    type="button"
                    className="be-wishlist-admin-btn"
                    onClick={() => handleEstado(d.id, "a_sacar")}
                    disabled={busy || !clave}
                    title={!clave ? "Poné la clave abajo" : "Marcar a sacar"}
                  >
                    A sacar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="be-wishlist-admin-btn"
                    onClick={() => handleEstado(d.id, "abierta")}
                    disabled={busy || !clave}
                  >
                    Reabrir
                  </button>
                )}
                <button
                  type="button"
                  className="be-wishlist-admin-btn ghost"
                  onClick={() => handleEstado(d.id, "archivada")}
                  disabled={busy || !clave}
                  title="Archivar"
                >
                  <Archive size={12} />
                </button>
              </div>
            </li>
          ))
        )}
      </ol>

      <label className="be-wishlist-field be-wishlist-clave">
        <span>Clave (profe: a sacar / archivar)</span>
        <input
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoComplete="off"
          placeholder="clave de edición"
        />
      </label>

      {status ? (
        <p
          className={
            "be-wishlist-status" + (status.type === "ok" ? " ok" : " err")
          }
        >
          {status.message}
        </p>
      ) : null}

      {archived.length > 0 ? (
        <div className="be-wishlist-archived">
          <button
            type="button"
            className="be-wishlist-archived-toggle"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Ocultar" : "Ver"} archivados ({archived.length})
          </button>
          {showArchived ? (
            <ul>
              {archived.map((d) => (
                <li key={d.id}>
                  {d.titulo}
                  <button
                    type="button"
                    className="be-wishlist-admin-btn"
                    onClick={() => handleEstado(d.id, "abierta")}
                    disabled={busy || !clave}
                  >
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
