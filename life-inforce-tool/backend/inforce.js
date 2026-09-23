/* Inforce Tool — Life. Client.
 *
 * One of two tool pages (the other is optimizer.js). Each page is
 * self-contained; the header dropdown navigates between them. Only the theme
 * choice carries across, via localStorage — a loaded extract belongs to this
 * page and is gone on navigation, which is the price of two separate pages.
 *
 * Shape of the thing: one in-memory dataset, parsed from the extract and held
 * as `state.base` (pristine) plus `state.data` (working copy). Every edit
 * mutates the working copy and re-renders; the pristine copy is what the
 * change log diffs against, so the operator can always see exactly what was
 * altered before a value is compared against the other platform.
 *
 * All modifications are available simultaneously — terminate a coverage,
 * reduce a face amount and flip a smoker status in one pass. Which fields may
 * be touched comes from the schema below (`lock: 1` = NON-EDITABLE), not from
 * any mode the operator has to select first.
 *
 * The parser is mocked and the projection engine is a stub. Both are isolated
 * behind one function each — `parseWorkbook` and `runProjection` — so wiring
 * the real ones does not touch the rendering code.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- utils
  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var toastTimer = null;
  function toast(msg, kind) {
    var n = $('toast');
    n.textContent = msg;
    n.className = 'toast show' + (kind ? ' toast--' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.className = 'toast'; }, kind === 'err' ? 5000 : 3000);
  }

  var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  /* Accepted entry formats. The terminal shows DD-MMM-YYYY, but nobody wants
     to type month abbreviations all day, so the ISO-ish forms are taken too
     and normalised back to DD-MMM-YYYY on commit. */
  var DATE_FORMATS = 'DD-MMM-YYYY, DDMMMYYYY, YYYY-MM-DD, YYYYMMDD or YYYY/MM/DD';

  function buildDate(y, mi, d) {
    if (mi < 0 || mi > 11 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mi, d));
    // Rejects 31-FEB-2026, and catches Date's 0-99 -> 1900s year remapping:
    // only a real date survives the roundtrip intact.
    if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mi || dt.getUTCFullYear() !== y) return null;
    return dt;
  }

  function parseDate(s) {
    var t = String(s === null || s === undefined ? '' : s).trim();
    var m;

    m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(t);                 // DD-MMM-YYYY
    if (m) return buildDate(+m[3], MONTHS.indexOf(m[2].toUpperCase()), +m[1]);

    m = /^(\d{1,2})([A-Za-z]{3})(\d{4})$/.exec(t);                   // DDMMMYYYY
    if (m) return buildDate(+m[3], MONTHS.indexOf(m[2].toUpperCase()), +m[1]);

    m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(t);            // YYYY-MM-DD, YYYY/MM/DD
    if (m) return buildDate(+m[1], +m[2] - 1, +m[3]);

    m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);                          // YYYYMMDD
    if (m) return buildDate(+m[1], +m[2] - 1, +m[3]);

    return null;
  }

  function fmtDate(dt) {
    return String(dt.getUTCDate()).padStart(2, '0') + '-' + MONTHS[dt.getUTCMonth()] + '-' + dt.getUTCFullYear();
  }

  /* Both ages the illustration needs.
       real     age last birthday
       nearest  age nearest birthday - the age at whichever birthday, previous
                or next, falls closer to the projection date. Measured against
                the actual midpoint between the two birthdays rather than a
                six-month rule of thumb, so leap years land correctly. */
  function agesAt(birth, asOf) {
    var b = parseDate(birth), a = parseDate(asOf);
    if (!b || !a) return { real: null, nearest: null };

    var real = a.getUTCFullYear() - b.getUTCFullYear();
    var last = new Date(Date.UTC(a.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
    if (last > a) {
      real -= 1;
      last = new Date(Date.UTC(a.getUTCFullYear() - 1, b.getUTCMonth(), b.getUTCDate()));
    }
    var next = new Date(Date.UTC(last.getUTCFullYear() + 1, b.getUTCMonth(), b.getUTCDate()));
    var mid = last.getTime() + (next.getTime() - last.getTime()) / 2;

    return { real: real, nearest: a.getTime() >= mid ? real + 1 : real };
  }

  function toNum(raw) {
    if (typeof raw === 'number') return isFinite(raw) ? raw : null;
    var c = String(raw === null || raw === undefined ? '' : raw).replace(/[\s,$]/g, '').replace(/%$/, '');
    if (c === '' || !/^-?\d*\.?\d*$/.test(c)) return null;
    var n = Number(c);
    return isFinite(n) ? n : null;
  }

  function group(n, dec) {
    // Number('') is 0 and isFinite('') is true, so an empty value would
    // otherwise render as "0" — a real figure the operator never entered.
    if (n === null || n === undefined || n === '' || !isFinite(n)) return '';
    var neg = n < 0, parts = Math.abs(n).toFixed(dec || 0).split('.');
    return (neg ? '-' : '') + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (parts[1] ? '.' + parts[1] : '');
  }

  function decimals(n) {
    var s = String(n), i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  }

  function stamp(d) {
    var p = function (x) { return String(x).padStart(2, '0'); };
    return p(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // --------------------------------------------------------------- schema
  /* One descriptor per field. `lock: 1` marks the NON-EDITABLE fields from the
     specification; everything else is editable at any time. Field order
     mirrors the interface definitions so the two stay easy to cross-check. */
  var ALNUM = /^[A-Za-z0-9]*$/, NUMERIC = /^[0-9]*$/, QID = /^[A-Za-z0-9 ]*$/;
  var AMT = 999999999, MONEY = 999999999.99, PCT = 1000000;

  /* Coverage grid groups. Each renders as one column, so related fields sit
     adjacent vertically and the eye scans down a group rather than hunting
     across a flat 24-cell grid. A field with no `g` is not shown in the grid —
     coverageNumber is already the badge in the card header. */
  var COVERAGE_GROUPS = [
    { id: 'plan',    l: 'Plan & Risk' },
    { id: 'amounts', l: 'Amounts & Premium' },
    { id: 'dates',   l: 'Dates' },
    { id: 'load',    l: 'Loadings & Adjustments' }
  ];

  /* Declared in display order. All 24 interface fields are present; only
     coverageNumber is withheld from the grid. `lock: 1` = NON-EDITABLE. */
  var COVERAGE_FIELDS = [
    { k: 'coverageNumber', l: 'Cov. No.', t: 'txt', lock: 1, maxLen: 3, cs: ALNUM, csl: 'alphanumeric', hint: 'Coverage number' },

    { g: 'plan', k: 'planId', l: 'Plan ID', t: 'txt', newOk: 1, lock: 1, len: 5, cs: ALNUM, csl: 'alphanumeric' },
    { g: 'plan', k: 'rateScale', l: 'Rate Scale', t: 'txt', newOk: 1, lock: 1, len: 1, cs: ALNUM, csl: 'alphanumeric' },
    { g: 'plan', k: 'sex', l: 'Sex', t: 'enum', newOk: 1, lock: 1, opts: [['M', 'M'], ['F', 'F']] },
    { g: 'plan', k: 'smokerStatus', l: 'Smoker', t: 'enum', newOk: 1, opts: [['N', 'N'], ['S', 'S']], hint: 'Smoker status — change of smoker status' },
    { g: 'plan', k: 'stb1', l: 'STB 1', t: 'txt', lock: 1, len: 2, cs: ALNUM, csl: 'alphanumeric' },
    { g: 'plan', k: 'stb2', l: 'STB 2', t: 'txt', lock: 1, len: 3, cs: ALNUM, csl: 'alphanumeric' },
    { g: 'plan', k: 'coverageStatus', l: 'Status', t: 'txt', lock: 1, len: 1, cs: ALNUM, csl: 'alphanumeric', hint: 'Coverage status' },

    { g: 'amounts', k: 'faceAmount', l: 'Face Amount', t: 'int', newOk: 1, min: 1, max: AMT, u: 'CAD', hint: 'Face amount (CAD) — coverage amount reduction' },
    { g: 'amounts', k: 'sumInsured', l: 'Sum Insured', t: 'int', lock: 1, min: 1, max: AMT, u: 'CAD' },
    { g: 'amounts', k: 'modalPremium', l: 'Modal Prem.', t: 'money', lock: 1, min: 0, max: MONEY, dec: 2, u: 'CAD', hint: 'Modal premium (CAD)' },
    { g: 'amounts', k: 'policyFee', l: 'Policy Fee', t: 'int', lock: 1, min: 1, max: 999, u: 'CAD' },
    { g: 'amounts', k: 'cashValue', l: 'Cash Value', t: 'money', lock: 1, min: 0, max: MONEY, dec: 2, u: 'CAD' },
    { g: 'amounts', k: 'grpTotalAmount', l: 'GRP Total', t: 'money', lock: 1, min: 0, max: MONEY, dec: 2, u: 'CAD', hint: 'GRP total amount (CAD)' },
    { g: 'amounts', k: 'businessPremiumAllocationDuration', l: 'Bus. Alloc. Dur.', t: 'int', lock: 1, min: 1, max: 999, u: 'yrs', hint: 'Business premium allocation duration' },

    { g: 'dates', k: 'coverageIssueDate', l: 'Issue Date', t: 'date', newOk: 1, lock: 1, hint: 'Coverage issue date' },
    { g: 'dates', k: 'coverageExpirationDate', l: 'Maturity/Exp.', t: 'date', lock: 1, hint: 'Maturity / expiry date' },
    { g: 'dates', k: 'paidUpDate', l: 'Paid-Up Date', t: 'date', lock: 1 },
    { g: 'dates', k: 'rateDate', l: 'Rate Date', t: 'date', lock: 1 },

    { g: 'load', k: 'permanentExtraPremiumPct', l: 'Perm. Extra', t: 'pct', newOk: 1, min: 0, max: PCT, u: '%', hint: 'Permanent extra premium % — extra premium revision' },
    { g: 'load', k: 'flatRate', l: 'Flat Rate', t: 'money', newOk: 1, min: 0, max: 999.99, dec: 2, u: 'CAD', hint: 'Flat rate (CAD) — extra premium revision' },
    { g: 'load', k: 'flatRateDuration', l: 'Flat Rate Dur.', t: 'int', newOk: 1, min: 1, max: 999, u: 'yrs', hint: 'Flat rate duration — extra premium revision' },
    { g: 'load', k: 'premiumCoiAdjustmentPct', l: 'Prem/COI Adj.', t: 'pct', newOk: 1, min: 0, max: PCT, u: '%', hint: 'Premium / COI adjustment %' },
    { g: 'load', k: 'premiumCoiAdjustmentDuration', l: 'Prem/COI Dur.', t: 'int', newOk: 1, min: 1, max: 999, u: 'yrs', hint: 'Premium / COI adjustment duration' }
  ];

  var POLICY_FIELDS = [
    { g: 'Identification' },
    { k: 'policyNumber', l: 'Policy Number', t: 'txt', lock: 1, maxLen: 10, cs: ALNUM, csl: 'alphanumeric' },
    { k: 'policyStatus', l: 'Policy Status', t: 'txt', lock: 1, len: 1, cs: ALNUM, csl: 'alphanumeric' },
    { k: 'pmtMode', l: 'Payment Mode', t: 'enum', opts: [['01', '01 — Monthly'], ['12', '12 — Annual']] },
    { k: 'premiumDepositAccount', l: 'Premium Deposit Acct', t: 'txt', lock: 1, len: 3, cs: NUMERIC, csl: 'numeric', opt: 1 },
    { k: 'specialQuoteIdentifier', l: 'Special Quote ID', t: 'txt', lock: 1, maxLen: 20, cs: QID, csl: 'alphanumeric', hint: 'Format ### YYMMMDDD' },

    { g: 'Key Dates' },
    { k: 'policyIssueDate', l: 'Policy Issue Date', t: 'date', lock: 1 },
    { k: 'valueAsOfDate', l: 'Projection Date', t: 'date' },
    { k: 'premiumsPaidToDate', l: 'Paid-To Date', t: 'date', lock: 1 },

    { g: 'Tax & Premiums' },
    { k: 'policyAcb', l: 'Adjusted Cost Basis', t: 'money', lock: 1, min: 0, max: MONEY, dec: 2 },
    { k: 'totalPremiumsPaid', l: 'Total Premiums Paid', t: 'money', lock: 1, min: 0, max: MONEY, dec: 2 },
    { k: 'policyCumulativeNcpi', l: 'Net Cost of Pure Ins.', t: 'money', lock: 1, min: 0, max: MONEY, dec: 2 },

    { g: 'Indebtedness' },
    { k: 'currentLoanAmount', l: 'Current Loan Amount', t: 'money', lock: 1, min: 0, max: MONEY, dec: 2 },
    { k: 'currentLoanInterest', l: 'Current Loan Interest', t: 'money', lock: 1, min: 0, max: MONEY, dec: 2 },
    { k: 'currentAplAmount', l: 'Current APL Amount', t: 'money', lock: 1, min: 0, max: MONEY, dec: 2 },
    { k: 'currentAplInterest', l: 'Current APL Interest', t: 'money', lock: 1, min: 0, max: MONEY, dec: 2 }
  ];

  /* Insured fields are NON-EDITABLE on an imported life. They open up only on
     a life the operator has added, which has no source value to protect. */
  var NAME = /^[A-Za-z '-]*$/;
  var INSURED_FIELDS = [
    { k: 'fullName', l: 'Insured', t: 'txt', maxLen: 60, cs: NAME, csl: 'letters, spaces, hyphens and apostrophes', up: 1, ph: 'FIRST LAST' },
    { k: 'birthdate', l: 'Birthdate', t: 'date', ph: 'DD-MMM-YYYY' },
    { k: 'sex', l: 'Sex', t: 'enum', opts: [['M', 'M'], ['F', 'F']] }
  ];

  var COV_MAP = {}, POL_MAP = {}, INS_MAP = {};
  INSURED_FIELDS.forEach(function (f) { INS_MAP[f.k] = f; });
  COVERAGE_FIELDS.forEach(function (f) { COV_MAP[f.k] = f; });
  POLICY_FIELDS.forEach(function (f) { if (f.k) POL_MAP[f.k] = f; });

  // ----------------------------------------------------------- validation
  function validate(f, raw) {
    var s = typeof raw === 'string' ? raw.trim() : raw;
    if (s === '' || s === null || s === undefined) {
      return f.opt ? { ok: true, v: '' } : { ok: false, msg: f.l + ' is required' };
    }

    if (f.t === 'txt') {
      // The extract holds names upper case; fold rather than reject an
      // operator who typed naturally.
      s = f.up ? String(s).toUpperCase() : String(s);
      if (f.cs && !f.cs.test(s)) return { ok: false, msg: f.l + ' accepts ' + f.csl + ' characters only' };
      if (f.len !== undefined && s.length !== f.len) {
        return { ok: false, msg: f.l + ' must be exactly ' + f.len + ' character' + (f.len === 1 ? '' : 's') };
      }
      if (f.maxLen !== undefined && s.length > f.maxLen) {
        return { ok: false, msg: f.l + ' must be at most ' + f.maxLen + ' characters' };
      }
      return { ok: true, v: s };
    }

    if (f.t === 'enum') {
      var hit = null;
      f.opts.forEach(function (o) { if (o[0] === String(s).toUpperCase()) hit = o[0]; });
      if (!hit) return { ok: false, msg: f.l + ' must be ' + f.opts.map(function (o) { return o[0]; }).join(' or ') };
      return { ok: true, v: hit };
    }

    if (f.t === 'date') {
      var dt = parseDate(s);
      if (!dt) return { ok: false, msg: f.l + ' must be a valid date — ' + DATE_FORMATS };
      return { ok: true, v: fmtDate(dt) };
    }

    var n = toNum(s);
    if (n === null) return { ok: false, msg: f.l + ' must be a number' };
    if (f.t === 'int' && n % 1 !== 0) return { ok: false, msg: f.l + ' must be a whole number' };
    if (f.t === 'money' && decimals(n) > (f.dec || 2)) {
      return { ok: false, msg: f.l + ' allows at most ' + (f.dec || 2) + ' decimal places' };
    }
    if (f.min !== undefined && n < f.min) return { ok: false, msg: f.l + ' must be at least ' + group(f.min, f.dec || 0) };
    if (f.max !== undefined && n > f.max) return { ok: false, msg: f.l + ' must not exceed ' + group(f.max, f.dec || 0) };
    return { ok: true, v: n };
  }

  /** Value as displayed read-only. */
  function show(f, v) {
    if (v === null || v === undefined || v === '') return '';
    if (f.t === 'enum' && f.opts) {
      var hit = '';
      f.opts.forEach(function (o) { if (o[0] === v) hit = o[1]; });
      return hit || String(v);
    }
    if (f.t === 'money') return group(v, f.dec || 2);
    if (f.t === 'int') return group(v, 0);
    if (f.t === 'pct') return group(v, decimals(Number(v.toFixed ? v.toFixed(4) : v))) + '%';
    return String(v);
  }

  /* Value as it sits in an input. Numbers keep their thousands separators:
     the whole job is comparing figures against another platform by eye, and
     "250000" does not read against "250,000". `toNum` strips the separators
     again on the way back in, and focusing selects the whole field so typing
     replaces rather than splices. */
  function raw(f, v) {
    if (v === null || v === undefined) return '';
    if (f.t === 'money') return group(v, f.dec || 2);
    if (f.t === 'int') return group(v, 0);
    if (f.t === 'pct') return group(v, decimals(v));
    return String(v);
  }

  function same(a, b) {
    if (a === b) return true;
    if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) return true;
    var na = Number(a), nb = Number(b);
    if (a !== '' && b !== '' && isFinite(na) && isFinite(nb)) return na === nb;
    return false;
  }

  // ------------------------------------------------------------------ xlsx io
  /* A dependency-free .xlsx (OOXML zip) reader — just enough to pull named
     cells off a workbook by sheet name and cell reference, per ground rule
     §0: no SheetJS-as-npm-module, no bundler. A .xlsx is a zip of XML parts;
     the only compression method it actually uses is 8 (deflate), which the
     browser's own DecompressionStream handles, so no inflate library is
     needed either. */
  var RELS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  function zipEntries(buf) {
    var view = new DataView(buf), bytes = new Uint8Array(buf);
    var EOCD = 0x06054b50, i = bytes.length - 22, min = Math.max(0, bytes.length - 22 - 65536);
    for (; i >= min; i--) { if (view.getUint32(i, true) === EOCD) break; }
    if (i < min) throw new Error('Not a valid .xlsx (zip) file');

    var cdCount = view.getUint16(i + 10, true), cdOffset = view.getUint32(i + 16, true);
    var entries = {}, p = cdOffset;
    for (var n = 0; n < cdCount; n++) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      var compMethod = view.getUint16(p + 10, true);
      var compSize = view.getUint32(p + 20, true);
      var nameLen = view.getUint16(p + 28, true);
      var extraLen = view.getUint16(p + 30, true);
      var commentLen = view.getUint16(p + 32, true);
      var localOffset = view.getUint32(p + 42, true);
      var name = '';
      for (var c = 0; c < nameLen; c++) name += String.fromCharCode(bytes[p + 46 + c]);
      entries[name] = { compMethod: compMethod, compSize: compSize, localOffset: localOffset };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return { view: view, bytes: bytes, entries: entries };
  }

  /** Decompressed bytes of one zip entry, or null if the archive has none by that name. */
  function zipReadEntry(zip, name) {
    var e = zip.entries[name];
    if (!e) return Promise.resolve(null);

    var view = zip.view, p = e.localOffset;
    if (view.getUint32(p, true) !== 0x04034b50) return Promise.reject(new Error('Corrupt zip entry: ' + name));
    var nameLen = view.getUint16(p + 26, true), extraLen = view.getUint16(p + 28, true);
    var dataStart = p + 30 + nameLen + extraLen;
    var rawBytes = zip.bytes.slice(dataStart, dataStart + e.compSize);

    if (e.compMethod === 0) return Promise.resolve(rawBytes);        // stored
    if (e.compMethod !== 8) return Promise.reject(new Error('Unsupported zip compression in ' + name));
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('This browser cannot decompress .xlsx files (DecompressionStream unsupported)'));
    }
    var stream = new Blob([rawBytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  function utf8(bytes) { return new TextDecoder('utf-8').decode(bytes); }

  function parseWorkbookXml(xml) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var nodes = doc.getElementsByTagName('sheet'), out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      out.push({ name: n.getAttribute('name'), rid: n.getAttributeNS(RELS_NS, 'id') || n.getAttribute('r:id') });
    }
    return out;
  }

  function parseRelsXml(xml) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var nodes = doc.getElementsByTagName('Relationship'), out = {};
    for (var i = 0; i < nodes.length; i++) out[nodes[i].getAttribute('Id')] = nodes[i].getAttribute('Target');
    return out;
  }

  function parseSharedStrings(xml) {
    if (!xml) return [];
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var items = doc.getElementsByTagName('si'), out = [];
    for (var i = 0; i < items.length; i++) {
      // <si> holds one <t>, or several <r><t> runs for rich text — join all <t>.
      var ts = items[i].getElementsByTagName('t'), s = '';
      for (var j = 0; j < ts.length; j++) s += ts[j].textContent;
      out.push(s);
    }
    return out;
  }

  /** Cell reference (e.g. "B7") -> raw value (string, number or boolean). */
  function parseSheetCells(xml, sharedStrings) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var nodes = doc.getElementsByTagName('c'), cells = {};
    for (var i = 0; i < nodes.length; i++) {
      var cellNode = nodes[i], ref = cellNode.getAttribute('r'), type = cellNode.getAttribute('t');
      var vNode = cellNode.getElementsByTagName('v')[0], value = null;
      if (type === 's') {
        value = vNode ? (sharedStrings[+vNode.textContent] || '') : '';
      } else if (type === 'str' || type === 'inlineStr') {
        var isNode = cellNode.getElementsByTagName('is')[0], ts = isNode ? isNode.getElementsByTagName('t') : [];
        var s = '';
        for (var j = 0; j < ts.length; j++) s += ts[j].textContent;
        value = ts.length ? s : (vNode ? vNode.textContent : '');
      } else if (type === 'b') {
        value = vNode ? vNode.textContent === '1' : null;
      } else {
        value = vNode ? Number(vNode.textContent) : null;              // number, possibly a date serial
      }
      cells[ref] = value;
    }
    return cells;
  }

  /* Excel's date epoch is 30-DEC-1899; 25569 is the day count from there to
     the Unix epoch (1970-01-01), the standard constant for this conversion. */
  function excelSerialToDate(n) { return new Date(Math.round((n - 25569) * 86400 * 1000)); }

  /** Reads every named sheet of an uploaded workbook into { sheets: { name: cells } }. */
  function readWorkbookXlsx(bytes) {
    var zip;
    try { zip = zipEntries(bytes); } catch (err) { return Promise.reject(err); }

    return Promise.all([
      zipReadEntry(zip, 'xl/workbook.xml'),
      zipReadEntry(zip, 'xl/_rels/workbook.xml.rels'),
      zipReadEntry(zip, 'xl/sharedStrings.xml')
    ]).then(function (parts) {
      if (!parts[0]) throw new Error('Missing xl/workbook.xml — not a valid .xlsx file');
      var sheetDefs = parseWorkbookXml(utf8(parts[0]));
      var rels = parts[1] ? parseRelsXml(utf8(parts[1])) : {};
      var sharedStrings = parseSharedStrings(parts[2] ? utf8(parts[2]) : '');

      var reads = sheetDefs.map(function (sd) {
        var target = rels[sd.rid];
        if (!target) return Promise.resolve([sd.name, null]);
        var path = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target;
        return zipReadEntry(zip, path).then(function (raw) {
          return [sd.name, raw ? parseSheetCells(utf8(raw), sharedStrings) : null];
        });
      });

      return Promise.all(reads).then(function (pairs) {
        var sheets = {};
        pairs.forEach(function (pair) { sheets[pair[0]] = pair[1]; });
        return { sheets: sheets };
      });
    });
  }

  function findSheet(book, name) {
    var target = name.toLowerCase(), hit = null;
    Object.keys(book.sheets).forEach(function (k) { if (k.toLowerCase() === target) hit = book.sheets[k]; });
    return hit;
  }

  /* Policy sheet now uses 3-column format: TOOL Field | CAPSIL Field | Value
     Column A: TOOL Field name (display label, ignored by parser)
     Column B: CAPSIL Field name (internal name used to find the row)
     Column C: Value (the actual data, what we read)
     Mapping: GUI field name → CAPSIL Field name (to find the row) → Kind (how to parse the value)
     */
  var POLICY_CAPSIL_FIELD_MAP = {
    policyNumber:     { capsil: 'Policy',          kind: 'text' },
    valueAsOfDate:   { capsil: 'POLI Date',       kind: 'date' },
    premiumsPaidToDate:       { capsil: 'PAID-TO-DATE',    kind: 'date' },
    premiumDepositAccount: { capsil: 'PDA',        kind: 'code3' },
    policyAcb: { capsil: 'ACB',            kind: 'number' },
    totalPremiumsPaid: { capsil: 'PREMIUMS-PAID',  kind: 'number' },
    policyCumulativeNcpi: { capsil: 'NCPI',      kind: 'number' },
    currentLoanAmount: { capsil: 'LOAN-AMOUNT',    kind: 'number' },
    currentLoanInterest: { capsil: 'LOAN-INT',     kind: 'number' },
    currentAplAmount: { capsil: 'APL-AMOUNT',      kind: 'number' },
    currentAplInterest: { capsil: 'APL-INT',       kind: 'number' },
    pmtMode:      { capsil: 'MODE',            kind: 'code2' },
    policyIssueDate:  { capsil: 'POL-DT',          kind: 'date' },
    policyStatus:     { capsil: 'ST',              kind: 'text' },
    specialQuoteIdentifier: { capsil: 'COMM3',      kind: 'text' }
  };

  function readPolicyCell(cells, spec) {
    var v = cells[spec.ref];
    if (v === null || v === undefined || v === '') return '';        // blank stays blank

    if (spec.kind === 'date') {
      if (typeof v === 'number') return fmtDate(excelSerialToDate(v));
      var dt = parseDate(v);
      return dt ? fmtDate(dt) : String(v).trim();
    }
    if (spec.kind === 'number') {
      if (typeof v === 'number') return v;
      var n = toNum(v);
      return n === null ? '' : n;
    }
    if (spec.kind === 'code2' || spec.kind === 'code3') {
      var len = spec.kind === 'code2' ? 2 : 3;
      var s = typeof v === 'number' ? String(Math.trunc(v)) : String(v).trim();
      return s === '' ? '' : s.padStart(len, '0');
    }
    return String(v).trim();                                          // text
  }

  function parsePolicyCellByName(cells, spec) {
    /* New format: scan rows for CAPSIL field name in column B, read value from column C */
    var capsulField = spec.capsil;
    var kind = spec.kind;

    // Scan through cells to find the row with matching CAPSIL field name in column B
    for (var i = 2; i <= 100; i++) {  // rows 2-100 (row 1 is header)
      var cellB = 'B' + i;
      if (cells[cellB] === capsulField) {
        var cellC = 'C' + i;
        var v = cells[cellC];
        if (v === null || v === undefined || v === '') return '';

        if (kind === 'date') {
          if (typeof v === 'number') return fmtDate(excelSerialToDate(v));
          var dt = parseDate(v);
          return dt ? fmtDate(dt) : String(v).trim();
        }
        if (kind === 'number') {
          if (typeof v === 'number') return v;
          var n = toNum(v);
          return n === null ? '' : n;
        }
        if (kind === 'code2' || kind === 'code3') {
          var len = kind === 'code2' ? 2 : 3;
          var s = typeof v === 'number' ? String(Math.trunc(v)) : String(v).trim();
          return s === '' ? '' : s.padStart(len, '0');
        }
        return String(v).trim();  // text
      }
    }
    return '';  // field not found
  }

  function parsePolicySheet(cells) {
    var p = {};
    Object.keys(POLICY_CAPSIL_FIELD_MAP).forEach(function (k) {
      p[k] = parsePolicyCellByName(cells, POLICY_CAPSIL_FIELD_MAP[k]);
    });
    return p;
  }

  var COVERAGE_CELL_MAP = {
    coverageNumber:  { col: 'A', kind: 'text' },
    planId:          { col: 'B', kind: 'text' },
    rateScale:       { col: 'C', kind: 'text' },
    sex:             { col: 'D', kind: 'text' },
    smokerStatus:    { col: 'E', kind: 'text' },
    stb1:            { col: 'F', kind: 'code2' },
    stb2:            { col: 'G', kind: 'code3' },
    faceAmount:      { col: 'H', kind: 'number' },
    sumInsured:      { col: 'I', kind: 'number' },
    permanentExtraPremiumPct: { col: 'J', kind: 'number' },
    flatRate:        { col: 'K', kind: 'number' },
    flatRateDuration: { col: 'L', kind: 'number' },
    policyFee:       { col: 'M', kind: 'number' },
    coverageIssueDate: { col: 'N', kind: 'date' },
    coverageExpirationDate: { col: 'O', kind: 'date' },
    paidUpDate:      { col: 'P', kind: 'date' },
    coverageStatus:  { col: 'Q', kind: 'text' },
    modalPremium:    { col: 'R', kind: 'number' },
    rateDate:        { col: 'S', kind: 'date' },
    premiumCoiAdjustmentPct: { col: 'T', kind: 'number' },
    premiumCoiAdjustmentDuration: { col: 'U', kind: 'number' },
    grpTotalAmount:  { col: 'V', kind: 'number' },
    businessPremiumAllocationDuration: { col: 'W', kind: 'number' },
    cashValue:       { col: 'AC', kind: 'number' }
  };

  function readCoverageCell(cells, row, spec) {
    var v = cells[spec.col + row];
    if (v === null || v === undefined || v === '') return '';

    if (spec.kind === 'date') {
      if (typeof v === 'number') return fmtDate(excelSerialToDate(v));
      var dt = parseDate(v);
      return dt ? fmtDate(dt) : String(v).trim();
    }
    if (spec.kind === 'number') {
      if (typeof v === 'number') return v;
      var n = toNum(v);
      return n === null ? '' : n;
    }
    if (spec.kind === 'code2' || spec.kind === 'code3') {
      var len = spec.kind === 'code2' ? 2 : 3;
      var code = typeof v === 'number' ? String(Math.trunc(v)) : String(v).trim();
      return code === '' ? '' : code.padStart(len, '0');
    }
    return String(v).trim();
  }

  function parseCoveragesSheet(cells) {
    var rows = [], maxRow = 0;
    Object.keys(cells).forEach(function (ref) {
      var match = /^(?:[A-Z]+)(\d+)$/.exec(ref);
      if (match && +match[1] > maxRow) maxRow = +match[1];
    });

    for (var row = 2; row <= maxRow; row++) {
      var hasValue = false;
      Object.keys(cells).forEach(function (ref) {
        var match = /^(?:[A-Z]+)(\d+)$/.exec(ref);
        var value = cells[ref];
        if (match && +match[1] === row && value !== null && value !== undefined && String(value).trim() !== '') {
          hasValue = true;
        }
      });
      if (!hasValue) continue;

      var coverage = {};
      Object.keys(COVERAGE_CELL_MAP).forEach(function (k) {
        coverage[k] = readCoverageCell(cells, row, COVERAGE_CELL_MAP[k]);
      });
      // Only in-force statuses are imported; coverageNumber is left as-is on the
      // survivors — never renumbered to fill the gap left by a skipped status.
      if (['1', '2', '3', '4'].indexOf(coverage.coverageStatus) === -1) continue;

      coverage._id = 'c' + row;
      coverage._removed = false;
      coverage._new = false;
      coverage.insureds = [];
      rows.push(coverage);
    }
    return rows;
  }

  function parseInsuredsSheet(cells, coverages) {
    var byCoverage = {}, maxRow = 0, insuredSeq = 0;
    coverages.forEach(function (coverage) {
      byCoverage[String(coverage.coverageNumber).trim().toUpperCase()] = coverage;
    });
    Object.keys(cells).forEach(function (ref) {
      var match = /^(?:[A-Z]+)(\d+)$/.exec(ref);
      if (match && +match[1] > maxRow) maxRow = +match[1];
    });

    for (var row = 2; row <= maxRow; row++) {
      var hasValue = false;
      Object.keys(cells).forEach(function (ref) {
        var match = /^(?:[A-Z]+)(\d+)$/.exec(ref);
        var value = cells[ref];
        if (match && +match[1] === row && value !== null && value !== undefined && String(value).trim() !== '') {
          hasValue = true;
        }
      });
      if (!hasValue) continue;

      var coverageNumber = cells['A' + row];
      var coverage = coverageNumber === null || coverageNumber === undefined
        ? null
        : byCoverage[String(coverageNumber).trim().toUpperCase()];
      if (!coverage) continue;

      var birthdate = cells['C' + row];
      if (typeof birthdate === 'number') {
        birthdate = fmtDate(excelSerialToDate(birthdate));
      } else if (birthdate !== null && birthdate !== undefined && birthdate !== '') {
        var dt = parseDate(birthdate);
        birthdate = dt ? fmtDate(dt) : String(birthdate).trim();
      } else {
        birthdate = '';
      }

      var name = cells['B' + row];
      coverage.insureds.push({
        fullName: name === null || name === undefined ? '' : String(name).trim().toUpperCase(),
        birthdate: birthdate,
        sex: coverage.sex,
        _id: 'i' + (++insuredSeq),
        _removed: false,
        _new: false
      });
    }
    return coverages;
  }

  /** "Load Sample" — no bytes to parse; the fixture stands in for a real workbook. */
  function sampleResult(fileName) {
    var digits = String(fileName || '').replace(/\D/g, '');
    var data = JSON.parse(JSON.stringify(FIXTURE));
    if (digits.length >= 6) data.policy.policyNumber = digits.slice(0, 10);

    var n = 0;
    data.coverages.forEach(function (c) {
      c._id = 'c' + (++n);
      c._removed = false;
      c._new = false;
      c.insureds.forEach(function (i) { i._id = 'i' + (++n); i._removed = false; i._new = false; });
    });
    return {
      data: data,
      meta: { fileName: fileName || 'extract.xlsx', importedAt: new Date(), mocked: false }
    };
  }

  /* Real extract import. Reads the "Policy", "Coverages" and "Insureds"
     sheets of the uploaded workbook and populates the working dataset. Returns a Promise
     (zip decompression is async) — callers use
     .then(load).catch(...) rather than calling load() directly. */
  function parseWorkbook(bytes, fileName) {
    if (!bytes) return Promise.resolve(sampleResult(fileName));

    return readWorkbookXlsx(bytes).then(function (book) {
      var cells = findSheet(book, 'Policy');
      if (!cells) throw new Error('Workbook has no "Policy" sheet');
      var coverageCells = findSheet(book, 'Coverages');
      if (!coverageCells) throw new Error('Workbook has no "Coverages" sheet');
      var insuredCells = findSheet(book, 'Insureds');
      if (!insuredCells) throw new Error('Workbook has no "Insureds" sheet');

      var coverages = parseCoveragesSheet(coverageCells);
      parseInsuredsSheet(insuredCells, coverages);
      var data = { policy: parsePolicySheet(cells), coverages: coverages };
      return {
        data: data,
        meta: { fileName: fileName || 'extract.xlsx', importedAt: new Date(), mocked: false }
      };
    });
  }

  /* STUBBED. The heavy engine lands here; it receives the working dataset with
     terminated records already stripped, and returns rows the Projection tab
     renders. Nothing above this line needs to change when it does. */
  function runProjection(dataset) {
    var live = dataset.coverages.filter(function (c) { return !c._removed; });
    var lives = 0;
    live.forEach(function (c) { lives += c.insureds.filter(function (i) { return !i._removed; }).length; });
    return {
      status: 'not-implemented',
      rows: [],
      note: 'Received ' + live.length + ' coverage(s) and ' + lives + ' insured life/lives.'
    };
  }

  var FIXTURE = {
    policy: {
      policyNumber: '7841002', policyIssueDate: '15-MAR-2011', valueAsOfDate: '01-JAN-2026',
      premiumsPaidToDate: '15-MAR-2026', premiumDepositAccount: '004',
      policyAcb: 48210.55, totalPremiumsPaid: 132750, policyCumulativeNcpi: 84539.45,
      currentLoanAmount: 0, currentLoanInterest: 0, currentAplAmount: 0, currentAplInterest: 0,
      pmtMode: '12', policyStatus: 'A', specialQuoteIdentifier: '001 26JAN0001'
    },
    coverages: [
      {
        coverageNumber: 'C01', planId: 'ULT10', rateScale: 'A', sex: 'M', smokerStatus: 'N',
        stb1: '01', stb2: '100', faceAmount: 500000, sumInsured: 500000,
        permanentExtraPremiumPct: 0, flatRate: 0, flatRateDuration: 1, policyFee: 60,
        coverageIssueDate: '15-MAR-2011', coverageExpirationDate: '15-MAR-2061', paidUpDate: '15-MAR-2031',
        coverageStatus: 'A', modalPremium: 412.75, rateDate: '15-MAR-2011',
        premiumCoiAdjustmentPct: 0, premiumCoiAdjustmentDuration: 1, grpTotalAmount: 0,
        businessPremiumAllocationDuration: 10, cashValue: 41288.32,
        insureds: [{ fullName: 'MARC TREMBLAY', birthdate: '22-JUL-1974', sex: 'M' }]
      },
      {
        coverageNumber: 'C02', planId: 'TRM20', rateScale: 'B', sex: 'F', smokerStatus: 'S',
        stb1: '02', stb2: '210', faceAmount: 250000, sumInsured: 250000,
        permanentExtraPremiumPct: 150, flatRate: 2.5, flatRateDuration: 10, policyFee: 60,
        coverageIssueDate: '15-MAR-2011', coverageExpirationDate: '15-MAR-2031', paidUpDate: '15-MAR-2031',
        coverageStatus: 'A', modalPremium: 188.4, rateDate: '15-MAR-2011',
        premiumCoiAdjustmentPct: 0, premiumCoiAdjustmentDuration: 1, grpTotalAmount: 0,
        businessPremiumAllocationDuration: 5, cashValue: 0,
        insureds: [{ fullName: 'SOPHIE TREMBLAY', birthdate: '03-FEB-1977', sex: 'F' }]
      },
      {
        coverageNumber: 'C03', planId: 'JLTD1', rateScale: 'A', sex: 'M', smokerStatus: 'N',
        stb1: '03', stb2: '300', faceAmount: 1000000, sumInsured: 1000000,
        permanentExtraPremiumPct: 0, flatRate: 0, flatRateDuration: 1, policyFee: 60,
        coverageIssueDate: '01-SEP-2015', coverageExpirationDate: '01-SEP-2065', paidUpDate: '01-SEP-2035',
        coverageStatus: 'A', modalPremium: 655.2, rateDate: '01-SEP-2015',
        premiumCoiAdjustmentPct: 25, premiumCoiAdjustmentDuration: 15, grpTotalAmount: 0,
        businessPremiumAllocationDuration: 20, cashValue: 12904.11,
        insureds: [
          { fullName: 'MARC TREMBLAY', birthdate: '22-JUL-1974', sex: 'M' },
          { fullName: 'SOPHIE TREMBLAY', birthdate: '03-FEB-1977', sex: 'F' }
        ]
      }
    ]
  };

  // ---------------------------------------------------------------- state
  var state = { loaded: false, meta: null, base: null, data: null, form: null, seq: 100 };

  function coverage(id) {
    var hit = null;
    state.data.coverages.forEach(function (c) { if (c._id === id) hit = c; });
    return hit;
  }
  function baseCoverage(id) {
    var hit = null;
    state.base.coverages.forEach(function (c) { if (c._id === id) hit = c; });
    return hit;
  }
  function liveCoverages() {
    return state.data.coverages.filter(function (c) { return !c._removed; });
  }
  function liveInsureds(c) {
    return c.insureds.filter(function (i) { return !i._removed; });
  }

  function newCoverage() {
    var used = {}, num = 'C01';
    state.data.coverages.forEach(function (c) { used[String(c.coverageNumber).toUpperCase()] = 1; });
    for (var i = 1; i <= 99; i++) {
      var cand = 'C' + String(i).padStart(2, '0');
      if (!used[cand]) { num = cand; break; }
    }
    /* Everything blank. The two dropdowns need a seed value to render, but no
       number or date is invented here — a figure the operator did not enter is
       exactly what this tool exists to catch. */
    return {
      _id: 'c' + (++state.seq), _removed: false, _new: true,
      coverageNumber: num, planId: '', rateScale: '', sex: 'M', smokerStatus: 'N',
      stb1: '', stb2: '', faceAmount: '', sumInsured: '',
      permanentExtraPremiumPct: '', flatRate: '', flatRateDuration: '', policyFee: '',
      coverageIssueDate: '', coverageExpirationDate: '', paidUpDate: '',
      coverageStatus: '', modalPremium: '', rateDate: '',
      premiumCoiAdjustmentPct: '', premiumCoiAdjustmentDuration: '', grpTotalAmount: '',
      businessPremiumAllocationDuration: '', cashValue: '',
      insureds: [{ _id: 'i' + (++state.seq), _removed: false, _new: true, fullName: '', birthdate: '', sex: 'M' }]
    };
  }

  // --------------------------------------------------------------- render
  /* A commit arrives on `change`, which the browser dispatches *before* focus
     reaches the next control. Rendering there would capture document.body as
     the active element and drop focus on the floor — Tab would stop working
     after every edit. Deferring one tick lets focus settle first. */
  var pending = null;
  function deferRender() {
    if (pending) return;
    pending = setTimeout(function () { pending = null; render(); }, 0);
  }

  function render() {
    if (pending) { clearTimeout(pending); pending = null; }
    if (!state.loaded) return;

    // Carry focus, any in-progress text and the selection across the rebuild.
    var act = document.activeElement;
    var fk = act && act.dataset ? act.dataset.fk : null;
    var typing = fk && act.tagName === 'INPUT' ? act.value : null;
    var from = fk && act.tagName === 'INPUT' ? act.selectionStart : null;
    var to = fk && act.tagName === 'INPUT' ? act.selectionEnd : null;

    renderCoverages();
    renderPolicy();
    renderStatus();

    if (!fk) return;
    var back = document.querySelector('[data-fk="' + fk + '"]');
    if (!back) return;

    if (typing !== null && back.value !== typing) back.value = typing;
    back.focus();
    if (from !== null) { try { back.setSelectionRange(from, to); } catch (err) { /* selects unsupported */ } }
  }

  /* ── Coverages ─────────────────────────────────────────────────────── */
  function renderCoverages() {
    var html = state.data.coverages.map(covCard).join('');
    $('coverageList').innerHTML = html;
    var n = liveCoverages().length;
    $('covCount').textContent = n + ' coverage' + (n === 1 ? '' : 's') + ' in force';
  }

  function covCard(c) {
    var base = baseCoverage(c._id);
    var cls = 'card cov' + (c._removed ? ' is-removed' : '') + (c._new ? ' is-new' : '');

    var head =
      '<div class="cov-head">' +
        '<span class="cov-no">' + esc(c.coverageNumber) + '</span>' +
        '<span class="cov-plan">' + esc(c.planId) + '</span>' +
        '<span class="cov-sum">Face <b>' + (group(c.faceAmount) || '—') + '</b> · Modal <b>' +
          (group(c.modalPremium, 2) || '—') + '</b> · ' + liveInsureds(c).length + ' life' +
          (liveInsureds(c).length === 1 ? '' : 'ves') + '</span>' +
        '<span class="spacer"></span>' +
        (c._removed
          ? '<button class="btn btn--sm" data-act="rscov" data-id="' + c._id + '">Restore Coverage</button>'
          : c._new
            ? '<button class="btn btn--sm btn--danger" data-act="dropcov" data-id="' + c._id + '">Discard Coverage</button>'
            : '<button class="btn btn--sm btn--danger" data-act="rmcov" data-id="' + c._id + '">Remove Coverage</button>') +
      '</div>';

    if (c._removed) {
      return '<div class="' + cls + '">' + head +
             '<div class="card-body card-note">Terminated — excluded from the projection. ' +
             'The imported extract is untouched.</div></div>';
    }

    var grid = COVERAGE_GROUPS.map(function (grp) {
      var rows = COVERAGE_FIELDS.filter(function (f) { return f.g === grp.id; })
        .map(function (f) { return fieldRow(f, c, base, 'cov|' + c._id + '|' + f.k, c._new); })
        .join('');
      return '<div class="fgroup"><div class="fgroup-head">' + esc(grp.l) + '</div>' + rows + '</div>';
    }).join('');

    return '<div class="' + cls + '">' + head +
           '<div class="fgrid">' + grid + '</div>' + insuredTable(c) + '</div>';
  }

  /* A locked field keeps its box so the grid stays aligned, but renders as a
     dashed grey read-only control: unmistakably inert, still selectable so a
     value can be copied out for comparison, and skipped by Tab so the keyboard
     runs straight between the fields that can actually be changed. */
  function control(f, v, fk, locked) {
    var numeric = f.t === 'int' || f.t === 'money' || f.t === 'pct';

    if (locked) {
      var txt = show(f, v);
      return '<input class="fi fi--ro' + (numeric ? '' : ' fi--txt') + '"' +
             ' value="' + esc(txt) + '" readonly tabindex="-1"' +
             (txt ? '' : ' placeholder="—"') + '>';
    }
    if (f.t === 'enum') {
      return '<select class="fi" data-fk="' + fk + '">' + f.opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    }
    return '<input class="fi' + (numeric ? '' : ' fi--txt') + '" data-fk="' + fk + '"' +
           ' value="' + esc(raw(f, v)) + '" spellcheck="false" autocomplete="off"' +
           (f.maxLen || f.len ? ' maxlength="' + (f.maxLen || f.len) + '"' : '') + '>';
  }

  function fieldRow(f, rec, base, fk, isNew) {
    var v = rec[f.k];
    /* Two different rules. On an imported coverage, `lock` protects the value
       the extract supplied. On a coverage the operator added there is no such
       value, so an explicit allowlist decides instead — everything outside it
       stays blank and inert rather than inviting an invented figure. */
    var locked = isNew ? !f.newOk : Boolean(f.lock);
    var changed = base && !isNew && !same(base[f.k], v);
    var title = (f.hint || f.l) + (locked ? '  ·  not editable' : '') +
                (changed ? '  ·  was ' + show(f, base[f.k]) : '');

    return '<div class="fr' + (changed ? ' is-chg' : '') + '" title="' + esc(title) + '">' +
           '<span class="fk">' + esc(f.l) +
           (f.u && f.u !== 'CAD' ? ' <span class="muted">' + esc(f.u) + '</span>' : '') + '</span>' +
           control(f, v, fk, locked) + '</div>';
  }

  /** One insured field as a control — only reached for a life the operator added. */
  function insControl(f, ins, cov, cls) {
    var fk = 'ins|' + cov._id + '~' + ins._id + '|' + f.k;
    if (f.t === 'enum') {
      return '<select class="fi" data-fk="' + fk + '">' + f.opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === ins[f.k] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    }
    return '<input class="fi fi--txt' + (cls ? ' ' + cls : '') + '" data-fk="' + fk + '"' +
           ' value="' + esc(ins[f.k]) + '" spellcheck="false" autocomplete="off"' +
           (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') +
           (f.maxLen ? ' maxlength="' + f.maxLen + '"' : '') + '>';
  }

  /* An insured the operator added is discarded outright — it never existed on
     the extract, so there is nothing to strike through and nothing to restore.
     An imported life is soft-withdrawn instead, keeping the change auditable. */
  function insuredAction(i, c, last, isNew) {
    var lock = last ? ' disabled title="A coverage must retain at least one insured life"' : '';

    if (isNew) {
      return '<button class="btn btn--sm btn--danger" data-act="dropins" data-cov="' + c._id +
             '" data-id="' + i._id + '"' + lock + '>Remove</button>';
    }
    if (i._removed) {
      return '<button class="btn btn--sm" data-act="rsins" data-cov="' + c._id +
             '" data-id="' + i._id + '">Restore</button>';
    }
    return '<button class="btn btn--sm btn--danger" data-act="rmins" data-cov="' + c._id +
           '" data-id="' + i._id + '"' + lock + '>Withdraw</button>';
  }

  function insuredTable(c) {
    var proj = state.data.policy.valueAsOfDate;
    var live = liveInsureds(c).length;

    var rows = c.insureds.map(function (i) {
      var age = agesAt(i.birthdate, proj);
      var last = live <= 1 && !i._removed;
      var open = Boolean(i._new);          // added lives are editable, imported ones are not

      return '<tr' + (i._removed ? ' class="is-removed"' : '') + '>' +
        '<td>' + (open ? insControl(INS_MAP.fullName, i, c, 'fi--name') : esc(i.fullName || '(unnamed)')) + '</td>' +
        '<td class="' + (open ? '' : 'mono') + '">' +
          (open ? insControl(INS_MAP.birthdate, i, c) : esc(i.birthdate || '—')) + '</td>' +
        '<td class="r">' + (open ? insControl(INS_MAP.sex, i, c) : esc(i.sex)) + '</td>' +
        '<td class="r num">' + (age.real === null ? '—' : age.real) + '</td>' +
        '<td class="r num">' + (age.nearest === null ? '—' : age.nearest) + '</td>' +
        '<td class="act">' + insuredAction(i, c, last, open) + '</td></tr>';
    }).join('');

    return '<div class="ins-wrap"><table class="ins"><thead><tr>' +
      '<th>Insured</th><th>Birthdate</th><th class="r">Sex</th>' +
      '<th class="r" title="Age last birthday at the projection date">Real Age</th>' +
      '<th class="r" title="Age nearest birthday at the projection date">Nearest Age</th>' +
      '<th class="r"><button class="btn btn--sm" data-act="addins" data-id="' + c._id + '">+ Insured</button></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ── Policy sidebar + change log ───────────────────────────────────── */
  function renderPolicy() {
    var p = state.data.policy, b = state.base.policy;

    var body = POLICY_FIELDS.map(function (f) {
      if (f.g) return '<div class="grouphead"><span class="micro">' + esc(f.g) + '</span></div>';

      var changed = !same(b[f.k], p[f.k]);
      var title = (f.hint || f.l) + (f.lock ? '  ·  not editable' : '') +
                  (changed ? '  ·  was ' + show(f, b[f.k]) : '');

      return '<div class="kv' + (changed ? ' is-chg' : '') + '" title="' + esc(title) + '">' +
             '<dt>' + esc(f.l) + '</dt><dd>' +
             control(f, p[f.k], 'pol||' + f.k, f.lock) + '</dd></div>';
    }).join('');

    var debt = (+p.currentLoanAmount || 0) + (+p.currentLoanInterest || 0) +
               (+p.currentAplAmount || 0) + (+p.currentAplInterest || 0);

    var card =
      '<div class="card card--out">' +
        '<div class="card-head card-head--band"><span class="card-title">Policy Information</span>' +
          '<span class="chip mono">' + esc(p.policyNumber || '—') + '</span></div>' +
        body +
        '<div class="kv is-total"><dt>Total Indebtedness</dt><dd class="num">' + group(debt, 2) + '</dd></div>' +
        loanForm() +
        '<div class="card-foot">' +
          '<button class="btn btn--sm" data-act="loan">Add Loan on Policy</button>' +
          '<button class="btn btn--sm" data-act="apl">Add APL on Policy</button>' +
        '</div>' +
      '</div>';

    $('policyCol').innerHTML = card + changeLog();
  }

  function loanForm() {
    if (!state.form) return '';
    var apl = state.form === 'apl';
    var p = state.data.policy;
    return '<div class="inline-form">' +
      '<div class="micro" style="margin-bottom:6px">' + (apl ? 'Automatic Premium Loan' : 'Policy Loan') + '</div>' +
      '<div class="row"><label>Amount</label><input id="loanAmt" value="' +
        esc(apl ? p.currentAplAmount : p.currentLoanAmount) + '"></div>' +
      '<div class="row"><label>Interest</label><input id="loanInt" value="' +
        esc(apl ? p.currentAplInterest : p.currentLoanInterest) + '"></div>' +
      '<div class="acts">' +
        '<button class="btn btn--sm" data-act="loancancel">Cancel</button>' +
        '<button class="btn btn--sm btn--primary" data-act="loanapply">Apply</button>' +
      '</div></div>';
  }

  /** Every difference between the imported extract and the working copy. */
  function diff() {
    var out = [];
    POLICY_FIELDS.forEach(function (f) {
      if (!f.k) return;
      if (!same(state.base.policy[f.k], state.data.policy[f.k])) {
        out.push(['mod', 'Policy', f.l, show(f, state.base.policy[f.k]), show(f, state.data.policy[f.k])]);
      }
    });

    state.data.coverages.forEach(function (c) {
      var b = baseCoverage(c._id);
      if (!b) {
        var desc = [c.planId, group(c.faceAmount)].filter(Boolean).join(' · ');
        out.push(['add', c.coverageNumber, 'Coverage added', '', desc || 'not yet completed']);
        return;
      }
      if (c._removed) { out.push(['del', c.coverageNumber, 'Coverage terminated', b.planId + ' · ' + group(b.faceAmount), '']); return; }

      COVERAGE_FIELDS.forEach(function (f) {
        if (!same(b[f.k], c[f.k])) out.push(['mod', c.coverageNumber, f.l, show(f, b[f.k]), show(f, c[f.k])]);
      });
      c.insureds.forEach(function (i) {
        var bi = null;
        b.insureds.forEach(function (x) { if (x._id === i._id) bi = x; });
        if (!bi) out.push(['add', c.coverageNumber, 'Insured added', '', i.fullName || '(unnamed)']);
        else if (i._removed) out.push(['del', c.coverageNumber, 'Insured withdrawn', bi.fullName, '']);
      });
    });
    return out;
  }

  function changeLog() {
    var d = diff();
    var head = '<div class="card-head card-head--band"><span class="card-title">Change Log</span>' +
      '<span class="card-note">vs. imported extract</span><span class="spacer"></span>' +
      (d.length ? '<span class="chip chip--edit">' + d.length + '</span>' : '<span class="chip">None</span>') +
      '</div>';

    if (!d.length) {
      return '<div class="card card--out">' + head +
        '<div class="card-body card-note">The working copy matches the extract exactly.</div></div>';
    }

    var rows = d.map(function (e) {
      return '<tr><td><span class="tag tag--' + e[0] + '">' + e[0] + '</span></td>' +
        '<td class="where">' + esc(e[1]) + '</td><td>' + esc(e[2]) + '</td>' +
        '<td class="r from">' + esc(e[3] || '—') + '</td>' +
        '<td class="r to">' + esc(e[4] || '—') + '</td></tr>';
    }).join('');

    return '<div class="card card--out">' + head +
      '<table class="diff"><thead><tr><th></th><th>Where</th><th>Field</th>' +
      '<th class="r">From</th><th class="r">To</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="card-foot"><span class="spacer"></span>' +
      '<button class="btn btn--sm" data-act="reset">Reset to Extract</button></div></div>';
  }

  function renderStatus() {
    var n = diff().length;
    $('stDot').className = 'dot dot--ok';
    $('stText').textContent = 'Ready';
    $('stFile').textContent = state.meta.fileName;
    $('stChanges').textContent = n + ' change' + (n === 1 ? '' : 's') + ' vs. extract';
  }

  // --------------------------------------------------------------- events
  /* A field key is "<scope>|<id>|<field>", where the id is empty for the
     policy and "<coverageId>~<insuredId>" for an insured life. */
  function resolve(fk) {
    var p = String(fk).split('|');
    if (p[0] === 'pol') return { f: POL_MAP[p[2]], rec: state.data.policy };

    if (p[0] === 'ins') {
      var ids = p[1].split('~'), c = coverage(ids[0]), hit = null;
      if (c) c.insureds.forEach(function (x) { if (x._id === ids[1]) hit = x; });
      return { f: INS_MAP[p[2]], rec: hit };
    }
    return { f: COV_MAP[p[2]], rec: coverage(p[1]) };
  }

  function commit(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.fk) return;

    var r = resolve(el.dataset.fk), f = r.f, rec = r.rec;
    if (!f || !rec) return;

    var res = validate(f, el.value);
    if (!res.ok) {
      el.classList.add('fi--bad');
      el.title = res.msg;
      toast(res.msg, 'err');
      return;                                   // invalid values never commit
    }
    el.classList.remove('fi--bad');
    rec[f.k] = res.v;
    deferRender();
  }

  function live(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.fk) return;
    var f = resolve(el.dataset.fk).f;
    if (!f) return;
    el.classList.toggle('fi--bad', !validate(f, el.value).ok);
  }

  function onClick(e) {
    var btn = e.target.closest ? e.target.closest('button[data-act]') : null;
    if (!btn) return;
    var act = btn.dataset.act, id = btn.dataset.id, cov = btn.dataset.cov;

    if (act === 'rmcov')   { coverage(id)._removed = true; }
    if (act === 'rscov')   { coverage(id)._removed = false; }
    if (act === 'dropcov') {
      state.data.coverages = state.data.coverages.filter(function (c) { return c._id !== id; });
    }
    if (act === 'addins') {
      coverage(id).insureds.push({
        _id: 'i' + (++state.seq), _removed: false, _new: true,
        fullName: '', birthdate: '', sex: 'M'
      });
    }
    if (act === 'dropins') {
      var host = coverage(cov);
      host.insureds = host.insureds.filter(function (i) { return i._id !== id; });
    }
    if (act === 'rmins' || act === 'rsins') {
      coverage(cov).insureds.forEach(function (i) {
        if (i._id === id) i._removed = (act === 'rmins');
      });
    }
    if (act === 'loan' || act === 'apl') { state.form = act; }
    if (act === 'loancancel') { state.form = null; }
    if (act === 'loanapply') {
      var apl = state.form === 'apl';
      var fa = POL_MAP[apl ? 'currentAplAmount' : 'currentLoanAmount'];
      var fi = POL_MAP[apl ? 'currentAplInterest' : 'currentLoanInterest'];
      var ra = validate(fa, $('loanAmt').value), ri = validate(fi, $('loanInt').value);
      if (!ra.ok || !ri.ok) { toast(ra.ok ? ri.msg : ra.msg, 'err'); return; }
      state.data.policy[fa.k] = ra.v;
      state.data.policy[fi.k] = ri.v;
      state.form = null;
      toast((apl ? 'APL' : 'Loan') + ' applied to the policy');
    }
    if (act === 'reset') {
      state.data = JSON.parse(JSON.stringify(state.base));
      state.form = null;
      toast('Working copy reset to the imported extract');
    }
    render();
  }

  function load(result) {
    state.loaded = true;
    state.meta = result.meta;
    state.base = result.data;
    state.data = JSON.parse(JSON.stringify(result.data));
    state.form = null;

    $('hdrPolicy').textContent = state.data.policy.policyNumber || '(no policy number)';
    $('hdrFile').textContent = result.meta.fileName;
    $('hdrMock').hidden = !result.meta.mocked;
    $('hdrStamp').textContent = 'Imported ' + stamp(result.meta.importedAt);
    $('btnClear').hidden = false;
    $('paneEmpty').hidden = true;
    showTab(currentTab());
    render();
    toast('Extract imported — ' + result.data.coverages.length + ' coverage(s)');
  }

  function currentTab() {
    var sel = document.querySelector('.tab[aria-selected="true"]');
    return sel ? sel.dataset.pane : PANES[0];
  }

  function showTab(pane) {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.setAttribute('aria-selected', String(t.dataset.pane === pane));
    });
    // Nothing shows at all until an extract is loaded — except History,
    // which is how an operator gets back into a case without a fresh
    // import, so it stays reachable (and pushes the empty state aside)
    // regardless of state.loaded.
    $('paneEmpty').hidden = state.loaded || pane === 'paneHistory';
    PANES.forEach(function (id) {
      var needsData = id !== 'paneHistory';
      $(id).hidden = id !== pane || (needsData && !state.loaded);
    });
  }

  function ingest(file) {
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      toast(file.name + ' is not an accepted extract (.xlsx .xlsm)', 'err');
      return;
    }
    var r = new FileReader();
    r.onerror = function () { toast('Could not read ' + file.name, 'err'); };
    r.onload = function () {
      parseWorkbook(r.result, file.name).then(load, function (err) {
        toast('Could not parse ' + file.name + ' — ' + err.message, 'err');
      });
    };
    r.readAsArrayBuffer(file);
  }

  // ----------------------------------------------------------------- tools
  /* The header block is a tool switcher. Each tool is its own page, so
     picking the other one simply navigates there. */
  var TOOLS = [
    { id: 'inforce',   href: 'inforce.html',   mark: 'IT', name: 'Inforce Tool',       swatch: '#35663E',
      note: 'Validate an in-force policy extract' },
    { id: 'optimizer', href: 'optimizer.html', mark: 'CO', name: 'Coverage Optimizer', swatch: '#345165',
      note: 'Optimise the coverage structure' }
  ];
  var THIS_TOOL = 'inforce';
  var PANES = ['paneHome', 'paneProjection', 'paneHistory', 'paneDevCalc'];

  function renderToolMenu() {
    $('toolMenu').innerHTML = TOOLS.map(function (o) {
      var on = o.id === THIS_TOOL;
      return '<button class="brand-opt" role="option" data-tool="' + o.id + '"' +
             ' aria-selected="' + on + '">' +
               // Each badge wears its own tool colour, not this page's palette,
               // so the operator can see what they are switching into.
               '<span class="mark" style="background:' + o.swatch + ';color:#fff">' +
                 esc(o.mark) + '</span>' +
               '<span class="brand-opt-txt">' +
                 '<span class="brand-opt-name">' + esc(o.name) + '</span>' +
                 '<span class="brand-opt-note">' + esc(o.note) + '</span>' +
               '</span>' +
               (on ? '<span class="tick">✓</span>' : '') +
             '</button>';
    }).join('');
  }

  function openToolMenu(open) {
    $('toolMenu').hidden = !open;
    $('toolSelect').setAttribute('aria-expanded', String(open));
  }

  function selectTool(id) {
    openToolMenu(false);
    if (id === THIS_TOOL) { $('toolSelect').focus(); return; }
    TOOLS.forEach(function (t) { if (t.id === id) location.href = t.href; });
  }

  // ----------------------------------------------------------------- theme
  /* Light is the default; the OS preference is deliberately not consulted so
     the tool looks the same on every workstation. The choice persists across
     both tool pages through localStorage. Everything is wrapped: storage can
     be unavailable (private windows, locked-down browsers) and the tool must
     still run without it. */
  var THEME_KEY = 'life-tool-theme';

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  }
  function loadTheme() {
    var t = 'light';
    try { t = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { /* no storage */ }
    applyTheme(t);
  }
  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* no storage */ }
  }

  // -------------------------------------------------------------- history
  /* Save Test / History — same persistence pattern as the Coverage
     Optimizer's History tab: a catalog kept in this browser's own
     localStorage (instant list + one-click Load) AND mirrored as portable
     .json files in history_data/, written through server.py (the tool is
     started from _start-life-inforce.bat; Save Test falls back to a browser
     download if the server can't be reached).

     Unlike the Optimizer, a saved entry captures BOTH state.base and
     state.data (not just the working copy) — Load restores both, so the
     gold "changed" highlights and the Change Log come back exactly as they
     were the moment the case was saved, ready to keep analysing. */
  var HIST_KEY = 'life-inforce-testcases';
  var HIST_COLUMNS = ['Test Case Name', 'Username', 'Date Saved', 'Policy Number', 'Coverages', 'Changes', 'Load', 'Delete'];
  var histFilters = { name: '', user: '', date: '' };

  function histLoadCatalog() {
    try {
      var raw = localStorage.getItem(HIST_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* storage unavailable/corrupt — start empty, tool still runs */ }
    return [];
  }
  function histPersistCatalog() {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(histCatalog)); } catch (e) { /* storage unavailable */ }
  }
  var histCatalog = histLoadCatalog();

  function histNewId() { return 'tc' + Date.now() + Math.floor(Math.random() * 1000); }

  // A real wall-clock moment (when Save Test was clicked), so built from
  // local time — deliberately not fmtDate, which is for the business dates
  // elsewhere on this page (birthdates, policy dates) and reads UTC fields.
  function histNowStamp() {
    var d = new Date();
    var p = function (x) { return String(x).padStart(2, '0'); };
    return p(d.getDate()) + '-' + MONTHS[d.getMonth()] + '-' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function histSafeFileName(name) {
    var base = String(name || 'test-case').trim().replace(/[^A-Za-z0-9\-_ ]+/g, '').replace(/\s+/g, '_');
    // The saver's initials first (set on the pre-load page) so two people's files can't collide.
    return ($('tcUser').dataset.ini || 'u') + '_' + (base || 'test-case').slice(0, 60) + '.json';
  }

  /** Fallback only (see histSaveToDataFolder): a plain download can't choose
      a folder — the browser's own download directory decides. */
  function histDownloadJSON(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** POSTs the test case to server.py (_start-life-inforce.bat), which writes
      it into history_data/ and never overwrites — a taken name comes back
      with a timestamp suffix. Resolves { name } — the file actually written
      — or { why } (page opened from disk, server down, refused) → the
      caller downloads instead. */
  function histSaveToDataFolder(filename, obj) {
    return fetch('../history_data/' + filename, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj, null, 2)
    }).then(function (r) {
      if (!r.ok) throw new Error('the server answered HTTP ' + r.status);
      return r.json();
    }).then(function (j) { return { name: j.name }; })
      .catch(function (e) { return { why: e.message === 'Failed to fetch' ? 'the tool\'s server isn\'t reachable' : e.message }; });
  }

  function histBuildEntry(name, user) {
    return {
      id: histNewId(),
      name: name,
      user: user,
      savedAt: histNowStamp(),
      policyNumber: state.data.policy.policyNumber || '',
      coverageCount: state.data.coverages.length,
      changeCount: diff().length,
      // base + data, deep-cloned: everything Load needs to put both the
      // pristine extract AND the operator's edits back exactly as saved.
      snapshot: {
        base: JSON.parse(JSON.stringify(state.base)),
        data: JSON.parse(JSON.stringify(state.data)),
        meta: state.meta ? { fileName: state.meta.fileName, importedAt: state.meta.importedAt, mocked: state.meta.mocked } : null
      }
    };
  }

  function doSaveTest() {
    if (!state.loaded) {
      toast('Import an extract before saving a test case', 'err');
      return;
    }
    var nameEl = $('tcName');
    var name = nameEl.value.trim();
    if (!name) {
      nameEl.classList.add('fi--bad');
      nameEl.title = 'Enter a Test Case Name before saving';
      toast('Enter a Test Case Name before saving', 'err');
      nameEl.focus();
      return;
    }
    nameEl.classList.remove('fi--bad');
    nameEl.title = 'Test Case Name';

    var entry = histBuildEntry(name, $('tcUser').textContent);
    histCatalog.push(entry);
    histPersistCatalog();
    renderHistoryTab();
    nameEl.value = '';

    var fname = histSafeFileName(name);
    histSaveToDataFolder(fname, entry).then(function (r) {
      if (r.name) {
        entry.file = r.name;
        histPersistCatalog();
        toast('Saved "' + name + '" to History and history_data/' + r.name + '.');
        return;
      }
      histDownloadJSON(fname, entry);
      toast('Saved "' + name + '" to History; downloaded instead — history_data/ not reachable (start the tool with _start-life-inforce.bat).', 'err');
    });
  }

  function doHistLoad(id) {
    var entry = null;
    histCatalog.forEach(function (e) { if (e.id === id) entry = e; });
    if (!entry) return;
    var snap = entry.snapshot;
    if (!snap || !snap.base || !snap.data) { toast('Could not load "' + entry.name + '" — the saved file is damaged.', 'err'); return; }

    state.loaded = true;
    state.meta = snap.meta || { fileName: entry.name, importedAt: new Date(), mocked: false };
    state.base = JSON.parse(JSON.stringify(snap.base));
    state.data = JSON.parse(JSON.stringify(snap.data));
    state.form = null;

    $('hdrPolicy').textContent = state.data.policy.policyNumber || '(no policy number)';
    $('hdrFile').textContent = state.meta.fileName;
    $('hdrMock').hidden = !state.meta.mocked;
    $('hdrStamp').textContent = 'Loaded "' + entry.name + '" — saved ' + entry.savedAt;
    $('btnClear').hidden = false;
    showTab('paneHome');
    render();
    toast('Loaded "' + entry.name + '" — the changes on it at save time came back with it.');
  }

  function doHistDelete(id) {
    var entry = null;
    histCatalog.forEach(function (e) { if (e.id === id) entry = e; });
    if (!entry) return;
    histCatalog = histCatalog.filter(function (e) { return e !== entry; });
    histPersistCatalog();
    renderHistoryTab();
    if (!entry.file) { toast('Test case removed.'); return; }
    // Its file goes too (else it would come back at the next launch) — moved to history_data/_deleted/, never erased.
    fetch('../history_data/' + entry.file, { method: 'DELETE' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      toast('Test case removed (its file is in history_data/_deleted/).');
    }).catch(function () {
      toast('Removed from the list, but its file in history_data/ could not be deleted — it will reappear next launch.', 'err');
    });
  }

  /* Every launch: merge in every test case already in history_data/ (every
     colleague's saves) by id, so a case saved by someone else is here when
     this browser opens the tool. */
  function histLoadFromFolder() {
    fetch('../history_data/').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (files) {
      var inFolder = {}, have = {};
      files.forEach(function (f) { inFolder[f.file] = 1; });
      histCatalog = histCatalog.filter(function (e) { return !e.file || inFolder[e.file]; });
      histCatalog.forEach(function (e) { have[e.id] = e; });
      files.forEach(function (f) {
        var d = f.entry, snap = d && d.snapshot;
        if (!d || !d.name || !snap || !snap.base || !snap.data) return;
        if (!d.id) d.id = histNewId();
        if (have[d.id]) { have[d.id].file = f.file; return; }
        d.file = f.file;
        histCatalog.push(d);
        have[d.id] = d;
      });
      histPersistCatalog();
      renderHistoryTab();
    }).catch(function () { /* no server reachable — this browser's own list still works */ });
  }

  // Filters: Test Case Name and Date Saved match "contains" (case-insensitive), Username is exact. Newest first.
  function histHas(v, q) { return !q || String(v || '').toLowerCase().indexOf(q.toLowerCase()) >= 0; }
  function histShows(e) { return histHas(e.name, histFilters.name) && (!histFilters.user || e.user === histFilters.user) && histHas(e.savedAt, histFilters.date); }
  function histSavedMs(e) { return parseInt(String(e.id).slice(2, 15), 10) || 0; }

  function historyRow(entry) {
    return '<tr>' +
        '<td class="r">' + esc(entry.name) + '</td>' +
        '<td class="r">' + esc(entry.user) + '</td>' +
        '<td class="r">' + esc(entry.savedAt) + '</td>' +
        '<td class="r">' + esc(entry.policyNumber || '—') + '</td>' +
        '<td class="r">' + entry.coverageCount + '</td>' +
        '<td class="r">' + entry.changeCount + '</td>' +
        '<td class="r"><button class="btn btn--sm" data-act="load-tc" data-id="' + esc(entry.id) + '">Load</button></td>' +
        '<td class="r"><button class="btn btn--sm btn--danger" data-act="del-tc" data-id="' + esc(entry.id) + '">Delete</button></td>' +
      '</tr>';
  }

  function renderHistoryTab() {
    if (!$('historyTabBody')) return;   // not built yet
    var users = [];
    histCatalog.forEach(function (e) { if (e.user && users.indexOf(e.user) < 0) users.push(e.user); });
    users.sort();
    $('hfUser').innerHTML = '<option value="">All</option>' + users.map(function (u) {
      return '<option' + (u === histFilters.user ? ' selected' : '') + '>' + esc(u) + '</option>';
    }).join('');
    var list = histCatalog.slice().sort(function (a, b) { return histSavedMs(b) - histSavedMs(a); }).filter(histShows);
    $('historyTabBody').innerHTML = list.length
      ? list.map(historyRow).join('')
      : '<tr><td colspan="' + HIST_COLUMNS.length + '">' +
          '<div class="proj-slot" style="margin:0;"><div class="s">' +
            (histCatalog.length ? 'No test case matches the filters.' : 'No test cases saved yet — use Save Test in the top bar to add one.') +
          '</div></div></td></tr>';
    $('historyTabCount').textContent = (list.length === histCatalog.length ? '' : list.length + ' of ') +
      histCatalog.length + ' test case' + (histCatalog.length === 1 ? '' : 's');
  }

  function historyTabShell() {
    var headCells = HIST_COLUMNS.map(function (l) { return '<th class="r">' + esc(l) + '</th>'; }).join('');
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band">' +
          '<span class="card-title">History</span>' +
          '<span class="card-note" id="historyTabCount"></span>' +
        '</div>' +
        '<div class="table-scroll-wrap">' +
          '<table class="ins hist-tab-table">' +
            '<thead><tr>' + headCells + '</tr>' +
              '<tr class="hist-filter">' +
                '<th><input class="fi fi--txt" data-hf="name" placeholder="Filter name…" spellcheck="false" autocomplete="off" aria-label="Filter by Test Case Name"></th>' +
                '<th><select class="fi" id="hfUser" data-hf="user" aria-label="Filter by Username"></select></th>' +
                '<th><input class="fi fi--txt" data-hf="date" placeholder="e.g. 23-SEP-2026" spellcheck="false" autocomplete="off" aria-label="Filter by Date Saved"></th>' +
                '<th colspan="5"><button class="btn btn--sm" data-act="clear-hf" type="button">Clear filters</button></th>' +
              '</tr></thead>' +
            '<tbody id="historyTabBody"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function initHistoryTab() {
    $('historyTabHost').innerHTML = historyTabShell();
    renderHistoryTab();

    $('historyTabHost').addEventListener('click', function (e) {
      var loadBtn = e.target.closest ? e.target.closest('[data-act="load-tc"]') : null;
      if (loadBtn) { doHistLoad(loadBtn.dataset.id); return; }
      var delBtn = e.target.closest ? e.target.closest('[data-act="del-tc"]') : null;
      if (delBtn) { doHistDelete(delBtn.dataset.id); return; }
      if (e.target.closest && e.target.closest('[data-act="clear-hf"]')) {
        histFilters = { name: '', user: '', date: '' };
        Array.prototype.forEach.call(document.querySelectorAll('input[data-hf]'), function (i) { i.value = ''; });
        renderHistoryTab();
      }
    });
    $('historyTabHost').addEventListener('input', function (e) {
      if (e.target.dataset && e.target.dataset.hf) { histFilters[e.target.dataset.hf] = e.target.value; renderHistoryTab(); }
    });
    $('historyTabHost').addEventListener('change', function (e) {   // the Username <select> fires `change`
      if (e.target.dataset && e.target.dataset.hf === 'user') { histFilters.user = e.target.value; renderHistoryTab(); }
    });
  }

  // ------------------------------------------------------------- dev calc
  /* Dev Validations — not part of the tool as shipped. POSTs the current
     working dataset to server.py's /calc/term_life route, which runs every
     calc_engine.term_life variable it knows about and returns the results
     grouped by section; this just renders that response into one card per
     section, one row per (variable, coverage). A variable the engine hasn't
     implemented yet, or that raised Blocked (e.g. needs the Product
     Characteristics lookup), shows its reason instead of a value — see
     INFORCE_REFERENCE.md Sec 16. */
  var SECTION_LABELS = { 'Duration': '1. Duration', 'Input Setup - Policy': '2. Input Setup — Policy', 'Input Setup - Coverage': '3. Input Setup — Coverage' };

  function devCalcRow(v) {
    return v.results.map(function (r) {
      var scope = r.iCov == null ? '(policy)' : 'C' + (r.coverageNumber || r.iCov) + (r.iInsured == null ? '' : ' / insured ' + r.iInsured);
      var cell = r.error
        ? '<span class="chip chip--warn" title="' + esc(r.error) + '">' + esc(r.error.length > 46 ? r.error.slice(0, 46) + '…' : r.error) + '</span>'
        : '<span class="mono">' + esc(String(r.value)) + '</span>';
      return '<tr><td class="mono">' + esc(v.id) + '</td><td>' + esc(v.business_name) + '</td>' +
        '<td class="mono">' + esc(v.python_name) + '</td><td class="r">' + esc(scope) + '</td>' +
        '<td class="r">' + cell + '</td></tr>';
    }).join('');
  }

  function devCalcSection(sec) {
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band"><span class="card-title">' + esc(SECTION_LABELS[sec.section] || sec.section) + '</span>' +
        '<span class="card-note">' + sec.vars.length + ' variable(s)</span></div>' +
        '<div class="table-scroll-wrap"><table class="ins">' +
          '<thead><tr><th>ID</th><th>Business name</th><th>python_name</th><th class="r">Scope</th><th class="r">Value</th></tr></thead>' +
          '<tbody>' + sec.vars.map(devCalcRow).join('') + '</tbody>' +
        '</table></div></div>';
  }

  function renderDevCalc() {
    var host = $('devCalcHost');
    if (!host) return;
    if (!state.loaded) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="card-note" style="margin:8px;">Loading…</div>';
    fetch('../calc/term_life', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.data)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (result) {
      host.innerHTML = result.sections.map(devCalcSection).join('');
    }).catch(function (e) {
      host.innerHTML = '<div class="card card--out"><div class="card-body card-note">' +
        'Could not reach the calc engine (' + esc(e.message) + ') — start the tool with _start-life-inforce.bat.</div></div>';
    });
  }

  // -------------------------------------------------------------- preload
  /* Covers the tool until a user is picked. Usernames are proposed from
     usernames.json (server.py); "Add" (or Enter) posts a new one there so
     it's on the list for everyone next launch too. Picking a pill writes
     the name/initials onto the top-bar chip #tcUser, which the History code
     above reads. Nothing is remembered between launches — it asks every
     time. */
  var plUser = null;

  function plRenderUsers(list) {
    $('plUsers').innerHTML = (list || []).map(function (u) {
      return '<button class="pl-user" type="button" role="radio" aria-checked="false" data-user="' +
        esc(u.name) + '" data-ini="' + esc(u.ini) + '">' + esc(u.name) + '</button>';
    }).join('');
  }

  function plUpdate() {
    $('plStart').disabled = !plUser;
    $('plHint').textContent = plUser ? '' : 'Choose your name.';
    $('plImportHint').hidden = !!plUser;
  }

  function plEnter(name, ini) {
    $('tcUser').textContent = name;
    $('tcUser').dataset.ini = ini;
    $('preload').hidden = true;
    document.querySelector('.app').inert = false;
  }

  /** Gate for the preload page's own import controls: a name must be picked
      first (Save Test and the history_data file name both need it). Dismisses
      the preload immediately on success — the app shell underneath then shows
      #paneEmpty for the instant it takes ingest()/load() to finish, same as
      if Start had been clicked first. */
  function plProceed() {
    if (!plUser) { $('plImportHint').hidden = false; $('plDropZone').scrollIntoView({ block: 'nearest' }); return false; }
    plEnter(plUser.dataset.user, plUser.dataset.ini);
    return true;
  }

  function plAddUser() {
    var input = $('plNewName');
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    fetch('../usernames.json', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (list) {
      plRenderUsers(list);
      input.value = '';
      var match = null;
      Array.prototype.forEach.call(document.querySelectorAll('.pl-user'), function (b) {
        if (b.dataset.user.toLowerCase() === name.toLowerCase()) match = b;
      });
      if (match) match.click();
    }).catch(function () {
      toast('Could not reach the server to add "' + name + '" — start the tool with _start-life-inforce.bat.', 'err');
    });
  }

  function initPreload() {
    document.querySelector('.app').inert = true;

    fetch('../usernames.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(plRenderUsers).catch(function () {
      $('plHint').textContent = 'Could not reach the server for the username list — start the tool with _start-life-inforce.bat, or just type your name below and click Add.';
    });

    $('plUsers').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.pl-user') : null;
      if (!btn) return;
      Array.prototype.forEach.call(document.querySelectorAll('.pl-user'), function (b) {
        b.setAttribute('aria-checked', String(b === btn));
      });
      plUser = btn;
      plUpdate();
    });

    $('plAddUser').addEventListener('click', plAddUser);
    $('plNewName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); plAddUser(); }
    });

    $('plStart').addEventListener('click', function () {
      if (!$('plStart').disabled) plEnter(plUser.dataset.user, plUser.dataset.ini);
    });

    $('plSelectExtract').addEventListener('click', function () {
      if (plProceed()) $('fileInput').click();
    });
    $('plSampleExtract').addEventListener('click', function () {
      if (plProceed()) parseWorkbook(null, 'SAMPLE_EXTRACT.xlsx').then(load);
    });

    var plDz = $('plDropZone');
    ['dragenter', 'dragover'].forEach(function (t) {
      plDz.addEventListener(t, function (e) { e.preventDefault(); plDz.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      plDz.addEventListener(t, function (e) { e.preventDefault(); plDz.classList.remove('is-over'); });
    });
    plDz.addEventListener('drop', function (e) {
      if (!plProceed()) return;
      if (e.dataTransfer.files && e.dataTransfer.files[0]) ingest(e.dataTransfer.files[0]);
    });

    plUpdate();
  }

  // ------------------------------------------------------------------ init
  loadTheme();
  renderToolMenu();

  $('toolSelect').addEventListener('click', function () {
    openToolMenu($('toolMenu').hidden);
  });

  $('toolMenu').addEventListener('click', function (e) {
    var opt = e.target.closest ? e.target.closest('.brand-opt') : null;
    if (opt) selectTool(opt.dataset.tool);
  });

  // Anything outside the block dismisses the menu; clicks inside it are the
  // trigger and the options, both of which handle themselves.
  document.addEventListener('click', function (e) {
    if (!$('toolMenu').hidden && !$('brandBlock').contains(e.target)) openToolMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('toolMenu').hidden) { openToolMenu(false); $('toolSelect').focus(); }
  });

  // Select on focus, so typing over a grouped number replaces it cleanly.
  document.addEventListener('focusin', function (e) {
    if (e.target.dataset && e.target.dataset.fk && e.target.tagName === 'INPUT') e.target.select();
  });

  $('coverageList').addEventListener('change', commit);
  $('coverageList').addEventListener('input', live);
  $('coverageList').addEventListener('click', onClick);
  $('policyCol').addEventListener('change', commit);
  $('policyCol').addEventListener('input', live);
  $('policyCol').addEventListener('click', onClick);

  // Enter commits by blurring, so `change` always fires with focus gone.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.fk) { e.preventDefault(); e.target.blur(); }
  });

  $('btnAddCoverage').addEventListener('click', function () {
    state.data.coverages.push(newCoverage());
    render();
  });

  $('tabList').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.tab') : null;
    if (!b) return;
    showTab(b.dataset.pane);
    if (b.dataset.pane === 'paneDevCalc') renderDevCalc();
  });

  $('btnRun').addEventListener('click', function () {
    var r = runProjection(state.data);
    $('projectionSlot').innerHTML = r.status === 'not-implemented'
      ? '<div class="t">Calculation engine not yet wired in</div><div class="s">' + esc(r.note) +
        ' This container renders whatever the engine returns.</div>'
      : '<div class="s">' + r.rows.length + ' projection rows returned.</div>';
  });

  $('btnTheme').addEventListener('click', toggleTheme);

  $('btnSample').addEventListener('click', function () { parseWorkbook(null, 'SAMPLE_EXTRACT.xlsx').then(load); });
  $('btnSample2').addEventListener('click', function () { parseWorkbook(null, 'SAMPLE_EXTRACT.xlsx').then(load); });
  $('btnImport').addEventListener('click', function () { $('fileInput').click(); });
  $('btnSelect').addEventListener('click', function () { $('fileInput').click(); });

  $('fileInput').addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) ingest(e.target.files[0]);
    e.target.value = '';
  });

  $('btnClear').addEventListener('click', function () {
    state = { loaded: false, meta: null, base: null, data: null, form: null, seq: 100 };
    $('hdrPolicy').textContent = 'No extract loaded';
    $('hdrFile').textContent = '—';
    $('hdrStamp').textContent = '';
    $('hdrMock').hidden = true;
    $('btnClear').hidden = true;
    $('paneEmpty').hidden = false;
    PANES.forEach(function (id) { $(id).hidden = true; });
    $('stDot').className = 'dot dot--idle';
    $('stText').textContent = 'Awaiting extract';
    $('stFile').textContent = '';
    $('stChanges').textContent = '';
  });

  var dz = $('dropZone');
  ['dragenter', 'dragover'].forEach(function (t) {
    dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.remove('is-over'); });
  });
  dz.addEventListener('drop', function (e) {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) ingest(e.dataTransfer.files[0]);
  });

  initHistoryTab();
  histLoadFromFolder();
  initPreload();

  $('btnSaveTest').addEventListener('click', doSaveTest);
  $('tcName').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doSaveTest(); }
  });
  $('tcName').addEventListener('input', function () {
    if ($('tcName').value.trim()) $('tcName').classList.remove('fi--bad');
  });

  window.__state = function () { return state; };   // console access for validation work
})();
