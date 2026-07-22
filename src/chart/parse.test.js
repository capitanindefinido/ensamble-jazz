import { describe, expect, it } from "vitest";
import {
  EAST_OF_SUN_CHART,
  countMeasures,
  deriveKeyFromAst,
  formatChord,
  formatPitch,
  parseChart,
  parseChord,
  parseKeyString,
} from "./parse.js";
import {
  chordRaws,
  deltaToKey,
  preferKeySpelling,
  transposeAst,
  transposePitch,
} from "./transpose.js";

describe("parseChord", () => {
  it("parsea ejemplos reales del plan", () => {
    expect(parseChord("Bb^7")).toMatchObject({
      root: { letter: "B", alter: -1 },
      quality: "maj",
      ext: ["7"],
    });
    expect(parseChord("D-7")).toMatchObject({ quality: "min", ext: ["7"] });
    expect(parseChord("G7")).toMatchObject({ quality: "dom", ext: ["7"] });
    expect(parseChord("Ah7")).toMatchObject({ quality: "halfdim", ext: ["7"] });
    expect(parseChord("Co7")).toMatchObject({ quality: "dim", ext: ["7"] });
    expect(parseChord("D7b13")).toMatchObject({
      quality: "dom",
      ext: ["7", "b13"],
    });
    expect(parseChord("D7b9")).toMatchObject({ ext: ["7", "b9"] });
    expect(parseChord("C-7/Bb")).toMatchObject({
      quality: "min",
      bass: { letter: "B", alter: -1 },
    });
    expect(parseChord("Bb6")).toMatchObject({ quality: "maj", ext: ["6"] });
    expect(parseChord("C-")).toMatchObject({ quality: "min", ext: [] });
    expect(parseChord("G7sus")).toMatchObject({ quality: "sus", ext: ["7"] });
  });
});

describe("parseChart — East of the Sun", () => {
  const { ast, warnings } = parseChart(EAST_OF_SUN_CHART);

  it("no emite warnings con el fixture válido", () => {
    expect(warnings).toEqual([]);
  });

  it("tiene timeSig 4/4", () => {
    expect(ast.timeSig).toEqual({ num: 4, den: 4 });
  });

  it("tiene 40 compases y secciones A/B/A/C", () => {
    expect(countMeasures(ast)).toBe(40);
    expect(ast.sections.map((s) => s.label)).toEqual(["A", "B", "A", "C"]);
  });

  it("expande % con repeatPrev y acordes del compás anterior", () => {
    const a = ast.sections[0].measures;
    const m5 = a[5]; // índice local 5 = segundo compás de la fila 2 (% )
    expect(m5.repeatPrev).toBe(true);
    expect(m5.chords[0].root).toEqual(a[4].chords[0].root);
    expect(m5.chords[0].quality).toBe("min");
  });

  it("trata Ah7 como half-diminished", () => {
    const b = ast.sections[1].measures;
    const m = b.find((x) => x.chords.some((c) => c.raw === "Ah7" || formatChord(c).startsWith("Ah")));
    const ah = m.chords.find((c) => c.quality === "halfdim");
    expect(ah).toBeTruthy();
    expect(ah.root).toEqual({ letter: "A", alter: 0 });
  });

  it("trata C-7/Bb como slash chord", () => {
    const c = ast.sections[3].measures[0];
    const slash = c.chords.find((ch) => ch.bass);
    expect(slash).toMatchObject({
      root: { letter: "C", alter: 0 },
      quality: "min",
      bass: { letter: "B", alter: -1 },
    });
  });
});

describe("parseChart — resiliencia", () => {
  it("nunca lanza con input inválido y reporta warnings", () => {
    expect(() => parseChart("T44\n[A] Bb^7 | XYZ99 | D-7 |")).not.toThrow();
    const { ast, warnings } = parseChart("T44\n[A] Bb^7 | XYZ99 | D-7 |");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].line).toBe(2);
    expect(countMeasures(ast)).toBe(3);
    const invalid = ast.sections[0].measures.find((m) => m.invalid);
    expect(invalid.raw).toContain("XYZ99");
    // el resto sigue vivo
    expect(ast.sections[0].measures[0].chords[0].raw).toBe("Bb^7");
    expect(ast.sections[0].measures[2].chords[0].quality).toBe("min");
  });

  it("parsea repeticiones y casillas N1/N2", () => {
    const { ast, warnings } = parseChart(
      "T44\n[A] { Bb^7 | E7 } | N1 D-7 | N2 G7 |"
    );
    expect(warnings).toEqual([]);
    const ms = ast.sections[0].measures;
    expect(ms[0].openRepeat).toBe(true);
    expect(ms.some((m) => m.closeRepeat)).toBe(true);
    expect(ms.some((m) => m.ending === 1)).toBe(true);
    expect(ms.some((m) => m.ending === 2)).toBe(true);
  });

  it("parsea acorde alternativo (Eb7)", () => {
    const { ast } = parseChart("T44\n[A] (Eb7) Bb^7 | E7 |");
    expect(ast.sections[0].measures[0].alternate).toMatchObject({
      root: { letter: "E", alter: -1 },
      quality: "dom",
      ext: ["7"],
    });
  });
});

describe("transpose", () => {
  it("Bb + 2 semitonos → C (no B#)", () => {
    const p = transposePitch({ letter: "B", alter: -1 }, 2, true);
    expect(p).toEqual({ letter: "C", alter: 0 });
  });

  it("elige enarmónica con ≤6 alteraciones (C+1 → Db no C#)", () => {
    const p = preferKeySpelling(
      transposePitch({ letter: "C", alter: 0 }, 1, true)
    );
    expect(formatPitch(p)).toBe("Db");
  });

  it("subir Bb→C y bajar C→Bb vuelve a los mismos acordes", () => {
    const { ast } = parseChart(EAST_OF_SUN_CHART);
    const chartKey = deriveKeyFromAst(ast);
    const sheetKey = parseKeyString("C");
    const up = deltaToKey(chartKey, sheetKey);
    const toC = transposeAst(ast, up, sheetKey);
    const back = transposeAst(toC, -up, chartKey);
    expect(chordRaws(back)).toEqual(chordRaws(ast));
  });
});
