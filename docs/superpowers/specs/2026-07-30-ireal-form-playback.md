# iReal: metadatos + playback del form

**Fecha:** 2026-07-30

## Qué ya usábamos

| Fuente | Campo | Uso |
|--------|--------|-----|
| URI | título, compositor, feel, bpm, tono | Sheet |
| Cuerpo | acordes, `{` `}`, `N1`/`N2`, `%`, `N.C.`, secciones `*A`, alternate `( )`, notas `<texto>` genérico | chart / notas |

## Qué se descartaba (y ahora se captura)

| Token | Significado | Destino |
|-------|-------------|---------|
| `S` | Segno | AST + glifo + salto D.S. |
| `Q` | Coda | AST + glifo + D.C./D.S. al Coda |
| `U` | END | AST (cierra tras jump al Fine) |
| `f` | Fermata | AST + glifo (visual; no alarga el beat aún) |
| `<D.C. …>` / `<D.S. …>` / `<Fine>` / `<3x>` | Navegación | AST + `expandPlaybackForm` |
| `p` | Slash (repite acorde) | Se copia el acorde anterior en el translate |

## Aún no / bajo prioridad

| Ítem | Nota |
|------|------|
| `s` / `l` | Solo tipografía de acorde — OK ignorar |
| `Y` spacer | Layout iReal — OK ignorar |
| Cambio de métrica a mitad (`T34` tras el primero) | Solo primera `T` cuenta |
| `styleShort` (campo URI [3]) | No va al Sheet; `feel` sí |
| Campo URI [2] | Vacío en el layout actual |
| Grooves iReal (playback style) | No aplica; usamos click/bajo propio |
| D.C. al 1st/2nd/3rd End. | Parseado; seek por ending en form.js |

## Player

`playbackTimeline(ast)` expande el form; el player ya no hace loop lineal del array plano.
