import { describe, expect, it } from "vitest";
import { EAST_OF_SUN_CHART, formatChord, parseChart } from "./parse.js";
import { serializeAst } from "./transpose.js";
import {
  findMeasure,
  measureSlotTexts,
  setMeasureContent,
} from "./mutate.js";

describe("setMeasureContent", () => {
  it("cambia un slot y sobrevive roundtrip serialize→parse", () => {
    const { ast } = parseChart(EAST_OF_SUN_CHART);
    const before = findMeasure(ast, 0);
    expect(formatChord(before.chords[0])).toBe("Bb^7");

    const { ast: next, error } = setMeasureContent(ast, 0, {
      mode: "chords",
      slots: ["C^7"],
    });
    expect(error).toBeNull();
    expect(formatChord(findMeasure(next, 0).chords[0])).toBe("C^7");

    const text = serializeAst(next);
    const { ast: again } = parseChart(text);
    expect(formatChord(findMeasure(again, 0).chords[0])).toBe("C^7");
  });

  it("pone % y N.C.", () => {
    const { ast } = parseChart("T44\n[A] Bb7 | D-7 | G7 |");
    const rep = setMeasureContent(ast, 1, { mode: "repeat" });
    expect(rep.error).toBeNull();
    expect(findMeasure(rep.ast, 1).repeatPrev).toBe(true);

    const text = serializeAst(rep.ast);
    expect(text).toMatch(/%/);

    const nc = setMeasureContent(ast, 2, { mode: "nc" });
    expect(nc.error).toBeNull();
    expect(findMeasure(nc.ast, 2).noChord).toBe(true);
    expect(serializeAst(nc.ast)).toMatch(/N\.C\./);
  });

  it("rechaza acorde inválido sin mutar", () => {
    const { ast } = parseChart("T44\n[A] C7 |");
    const { ast: next, error } = setMeasureContent(ast, 0, {
      mode: "chords",
      slots: ["NOPE"],
    });
    expect(error).toMatch(/NOPE/);
    expect(formatChord(findMeasure(next, 0).chords[0])).toBe("C7");
  });

  it("measureSlotTexts lee acordes formateados", () => {
    const { ast } = parseChart("T44\n[A] D-7 G7 |");
    expect(measureSlotTexts(findMeasure(ast, 0))).toEqual(["D-7", "G7"]);
  });
});
