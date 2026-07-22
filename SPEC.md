# SPEC — Biblioteca de Ensambles

App del Club de Jazz de Santiago. Repertorio curado por ensamble: cada tema con
su chart, tono, feel, tempo y referencia, más los integrantes. Solo lectura,
pública, sin login.

**En producción:** https://club-de-jazz.vercel.app

---

## 1. El problema y la decisión que lo define

Los ensambles del club manejan su repertorio en WhatsApp, PDFs sueltos y la
memoria de cada profe. La app junta eso en un lugar, con una condición: **el
contenido lo edita gente no técnica, sin tocar código**, y el club tiene que ser
dueño de todo.

De ahí salen dos decisiones que estructuran el resto:

**Los datos viven en un Google Sheet, no en una base de datos.** Los profes ya
saben usar planillas. No hay backend que mantener, no hay servidor que se caiga,
y si el desarrollador desaparece el Sheet sigue siendo del club y sigue teniendo
todo.

**El chart es data, no un PDF.** Un chart de jazz es una grilla de compases con
un símbolo de acorde en cada uno: cabe en un string corto. Guardarlo como texto
en vez de como imagen habilita transposición al vuelo, secciones editables y
renderizado dentro del diseño de la app. Un PDF no permite nada de eso.

Se evaluó y **se descartó OCR** de los PDFs existentes: falla justo en lo que
distingue un acorde de otro (`♭` vs `b`, `ø` vs `o`, `∆7` vs `A7`, superíndices,
marcas de repetición), y falla en silencio — un acorde mal leído en el compás 12
es peor que no tener chart. Además exigiría un servicio con API key, rompiendo
la restricción de no tener backend.

El PDF sobrevive como campo **opcional** (`chart_pdf_url`) para material
escaneado que nadie quiera transcribir.

---

## 2. Alcance

### Dentro de v0 (construido)

Selector de ensamble con links compartibles · lista de repertorio con búsqueda ·
vista de detalle por tema · metrónomo con audio · chart renderizado desde texto ·
transposición con botones −/+ · integrantes agrupados por rol · estados de carga,
vacío y error accionables · responsive mobile-first · desplegado.

### Fuera de v0, explícitamente

| Queda para | Qué |
|---|---|
| v1 | Editor visual de charts en la app · escritura al Sheet vía Google Apps Script · import desde iReal Pro · play del chart con seguimiento visual · modo atril · impresión · QR por ensamble |
| v2 | Login y cuentas · beneficio de alumno · mensualidad y pagos · cursos tipo e-learning · grabaciones del ensamble · asistencia y calendario |

No se construye nada de la tabla en v0. Si aparece la tentación, esta sección es
la respuesta.

---

## 3. Modelo de datos

Un Google Sheet con cuatro pestañas. Los nombres de pestaña son
**case-insensitive** en la API que usamos, pero la ortografía debe ser exacta.

### Pestaña `Ensambles`

| Columna | Obligatoria | Ejemplo |
|---|---|---|
| `id` | sí | `sabado-10` |
| `nombre` | sí | `Sábado · 10:00–11:00` |
| `horario` | | `Sábado 10:00–11:00` |
| `profe_titular` | | `Miguel Pérez` |
| `profe_ayudante` | | `Diego Montecinos` |

`id` es la llave: aparece en la URL (`#/ensamble/sabado-10`) y es lo que enlaza
las otras pestañas. Sin espacios ni acentos.

### Pestaña `Repertorio`

| Columna | Obligatoria | Ejemplo |
|---|---|---|
| `ensamble_id` | sí | `sabado-10` |
| `orden` | | `5` |
| `titulo` | sí | `East of the Sun` |
| `compositor` | | `Brooks Bowman` |
| `feel` | | `Swing Two/Four` |
| `bpm` | | `132` |
| `tono` | | `B♭` |
| `chart` | | ver §4 |
| `chart_pdf_url` | | link de Drive, respaldo si no hay `chart` |
| `ref_url` | | link a la grabación de referencia |
| `notas` | | `Con breaks — ojo con los cortes` |

`tono` acepta `Bb`, `B♭`, `bb` y variantes: la app las normaliza.

### Pestaña `Integrantes`

| Columna | Obligatoria | Valores |
|---|---|---|
| `ensamble_id` | sí | |
| `nombre` | sí | |
| `rol` | sí | `titular` · `ayudante` · `musico` |
| `instrumento` | | `Trompeta` |

### Pestaña `Config`

| Columna | Para qué |
|---|---|
| `clave_edicion` | Reservada para v1 (editor). La app pública **nunca** la lee. |

---

## 4. Formato de chart

Texto plano inspirado en iReal Pro. Va completo en la celda `chart`, **en una
sola línea** (los saltos de línea también funcionan, pero complican pegar en
Sheets).

```
T44 [A] Bb^7 | (Eb7) % | D-7 | G7 | C-7 | % | Eb-7 | Ab7 | [B] C-7 | F7 | ...
```

| Símbolo | Significa |
|---|---|
| `T44` | Compás. Opcional, por defecto 4/4. También `T34`, `T68`. |
| `[A]` | Marca de sección. Cualquier etiqueta: `[A]`, `[B]`, `[Intro]`, `[Coda]`. |
| `\|` | Barra de compás. |
| `%` | Repite el compás anterior. |
| `(Eb7)` | **Acorde alternativo**: sustitución opcional, se dibuja chica arriba del compás. |
| `{ }` | Repetición. |
| `N1` `N2` | Casilla 1 y casilla 2. |

**Acordes:** raíz + calidad + tensiones + `/bajo`.

| Escribes | Es |
|---|---|
| `Bb^7` | Si bemol mayor séptima (∆) |
| `D-7` | Re menor séptima |
| `G7` | Sol dominante |
| `Ah7` | La semidisminuido (ø) |
| `Co7` | Do disminuido |
| `G7sus` | Sol suspendido |
| `D7b13` | Con tensión alterada |
| `C-7/Bb` | Con bajo distinto |

Dos acordes en un mismo compás van separados por espacio: `Ah7 D7b13`.

**El parser nunca lanza excepción.** Un acorde mal escrito degrada a un compás
marcado como inválido, mostrando el texto crudo; el resto del chart sigue
renderizando. Un typo no puede dejar la pantalla en blanco.

**Tonalidad:** se deduce de la raíz del último acorde. Si la columna `tono` del
Sheet dice otra cosa, la app transpone al valor del Sheet. El chart manda sobre
qué acordes son; el Sheet manda sobre en qué tono se toca.

**Transposición:** por intervalo, no por semitonos sueltos, para que la
ortografía sea legible — sale `Bb`, nunca `A#`, y nunca dobles alteraciones como
`Bbb`. Hay tests que barren las 12 raíces × 12 transposiciones verificando que
ninguna salida contenga `bb` ni `##`.

---

## 5. Acceso a los datos: CSV publicado vs. API

**Elegido: CSV vía `gviz`**, sin API key.

```
https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&sheet={Pestaña}
```

| | gviz CSV (elegido) | Sheets API con key |
|---|---|---|
| Configuración del profe | Compartir por enlace y listo | Igual, más crear y restringir una key |
| Secretos en el cliente | Ninguno | La key va en el bundle, es visible |
| Mantención | Cero | Rotar la key, vigilar cuotas |
| Sheet privado | No | Sí |
| Estabilidad del contrato | No es API pública documentada | API con versionado y soporte |

El contenido es público por diseño — es el repertorio de un club, pensado para
que los alumnos lo vean. Un Sheet privado no compra nada y una key en el bundle
es seguridad de mentira. El riesgo real de gviz es que Google lo cambie sin
aviso; se mitiga con el `snapshot.json` versionado en el repo, y el plan B
documentado es migrar a la Sheets API.

### Comportamiento real de gviz, medido

Esto se verificó contra un Sheet real, no se asumió. Importa porque determina
qué mensaje de error ve el profe:

| Situación | Qué hace Google | Cómo lo detectamos |
|---|---|---|
| Todo bien | 200 con el CSV | — |
| Sheet **no compartido** | **302 hacia `accounts.google.com`**, que no manda CORS. Un `fetch` normal muere con `TypeError` indistinguible de estar sin internet. | `fetch(url, { redirect: "manual" })` → `response.type === "opaqueredirect"` |
| ID de Sheet inexistente | 200… no: **404**, con headers CORS correctos | `status === 404` |
| **Pestaña inexistente** | **200 con el contenido de la primera pestaña.** No hay error de ningún tipo. | Validar que los headers del CSV contengan las columnas esperadas |
| Sin internet | El `fetch` lanza | `TypeError` |

Las dos filas en negrita son trampas serias. La segunda es corrupción
silenciosa: pedir una pestaña que no existe devuelve datos de otra pestaña como
si fueran correctos. Por eso la única detección confiable de "pestaña mal
nombrada" es comparar los headers, no el código de estado.

### Resiliencia

Cascada: **red → `localStorage` → `snapshot.json` del repo**. Sin
`VITE_SHEET_ID`, la app corre con fixtures locales.

La caché tiene un tope de **7 días**. Y hay una distinción deliberada:

- **Falla transitoria** (sin internet): sirve caché con una nota discreta. Se va
  a arreglar solo.
- **Error de configuración** (no compartido, ID malo, pestaña mala): sirve caché
  igual, pero con aviso prominente y accionable. **No se arregla solo y alguien
  tiene que enterarse.**

La caché puede tapar un corte de wifi. No puede tapar un Sheet mal configurado.

---

## 6. Arquitectura

```
Google Sheet  ──gviz CSV──▶  React (Vite)  ──build──▶  Vercel (estático)
     ▲                            │
     │                            └─▶ localStorage (última copia buena)
  los profes                      └─▶ snapshot.json (respaldo en el repo)
```

Sin servidor, sin base de datos, sin API key, sin sesión. El build es HTML, CSS
y JS estáticos: se puede mover a Netlify, GitHub Pages o cualquier hosting
estático sin tocar una línea.

```
src/
  chart/       parse.js · transpose.js · Chart.jsx  + tests
  data/        sheet.js (cascada) · sheetParse.js (fetch + parseo) · fixtures · snapshot
  components/  SongSheet · RepertorioList · Roster · Metronome · EnsemblePicker · SearchBar
  styles/      tokens.css · app.css        (sistema de diseño del prototipo)
scripts/
  snapshot.mjs   regenera snapshot.json desde el Sheet
plantilla-sheet/ CSVs para crear un Sheet nuevo
```

**Sistema de diseño:** heredado del prototipo. Fraunces + Space Mono
self-hosted (sin depender de Google Fonts en runtime, porque la sala de ensayo
tiene mal wifi), paleta oscura de club con el chart sobre papel crema.

---

## 7. Deploy

| | |
|---|---|
| Hosting | Vercel, build estático |
| URL | https://club-de-jazz.vercel.app |
| Repo | github.com/capitanindefinido/ensamble-jazz |
| Build | `npm run build` → `dist/` |
| Variable | `VITE_SHEET_ID` (el ID del Sheet; se hornea en el build) |
| Routing | Por hash (`#/ensamble/id`), así que **no requiere rewrites** en el hosting |

Como `VITE_SHEET_ID` se resuelve en tiempo de build, cambiar de Sheet exige
volver a desplegar. Cambiar el *contenido* del Sheet no: eso es inmediato (con
~5 minutos de caché de Google).

### Portabilidad — deuda abierta

Hoy la cuenta de Vercel, el repo de GitHub y el Google Sheet están en cuentas
personales del desarrollador. **Eso contradice el requisito de que el club sea
dueño.** Para cerrarlo hace falta: una cuenta Google del club dueña del Sheet y
la carpeta de Drive, el repo en una organización del club, y el proyecto en un
Vercel Team del club. Es administrativo, no técnico, pero mientras no pase, el
proyecto depende de una persona.

---

## 8. Verificación

```bash
npm test        # parser, transposición, fixture bloqueado contra el jpeg de referencia
npm run build
npm run dev     # sin .env corre con fixtures; con VITE_SHEET_ID lee el Sheet real
npm run snapshot  # regenera el respaldo desde el Sheet
```

Los tests cubren, entre otros: la forma del chart de *East of the Sun* contra el
jpeg original (36 compases, A/B/A/C), el acorde alternativo, roundtrip de
transposición en los 12 semitonos, y el barrido de 12 raíces × 12
transposiciones sin dobles alteraciones.
