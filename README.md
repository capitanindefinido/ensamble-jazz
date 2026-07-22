# Biblioteca de Ensambles — Club de Jazz de Santiago

El repertorio de cada ensamble, en el teléfono: los temas del ciclo, en qué tono
y a qué tempo van, el chart para leer, la referencia para escuchar y quiénes
tocan.

### 👉 https://club-de-jazz.vercel.app

---

## Para profes: cómo se edita el contenido

**No hay que tocar código ni pedirle nada a nadie.** Todo el contenido de la app
vive en una planilla de Google. Editas la planilla, y a los pocos minutos la app
muestra lo nuevo.

La planilla tiene cuatro pestañas abajo: **Ensambles**, **Repertorio**,
**Integrantes** y **Config**.

### Agregar un tema al repertorio

Anda a la pestaña **Repertorio** y agrega una fila al final:

| Columna | Qué poner | ¿Obligatorio? |
|---|---|---|
| `ensamble_id` | El id del ensamble, tal como aparece en la pestaña Ensambles | **sí** |
| `orden` | En qué posición va en la lista (1, 2, 3…) | no |
| `titulo` | `East of the Sun` | **sí** |
| `compositor` | `Brooks Bowman` | no |
| `feel` | `Medium Swing`, `Bossa`, `Ballad`… | no |
| `bpm` | El tempo en números: `132` | no |
| `tono` | `Bb`, `F`, `Eb`… | no |
| `chart` | Los acordes (ver más abajo) | no |
| `chart_pdf_url` | Link a un PDF en Drive, si prefieres subir la partitura | no |
| `ref_url` | Link a la grabación de referencia (YouTube, Spotify) | no |
| `notas` | `Con breaks — ojo con los cortes antes de cada frase` | no |

Lo único imprescindible es `ensamble_id` y `titulo`. Todo lo demás se puede ir
llenando después.

### Agregar un integrante

Pestaña **Integrantes**, una fila por persona:

| Columna | Qué poner |
|---|---|
| `ensamble_id` | El id del ensamble |
| `nombre` | `Juan Pablo Andrade` |
| `rol` | `titular`, `ayudante` o `musico` — así se agrupan en la app |
| `instrumento` | `Contrabajo` |

### Escribir un chart

El chart va todo en **una sola celda**, en una línea. Cada compás va entre
barras verticales:

```
T44 [A] Bb^7 | (Eb7) % | D-7 | G7 | C-7 | % | Eb-7 | Ab7 |
```

| Escribes | Significa |
|---|---|
| `T44` | Compás de 4/4. Va una sola vez, al principio. Si el tema es en 3/4, `T34`. |
| `[A]` `[B]` | Empieza una sección. También sirve `[Intro]`, `[Coda]`, lo que quieras. |
| `\|` | Separa compases. |
| `%` | Repite el compás anterior (te ahorra escribirlo de nuevo). |
| `(Eb7)` | Acorde **alternativo**: sale chiquito arriba del compás, como sugerencia opcional. |

Los acordes se escriben así:

| Escribes | Suena a |
|---|---|
| `Bb^7` | Si bemol mayor 7 (el `^` es el triangulito ∆) |
| `D-7` | Re menor 7 (el `-` es la rayita de menor) |
| `G7` | Sol con séptima, dominante |
| `Ah7` | La semidisminuido (el `h` es la ø) |
| `Co7` | Do disminuido |
| `G7sus` | Sol suspendido |
| `D7b13` | Con tensión: `b9`, `#11`, `b13`… van pegadas atrás |
| `C-7/Bb` | Con el bajo en otra nota |

Si en un compás van dos acordes, los separas con un espacio: `Ah7 D7b13`.

**No tengas miedo de equivocarte.** Si escribes mal un acorde, la app marca ese
compás y muestra el resto igual. Nunca se va a quedar en blanco por un error de
tipeo.

Y no te preocupes por el tono: la app tiene botones **−** y **+** para que cada
músico lo lea en el tono que necesite.

---

## Si algo no aparece

**Lo primero: espera 5 minutos.** Google guarda una copia de la planilla y tarda
un poco en refrescar. Si acabas de editar y no ves el cambio, es normal.

Si pasa más rato y sigue igual, la app te dice qué pasa. Los mensajes son
concretos a propósito:

| Dice | Qué hacer |
|---|---|
| *"El Sheet existe pero no está compartido"* | Abre la planilla → **Compartir** → **Acceso general** → **Cualquiera con el enlace** → **Lector** |
| *"La pestaña 'Repertorio' no existe o sus columnas están mal escritas"* | Revisa que la pestaña se llame así y que la primera fila tenga los nombres de columna correctos |
| *"No existe un Sheet con ese ID"* | El link de la planilla cambió. Necesitas ayuda técnica para esto |
| *"Sin conexión"* | Es tu internet, no la planilla |
| *"Este ensamble aún no tiene repertorio"* | Falta agregar filas en Repertorio con ese `ensamble_id` |

Dos errores frecuentes que valen la pena mirar antes de pedir ayuda:

- **La primera fila de cada pestaña son los nombres de columna.** Si la borras o
  le cambias un nombre, esa pestaña deja de leerse. Deben ir en minúscula y con
  guión bajo: `ensamble_id`, no `Ensamble ID`.
- **El `ensamble_id` tiene que calzar exacto** entre las pestañas. Si en
  Ensambles dice `sabado-10` y en Repertorio pusiste `sábado-10`, los temas no
  aparecen.

---

## Crear una planilla nueva desde cero

Solo hace falta si estás armando otra biblioteca (otro club, otra sede).

1. Anda a [sheets.new](https://sheets.new) y ponle nombre.
2. Por cada archivo de la carpeta `plantilla-sheet/` de este repo
   (`Ensambles.csv`, `Repertorio.csv`, `Integrantes.csv`, `Config.csv`):
   **Archivo → Importar → Subir**, y en *Ubicación* elige **"Insertar hoja(s)
   nueva(s)"**. Google le pone a la pestaña el nombre del archivo, que es
   justo lo que se necesita.
3. Borra la pestaña *Hoja 1* que queda vacía.
4. **Compartir → Acceso general → Cualquiera con el enlace → Lector.** Este es
   el paso que más se olvida y sin él la app no ve nada.
5. Copia el ID de la planilla desde la barra de direcciones — es la parte larga
   entre `/d/` y `/edit`:

```
https://docs.google.com/spreadsheets/d/1AbC...XyZ/edit#gid=0
                                       └──── esto ────┘
```

6. Pásaselo a quien mantenga la app: hay que ponerlo como variable
   `VITE_SHEET_ID` en Vercel y volver a desplegar.

### Charts en PDF (opcional)

Si prefieres subir partituras escaneadas en vez de escribir los acordes:

1. Crea una carpeta en Drive para el ensamble.
2. Compártela como **Cualquiera con el enlace → Lector**.
3. Sube el PDF, click derecho → **Obtener vínculo**, y pega ese link en la
   columna `chart_pdf_url` del tema.

La app lo muestra embebido, con un botón para abrirlo en Drive. Si un tema tiene
las dos cosas, manda el `chart` escrito, porque es el que se puede transponer.

---

## Para desarrolladores

```bash
npm install
npm run dev        # sin .env corre con datos de ejemplo
npm test
npm run build
npm run snapshot   # regenera el respaldo local desde el Sheet
```

Para leer el Sheet real, crea un archivo `.env` en la raíz:

```
VITE_SHEET_ID=el_id_de_la_planilla
```

Vite lee el `.env` **solo al arrancar**: si el servidor ya estaba corriendo,
reinícialo.

Detalles de arquitectura, modelo de datos, decisiones y lo que queda para v1/v2:
**[SPEC.md](SPEC.md)**.

### Deploy

Vercel, build estático. `VITE_SHEET_ID` va como variable de entorno del proyecto
y se hornea en el build, así que **cambiar de planilla exige volver a
desplegar**; cambiar el contenido de la planilla no.

No hay backend, base de datos ni API keys. El build es HTML, CSS y JS estáticos:
se puede mover a Netlify o GitHub Pages sin tocar código. El routing es por hash,
así que no necesita reglas de rewrite en el hosting.

---

## Estado y pendientes

Esto es **v0**. Funciona y está en producción.

Lo que viene: editor de charts dentro de la app, escritura de vuelta a la
planilla sin copiar y pegar, reproducción del chart con seguimiento visual, modo
atril para el teléfono en el pie de micrófono, e impresión.

Lo que **no** está planificado: login, pagos, mensualidades ni cursos.

⚠️ **Pendiente de traspaso:** hoy la planilla, el repositorio y la cuenta de
hosting están a nombre personal del desarrollador. Para que el club sea
efectivamente dueño hay que moverlos a cuentas del club. Es trámite, no
programación, pero hasta que pase el proyecto depende de una persona.
