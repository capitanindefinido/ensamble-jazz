/**
 * Apps Script para guardar charts, notas e import iReal desde la app.
 *
 * Deploy: Extensiones → Apps Script → pegar este archivo →
 * Implementar → Nueva implementación → Aplicación web
 *   Ejecutar como: Yo
 *   Quién tiene acceso: Cualquiera
 * Copiar la URL a VITE_APPS_SCRIPT_URL en Vercel / .env
 *
 * El Sheet debe tener pestaña Config con columna clave_edicion.
 *
 * POST body (text/plain JSON):
 *   A) Update simple:
 *      { clave, ensamble_id, titulo, chart?, notas? }
 *   B) Upsert lote (import iReal):
 *      { clave, ensamble_id, songs: [{ titulo, compositor, feel, bpm, tono, chart, notesText? }] }
 */

var SHEET_REPERTORIO = "Repertorio";
var SHEET_CONFIG = "Config";

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "";
    var body = JSON.parse(raw);
    var clave = String(body.clave || "");
    var ensambleId = String(body.ensamble_id || "");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var auth = checkClave_(ss, clave);
    if (!auth.ok) return jsonOut(auth);

    if (body.songs && Object.prototype.toString.call(body.songs) === "[object Array]") {
      return upsertSongs_(ss, ensambleId, body.songs);
    }

    return updateFields_(ss, ensambleId, body);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function checkClave_(ss, clave) {
  var config = ss.getSheetByName(SHEET_CONFIG);
  if (!config) {
    return { ok: false, error: "no hay pestaña Config" };
  }
  var claveOk = String(config.getRange("A2").getValue() || "").trim();
  var cfgValues = config.getDataRange().getValues();
  if (cfgValues.length && String(cfgValues[0][0]).toLowerCase().indexOf("clave") !== -1) {
    claveOk = String(cfgValues[1] && cfgValues[1][0] != null ? cfgValues[1][0] : claveOk).trim();
  }
  if (!claveOk || clave !== claveOk) {
    return { ok: false, error: "clave incorrecta" };
  }
  return { ok: true };
}

function headerIndex_(headers, name) {
  return headers.indexOf(name);
}

function normTitle_(t) {
  var s = String(t || "").toLowerCase();
  s = s
    .replace(/[áàäâ]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöô]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/ç/g, "c");
  return s.replace(/[^a-z0-9]+/g, " ").trim();
}

/** Soft-match: exacto, sin paréntesis, o prefijo. */
function titlesMatch_(sheetTitle, importTitle) {
  var a = normTitle_(sheetTitle);
  var b = normTitle_(importTitle);
  if (!a || !b) return false;
  if (a === b) return true;
  var aShort = normTitle_(String(sheetTitle || "").replace(/\([^)]*\)/g, " "));
  var bShort = normTitle_(String(importTitle || "").replace(/\([^)]*\)/g, " "));
  if (aShort && bShort && aShort === bShort) return true;
  if (aShort && bShort && (aShort.indexOf(bShort) === 0 || bShort.indexOf(aShort) === 0)) {
    return true;
  }
  return false;
}

function colMap_(headers) {
  return {
    ensamble_id: headerIndex_(headers, "ensamble_id"),
    orden: headerIndex_(headers, "orden"),
    titulo: headerIndex_(headers, "titulo"),
    compositor: headerIndex_(headers, "compositor"),
    feel: headerIndex_(headers, "feel"),
    bpm: headerIndex_(headers, "bpm"),
    tono: headerIndex_(headers, "tono"),
    chart: headerIndex_(headers, "chart"),
    chart_pdf_url: headerIndex_(headers, "chart_pdf_url"),
    ref_url: headerIndex_(headers, "ref_url"),
    notas: headerIndex_(headers, "notas"),
  };
}

function updateFields_(ss, ensambleId, body) {
  var titulo = String(body.titulo || "");
  var hasChart = Object.prototype.hasOwnProperty.call(body, "chart");
  var hasNotas = Object.prototype.hasOwnProperty.call(body, "notas");

  if (!ensambleId || !titulo) {
    return jsonOut({ ok: false, error: "faltan ensamble_id o titulo" });
  }
  if (!hasChart && !hasNotas) {
    return jsonOut({ ok: false, error: "nada que guardar (chart o notas)" });
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
  var cols = colMap_(headers);
  if (cols.ensamble_id < 0 || cols.titulo < 0) {
    return jsonOut({ ok: false, error: "headers incompletos en Repertorio" });
  }
  if (hasChart && cols.chart < 0) {
    return jsonOut({ ok: false, error: "falta columna chart" });
  }
  if (hasNotas && cols.notas < 0) {
    return jsonOut({ ok: false, error: "falta columna notas" });
  }

  var rowIndex = -1;
  for (var r = 1; r < data.length; r++) {
    var eid = String(data[r][cols.ensamble_id] || "").trim();
    var tit = String(data[r][cols.titulo] || "");
    if (eid === ensambleId && titlesMatch_(tit, titulo)) {
      rowIndex = r + 1;
      break;
    }
  }
  if (rowIndex < 0) {
    return jsonOut({ ok: false, error: "tema no encontrado" });
  }

  var updated = [];
  if (hasChart) {
    sheet.getRange(rowIndex, cols.chart + 1).setValue(String(body.chart != null ? body.chart : ""));
    updated.push("chart");
  }
  if (hasNotas) {
    sheet.getRange(rowIndex, cols.notas + 1).setValue(String(body.notas != null ? body.notas : ""));
    updated.push("notas");
  }

  return jsonOut({ ok: true, row: rowIndex, updated: updated });
}

function upsertSongs_(ss, ensambleId, songs) {
  if (!ensambleId) {
    return jsonOut({ ok: false, error: "falta ensamble_id" });
  }
  if (!songs.length) {
    return jsonOut({ ok: false, error: "songs vacío" });
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
  var cols = colMap_(headers);
  if (cols.ensamble_id < 0 || cols.titulo < 0 || cols.chart < 0) {
    return jsonOut({ ok: false, error: "headers incompletos en Repertorio" });
  }

  var maxOrden = 0;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][cols.ensamble_id] || "").trim() !== ensambleId) continue;
    if (cols.orden >= 0) {
      var n = Number(data[r][cols.orden]);
      if (isFinite(n) && n > maxOrden) maxOrden = n;
    }
  }

  var created = [];
  var updated = [];
  var errors = [];

  for (var i = 0; i < songs.length; i++) {
    var song = songs[i] || {};
    var titulo = String(song.titulo || "").trim();
    if (!titulo) {
      errors.push({ title: "?", reason: "sin titulo" });
      continue;
    }

    var rowIndex = -1;
    var rowArr = null;
    for (var rr = 1; rr < data.length; rr++) {
      var eid = String(data[rr][cols.ensamble_id] || "").trim();
      if (eid !== ensambleId) continue;
      if (titlesMatch_(String(data[rr][cols.titulo] || ""), titulo)) {
        rowIndex = rr + 1;
        rowArr = data[rr];
        break;
      }
    }

    if (rowIndex < 0) {
      maxOrden += 1;
      var newRow = [];
      for (var c = 0; c < headers.length; c++) newRow[c] = "";
      if (cols.ensamble_id >= 0) newRow[cols.ensamble_id] = ensambleId;
      if (cols.orden >= 0) newRow[cols.orden] = maxOrden;
      if (cols.titulo >= 0) newRow[cols.titulo] = titulo;
      if (cols.compositor >= 0) newRow[cols.compositor] = String(song.compositor || "");
      if (cols.feel >= 0) newRow[cols.feel] = String(song.feel || "");
      if (cols.bpm >= 0 && String(song.bpm || "").trim()) {
        newRow[cols.bpm] = String(song.bpm);
      }
      if (cols.tono >= 0) newRow[cols.tono] = String(song.tono || "");
      if (cols.chart >= 0) newRow[cols.chart] = String(song.chart || "");
      var notesNew = String(song.notesText || song.notas || "").trim();
      if (cols.notas >= 0 && notesNew) newRow[cols.notas] = notesNew;
      if (cols.ref_url >= 0) {
        var q = encodeURIComponent(titulo + " " + String(song.compositor || ""));
        newRow[cols.ref_url] = "https://www.youtube.com/results?search_query=" + q;
      }
      sheet.appendRow(newRow);
      data.push(newRow);
      created.push(titulo);
    } else {
      if (cols.compositor >= 0) {
        sheet.getRange(rowIndex, cols.compositor + 1).setValue(String(song.compositor || ""));
      }
      if (cols.feel >= 0) {
        sheet.getRange(rowIndex, cols.feel + 1).setValue(String(song.feel || ""));
      }
      if (cols.tono >= 0) {
        sheet.getRange(rowIndex, cols.tono + 1).setValue(String(song.tono || ""));
      }
      if (cols.chart >= 0) {
        sheet.getRange(rowIndex, cols.chart + 1).setValue(String(song.chart || ""));
      }
      if (cols.bpm >= 0) {
        var prevBpm = String(rowArr[cols.bpm] || "").trim();
        var exportBpm = String(song.bpm || "").trim();
        if (!prevBpm && exportBpm) {
          sheet.getRange(rowIndex, cols.bpm + 1).setValue(exportBpm);
          rowArr[cols.bpm] = exportBpm;
        }
      }
      if (cols.notas >= 0) {
        var prevNotas = String(rowArr[cols.notas] || "").trim();
        var exportNotas = String(song.notesText || song.notas || "").trim();
        if (!prevNotas && exportNotas) {
          sheet.getRange(rowIndex, cols.notas + 1).setValue(exportNotas);
          rowArr[cols.notas] = exportNotas;
        }
      }
      // No tocar chart_pdf_url / ref_url si ya tienen valor
      if (cols.compositor >= 0) rowArr[cols.compositor] = String(song.compositor || "");
      if (cols.feel >= 0) rowArr[cols.feel] = String(song.feel || "");
      if (cols.tono >= 0) rowArr[cols.tono] = String(song.tono || "");
      if (cols.chart >= 0) rowArr[cols.chart] = String(song.chart || "");
      updated.push(titulo);
    }
  }

  return jsonOut({
    ok: true,
    created: created,
    updated: updated,
    errors: errors,
    createdCount: created.length,
    updatedCount: updated.length,
  });
}

function doGet() {
  return jsonOut({ ok: true, service: "biblioteca-ensambles-write" });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
