/**
 * Apps Script para guardar charts, notas, import iReal y lista de deseos.
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
 *      { clave, ensamble_id, songs: [...] }
 *   C) Lista de deseos:
 *      { action: "wishlist_propose", ensamble_id, titulo, propuesto_por, id? }
 *      { action: "wishlist_vote", ensamble_id, deseo_id, votante }
 *      { action: "wishlist_estado", clave, ensamble_id, deseo_id, estado }
 */

var SHEET_REPERTORIO = "Repertorio";
var SHEET_CONFIG = "Config";
var SHEET_INTEGRANTES = "Integrantes";
var SHEET_DESEOS = "Deseos";
var SHEET_VOTOS = "Votos";
var MAX_VOTOS = 3;

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "";
    var body = JSON.parse(raw);
    var action = String(body.action || "");
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "wishlist_propose") {
      return wishlistPropose_(ss, body);
    }
    if (action === "wishlist_vote") {
      return wishlistVote_(ss, body);
    }
    if (action === "wishlist_estado") {
      var authEst = checkClave_(ss, String(body.clave || ""));
      if (!authEst.ok) return jsonOut(authEst);
      return wishlistEstado_(ss, body);
    }

    var clave = String(body.clave || "");
    var ensambleId = String(body.ensamble_id || "");
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

function sheetData_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  if (!data.length) return null;
  var headers = data[0].map(function (h) {
    return String(h || "").trim().toLowerCase();
  });
  return { sheet: sheet, data: data, headers: headers };
}

function isIntegrante_(ss, ensambleId, nombre) {
  var pack = sheetData_(ss, SHEET_INTEGRANTES);
  if (!pack) return false;
  var iEns = headerIndex_(pack.headers, "ensamble_id");
  var iNom = headerIndex_(pack.headers, "nombre");
  if (iEns < 0 || iNom < 0) return false;
  var n = String(nombre || "").trim();
  for (var r = 1; r < pack.data.length; r++) {
    if (
      String(pack.data[r][iEns] || "").trim() === ensambleId &&
      String(pack.data[r][iNom] || "").trim() === n
    ) {
      return true;
    }
  }
  return false;
}

function wishlistPropose_(ss, body) {
  var ensambleId = String(body.ensamble_id || "").trim();
  var titulo = String(body.titulo || "").trim();
  var propuestoPor = String(body.propuesto_por || "").trim();
  var id = String(body.id || "").trim();
  if (!ensambleId || !titulo || !propuestoPor) {
    return jsonOut({ ok: false, error: "faltan ensamble_id, titulo o propuesto_por" });
  }
  if (!isIntegrante_(ss, ensambleId, propuestoPor)) {
    return jsonOut({ ok: false, error: "propuesto_por no es integrante del ensamble" });
  }

  var pack = sheetData_(ss, SHEET_DESEOS);
  if (!pack) {
    return jsonOut({ ok: false, error: "no hay pestaña Deseos" });
  }
  var cols = {
    id: headerIndex_(pack.headers, "id"),
    ensamble_id: headerIndex_(pack.headers, "ensamble_id"),
    titulo: headerIndex_(pack.headers, "titulo"),
    propuesto_por: headerIndex_(pack.headers, "propuesto_por"),
    estado: headerIndex_(pack.headers, "estado"),
    creado: headerIndex_(pack.headers, "creado"),
  };
  if (cols.id < 0 || cols.ensamble_id < 0 || cols.titulo < 0) {
    return jsonOut({ ok: false, error: "headers incompletos en Deseos" });
  }

  var key = normTitle_(titulo);
  for (var r = 1; r < pack.data.length; r++) {
    if (String(pack.data[r][cols.ensamble_id] || "").trim() !== ensambleId) continue;
    var est = cols.estado >= 0 ? String(pack.data[r][cols.estado] || "") : "abierta";
    if (est === "archivada") continue;
    if (normTitle_(String(pack.data[r][cols.titulo] || "")) === key) {
      return jsonOut({
        ok: false,
        error: "ya está en la lista",
        existing_id: String(pack.data[r][cols.id] || ""),
      });
    }
  }

  if (!id) id = "d_" + Utilities.getUuid().replace(/-/g, "").slice(0, 8);
  var creado = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var newRow = [];
  for (var c = 0; c < pack.headers.length; c++) newRow[c] = "";
  newRow[cols.id] = id;
  newRow[cols.ensamble_id] = ensambleId;
  newRow[cols.titulo] = titulo;
  if (cols.propuesto_por >= 0) newRow[cols.propuesto_por] = propuestoPor;
  if (cols.estado >= 0) newRow[cols.estado] = "abierta";
  if (cols.creado >= 0) newRow[cols.creado] = creado;
  pack.sheet.appendRow(newRow);

  return jsonOut({
    ok: true,
    deseo: {
      id: id,
      ensamble_id: ensambleId,
      titulo: titulo,
      propuesto_por: propuestoPor,
      estado: "abierta",
      creado: creado,
    },
  });
}

function wishlistVote_(ss, body) {
  var ensambleId = String(body.ensamble_id || "").trim();
  var deseoId = String(body.deseo_id || "").trim();
  var votante = String(body.votante || "").trim();
  if (!ensambleId || !deseoId || !votante) {
    return jsonOut({ ok: false, error: "faltan ensamble_id, deseo_id o votante" });
  }
  if (!isIntegrante_(ss, ensambleId, votante)) {
    return jsonOut({ ok: false, error: "votante no es integrante del ensamble" });
  }

  var deseos = sheetData_(ss, SHEET_DESEOS);
  if (!deseos) return jsonOut({ ok: false, error: "no hay pestaña Deseos" });
  var iId = headerIndex_(deseos.headers, "id");
  var iEnsD = headerIndex_(deseos.headers, "ensamble_id");
  var iEst = headerIndex_(deseos.headers, "estado");
  var found = false;
  for (var r = 1; r < deseos.data.length; r++) {
    if (
      String(deseos.data[r][iId] || "").trim() === deseoId &&
      String(deseos.data[r][iEnsD] || "").trim() === ensambleId
    ) {
      var est = iEst >= 0 ? String(deseos.data[r][iEst] || "abierta") : "abierta";
      if (est === "archivada") {
        return jsonOut({ ok: false, error: "tema archivado" });
      }
      found = true;
      break;
    }
  }
  if (!found) return jsonOut({ ok: false, error: "deseo no encontrado" });

  var pack = sheetData_(ss, SHEET_VOTOS);
  if (!pack) return jsonOut({ ok: false, error: "no hay pestaña Votos" });
  var cols = {
    ensamble_id: headerIndex_(pack.headers, "ensamble_id"),
    deseo_id: headerIndex_(pack.headers, "deseo_id"),
    votante: headerIndex_(pack.headers, "votante"),
  };
  if (cols.ensamble_id < 0 || cols.deseo_id < 0 || cols.votante < 0) {
    return jsonOut({ ok: false, error: "headers incompletos en Votos" });
  }

  var existingRow = -1;
  var used = 0;
  for (var vr = 1; vr < pack.data.length; vr++) {
    if (String(pack.data[vr][cols.ensamble_id] || "").trim() !== ensambleId) continue;
    if (String(pack.data[vr][cols.votante] || "").trim() !== votante) continue;
    used += 1;
    if (String(pack.data[vr][cols.deseo_id] || "").trim() === deseoId) {
      existingRow = vr + 1;
    }
  }

  if (existingRow > 0) {
    pack.sheet.deleteRow(existingRow);
    return jsonOut({ ok: true, liked: false, used: used - 1, remaining: MAX_VOTOS - (used - 1) });
  }

  if (used >= MAX_VOTOS) {
    return jsonOut({
      ok: false,
      error: "ya usaste tus " + MAX_VOTOS + " votos",
      used: used,
      remaining: 0,
    });
  }

  var newRow = [];
  for (var c = 0; c < pack.headers.length; c++) newRow[c] = "";
  newRow[cols.ensamble_id] = ensambleId;
  newRow[cols.deseo_id] = deseoId;
  newRow[cols.votante] = votante;
  pack.sheet.appendRow(newRow);
  return jsonOut({
    ok: true,
    liked: true,
    used: used + 1,
    remaining: MAX_VOTOS - (used + 1),
  });
}

function wishlistEstado_(ss, body) {
  var ensambleId = String(body.ensamble_id || "").trim();
  var deseoId = String(body.deseo_id || "").trim();
  var estado = String(body.estado || "").trim();
  if (!ensambleId || !deseoId || !estado) {
    return jsonOut({ ok: false, error: "faltan ensamble_id, deseo_id o estado" });
  }
  if (estado !== "abierta" && estado !== "a_sacar" && estado !== "archivada") {
    return jsonOut({ ok: false, error: "estado inválido" });
  }

  var pack = sheetData_(ss, SHEET_DESEOS);
  if (!pack) return jsonOut({ ok: false, error: "no hay pestaña Deseos" });
  var cols = {
    id: headerIndex_(pack.headers, "id"),
    ensamble_id: headerIndex_(pack.headers, "ensamble_id"),
    estado: headerIndex_(pack.headers, "estado"),
  };
  if (cols.id < 0 || cols.ensamble_id < 0 || cols.estado < 0) {
    return jsonOut({ ok: false, error: "headers incompletos en Deseos" });
  }

  for (var r = 1; r < pack.data.length; r++) {
    if (
      String(pack.data[r][cols.id] || "").trim() === deseoId &&
      String(pack.data[r][cols.ensamble_id] || "").trim() === ensambleId
    ) {
      pack.sheet.getRange(r + 1, cols.estado + 1).setValue(estado);
      return jsonOut({ ok: true, deseo_id: deseoId, estado: estado });
    }
  }
  return jsonOut({ ok: false, error: "deseo no encontrado" });
}
