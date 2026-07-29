/**
 * Apps Script para guardar charts y notas desde la app.
 *
 * Deploy: Extensiones → Apps Script → pegar este archivo →
 * Implementar → Nueva implementación → Aplicación web
 *   Ejecutar como: Yo
 *   Quién tiene acceso: Cualquiera
 * Copiar la URL a VITE_APPS_SCRIPT_URL en Vercel / .env
 *
 * El Sheet debe tener pestaña Config con columna clave_edicion.
 * POST body (text/plain JSON):
 *   { clave, ensamble_id, titulo, chart?, notas? }
 * Solo actualiza las columnas presentes en el body.
 */

var SHEET_REPERTORIO = "Repertorio";
var SHEET_CONFIG = "Config";

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "";
    var body = JSON.parse(raw);
    var clave = String(body.clave || "");
    var ensambleId = String(body.ensamble_id || "");
    var titulo = String(body.titulo || "");
    var hasChart = Object.prototype.hasOwnProperty.call(body, "chart");
    var hasNotas = Object.prototype.hasOwnProperty.call(body, "notas");

    if (!ensambleId || !titulo) {
      return jsonOut({ ok: false, error: "faltan ensamble_id o titulo" });
    }
    if (!hasChart && !hasNotas) {
      return jsonOut({ ok: false, error: "nada que guardar (chart o notas)" });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var config = ss.getSheetByName(SHEET_CONFIG);
    if (!config) {
      return jsonOut({ ok: false, error: "no hay pestaña Config" });
    }
    var claveOk = String(config.getRange("A2").getValue() || "").trim();
    var cfgValues = config.getDataRange().getValues();
    if (cfgValues.length && String(cfgValues[0][0]).toLowerCase().indexOf("clave") !== -1) {
      claveOk = String(cfgValues[1] && cfgValues[1][0] != null ? cfgValues[1][0] : claveOk).trim();
    }
    if (!claveOk || clave !== claveOk) {
      return jsonOut({ ok: false, error: "clave incorrecta" });
    }

    var sheet = ss.getSheetByName(SHEET_REPERTORIO);
    if (!sheet) {
      return jsonOut({ ok: false, error: "no hay pestaña Repertorio" });
    }

    var data = sheet.getDataRange().getValues();
    if (!data.length) {
      return jsonOut({ ok: false, error: "Repertorio vacío" });
    }
    var headers = data[0].map(function (h) {
      return String(h || "").trim().toLowerCase();
    });
    var iEns = headers.indexOf("ensamble_id");
    var iTit = headers.indexOf("titulo");
    var iChart = headers.indexOf("chart");
    var iNotas = headers.indexOf("notas");
    if (iEns < 0 || iTit < 0) {
      return jsonOut({ ok: false, error: "headers incompletos en Repertorio" });
    }
    if (hasChart && iChart < 0) {
      return jsonOut({ ok: false, error: "falta columna chart" });
    }
    if (hasNotas && iNotas < 0) {
      return jsonOut({ ok: false, error: "falta columna notas" });
    }

    var rowIndex = -1;
    var tNorm = titulo.trim().toLowerCase();
    for (var r = 1; r < data.length; r++) {
      var eid = String(data[r][iEns] || "").trim();
      var tit = String(data[r][iTit] || "").trim().toLowerCase();
      if (eid === ensambleId && tit === tNorm) {
        rowIndex = r + 1;
        break;
      }
    }
    if (rowIndex < 0) {
      return jsonOut({ ok: false, error: "tema no encontrado" });
    }

    var updated = [];
    if (hasChart) {
      sheet.getRange(rowIndex, iChart + 1).setValue(String(body.chart != null ? body.chart : ""));
      updated.push("chart");
    }
    if (hasNotas) {
      sheet.getRange(rowIndex, iNotas + 1).setValue(String(body.notas != null ? body.notas : ""));
      updated.push("notas");
    }

    return jsonOut({ ok: true, row: rowIndex, updated: updated });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return jsonOut({ ok: true, service: "biblioteca-ensambles-write" });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
