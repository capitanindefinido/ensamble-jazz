import React, { useState, useEffect, useRef } from "react";
import { Search, Users, Music4, X, Play, Pause, ExternalLink, FileText, ChevronRight, Upload } from "lucide-react";

/*
  Biblioteca de Ensambles — Club de Jazz de Santiago
  Prototipo v0 · Ensamble Sábado 10:00–11:00
  Un "iReal del club": repertorio curado por ensamble con chart, tono, feel,
  tempo y referencia. Los datos están hardcodeados para el MVP; en producción
  vienen de una planilla + carpeta de Drive.
*/

const YT = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

const SONGS = [
  { id: "misty", title: "Misty", composer: "Erroll Garner", feel: "Ballad Swing", bpm: 70, key: "B\u266d", ref: YT("Misty Erroll Garner"), notes: "" },
  { id: "atrain", title: "Take the A Train", composer: "Billy Strayhorn", feel: "Medium Up Swing", bpm: 160, key: "C", ref: YT("Take the A Train Duke Ellington"), notes: "" },
  { id: "route66", title: "Route 66", composer: "Bobby Troup", feel: "Medium Up Swing", bpm: 160, key: "F", ref: YT("Route 66 Nat King Cole"), notes: "Con breaks \u2014 ojo con los cortes antes de cada frase." },
  { id: "allofme", title: "All of Me", composer: "Gerald Marks", feel: "Medium Swing", bpm: 120, key: "G", ref: YT("All of Me jazz standard"), notes: "" },
  { id: "eastofsun", title: "East of the Sun", composer: "Brooks Bowman", feel: "Swing Two/Four", bpm: 132, key: "B\u266d", ref: YT("East of the Sun Stan Getz"), notes: "" },
];

const TEACHERS = [
  { name: "Diego Montecinos", role: "Profe titular" },
  { name: "Miguel P\u00e9rez", role: "Profe ayudante" },
];

const PLAYERS = [
  { name: "Diego", you: true },
  { name: "Juan Pablo Andrade" },
  { name: "Roberto" },
  { name: "Caroline" },
  { name: "Francesca" },
  { name: "Pablo S." },
  { name: "Vicente C." },
];

const initials = (n) =>
  n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Metronome({ bpm }) {
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!playing) return;
    const ms = 60000 / bpm;
    const id = setInterval(() => setBeat((b) => (b + 1) % 4), ms);
    return () => clearInterval(id);
  }, [playing, bpm]);

  useEffect(() => {
    if (!playing) setBeat(0);
  }, [playing]);

  return (
    <div className="be-metro">
      <button
        className="be-metro-btn"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Detener tempo" : "Escuchar tempo"}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
        <span>{bpm} bpm</span>
      </button>
      <div className="be-beats" ref={ref}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={
              "be-beat" +
              (playing && beat === i ? (i === 0 ? " on down" : " on") : "")
            }
          />
        ))}
      </div>
    </div>
  );
}

function SongSheet({ song, onClose }) {
  const [showChart, setShowChart] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="be-sheet-scrim" onClick={onClose}>
      <div className="be-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={song.title}>
        <button className="be-sheet-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>

        <div className="be-paper">
          <div className="be-paper-eyebrow">Del repertorio del ensamble</div>
          <h2 className="be-paper-title">{song.title}</h2>
          <div className="be-paper-composer">{song.composer}</div>

          <div className="be-readout">
            <div className="be-readout-cell">
              <span className="be-readout-label">Tono</span>
              <span className="be-readout-key">{song.key}</span>
            </div>
            <div className="be-readout-cell">
              <span className="be-readout-label">Feel</span>
              <span className="be-readout-val">{song.feel}</span>
            </div>
            <div className="be-readout-cell">
              <span className="be-readout-label">Tempo</span>
              <Metronome bpm={song.bpm} />
            </div>
          </div>

          {showChart ? (
            <div className="be-chart-empty">
              <FileText size={26} strokeWidth={1.4} />
              <p className="be-chart-empty-t">A\u00fan no hay chart cargado</p>
              <p className="be-chart-empty-s">
                Deja el PDF en la carpeta del ensamble y aparece ac\u00e1 para todos.
              </p>
              <button className="be-chart-upload" disabled>
                <Upload size={14} /> Subir chart
              </button>
            </div>
          ) : (
            <button className="be-chart-open" onClick={() => setShowChart(true)}>
              <FileText size={15} /> Ver chart
            </button>
          )}

          <div className="be-notes">
            <span className="be-notes-label">Notas de ensayo</span>
            {song.notes ? (
              <p className="be-notes-text">{song.notes}</p>
            ) : (
              <p className="be-notes-empty">
                Sin notas todav\u00eda. Agrega tono de ensayo, cortes o qui\u00e9n solea.
              </p>
            )}
          </div>

          <a className="be-ref" href={song.ref} target="_blank" rel="noreferrer">
            <Play size={14} /> Escuchar referencia
            <ExternalLink size={13} className="be-ref-ext" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("repertorio");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  const filtered = SONGS.filter(
    (s) =>
      s.title.toLowerCase().includes(q.toLowerCase()) ||
      s.composer.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="be-root">
      <style>{CSS}</style>
      <div className="be-glow" />
      <div className="be-app">
        <header className="be-head">
          <div className="be-eyebrow">Biblioteca de ensambles</div>
          <h1 className="be-ensemble">S\u00e1bado · 10:00\u201311:00</h1>
          <div className="be-profes">
            {TEACHERS.map((t) => (
              <span key={t.name} className="be-profe">
                <span className="be-profe-role">{t.role}</span> {t.name}
              </span>
            ))}
          </div>
        </header>

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
            <div className="be-search">
              <Search size={16} className="be-search-ic" />
              <input
                className="be-search-in"
                placeholder="Buscar tema o compositor"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="be-cyclerow">
              <span>{SONGS.length} temas · ciclo actual</span>
              <span className="be-cyclerow-hint">la playlist = las referencias de cada tema</span>
            </div>

            <ul className="be-list">
              {filtered.map((s, i) => (
                <li key={s.id}>
                  <button className="be-row" onClick={() => setOpen(s)}>
                    <span className="be-row-idx">{String(i + 1).padStart(2, "0")}</span>
                    <span className="be-row-main">
                      <span className="be-row-title">{s.title}</span>
                      <span className="be-row-sub">
                        {s.composer} · {s.feel}
                      </span>
                    </span>
                    <span className="be-row-meta">
                      <span className="be-key">{s.key}</span>
                      <span className="be-bpm">{s.bpm}</span>
                    </span>
                    <ChevronRight size={16} className="be-row-chev" />
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="be-noresults">
                  Nada con \u201c{q}\u201d. Prueba con otro tema.
                </li>
              )}
            </ul>
          </section>
        )}

        {tab === "integrantes" && (
          <section className="be-roster">
            <div className="be-roster-group">Cuerpo docente</div>
            {TEACHERS.map((m) => (
              <div key={m.name} className="be-member">
                <span className="be-avatar teacher">{initials(m.name)}</span>
                <span className="be-member-name">{m.name}</span>
                <span className="be-badge">{m.role}</span>
              </div>
            ))}
            <div className="be-roster-group">M\u00fasicos</div>
            {PLAYERS.map((m) => (
              <div key={m.name} className="be-member">
                <span className="be-avatar">{initials(m.name)}</span>
                <span className="be-member-name">
                  {m.name} {m.you && <span className="be-you">t\u00fa</span>}
                </span>
              </div>
            ))}
          </section>
        )}

        <footer className="be-foot">
          <span>Club de Jazz de Santiago · Casa Maroto</span>
          <span className="be-foot-credit">prototipo v0 · hecho por Diego</span>
        </footer>
      </div>

      {open && <SongSheet song={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Space+Mono:wght@400;700&display=swap');

.be-root{
  --ink:#17120e; --panel:#1f1811; --panel2:#241c14;
  --brass:#c9a24b; --brass-soft:#e2c684; --oxblood:#9a3a3a;
  --paper:#ece4d2; --paper-line:#d6cbb0; --paper-ink:#241d14;
  --text:#ebe3d4; --muted:#9c927f; --muted2:#6f675a;
  --line:rgba(201,162,75,.16);
  position:relative; min-height:100%; width:100%;
  background:radial-gradient(120% 80% at 50% -10%, #261d13 0%, var(--ink) 55%);
  color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
.be-glow{position:fixed; top:-140px; left:50%; transform:translateX(-50%);
  width:520px; height:320px; pointer-events:none;
  background:radial-gradient(closest-side, rgba(201,162,75,.22), transparent 70%);
  filter:blur(8px);}
.be-app{position:relative; max-width:460px; margin:0 auto; padding:34px 20px 26px; min-height:100vh; display:flex; flex-direction:column;}

.be-head{margin-bottom:22px;}
.be-eyebrow{font-family:"Space Mono",ui-monospace,monospace; font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:var(--brass); opacity:.85;}
.be-ensemble{font-family:"Fraunces",Georgia,serif; font-weight:600; font-size:30px; line-height:1.05; margin:8px 0 12px; color:#f5efe2; letter-spacing:-.01em;}
.be-profes{display:flex; flex-wrap:wrap; gap:6px 16px;}
.be-profe{font-size:13px; color:var(--text);}
.be-profe-role{font-family:"Space Mono",monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); display:block; margin-bottom:1px;}

.be-tabs{display:flex; gap:6px; margin-bottom:18px; border-bottom:1px solid var(--line); padding-bottom:2px;}
.be-tab{display:flex; align-items:center; gap:7px; background:none; border:none; color:var(--muted);
  font-size:14px; font-weight:500; padding:8px 4px 12px; cursor:pointer; position:relative;}
.be-tab.active{color:#f5efe2;}
.be-tab.active::after{content:""; position:absolute; left:2px; right:2px; bottom:-3px; height:2px; background:var(--brass); border-radius:2px;}

.be-search{display:flex; align-items:center; gap:10px; background:var(--panel); border:1px solid var(--line);
  border-radius:12px; padding:11px 14px; margin-bottom:12px;}
.be-search-ic{color:var(--muted); flex:none;}
.be-search-in{flex:1; background:none; border:none; outline:none; color:var(--text); font-size:15px;}
.be-search-in::placeholder{color:var(--muted2);}

.be-cyclerow{display:flex; justify-content:space-between; align-items:baseline; gap:12px;
  font-family:"Space Mono",monospace; font-size:11px; color:var(--muted); margin:2px 2px 14px; letter-spacing:.02em;}
.be-cyclerow-hint{color:var(--muted2); text-align:right; font-size:10px;}

.be-list{list-style:none; margin:0; padding:0;}
.be-list li + li .be-row{border-top:1px solid var(--line);}
.be-row{display:flex; align-items:center; gap:14px; width:100%; background:none; border:none;
  padding:15px 6px; cursor:pointer; text-align:left; color:inherit; position:relative;
  transition:background .16s ease;}
.be-row::before{content:""; position:absolute; left:-6px; top:8px; bottom:8px; width:2px; background:var(--brass);
  border-radius:2px; opacity:0; transition:opacity .16s ease;}
.be-row:hover{background:rgba(201,162,75,.05);}
.be-row:hover::before{opacity:1;}
.be-row-idx{font-family:"Space Mono",monospace; font-size:12px; color:var(--brass); opacity:.7; width:22px; flex:none;}
.be-row-main{flex:1; min-width:0; display:flex; flex-direction:column; gap:3px;}
.be-row-title{font-family:"Fraunces",Georgia,serif; font-size:19px; font-weight:500; color:#f3ecdd; line-height:1.1;}
.be-row-sub{font-size:12.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.be-row-meta{display:flex; align-items:center; gap:10px; flex:none;}
.be-key{font-family:"Space Mono",monospace; font-weight:700; font-size:13px; color:var(--paper-ink);
  background:var(--brass); border-radius:6px; padding:3px 8px; min-width:26px; text-align:center;}
.be-bpm{font-family:"Space Mono",monospace; font-size:12px; color:var(--muted);}
.be-row-chev{color:var(--muted2); flex:none;}
.be-noresults{padding:26px 6px; color:var(--muted); font-size:14px;}

/* Roster */
.be-roster{display:flex; flex-direction:column;}
.be-roster-group{font-family:"Space Mono",monospace; font-size:10px; letter-spacing:.16em; text-transform:uppercase;
  color:var(--brass); margin:14px 2px 8px;}
.be-member{display:flex; align-items:center; gap:13px; padding:9px 4px; border-bottom:1px solid var(--line);}
.be-avatar{flex:none; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  font-family:"Space Mono",monospace; font-size:13px; color:var(--muted); background:var(--panel2);
  border:1px solid var(--line);}
.be-avatar.teacher{color:var(--paper-ink); background:var(--brass); border-color:var(--brass-soft); font-weight:700;}
.be-member-name{flex:1; font-size:15px; color:var(--text);}
.be-you{font-family:"Space Mono",monospace; font-size:9px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--brass); border:1px solid var(--line); border-radius:4px; padding:1px 5px; margin-left:6px; vertical-align:middle;}
.be-badge{font-family:"Space Mono",monospace; font-size:10px; letter-spacing:.05em; color:var(--brass-soft);
  border:1px solid var(--line); border-radius:20px; padding:4px 10px;}

.be-foot{margin-top:auto; padding-top:26px; display:flex; flex-direction:column; gap:3px;
  font-family:"Space Mono",monospace; font-size:10.5px; color:var(--muted2); letter-spacing:.03em;}
.be-foot-credit{color:var(--brass); opacity:.6;}

/* Song sheet */
.be-sheet-scrim{position:fixed; inset:0; background:rgba(10,7,4,.66); backdrop-filter:blur(3px);
  display:flex; align-items:flex-end; justify-content:center; z-index:40; animation:be-fade .18s ease;}
.be-sheet{position:relative; width:100%; max-width:460px; max-height:92vh; overflow-y:auto;
  animation:be-rise .26s cubic-bezier(.2,.8,.25,1);}
.be-sheet-close{position:absolute; top:16px; right:16px; z-index:2; width:34px; height:34px; border-radius:50%;
  border:none; background:rgba(36,29,20,.7); color:var(--paper); display:flex; align-items:center; justify-content:center; cursor:pointer;}

.be-paper{background:var(--paper);
  background-image:linear-gradient(var(--paper-line) 1px, transparent 1px);
  background-size:100% 34px; background-position:0 96px;
  color:var(--paper-ink); border-radius:18px 18px 0 0; padding:30px 26px 34px; min-height:60vh;
  box-shadow:0 -14px 40px rgba(0,0,0,.4);}
.be-paper-eyebrow{font-family:"Space Mono",monospace; font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:#8a7a52;}
.be-paper-title{font-family:"Fraunces",Georgia,serif; font-weight:600; font-size:36px; line-height:1; margin:8px 0 4px; letter-spacing:-.015em;}
.be-paper-composer{font-family:"Fraunces",Georgia,serif; font-style:italic; font-size:16px; color:#5f5540; margin-bottom:22px;}

.be-readout{display:flex; gap:10px; border-top:1.5px solid var(--paper-ink); border-bottom:1.5px solid var(--paper-ink);
  padding:14px 2px; margin-bottom:22px;}
.be-readout-cell{flex:1; display:flex; flex-direction:column; gap:7px; min-width:0;}
.be-readout-cell + .be-readout-cell{border-left:1px solid var(--paper-line); padding-left:12px;}
.be-readout-label{font-family:"Space Mono",monospace; font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:#8a7a52;}
.be-readout-key{font-family:"Fraunces",Georgia,serif; font-weight:600; font-size:30px; line-height:1; color:var(--oxblood);}
.be-readout-val{font-size:14px; font-weight:500; color:var(--paper-ink); line-height:1.2;}

.be-metro{display:flex; flex-direction:column; gap:8px;}
.be-metro-btn{display:inline-flex; align-items:center; gap:6px; align-self:flex-start;
  background:var(--paper-ink); color:var(--paper); border:none; border-radius:20px;
  font-family:"Space Mono",monospace; font-size:12px; padding:5px 11px; cursor:pointer;}
.be-beats{display:flex; gap:7px;}
.be-beat{width:9px; height:9px; border-radius:50%; background:transparent; border:1.5px solid #b3a680; transition:transform .05s ease, background .05s ease;}
.be-beat.on{background:var(--brass); border-color:var(--brass); transform:scale(1.25);}
.be-beat.on.down{background:var(--oxblood); border-color:var(--oxblood); transform:scale(1.5);}

.be-chart-open{display:inline-flex; align-items:center; gap:8px; background:none; border:1.5px solid var(--paper-ink);
  color:var(--paper-ink); border-radius:10px; font-size:14px; font-weight:500; padding:11px 16px; cursor:pointer; margin-bottom:22px;}
.be-chart-open:hover{background:var(--paper-ink); color:var(--paper);}
.be-chart-empty{border:1.5px dashed #b3a680; border-radius:12px; padding:26px 18px; text-align:center; color:#8a7a52; margin-bottom:22px;}
.be-chart-empty-t{font-family:"Fraunces",Georgia,serif; font-size:17px; color:var(--paper-ink); margin:10px 0 4px;}
.be-chart-empty-s{font-size:13px; line-height:1.4; margin:0 0 14px;}
.be-chart-upload{display:inline-flex; align-items:center; gap:7px; background:#d9cfb5; color:#6f6446; border:none;
  border-radius:8px; font-size:13px; padding:8px 14px; cursor:not-allowed; opacity:.75;}

.be-notes{margin-bottom:24px;}
.be-notes-label{font-family:"Space Mono",monospace; font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#8a7a52; display:block; margin-bottom:6px;}
.be-notes-text{font-size:15px; line-height:1.45; margin:0; color:var(--paper-ink);}
.be-notes-empty{font-size:14px; line-height:1.45; margin:0; color:#98895f; font-style:italic;}

.be-ref{display:flex; align-items:center; gap:9px; background:var(--oxblood); color:var(--paper);
  text-decoration:none; border-radius:12px; padding:14px 18px; font-size:15px; font-weight:500;}
.be-ref-ext{margin-left:auto; opacity:.7;}

@keyframes be-fade{from{opacity:0}to{opacity:1}}
@keyframes be-rise{from{transform:translateY(24px); opacity:.4}to{transform:translateY(0); opacity:1}}

@media (prefers-reduced-motion: reduce){
  .be-sheet, .be-sheet-scrim{animation:none;}
  .be-beat{transition:none;}
}
`;
