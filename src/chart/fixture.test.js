import { describe, it, expect } from "vitest";
import { parseChart, formatChord } from "./parse.js";
import fixtures from "../data/fixtures.json";

/**
 * Bloquea la transcripción de East of the Sun contra east-of-the-sun-chart.jpeg.
 * El fixture ya derivó una vez (sección C inventada, y un acorde alternativo
 * transcrito como acorde obligatorio). Estos tests lo impiden en silencio.
 */
describe("fixture East of the Sun vs. el jpeg de referencia", () => {
  const song = fixtures.repertorio.find((s) => /east/i.test(s.titulo));
  const { ast, warnings } = parseChart(song.chart);
  const measures = ast.sections.flatMap((s) => s.measures);

  it("parsea sin warnings", () => {
    expect(warnings).toEqual([]);
  });

  it("tiene la forma A(8) B(8) A(8) C(12) = 36 compases", () => {
    expect(ast.sections.map((s) => [s.label, s.measures.length])).toEqual([
      ["A", 8],
      ["B", 8],
      ["A", 8],
      ["C", 12],
    ]);
    expect(measures).toHaveLength(36);
  });

  it("el compás 2 es % con Eb7 como alternativo, no un acorde obligatorio", () => {
    for (const i of [1, 17]) {
      expect(measures[i].repeatPrev, `compás ${i + 1}`).toBe(true);
      expect(formatChord(measures[i].alternate), `compás ${i + 1}`).toBe("Eb7");
    }
  });

  it("la sección C termina en Bb6 seguido de %", () => {
    expect(formatChord(measures[34].chords[0])).toBe("Bb6");
    expect(measures[35].repeatPrev).toBe(true);
  });

  it("conserva los compases de dos acordes", () => {
    expect(measures[24].chords.map(formatChord)).toEqual(["C-", "C-7/Bb"]);
    expect(measures[31].chords.map(formatChord)).toEqual(["Db-7", "Gb7"]);
  });
});
