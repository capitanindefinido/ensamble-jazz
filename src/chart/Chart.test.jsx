/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Chart from "./Chart.jsx";
import { EAST_OF_SUN_CHART, parseChart } from "./parse.js";

describe("Chart renderer", () => {
  it("pone data-measure={index} en cada compás", () => {
    const { ast } = parseChart(EAST_OF_SUN_CHART);
    const { container } = render(<Chart ast={ast} />);
    const nodes = container.querySelectorAll("[data-measure]");
    expect(nodes.length).toBe(40);
    expect(nodes[0].getAttribute("data-measure")).toBe("0");
    expect(nodes[39].getAttribute("data-measure")).toBe("39");
  });

  it("muestra el glifo de repetición de compás (no % tipográfico)", () => {
    const { ast } = parseChart(EAST_OF_SUN_CHART);
    const { container } = render(<Chart ast={ast} />);
    const pcts = container.querySelectorAll(".be-chart-pct");
    expect(pcts.length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".be-chart-pct-svg").length).toBe(
      pcts.length
    );
    expect(container.querySelector(".be-chart-pct")?.textContent?.trim()).toBe(
      ""
    );
  });

  it("marca compases inválidos con el texto crudo", () => {
    const { ast } = parseChart("T44\n[A] Bb^7 | NOPE | D-7 |");
    const { container } = render(<Chart ast={ast} />);
    expect(container.querySelector(".be-chart-measure.invalid")).toBeTruthy();
    expect(container.textContent).toContain("NOPE");
    expect(container.textContent).toMatch(/B/); // Bb sigue ahí
  });

  it("resalta el compás activo vía .active", () => {
    const { ast } = parseChart(EAST_OF_SUN_CHART);
    const { container, rerender } = render(
      <Chart ast={ast} activeMeasure={3} />
    );
    expect(
      container.querySelector('[data-measure="3"]')?.className
    ).toContain("active");
    rerender(<Chart ast={ast} activeMeasure={5} />);
    expect(
      container.querySelector('[data-measure="3"]')?.className
    ).not.toContain("active");
    expect(
      container.querySelector('[data-measure="5"]')?.className
    ).toContain("active");
  });
});
