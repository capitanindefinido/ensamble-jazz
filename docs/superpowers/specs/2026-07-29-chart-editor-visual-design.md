# Plan: Editor visual de charts (`#/editor`)

**Estado:** especificación / backlog — **no implementar todavía**  
**Fecha:** 2026-07-29  
**Contexto:** el editor actual es un form estrecho (import iReal + chips + textarea + preview). Se siente tosco; el destino es editar en el chart visual.

---

## Objetivo

Un editor donde el **chart renderizado es la superficie de edición**: tocás un compás y editás acordes (y más adelante la estructura) sin pelearte con un textarea crudo.

Público: cualquiera del club (priorizar **simplicidad** sobre poder de power-user).

---

## Decisiones ya tomadas

| Tema | Decisión |
|------|----------|
| Alcance UX | Rediseño completo: layout, edición y preview |
| Modelo de edición | **Simple:** click en un compás → panel con **1–4 slots** de acorde (no “celda editable sobre el papel”, no autocomplete fancy en v1) |
| Destino funcional | **Todo:** acordes + estructura (agregar/borrar/reordenar compases, secciones, repeticiones, endings) |
| Entrega | **Por capas**, con la **UI final ya armada** desde el día 1 y capacidades que se van encendiendo (recomendación; ver fases) |

---

## Principio de producto

1. El chart visual es el centro (misma tipografía / paper look que el atril).
2. Un panel lateral (desktop) o sheet inferior (mobile) edita **solo lo seleccionado**.
3. El string iReal-like sigue siendo la **fuente de verdad** al guardar en el Sheet (parse ↔ serialize roundtrip).
4. Import iReal queda como flujo secundario (colapsable / pestaña), no compite con el editor.

---

## Arquitectura (alto nivel)

```
ChartEditor (shell)
├── SongPicker + clave + Guardar / Copiar
├── Import iReal (secundario)
├── ChartCanvas (Chart.jsx + selección de compás / sección)
├── MeasureInspector (slots 1–4, acciones de estructura)
└── chart model
    parseChart(text) → AST
    mutaciones sobre AST → formatChart / serialize → text
```

**Regla:** no editar el string a mano en el camino feliz; el textarea crudo puede quedar como “Modo avanzado” colapsado (opcional, fase tardía).

Archivos probables:

- `src/components/ChartEditor.jsx` — shell / layout
- `src/chart/Chart.jsx` — modos `interactive` / selección
- `src/chart/mutate.js` (nuevo) — insert/delete/reorder measure, set chord slot, section/repeat ops
- `src/chart/serialize.js` o extender `formatChart` en `parse.js` — AST → string
- `src/styles/app.css` — layout editor wide

---

## Fases (implementar después, en orden)

### Fase 0 — Shell UI (sin lógica nueva de estructura)

- Layout ancho: chart dominante + inspector.
- Estados vacíos claros (“Elegí un tema”, “Tocá un compás”).
- Import iReal en panel colapsable / tab.
- Clave + Guardar / Copiar en barra sticky.
- **Sin** mutaciones nuevas: el inspector puede ser read-only o aún no cableado.

### Fase 1 — Editar acordes por compás (MVP usable)

- Click compás → selección visual.
- Inspector: 1–4 slots (vacío / acorde / `%` / `N.C.`).
- Paleta corta o input simple por slot (raíz + calidad + extensiones básicas).
- Mutar AST → re-serializar → preview live → Guardar al Sheet (mismo `saveRepertorioFields`).
- Tests: roundtrip de un tema conocido tras cambiar un slot.

### Fase 2 — Compases

- Agregar compás (antes/después).
- Borrar compás.
- Reordenar (botones ↑↓ o drag si sale barato).
- Duplicar compás.

### Fase 3 — Estructura

- Secciones `[A]`, `[B]`, … (crear / renombrar / mover).
- Barras de repetición, `N1`/`N2`, alternate `(Eb7)`, time sig `T44`.
- Validación suave + warnings visibles en el inspector.

### Fase 4 — Polish

- Atajos teclado (←→ entre compases, 1–4 focusean slots).
- Undo/redo local.
- Modo avanzado: textarea sincronizado.
- Mobile: inspector como bottom sheet.

---

## UX del inspector (Fase 1)

Al seleccionar un compás:

- **Slots:** hasta 4; botón “+ slot” / “−” dentro del máximo.
- Cada slot: campo de acorde (texto corto validado por `parseChord`) **o** chips de calidades frecuentes.
- Acciones rápidas: `%` (repite), `N.C.`, vaciar.
- Feedback: parse inválido → borde error + no pisa el AST hasta que sea válido (o marca invalid como hoy).

---

## Fuera de alcance (por ahora)

- Colaboración en tiempo real.
- Playback/metrónomo dentro del editor (ya vive en el atril).
- Edición de PDF / Drive.
- Rediseño de la app pública fuera de `#/editor`.

---

## Criterios de éxito

- Una persona no técnica puede corregir un acorde en &lt; 30 s sin mirar el string iReal.
- Guardar sigue siendo una acción explícita (no autosave accidental al Sheet).
- Roundtrip: lo que ves en el chart es lo que se persiste (salvo warnings conocidos del parser).
- El atril / modo lectura no se rompe (Chart sigue sirviendo en modo no interactivo).

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Serialize incompleto vs parser | Empezar por subset que `formatChord` + sections ya cubren; tests de fixtures |
| Chart.jsx demasiado acoplado | Prop `interactive` / `selectedMeasure` / `onSelectMeasure` sin romper atril |
| Scope creep fase 3 | No mezclar endings/reps en fase 1–2 |

---

## Próximo paso (cuando retomemos)

1. Confirmar fase 0+1 como primer PR.
2. Spike corto: ¿el AST actual soporta mutar un chord slot y volver a string sin perder markers?
3. Implementar fase 0 → 1; dejar 2–4 en backlog.

**No ejecutar este plan hasta que lo pidamos explícitamente.**
