import { describe, it, expect } from "vitest";
import {
  chordRaws,
  transposeAst,
  transposeChord,
  transposePitch,
} from "./transpose.js";
import {
  EAST_OF_SUN_CHART,
  formatPitch,
  parseChart,
  parseKeyString,
} from "./parse.js";

const t = (root, n) => formatPitch(transposePitch(parseKeyString(root), n));

describe("ortografía en transposición", () => {
  it("Bb + 1 → B (no Cb)", () => expect(t("Bb", 1)).toBe("B"));
  it("Eb + 1 → E (no Fb)", () => expect(t("Eb", 1)).toBe("E"));
  it("Ab + 1 → A (no Bbb)", () => expect(t("Ab", 1)).toBe("A"));
  it("Db + 1 → D (no Ebb)", () => expect(t("Db", 1)).toBe("D"));
  it("C + 1 → Db", () => expect(t("C", 1)).toBe("Db"));
  it("Bb + 2 → C", () => expect(t("Bb", 2)).toBe("C"));
  it("Eb + 2 → F", () => expect(t("Eb", 2)).toBe("F"));
});

describe("ningún doble bemol/sostenido en los 12 tonos", () => {
  it("desde cada raíz, los 12 shifts salen limpios", () => {
    for (const root of [
      "C",
      "Db",
      "D",
      "Eb",
      "E",
      "F",
      "Gb",
      "G",
      "Ab",
      "A",
      "Bb",
      "B",
    ]) {
      for (let n = 0; n < 12; n++) {
        const out = formatPitch(transposePitch(parseKeyString(root), n));
        expect(out, `${root} + ${n} → ${out}`).not.toMatch(/(bb|##)/);
      }
    }
  });
});

describe("East of the Sun — 12 transposiciones limpias", () => {
  it("ninguna salida contiene bb ni ##", () => {
    const { ast } = parseChart(EAST_OF_SUN_CHART);
    for (let n = 0; n < 12; n++) {
      const shifted = transposeAst(ast, n);
      for (const raw of chordRaws(shifted)) {
        expect(raw, `shift ${n}: ${raw}`).not.toMatch(/(bb|##)/);
      }
    }
  });
});

describe("transposeChord conserva raw", () => {
  it("no borra el texto crudo al transponer", () => {
    const chord = {
      root: { letter: "B", alter: -1 },
      quality: "maj",
      ext: ["7"],
      bass: null,
      raw: "Bb^7",
    };
    const out = transposeChord(chord, 1);
    expect(out.raw).toBe("Bb^7");
  });
});
