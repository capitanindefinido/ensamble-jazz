const initials = (n) =>
  String(n || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const ROLE_LABEL = {
  titular: "Profe titular",
  ayudante: "Profe ayudante",
  musico: "Músico",
};

function MemberRow({ member, teacher }) {
  return (
    <div className="be-member">
      <span className={"be-avatar" + (teacher ? " teacher" : "")}>
        {initials(member.nombre)}
      </span>
      <span className="be-row-main">
        <span className="be-member-name">{member.nombre}</span>
        {member.instrumento ? (
          <span className="be-row-sub">{member.instrumento}</span>
        ) : null}
      </span>
      {teacher ? (
        <span className="be-badge">
          {ROLE_LABEL[member.rol] || member.rol}
        </span>
      ) : null}
    </div>
  );
}

export default function Roster({ integrantes }) {
  const teachers = integrantes.filter(
    (m) => m.rol === "titular" || m.rol === "ayudante"
  );
  const players = integrantes.filter(
    (m) => m.rol !== "titular" && m.rol !== "ayudante"
  );

  if (integrantes.length === 0) {
    return (
      <div className="be-msg">
        <strong>Sin integrantes</strong>
        Este ensamble aún no tiene integrantes. Agrega filas en la pestaña
        Integrantes del Sheet y aparecen acá.
      </div>
    );
  }

  return (
    <section className="be-roster">
      {teachers.length > 0 && (
        <>
          <div className="be-roster-group">Cuerpo docente</div>
          {teachers.map((m) => (
            <MemberRow
              key={`${m.rol}-${m.nombre}`}
              member={m}
              teacher
            />
          ))}
        </>
      )}
      {players.length > 0 && (
        <>
          <div className="be-roster-group">Músicos</div>
          {players.map((m) => (
            <MemberRow key={`musico-${m.nombre}`} member={m} />
          ))}
        </>
      )}
    </section>
  );
}
