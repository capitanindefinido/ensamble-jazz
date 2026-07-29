import { describe, expect, it } from "vitest";
import { parseChord, parseChart } from "../chart/parse.js";
import { primaryScale, suggestScales } from "./scales.js";
import { findIiVI, suggestVoicings } from "./voicings.js";
import {
  buildChordGuide,
  guideForActiveMeasure,
  guideForSection,
} from "./guide.js";
import { suggestSectionScales } from "./sectionScales.js";
import { scaleNotesToMidis } from "../audio/audition.js";

describe("suggestScales", () => {
  it("D-7 → Dorian", () => {
    const s = primaryScale(parseChord("D-7"));
    expect(s.id).toBe("dorian");
    expect(s.notes[0]).toBe("D");
    expect(s.notes).toContain("C");
  });

  it("G7b9 → alt", () => {
    expect(primaryScale(parseChord("G7b9")).id).toBe("alt");
  });

  it("C^7 → Ionian", () => {
    expect(primaryScale(parseChord("C^7")).id).toBe("ionian");
  });

  it("Ah7 → Locrian", () => {
    expect(primaryScale(parseChord("Ah7")).id).toBe("locrian");
  });

  it("Co7 → whole-half dim", () => {
    expect(primaryScale(parseChord("Co7")).id).toBe("whDim");
  });

  it("C^7#11 → Lydian", () => {
    expect(primaryScale(parseChord("C^7#11")).id).toBe("lydian");
  });

  it("devuelve alternativas", () => {
    expect(suggestScales(parseChord("D-7")).length).toBeGreaterThan(1);
  });
});

describe("suggestVoicings", () => {
  it("shell + rootless para D-7", () => {
    const v = suggestVoicings(parseChord("D-7"), "A");
    expect(v.shell.notes.length).toBe(2);
    expect(v.shell.notes[0]).toBe("D");
    expect(v.rootless.notes.length).toBe(4);
  });

  it("dominante usa 3–7–9–13 en form A", () => {
    const v = suggestVoicings(parseChord("G7"), "A");
    expect(v.rootless.label).toMatch(/13/);
    expect(v.rootless.notes.length).toBe(4);
  });
});

describe("findIiVI", () => {
  it("detecta D-7 G7 C^7", () => {
    const hits = findIiVI([
      parseChord("D-7"),
      parseChord("G7"),
      parseChord("C^7"),
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe("ii–V–I");
  });

  it("no detecta si el V no calza", () => {
    expect(
      findIiVI([parseChord("D-7"), parseChord("A7"), parseChord("C^7")])
    ).toHaveLength(0);
  });
});

describe("guide", () => {
  it("buildChordGuide arma escala y voicing", () => {
    const g = buildChordGuide(parseChord("D-7"));
    expect(g.primary.id).toBe("dorian");
    expect(g.voicings.shell.notes.length).toBe(2);
  });

  it("guideForActiveMeasure sigue el AST", () => {
    const { ast } = parseChart("T44\n[A] D-7 | G7 | C^7 | % |");
    const g = guideForActiveMeasure(ast, 0, null);
    expect(g.chords[0].primary.id).toBe("dorian");
    expect(g.progression).toMatch(/ii/);
  });

  it("guideForSection sugiere escalas cómodas", () => {
    const { ast } = parseChart(
      "T44\n[A] D-7 | G7 | C^7 | % |\n[B] E-7 | A7 | D-7 | % |"
    );
    const g = guideForSection(ast, 0, null);
    expect(g.label).toBe("A");
    expect(g.scales.length).toBeGreaterThan(0);
    expect(g.scales[0].notes.length).toBeGreaterThanOrEqual(7);
  });
});

describe("suggestSectionScales", () => {
  it("ii–V–I en C favorece una escala de C o D", () => {
    const { scales, outliers } = suggestSectionScales([
      parseChord("D-7"),
      parseChord("G7"),
      parseChord("C^7"),
    ]);
    expect(scales.length).toBeGreaterThan(0);
    const names = scales.map((s) => s.name).join(" ");
    expect(/C |D /.test(names)).toBe(true);
    expect(Array.isArray(outliers)).toBe(true);
  });
});

describe("audition midis", () => {
  it("escala ascendente sin bajar de octava", () => {
    const midis = scaleNotesToMidis(["C", "D", "E", "F", "G", "A", "B"]);
    expect(midis).toHaveLength(7);
    for (let i = 1; i < midis.length; i++) {
      expect(midis[i]).toBeGreaterThan(midis[i - 1]);
    }
  });
});
