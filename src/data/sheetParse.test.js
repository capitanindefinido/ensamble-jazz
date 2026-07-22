import { describe, expect, it, vi } from "vitest";
import {
  ENSAMBLE_FIELDS,
  REPERTORIO_FIELDS,
  REQUIRED_HEADERS,
  SheetError,
  fetchTab,
  isConfigError,
  parseCsv,
} from "./sheetParse.js";

describe("parseCsv — validación de headers", () => {
  it("acepta headers correctos de Repertorio", () => {
    const csv =
      "ensamble_id,orden,titulo,compositor,feel,bpm,tono,chart,chart_pdf_url,ref_url,notas\n" +
      "sabado-10,1,Misty,Garner,Ballad,70,Bb,,,,\n";
    const rows = parseCsv(csv, REPERTORIO_FIELDS, {
      tabName: "Repertorio",
      requiredKeys: REQUIRED_HEADERS.Repertorio,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].titulo).toBe("Misty");
  });

  it("detecta pestaña equivocada cuando faltan columnas clave", () => {
    // gviz devolvió Ensambles al pedir Repertorio
    const csv =
      "id,nombre,horario,profe_titular,profe_ayudante\n" +
      "sabado-10,Sábado,10:00,Diego,Miguel\n";
    expect(() =>
      parseCsv(csv, REPERTORIO_FIELDS, {
        tabName: "Repertorio",
        requiredKeys: REQUIRED_HEADERS.Repertorio,
      })
    ).toThrow(SheetError);

    try {
      parseCsv(csv, REPERTORIO_FIELDS, {
        tabName: "Repertorio",
        requiredKeys: REQUIRED_HEADERS.Repertorio,
      });
    } catch (err) {
      expect(err.code).toBe("pestana");
      expect(err.message).toContain("Repertorio");
      expect(err.message).toContain("ensamble_id");
      expect(isConfigError(err)).toBe(true);
    }
  });
});

describe("fetchTab — taxonomía de errores", () => {
  it("opaqueredirect → no compartido", async () => {
    const fetchFn = vi.fn(async () => ({
      type: "opaqueredirect",
      status: 0,
      ok: false,
      text: async () => "",
    }));
    await expect(
      fetchTab("sheetid", "Ensambles", ENSAMBLE_FIELDS, fetchFn)
    ).rejects.toMatchObject({ code: "permisos" });
    expect(fetchFn.mock.calls[0][1]).toEqual({ redirect: "manual" });
  });

  it("404 → ID incorrecto", async () => {
    const fetchFn = vi.fn(async () => ({
      type: "cors",
      status: 404,
      ok: false,
      text: async () => "",
    }));
    await expect(
      fetchTab("bad-id", "Ensambles", ENSAMBLE_FIELDS, fetchFn)
    ).rejects.toMatchObject({
      code: "id",
      message: expect.stringContaining("VITE_SHEET_ID"),
    });
  });

  it("TypeError → sin conexión", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      fetchTab("sheetid", "Ensambles", ENSAMBLE_FIELDS, fetchFn)
    ).rejects.toMatchObject({ code: "red" });
  });

  it("200 CSV válido → parsea filas (camino feliz con redirect manual)", async () => {
    const csv =
      "id,nombre,horario,profe_titular,profe_ayudante\n" +
      "sabado-10,Sábado 10,10:00–11:00,Diego,Miguel\n";
    const fetchFn = vi.fn(async () => ({
      type: "cors",
      status: 200,
      ok: true,
      text: async () => csv,
    }));
    const rows = await fetchTab(
      "sheetid",
      "Ensambles",
      ENSAMBLE_FIELDS,
      fetchFn
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("sabado-10");
    expect(fetchFn.mock.calls[0][1]).toEqual({ redirect: "manual" });
  });
});
