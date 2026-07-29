/**
 * Panel de ayuda de improvisación (escalas + voicings).
 */
export default function ImprovGuide({ guide }) {
  if (!guide?.chords?.length) {
    return (
      <div className="be-improv no-print">
        <p className="be-improv-empty">
          Toca un compás del chart para ver escalas y voicings.
        </p>
      </div>
    );
  }

  return (
    <div className="be-improv no-print">
      <div className="be-improv-head">
        <span className="be-improv-label">Ayuda · compás {guide.measureIndex + 1}</span>
        {guide.progression ? (
          <span className="be-improv-prog">{guide.progression}</span>
        ) : null}
      </div>
      {guide.chords.map((c, i) => (
        <div key={`${c.chordLabel}-${i}`} className="be-improv-chord">
          <div className="be-improv-chord-name">{c.chordLabel}</div>
          {c.primary ? (
            <div className="be-improv-row">
              <span className="be-improv-k">Escala</span>
              <span className="be-improv-v">
                <strong>{c.primary.name}</strong>
                {" · "}
                {c.primary.notes.join(" ")}
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
      ))}
    </div>
  );
}
