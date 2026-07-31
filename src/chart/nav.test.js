import { describe, expect, it } from "vitest";
import { formatJump, parseNavDirective } from "./nav.js";

describe("parseNavDirective", () => {
  it("Fine / Nx / D.C. / D.S.", () => {
    expect(parseNavDirective("Fine")).toEqual({ type: "fine" });
    expect(parseNavDirective("3x")).toEqual({ type: "repeatX", times: 3 });
    expect(parseNavDirective("D.C. al Coda")).toMatchObject({
      type: "jump",
      kind: "dc",
      al: { target: "coda" },
    });
    expect(parseNavDirective("D.S. al Fine")).toMatchObject({
      type: "jump",
      kind: "ds",
      al: { target: "fine" },
    });
    expect(parseNavDirective("D.S. al 2nd End.")).toMatchObject({
      type: "jump",
      kind: "ds",
      al: { target: "ending", ending: 2 },
    });
  });

  it("formatJump redondea", () => {
    expect(
      formatJump({ kind: "ds", al: { target: "coda", ending: null } })
    ).toBe("D.S. al Coda");
  });
});
