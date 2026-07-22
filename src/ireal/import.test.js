import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseChart, formatChord } from "../chart/parse.js";
import { transposeAst, serializeAst } from "../chart/transpose.js";
import fixtures from "../data/fixtures.json";
import {
  parseIrealPlaylist,
  resolvePlayedKey,
  cleanTitle,
  flipComposer,
  feelFrom,
} from "./playlist.js";
import { translateIrealBody, cleanAnnotation } from "./translate.js";

function summarize(ast) {
  return ast.sections.map((sec) => ({
    label: sec.label,
    measures: sec.measures.map((m) => ({
      chords: (m.chords || []).map(formatChord),
      alt: m.alternate ? formatChord(m.alternate) : null,
      rpt: !!m.repeatPrev,
      nc: !!m.noChord,
    })),
  }));
}

describe("metadatos iReal", () => {
  it("limpia timestamps del título", () => {
    expect(cleanTitle("Route 66 (with breaks) - 1777954161403")).toBe(
      "Route 66 (with breaks)"
    );
  });

  it("invierte compositor Apellido Nombre", () => {
    expect(flipComposer("Strayhorn Billy")).toBe("Billy Strayhorn");
  });

  it("quita prefijo Jazz- del feel", () => {
    expect(feelFrom("Jazz-Swing Two/Four")).toBe("Swing Two/Four");
  });

  it("Summertime A- con pc 3 → C- (relativa mayor Eb)", () => {
    const k = resolvePlayedKey("A-", 3);
    expect(k.error).toBeNull();
    expect(k.tono).toBe("C-");
    expect(k.delta).toBe(3);
  });

  it("limpia anotaciones <*66  (Breaks)>", () => {
    expect(cleanAnnotation("*66  (Breaks)")).toBe("(Breaks)");
  });
});

describe("criterio de oro: East of the Sun desde iReal → fixture", () => {
  const htmlPath = resolve(process.env.HOME || "", "Downloads/Ensamble.html");

  let html;
  try {
    html = readFileSync(htmlPath, "utf8");
  } catch {
    html = null;
  }

  it("importa East, transpón a Bb, AST idéntico al de fixtures.json", function () {
    if (!html) {
      this.skip();
      return;
    }

    const { songs, error } = parseIrealPlaylist(html);
    expect(error).toBeNull();

    const east = songs.find((s) => /east of the sun/i.test(s.title));
    expect(east, "East Of The Sun en la playlist").toBeTruthy();
    expect(east.storedKey).toBe("G");
    expect(east.transposePc).toBe(10);

    const { chartText, error: trErr } = translateIrealBody(east.bodyRaw);
    expect(trErr).toBeNull();

    const keyInfo = resolvePlayedKey(east.storedKey, east.transposePc);
    expect(keyInfo.tono).toBe("B♭");
    expect(keyInfo.delta).toBe(3);

    const { ast } = parseChart(chartText);
    const transposed = transposeAst(ast, keyInfo.delta, keyInfo.playedPitch);

    const fixture = fixtures.repertorio.find((s) => /east/i.test(s.titulo));
    const { ast: gold } = parseChart(fixture.chart);

    expect(summarize(transposed)).toEqual(summarize(gold));

    const measures = transposed.sections.flatMap((s) => s.measures);
    expect(formatChord(measures[1].alternate)).toBe("Eb7");
    expect(measures[1].repeatPrev).toBe(true);
    expect(serializeAst(transposed)).toContain("(Eb7)");
  });

  it("importa los 8 temas sin omitidos", function () {
    if (!html) {
      this.skip();
      return;
    }
    const { songs } = parseIrealPlaylist(html);
    expect(songs).toHaveLength(8);
    const failures = [];
    for (const song of songs) {
      const { error, chartText } = translateIrealBody(song.bodyRaw);
      if (error) failures.push(`${song.title}: ${error}`);
      else if (!chartText) failures.push(`${song.title}: sin chart`);
    }
    expect(failures).toEqual([]);
  });

  it("Meditation tiene B7sus4; Favorite Things expande r en 3/4; Route 66 tiene N.C. y breaks", function () {
    if (!html) {
      this.skip();
      return;
    }
    const { songs } = parseIrealPlaylist(html);

    const med = songs.find((s) => /meditation/i.test(s.title));
    const { chartText: medChart, error: medErr } = translateIrealBody(
      med.bodyRaw
    );
    expect(medErr).toBeNull();
    expect(medChart).toMatch(/B7sus4/);

    const fav = songs.find((s) => /favorite things/i.test(s.title));
    const { chartText: favChart, error: favErr } = translateIrealBody(
      fav.bodyRaw
    );
    expect(favErr).toBeNull();
    const { ast: favAst } = parseChart(favChart);
    expect(favAst.timeSig).toEqual({ num: 3, den: 4 });
    const a = favAst.sections[0].measures;
    expect(formatChord(a[0].chords[0])).toBe(formatChord(a[2].chords[0]));
    expect(formatChord(a[1].chords[0])).toBe(formatChord(a[3].chords[0]));

    const route = songs.find((s) => /route 66/i.test(s.title));
    const {
      chartText: rChart,
      error: rErr,
      notes,
    } = translateIrealBody(route.bodyRaw);
    expect(rErr).toBeNull();
    const { ast: rAst } = parseChart(rChart);
    expect(
      rAst.sections.some((sec) => sec.measures.some((m) => m.noChord))
    ).toBe(true);
    expect(notes.some((n) => /break/i.test(n))).toBe(true);
  });
});

describe("translateIrealBody — East en G (sin HTML)", () => {
  const RAW_EAST_G =
    "*A[T44G^7XyQ| (C7)x LZB-7XyQ|E7XyQ|A-7XyQKcl LZC-7XyQ|F7XyQ]*B[A-7XyQ|D7XyQ|F#h7 B7b13LZE-7XyQ|E-7XyQ|A7XyQ|A-7XyQ|D7XyQ]*A[G^7XyQ| (C7)x LZB-7XyQ|E7XyQ|A-7XyQKcl LZC-7XyQ|F7XyQ]*C[A- A-7/GLZF#h7 B7b9LZE-7XyQ|A7XyQ|A-7XyQ|F7XyQ|B-7XyQ|Bb-7 Eb7LZA-7XyQ|D7XyQ|G6XyQKcl  Z";

  it("traduce el cuerpo verificado a chart parseable", () => {
    const { chartText, error } = translateIrealBody(RAW_EAST_G);
    expect(error).toBeNull();
    const { ast, warnings } = parseChart(chartText);
    expect(warnings).toEqual([]);
    expect(ast.sections.map((s) => [s.label, s.measures.length])).toEqual([
      ["A", 8],
      ["B", 8],
      ["A", 8],
      ["C", 12],
    ]);
  });

  it("no traga tokens desconocidos en silencio", () => {
    const { error } = translateIrealBody("*A[T44C6XyQ| @@ |Z");
    expect(error).toMatch(/tokens no traducibles/);
    expect(error).toContain("@");
  });
});
