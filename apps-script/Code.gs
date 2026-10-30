/**
 * Blom Doelgroepoverzicht 2026: opslag in Google Sheets.
 *
 * Dit script hoort in de Google Sheet "Blom Doelgroepoverzicht 2026 – antwoorden"
 * (Extensies > Apps Script). Implementeer het als web-app:
 *   Uitvoeren als: Ik      Wie heeft toegang: Iedereen
 *
 * Tabbladen in de Sheet:
 *   Toegang     Naam | Wachtwoord | Rol (beheerder of invuller)
 *   Antwoorden  Id | Naam | Bijgewerkt | Beantwoord | Klaar | Data (JSON, verdeeld over kolom F en verder)
 *   Config      Sleutel | Waarde (JSON)
 *
 * Er staan geen wachtwoorden in dit bestand: die staan alleen in de afgeschermde Sheet.
 */

const CHUNK = 40000;

function sh_(name) {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function slug_(n) {
  return String(n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'naamloos';
}

function who_(code) {
  code = String(code || '').trim().toLowerCase();
  if (!code) return null;
  const v = sh_('Toegang').getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    const name = String(v[i][0] || '').trim();
    if (name && String(v[i][1] || '').trim().toLowerCase() === code) {
      return { name: name, id: slug_(name), role: /beheer/i.test(String(v[i][2])) ? 'admin' : 'invuller' };
    }
  }
  return null;
}

function readDocs_() {
  const s = sh_('Antwoorden');
  const v = s.getDataRange().getValues();
  const docs = {};
  for (let i = 1; i < v.length; i++) {
    const id = String(v[i][0] || '').trim();
    if (!id) continue;
    let json = v[i].slice(5).join('');
    try {
      if (json.indexOf('gz:') === 0) {
        json = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(json.slice(3)), 'application/x-gzip')).getDataAsString('UTF-8');
      }
      docs[id] = JSON.parse(json);
    } catch (e) { /* lege of kapotte rij overslaan */ }
  }
  return docs;
}

function rowOf_(s, id) {
  const ids = s.getRange(1, 1, Math.max(1, s.getLastRow()), 1).getValues();
  for (let i = 1; i < ids.length; i++) if (String(ids[i][0]).trim() === id) return i + 1;
  return 0;
}

function writeDoc_(id, body) {
  const s = sh_('Antwoorden');
  if (s.getLastRow() === 0) s.appendRow(['Id', 'Naam', 'Bijgewerkt', 'Beantwoord', 'Klaar', 'Data']);
  const json = JSON.stringify(body);
  const parts = [];
  for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
  let row = rowOf_(s, id);
  if (!row) { row = s.getLastRow() + 1; }
  const width = Math.max(s.getLastColumn(), 5 + parts.length);
  const vals = [id, body.name || '', body.updatedAt || new Date().toISOString(), body.answered || 0, body.submitted ? 'ja' : 'nee'].concat(parts);
  while (vals.length < width) vals.push('');
  s.getRange(row, 1, 1, width).setNumberFormat('@').setValues([vals]);
}

function deleteDoc_(id) {
  const s = sh_('Antwoorden');
  const row = rowOf_(s, id);
  if (row) s.deleteRow(row);
}

function readConfig_() {
  const v = sh_('Config').getDataRange().getValues();
  const cfg = {};
  for (let i = 1; i < v.length; i++) {
    const k = String(v[i][0] || '').trim();
    if (!k) continue;
    try { cfg[k] = JSON.parse(String(v[i][1] || 'null')); } catch (e) { cfg[k] = null; }
  }
  return cfg;
}

function writeConfig_(key, value) {
  const s = sh_('Config');
  if (s.getLastRow() === 0) s.appendRow(['Sleutel', 'Waarde']);
  let row = rowOf_(s, key);
  if (!row) row = s.getLastRow() + 1;
  s.getRange(row, 1, 1, 2).setNumberFormat('@').setValues([[key, JSON.stringify(value)]]);
}

function state_(me) {
  const docs = readDocs_();
  const cfg = readConfig_();
  if (me.role === 'admin') {
    const names = (cfg.respondents && cfg.respondents.names) || [];
    return { me: me, docs: docs, config: { respondents: { names: names }, segments: cfg.segments || { list: [] } } };
  }
  const own = {};
  if (docs[me.id]) own[me.id] = docs[me.id];
  return { me: me, docs: own, config: { respondents: { names: [me.name] }, segments: cfg.segments || { list: [] } } };
}

function handle_(req) {
  const me = who_(req.code);
  if (!me) return { ok: false, error: 'wachtwoord' };
  const a = req.action || 'state';
  if (a === 'state') return Object.assign({ ok: true }, state_(me));
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (a === 'save') {
      const id = String(req.id || '');
      if (!id) return { ok: false, error: 'id' };
      if (me.role !== 'admin' && id !== me.id) return { ok: false, error: 'geen toegang' };
      const body = req.body || {};
      if (me.role !== 'admin') body.name = me.name;
      writeDoc_(id, body);
      return { ok: true };
    }
    if (a === 'delete') {
      const id = String(req.id || '');
      if (me.role !== 'admin' && id !== me.id) return { ok: false, error: 'geen toegang' };
      deleteDoc_(id);
      return { ok: true };
    }
    if (a === 'config') {
      if (me.role !== 'admin') return { ok: false, error: 'geen toegang' };
      if (['respondents', 'segments'].indexOf(req.key) < 0) return { ok: false, error: 'sleutel' };
      writeConfig_(req.key, req.value);
      return { ok: true };
    }
    return { ok: false, error: 'onbekende actie' };
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'verzoek' }); }
  return out_(handle_(req));
}

function doGet(e) {
  return out_(handle_({ code: e.parameter.code, action: 'state' }));
}

/**
 * Eenmalig: richt een lege Google Sheet in. Maakt de tabbladen Toegang, Antwoorden en Config,
 * en geeft iedereen een eigen wachtwoord en persoonlijke link.
 * Kies in de Apps Script-editor bovenaan de functie "inrichten" en klik op Uitvoeren.
 * Draai je het opnieuw, dan blijven bestaande wachtwoorden staan.
 */
function inrichten() {
  const ss = SpreadsheetApp.getActive();
  const BASE = 'https://blominteriors.github.io/doelgroepoverzicht/#c=';
  const mensen = [['Remy', 'beheerder'], ['Jan', 'beheerder'], ['Johan', 'invuller'], ['Andreas', 'invuller'], ['Antoni', 'invuller'],
    ['Nicole', 'invuller'], ['Ilse', 'invuller'], ['Natasha', 'invuller'], ['Chantal', 'invuller'], ['Yvonne', 'invuller'], ['Marion', 'invuller']];

  const t = sh_('Toegang');
  if (t.getLastRow() === 0) t.appendRow(['Naam', 'Wachtwoord', 'Rol', 'Persoonlijke link']);
  const bestaand = t.getDataRange().getValues().slice(1).map(function (r) { return String(r[0]).trim().toLowerCase(); });
  const tekens = 'abcdefghjkmnpqrstuvwxyz23456789';
  function ww() {
    let s = '';
    for (let i = 0; i < 12; i++) { s += tekens.charAt(Math.floor(Math.random() * tekens.length)); if (i === 3 || i === 7) s += '-'; }
    return s;
  }
  mensen.forEach(function (m) {
    if (bestaand.indexOf(m[0].toLowerCase()) >= 0) return;
    const row = t.getLastRow() + 1;
    t.getRange(row, 1, 1, 3).setValues([[m[0], ww(), m[1]]]);
    t.getRange(row, 4).setFormula('="' + BASE + '"&B' + row);
  });
  t.getRange(1, 1, 1, 4).setFontWeight('bold');
  t.setFrozenRows(1);
  t.setColumnWidth(4, 520);

  const a = sh_('Antwoorden');
  if (a.getLastRow() === 0) a.appendRow(['Id', 'Naam', 'Bijgewerkt', 'Beantwoord', 'Klaar', 'Data']);
  a.getRange(1, 1, 1, 6).setFontWeight('bold');
  a.setFrozenRows(1);

  const c = sh_('Config');
  if (c.getLastRow() === 0) c.appendRow(['Sleutel', 'Waarde']);
  c.getRange(1, 1, 1, 2).setFontWeight('bold');
  const cfg = readConfig_();
  if (!cfg.respondents) writeConfig_('respondents', { names: mensen.map(function (m) { return m[0]; }) });
  if (!cfg.segments) writeConfig_('segments', { list: [] });

  const leeg = ss.getSheetByName('Blad1') || ss.getSheetByName('Sheet1');
  if (leeg && leeg.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(leeg);
  ss.setActiveSheet(t);

  return 'Sheet ingericht';
}
