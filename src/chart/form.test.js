import { describe, expect, it } from "vitest";
import { expandPlaybackForm } from "./form.js";
import { parseChart, formatChord } from "./parse.js";

function played(chart) {
  const { ast } = parseChart(chart);
  const flat = [];
  for (const sec of ast.sections) {
    for (const m of sec.measures) flat.push(m);
  }
  const by = new Map(flat.map((m) => [m.index, m]));
  return expandPlaybackForm(ast).map((idx) => {
    const m = by.get(idx);
    if (m.noChord) return "N.C.";
    if (m.repeatPrev) return "%";
    return (m.chords || []).map(formatChord).join(" ");
  });
}

describe("expandPlaybackForm", () => {
  it("repite el bloque { }", () => {
    expect(
      played("T44\n[A] { C | F | G | C } |")
    ).toEqual(["C", "F", "G", "C", "C", "F", "G", "C"]);
  });

  it("casillas N1 / N2", () => {
    expect(
      played("T44\n[A] { C | F | N1 G | C } | N2 D | G |")
    ).toEqual(["C", "F", "G", "C", "C", "F", "D", "G"]);
  });

  it("D.S. al Coda con dos Q", () => {
    const seq = played(
      "T44\n[A] S C | F | Q G | <D.S. al Coda> C | Q Bb | Eb |"
    );
    // 1ª: C F G C → salto a S
    // 2ª: C F → toCoda G → coda Bb Eb
    expect(seq).toEqual(["C", "F", "G", "C", "C", "F", "Bb", "Eb"]);
  });

  it("D.C. al Fine", () => {
    expect(
      played("T44\n[A] C | F | <Fine> G | <D.C. al Fine> C |")
    ).toEqual(["C", "F", "G", "C", "C", "F", "G"]);
  });

  it("parsea marcas S/Q/jump en el AST", () => {
    const { ast } = parseChart(
      "T44\n[A] S C | Q F | <D.S. al Coda> G |"
    );
    const ms = ast.sections[0].measures;
    expect(ms[0].segno).toBe(true);
    expect(ms[1].coda).toBe(true);
    expect(ms[2].jump).toMatchObject({
      kind: "ds",
      al: { target: "coda" },
    });
  });
});
