# Biblioteca de Ensambles — Club de Jazz de Santiago (v0)

## Context

El Club de Jazz de Santiago tiene un prototipo de UI en React (`BibliotecaEnsambles.jsx`)
con datos hardcodeados: repertorio de un ensamble con tono, feel, bpm y referencia.
Define el sistema de diseño (club oscuro / chart en papel, Fraunces + Space Mono,
metrónomo) y hay que respetarlo como baseline visual.

Hay que convertirlo en una app real, desplegada, cuyo contenido edite gente NO técnica,
sin infra propia ni backend que mantener, y de la que el club sea dueño.

**Decisión de diseño que reencuadra el proyecto:** el chart NO es un PDF, es data.
El prototipo asumía PDFs en Drive embebidos en un iframe. En vez de eso el chart se
guarda como un string de compases en el Sheet y lo renderiza la app en el papel crema
del diseño existente. Eso habilita transposición al vuelo, secciones (intro/outro/coda),
y edición real — imposible sobre una imagen. Se descartó OCR de PDFs: falla justo en lo
que importa (`♭` vs `b`, `ø`, `∆7`, superíndices, `%`), falla en silencio, y requeriría
un servicio con API key que rompe la restricción de "sin backend".

El PDF de Drive sobrevive como campo **opcional** de respaldo (`chart_pdf_url`) para
material escaneado que nadie quiera transcribir.

## Decisiones tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Hosting | **Vercel** desde repo del club | Cuenta ya en uso del dev. Deploy en push + preview URL por rama, así hay demo compartible desde el slice 2. Migrable a Netlify/Pages sin cambiar código (build estático puro). |
| Datos | **gviz CSV** + caché localStorage + snapshot JSON en el repo | Cero API keys, cero config. El profe solo comparte el Sheet como "cualquiera con el enlace". Los dos fallbacks evitan pantalla en blanco si Google falla. |
| Chart | **Texto estructurado + renderer propio** | Transposición, edición, integrado al diseño. |
| Tono | **El chart manda**, `tono` se deriva | Una sola fuente de verdad; si el Sheet dice otro tono, la app transpone al vuelo. |
| Transpositor | **Sí en v0**, botones −/+ | Es la ventaja principal de tener el chart como data. |
| Import | Tres vías: mano, editor visual, link de iReal Pro | iReal es spike (ver riesgos). |
| Escritura | **A + B**: botón *Guardar* (Apps Script) con *Copiar* como respaldo | B es el camino feliz, A nunca se cae. |
| Permisos de edición | **Clave compartida** validada en el Apps Script | Sin OAuth. La clave vive en una celda del Sheet y se cambia editándola. |
| Auth / pagos / e-learning | Fuera | v1/v2. |

## Formato de chart

Texto plano, humano-escribible, inspirado en iReal. Va en la columna `chart`.

```
T44
[A] Bb^7 | (Eb7) % | D-7 | G7 |
    C-7 | % | Eb-7 | Ab7 |
[B] C-7 | F7 | Ah7 D7b13 | G-7 |
    G-7 | C7 | C-7 | F7 |
[A] Bb^7 | (Eb7) % | D-7 | G7 |
    C-7 | % | Eb-7 | Ab7 |
[C] C- C-7/Bb | Ah7 D7b9 | G-7 | C7 |
    C-7 | Ab7 | D-7 | Db-7 Gb7 |
    C-7 | F7 | Bb6 | % |
```

Transcripción completa y verificada contra `east-of-the-sun-chart.jpeg`:
36 compases, A(8) B(8) A(8) C(12). `(Eb7)` es un **acorde alternativo** —
sustitución opcional que se dibuja chica sobre el compás, no un acorde
obligatorio.

- `T44` compás (default 4/4) · `[X]` sección (`[A]`, `[Intro]`, `[Coda]`)
- `|` barra · `%` repite el compás anterior · dos acordes en un compás = separados por espacio
- Acorde: raíz + alteración + calidad + `/bajo` → `Bb^7`, `D-7`, `Ah7` (ø), `Co7` (dim),
  `D7b13`, `C-7/Bb`
- `{ ... }` repetición

Ese ejemplo es exactamente el chart de *East of the Sun* que se usó como referencia,
y sirve de fixture de test del parser.

## Esquema del Sheet

Pestaña **Ensambles**: `id, nombre, horario, profe_titular, profe_ayudante`
Pestaña **Repertorio**: `ensamble_id, orden, titulo, compositor, feel, bpm, tono, chart, chart_pdf_url, ref_url, notas`
Pestaña **Integrantes**: `ensamble_id, nombre, rol (titular|ayudante|musico), instrumento`
Pestaña **Config**: `clave_edicion` (celda leída solo por el Apps Script, nunca por el cliente)

Cambio respecto del brief: `chart_url` → `chart` (texto) + `chart_pdf_url` (respaldo opcional).

## Plan de implementación

### Slice 0 — SPEC.md + README (entregable de aprobación)
- `SPEC.md`: alcance, modelo de datos, esquema exacto del Sheet, gramática del formato
  de chart, tradeoff CSV vs API, plan de deploy, y v1/v2 explícito.
- `README.md`: guía paso a paso para NO-dev — crear el Sheet desde plantilla,
  compartirlo, pegar la URL, crear la carpeta de Drive, desplegar el Apps Script.
  Con capturas descritas y checklist, sin jerga.

### Slice 1 — Scaffold + sistema de diseño
- Vite + React + `papaparse`. Sin Tailwind: el prototipo ya trae su CSS.
- Extraer el bloque `CSS` de `BibliotecaEnsambles.jsx` a `src/styles/tokens.css` +
  `app.css`, conservando tal cual las variables (`--brass`, `--paper`, `--oxblood`…)
  y las clases `be-*`. Fuentes self-hosted (no `@import` de Google) para no depender
  de un tercero en runtime.
- Componentes portados 1:1 del prototipo: `Metronome`, `SongSheet`, lista, roster.
- Fixtures locales en `src/data/fixtures.json` con el ensamble del prototipo.

### Slice 2 — Data layer
- `src/data/sheet.js`: construye URLs gviz
  (`.../gviz/tq?tqx=out:csv&sheet=Repertorio`), fetch, parseo con PapaParse
  (necesario: el chart trae comas y saltos de línea dentro de la celda).
- Normalización a los tipos del dominio, tolerante a columnas faltantes o mal
  escritas (trim, lowercase de headers).
- Cascada de resiliencia: red → `localStorage` (último bueno, con timestamp) →
  `snapshot.json` versionado en el repo. La UI indica cuándo está viendo caché.
- Estados **loading / vacío / error** directivos en español de Chile
  ("Deja el PDF en la carpeta del ensamble y aparece acá", "El Sheet no está
  compartido: ábrelo, Compartir → Cualquiera con el enlace → Lector").
- `VITE_SHEET_ID` en `.env`; sin él, la app corre con fixtures.

### Slice 3 — Navegación y vistas
- Selector de ensamble + hash routing (`#/ensamble/sabado-10`) para links compartibles.
- Repertorio, integrantes agrupados por rol, búsqueda — portados del prototipo.
- Mobile-first, que ya es como está diseñado (`max-width:460px`).

### Slice 4 — Chart: parser + renderer + transposición
- `src/chart/parse.js` → AST `{ timeSig, sections: [{ label, measures: [{ chords, repeat }] }] }`.
- `src/chart/transpose.js`: shift por semitonos con respelling correcto según tonalidad
  (que salga `Bb`, no `A#`).
- `src/chart/Chart.jsx`: grid de 4 compases por fila sobre `.be-paper`, con la tipografía
  del diseño — raíz en Fraunces, alteraciones y extensiones en superíndice, `%` como glifo.
- Botones −/+ de tono sobre el chart; tonalidad derivada del chart, y si `tono` del Sheet
  difiere, se transpone al valor del Sheet por defecto.
- Tests del parser contra el fixture de *East of the Sun*.
- Si `chart` está vacío pero hay `chart_pdf_url`: iframe de preview de Drive con fallback
  "abrir en Drive". Si no hay ninguno: el empty state del prototipo.

### Slice 5 — Import desde iReal Pro (spike acotado)
- Verificar contra un export real que un parser MIT existente
  (`ireal-musicxml` / `ireal-reader`) decodifica el formato ofuscado, y mapear su
  salida a nuestro AST.
- **Timebox de medio día.** Si no funciona limpio, se corta: el editor visual y la
  escritura a mano ya cubren el caso, y queda anotado en SPEC.md como v1.

### Slice 6 — Editor + escritura
- `/editor` (ruta discreta, no linkeada desde la nav pública): armar chart pinchando
  compases y acordes, preview en vivo con el mismo renderer.
- Salidas: **Guardar** (POST al Apps Script) y **Copiar** (respaldo manual).
- `apps-script/Codigo.gs` versionado en el repo: valida la clave contra la pestaña
  `Config`, ubica la fila por `ensamble_id` + `titulo`, escribe la celda `chart`.
  Gotcha conocido: enviar `Content-Type: text/plain` para evitar el preflight CORS,
  que Apps Script no responde bien.
- La clave se guarda en `sessionStorage`, no en el bundle.

### Slice 7 — Play del chart con seguimiento visual ⭐ pieza de demo
- `src/chart/player.js`: scheduler sobre `AudioContext` (lookahead, no `setInterval`),
  reusando el motor del metrónomo del slice 1.
- Voces: click con acento en el 1 · bajo caminando sobre raíz/quinta del acorde del
  compás · si el timebox alcanza, voicing de 3ra+7ma derivado de la calidad que el
  parser ya conoce. Swing en los feels de swing (subdivisión 2:1).
- El compás en curso se ilumina en el papel y el chart auto-scrollea.
- Timebox de un slice. Si el voicing no suena bien, se envía con click + bajo, que
  ya sostiene la demo.

### Slice 8 — Modo atril, impresión y QR
- **Atril**: fullscreen horizontal, tipografía escalada, Wake Lock API para que no se
  apague la pantalla (con fallback silencioso donde no exista).
- **Imprimir**: `@media print` que saca el chart en el tono elegido, limpio, sin
  cromo de la app — equivalente al PDF de iReal pero transpuesto.
- **QR**: por ensamble, generado en el cliente, para pegar en la puerta de la sala.

### Slice 9 — Deploy a producción
- Vercel apuntado al repo del club, `VITE_SHEET_ID` como env var del proyecto.
  Los preview deploys por rama existen desde el slice 2; esto es solo promover a prod
  y conectar dominio si el club tiene uno.
- README con los pasos para que el club administre el sitio sin mí.

## Verificación

1. `npm test` — parser sobre el fixture de *East of the Sun*: 36 compases, secciones
   A/B/A/C, `%` expandido, `Ah7` como half-diminished, `C-7/Bb` como slash chord.
2. Transposición: subir Bb→C y bajar C→Bb debe volver al string original.
3. `npm run dev` sin `.env` → app funcional con fixtures.
4. Con `VITE_SHEET_ID` real → el ensamble carga end-to-end desde el Sheet.
5. Simular fallas: Sheet no compartido, pestaña mal nombrada, sin red → cada una debe
   dar su mensaje directivo, y la tercera debe servir la caché.
6. Editor: armar un chart, Guardar, refrescar la app pública y verlo. Con clave
   incorrecta, debe rechazar.
7. Revisar en móvil real (390px) el chart renderizado y el metrónomo con audio.
8. Play: el compás iluminado coincide con lo que suena a 70 bpm y a 240 bpm; pausar y
   retomar no desfasa; el audio no arranca antes del gesto del usuario (política de
   autoplay).
9. Atril en teléfono real horizontal; imprimir a PDF desde el navegador y comparar con
   el chart en pantalla; escanear el QR con otro teléfono.
10. Deploy en Vercel verificado desde un teléfono ajeno a la red local.

## Riesgos

- **Parser de iReal** — formato ofuscado y no oficial. Mitigado con timebox y dos
  vías de import alternativas.
- **gviz no es API pública contractual** — Google podría cambiarlo. Mitigado por el
  snapshot en repo; el plan B documentado es migrar a Sheets API con key.
- **Clave compartida no es seguridad** — es un pestillo, no una cerradura. Aceptable
  para repertorio de ensamble; el Sheet tiene historial de versiones para revertir.
  v1 lo reemplaza por login Google con lista blanca.

## Explícitamente fuera (v1/v2)

Login y cuentas · beneficio de alumno · mensualidad y pagos · cursos e-learning ·
edición del repertorio (no del chart) desde la app · PWA offline para la sala de
ensayo · playback con batería y voicings completos · grabaciones del ensamble ·
asistencia y calendario.
