import { describe, expect, it } from "vitest";
import {
  MAX_VOTES_PER_PERSON,
  findDuplicateDeseo,
  hasVoted,
  isIntegrante,
  normDeseoTitle,
  rankDeseos,
  votesRemaining,
  votesUsedBy,
} from "./wishlist.js";
import { DESEO_FIELDS, REQUIRED_HEADERS, parseCsv } from "./sheetParse.js";

describe("wishlist logic", () => {
  const deseos = [
    {
      id: "d1",
      ensamble_id: "sabado-10",
      titulo: "Take Five",
      estado: "abierta",
      creado: "2026-07-01",
    },
    {
      id: "d2",
      ensamble_id: "sabado-10",
      titulo: "Wave",
      estado: "abierta",
      creado: "2026-07-10",
    },
    {
      id: "d3",
      ensamble_id: "sabado-10",
      titulo: "Old",
      estado: "archivada",
      creado: "2026-06-01",
    },
  ];
  const votos = [
    { ensamble_id: "sabado-10", deseo_id: "d1", votante: "Diego" },
    { ensamble_id: "sabado-10", deseo_id: "d1", votante: "Caroline" },
    { ensamble_id: "sabado-10", deseo_id: "d2", votante: "Diego" },
  ];

  it("normaliza títulos para dedupe", () => {
    expect(normDeseoTitle("Como Fué")).toBe("como fue");
    expect(normDeseoTitle("  Pink  Panther ")).toBe("pink panther");
  });

  it("detecta duplicados ignorando archivados", () => {
    expect(findDuplicateDeseo(deseos, "sabado-10", "take five")?.id).toBe("d1");
    expect(findDuplicateDeseo(deseos, "sabado-10", "Old")).toBeNull();
  });

  it("cuenta votos y tope por persona", () => {
    expect(votesUsedBy(votos, "sabado-10", "Diego")).toBe(2);
    expect(votesRemaining(votos, "sabado-10", "Diego")).toBe(
      MAX_VOTES_PER_PERSON - 2
    );
    expect(hasVoted(votos, "sabado-10", "d1", "Diego")).toBe(true);
    expect(hasVoted(votos, "sabado-10", "d2", "Caroline")).toBe(false);
  });

  it("ordena por votos y oculta archivados", () => {
    const ranked = rankDeseos(deseos, votos, "sabado-10", "Diego");
    expect(ranked.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(ranked[0].votes).toBe(2);
    expect(ranked[0].likedByMe).toBe(true);
    expect(ranked[1].votes).toBe(1);
  });

  it("valida integrante del ensamble", () => {
    const roster = [
      { ensamble_id: "sabado-10", nombre: "Diego" },
      { ensamble_id: "otro", nombre: "Ana" },
    ];
    expect(isIntegrante(roster, "sabado-10", "Diego")).toBe(true);
    expect(isIntegrante(roster, "sabado-10", "Ana")).toBe(false);
  });
});

describe("parseCsv Deseos", () => {
  it("acepta headers de Deseos", () => {
    const csv =
      "id,ensamble_id,titulo,propuesto_por,estado,creado\n" +
      "d1,sabado-10,Wave,Diego,abierta,2026-07-22\n";
    const rows = parseCsv(csv, DESEO_FIELDS, {
      tabName: "Deseos",
      requiredKeys: REQUIRED_HEADERS.Deseos,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].titulo).toBe("Wave");
  });
});
