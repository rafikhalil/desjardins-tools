/* Coverage Optimizer — Rates tab. Client.
 *
 * Own file/IIFE — see OPTIMIZER_REFERENCE.md §1/§2d/§2e for why a split-off
 * tab lives outside optimizer.js. Reads shared state/utilities through
 * `window.OptimizerCore` only, the same rule every other split-off tab
 * follows. Uses the vendored `xlsx.full.min.js` (SheetJS, loaded before this
 * file in optimizer.html) to read a real .xlsx workbook client-side — the
 * one "vendored single script" this page's ground rules explicitly allow
 * (§0 rule 2), since XLSX is a zipped-XML format no one hand-writes a
 * parser for.
 *
 * One container per coverage. Per the request: each coverage's card splits
 * into TWO table regions sharing one row axis (the Coverage Category's fixed
 * rate bands) —
 *   - LEFT, scrollable: one 4-column group per insured on that coverage
 *     (PR_i / EPR_i / PR_BD_i / EPR_BD_i), light separators between insureds.
 *   - RIGHT, always visible: Total / BD_Total / BD_Final, 3 columns each,
 *     hard separators between the three groups.
 *
 * What's real right now vs. still pending (both render as an amber
 * "formula/data not yet provided" cell, core.pendingCell() — the point is to
 * make a wrong or missing figure impossible to mistake for a real one, not
 * to distinguish every possible reason a cell is empty):
 *   - BOTH Term Life and Permanent Life file *parsing* are fully implemented
 *     and tested against locally-built sample workbooks shaped exactly like
 *     the real ones — see ingestTermLifeWorkbook()/ingestPermLifeWorkbook()
 *     and their lookupXRate() counterparts below. One "Import Rates File"
 *     picker handles both; detectAndIngest() tells them apart by which sheet
 *     names the workbook itself has ("temp_rates_" vs "perm_rates_"), so
 *     there's one drop point instead of a button per category.
 *   - The Axis Key CONSTRUCTION formula (insured + coverage + band → the
 *     exact string a rate row is keyed by) has not been given yet for
 *     either category, so PR_i/EPR_i/PR_BD_i/EPR_BD_i stay pending
 *     regardless of whether a file is loaded — both lookups are ready, just
 *     not called by the UI yet.
 *   - Extra Premium Rate (EPR) comes from somewhere other than either rate
 *     file — not yet explained.
 *   - PR_BD_Final/EPR_BD_Final/PEP_BD_Final's own formulas are still coming
 *     (you said "refer to the Backdate tab" for what counts as backdatable,
 *     but the exact formula itself isn't final) — pending regardless of
 *     whether the rest of a row is ever filled in.
 *   - PR_Total/EPR_Total/PEP_Total and the BD_Total trio use the page's
 *     other "blocked on missing upstream data" convention instead (plain
 *     muted "—", not amber) — their SUM formula is fully specified; only the
 *     PR_i/EPR_i inputs they'd sum are what's missing right now. Matches how
 *     Results' own "Modal Premium" is treated (§ optimizer.js Results).
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var core = window.OptimizerCore;

  // ==========================================================================
  // RATE FILE CONFIG — edit here when the rate tables get a new version stamp
  // (per your answer: hardcoded for now, kept in one visible/obvious spot).
  // ==========================================================================
  var RATE_VERSION = '2509';
  var RATES_FOLDER = 'rates';
  var TERM_LIFE_FILENAME = 'temp_rates_' + RATE_VERSION + '_combined.xlsx';
  var TERM_LIFE_FILE_PATH = RATES_FOLDER + '/' + TERM_LIFE_FILENAME;
  // Sheet-name suffixes, in Coverage Input's own COVERAGE_OPTIONS.termLife
  // order (optimizer.js) — temp_rates_<RATE_VERSION>_<suffix> per sheet.
  var TERM_LIFE_DURATIONS = ['t10', 't15', 't20', 't25', 't30', 't65'];
  // Coverage (Coverage Input's own dropdown value) -> sheet suffix. Not read
  // by anything yet (the Axis Key formula that would need it isn't here
  // yet) — kept next to the rest of this file's naming config so it's ready
  // the moment that formula arrives, rather than reverse-engineered again.
  var TERM_LIFE_COVERAGE_SUFFIX = {
    'Term 10': 't10', 'Term 15': 't15', 'Term 20': 't20',
    'Term 25': 't25', 'Term 30': 't30', 'Term to 65': 't65'
  };

  var PERM_VERSION = '2007';
  var PERM_LIFE_FILENAME = 'perm_rates_' + PERM_VERSION + '_combined.xlsx';
  var PERM_LIFE_FILE_PATH = RATES_FOLDER + '/' + PERM_LIFE_FILENAME;
  // One sheet, unlike Term Life's six — every WL product's rows live
  // together in it, distinguished only by their own Axis Key (ColD).
  var PERM_LIFE_SHEET = 'perm_rates_' + PERM_VERSION + '_combined';
  // ==========================================================================

  /* Fixed rate-band tables, straight from your answer — 8 bands for Term
     Life, 6 for Permanent Life. A coverage Category with no entry here
     (Critical Illness, any of the three) renders the plain "not built yet"
     placeholder instead of a table — same as every other CI gap on this
     page (Coverage Type, Coverage Fee, §2b). */
  var BAND_TABLES = {
    termLife: [
      { code: 'B00025', amount: 25000 }, { code: 'B00050', amount: 50000 },
      { code: 'B00100', amount: 100000 }, { code: 'B00250', amount: 250000 },
      { code: 'B00500', amount: 500000 }, { code: 'B01000', amount: 1000000 },
      { code: 'B02000', amount: 2000000 }, { code: 'B10000', amount: 10000000 }
    ],
    permLife: [
      { code: 'B00010', amount: 10000 }, { code: 'B00025', amount: 25000 },
      { code: 'B00050', amount: 50000 }, { code: 'B00100', amount: 100000 },
      { code: 'B00250', amount: 250000 }, { code: 'B00500', amount: 500000 }
    ]
  };

  // ------------------------------------------------------------- workbook
  /* termLifeTables[suffix][axisKey][age] = rate. Populated by
     ingestTermLifeWorkbook(); empty until a file is loaded (fresh session)
     or restored from localStorage (§ persistence, below). */
  var termLifeTables = {};
  var termLifeMeta = null;   // { fileName, counts: {suffix: rowCount}, missingSheets: [] }

  /* permLifeTable[axisKey][age] = rate — one flat table, no per-product
     split (§ file header: Permanent Life is one sheet, every WL product's
     rows distinguished only by Axis Key). */
  var permLifeTable = {};
  var permLifeMeta = null;   // { fileName, count: rowCount, missingSheet: bool }

  /** Reads the bytes as a workbook and routes to the right ingester by
      looking at its OWN sheet names — "temp_rates_" -> Term Life,
      "perm_rates_" -> Permanent Life — rather than a second button/picker
      per category. One file, one drop point; the workbook says what it is. */
  function detectAndIngest(bytes, fileName) {
    var wb;
    try { wb = XLSX.read(bytes, { type: 'array' }); }
    catch (e) { toast('Could not read "' + fileName + '" as an Excel file (' + e.message + ').', 'err'); return; }

    var isTermLife = wb.SheetNames.some(function (n) { return /^temp_rates_/i.test(n); });
    var isPermLife = wb.SheetNames.some(function (n) { return /^perm_rates_/i.test(n); });

    if (isTermLife) ingestTermLifeWorkbook(wb, bytes, fileName);
    else if (isPermLife) ingestPermLifeWorkbook(wb, bytes, fileName);
    else toast('"' + fileName + '" doesn\'t look like a Term Life or Permanent Life rate workbook ' +
      '(expected a sheet name starting with "temp_rates_" or "perm_rates_").', 'err');
  }

  /** Parses one Term Life workbook per the exact layout described: for each
      of the 6 known sheets, ColD = Axis Key, ColE = Duration (keep only
      Duration === 1 — "we only want Row = 1"), ColG..ColDB = age 0..99
      (100 columns, 0-based offset from ColG). Column arithmetic: ColA=0 ...
      ColG=6 ... ColDB=105 (6+100-1), ColDC=106 (Scenario, ignored). */
  function ingestTermLifeWorkbook(wb, bytes, fileName) {
    var tables = {}, counts = {}, missing = [];
    TERM_LIFE_DURATIONS.forEach(function (suffix) {
      var sheetName = 'temp_rates_' + RATE_VERSION + '_' + suffix;
      var ws = wb.Sheets[sheetName];
      if (!ws) { missing.push(sheetName); tables[suffix] = {}; counts[suffix] = 0; return; }

      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      var table = {}, n = 0;
      for (var r = 1; r < rows.length; r++) {           // row 0 is the header row
        var row = rows[r];
        if (!row || row[3] === null || row[3] === '') continue;   // ColD, Axis Key
        if (Number(row[4]) !== 1) continue;                        // ColE, Duration — only 1
        var axisKey = String(row[3]).trim();
        var ages = {};
        for (var c = 6; c <= 105; c++) {                 // ColG..ColDB = C1..C100 = age 0..99
          var v = row[c];
          if (v === null || v === undefined || v === '') continue;
          ages[c - 6] = Number(v);
        }
        // Same axis key claimed by more than one Duration-1 row would be a
        // data problem in the source file, not something to silently pick a
        // winner for — the whole point of this tab is catching exactly this
        // kind of mismatch. Last one wins if it ever happens; n only counts
        // genuinely new keys so the row count stays honest either way.
        if (!(axisKey in table)) n++;
        table[axisKey] = ages;
      }
      tables[suffix] = table;
      counts[suffix] = n;
    });

    termLifeTables = tables;
    termLifeMeta = { fileName: fileName, counts: counts, missingSheets: missing };
    persistRates('termLife', bytes, fileName);
    renderRatesTab();
    renderStatus();

    var total = TERM_LIFE_DURATIONS.reduce(function (s, suf) { return s + (counts[suf] || 0); }, 0);
    if (missing.length) {
      toast('Loaded "' + fileName + '", but couldn\'t find sheet(s): ' + missing.join(', ') + '.', 'err');
    } else {
      toast('Loaded "' + fileName + '" — ' + total + ' rate row(s) across ' + TERM_LIFE_DURATIONS.length + ' sheets.');
    }
  }

  /** Permanent Life's own layout (much simpler — one sheet, one rate per
      row): ColD = Axis Key, ColE = Age + 1 ("Row" — e.g. Row 37 is age 36,
      Row 20 is age 19), ColG = the rate. A block starts with a Row = -2
      sentinel row that carries no rate and is skipped, along with anything
      else outside the real 1-100 range, rather than trusting -2 as the only
      possible non-data value. */
  function ingestPermLifeWorkbook(wb, bytes, fileName) {
    var ws = wb.Sheets[PERM_LIFE_SHEET];
    if (!ws) {
      permLifeMeta = { fileName: fileName, count: 0, missingSheet: true };
      renderStatus();
      toast('Loaded "' + fileName + '", but couldn\'t find sheet "' + PERM_LIFE_SHEET + '".', 'err');
      return;
    }

    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    var table = {}, n = 0;
    for (var r = 1; r < rows.length; r++) {              // row 0 is the header row
      var row = rows[r];
      if (!row || row[3] === null || row[3] === '') continue;   // ColD, Axis Key
      var rowNum = Number(row[4]);                               // ColE, Age + 1
      if (!isFinite(rowNum) || rowNum < 1 || rowNum > 100) continue;   // skips the -2 sentinel, any junk
      var v = row[6];                                            // ColG, the rate
      if (v === null || v === undefined || v === '') continue;
      var axisKey = String(row[3]).trim(), age = rowNum - 1;
      if (!(axisKey in table)) { table[axisKey] = {}; }
      table[axisKey][age] = Number(v);
      n++;
    }

    permLifeTable = table;
    permLifeMeta = { fileName: fileName, count: n, missingSheet: false };
    persistRates('permLife', bytes, fileName);
    renderRatesTab();
    renderStatus();
    toast('Loaded "' + fileName + '" — ' + n + ' rate row(s).');
  }

  /** The two lookups this whole file exists to provide — not called by the
      UI yet (§ file header: the Axis Key input isn't available for either
      category), but fully working and exercised by each ingest function's
      own row counts, cross-checked against a locally-built sample workbook
      shaped exactly like the real ones. Both return null for "no such row"
      — never a guessed or defaulted figure. */
  function lookupTermLifeRate(suffix, axisKey, age) {
    var table = termLifeTables[suffix];
    if (!table) return null;
    var ages = table[axisKey];
    if (!ages || !(age in ages)) return null;
    return ages[age];
  }
  function lookupPermLifeRate(axisKey, age) {
    var ages = permLifeTable[axisKey];
    if (!ages || !(age in ages)) return null;
    return ages[age];
  }

  // ---------------------------------------------------------------- file I/O
  function handleFilePicked(file) {
    var reader = new FileReader();
    reader.onload = function () { detectAndIngest(new Uint8Array(reader.result), file.name); };
    reader.onerror = function () { toast('Could not read that file.', 'err'); };
    reader.readAsArrayBuffer(file);
  }

  /** fetch() a local relative file only works when this page is served over
      http(s) (a local dev server, per OPTIMIZER_REFERENCE.md's own "Running
      it" section) — opened directly via file:// (the tool's other, equally
      supported mode, §0 rule 1), Chromium blocks it outright. Degrades to a
      calm status message rather than a scary error either way; the file
      picker above always works regardless of which mode this page is
      running in. Tries both known files independently — one succeeding
      doesn't depend on the other existing. */
  function loadFromRatesFolder() {
    [[TERM_LIFE_FILE_PATH, TERM_LIFE_FILENAME], [PERM_LIFE_FILE_PATH, PERM_LIFE_FILENAME]].forEach(function (pair) {
      var path = pair[0], name = pair[1];
      fetch(path).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      }).then(function (buf) {
        detectAndIngest(new Uint8Array(buf), name);
      }).catch(function (err) {
        toast('Could not auto-load "' + path + '" (' + err.message + '). This only works when the tool is ' +
          'served over http(s), not opened directly from disk — use Import Rates File to pick it manually.', 'err');
      });
    });
  }

  // ------------------------------------------------------------ persistence
  /* Raw file bytes, not the parsed lookup table, are what's cached — smaller
     (XLSX is already zip-compressed; a full JSON dump of every cell would
     likely be larger) and a single source of truth: a future fix to the
     parsing logic above applies automatically on next load instead of
     needing the cache invalidated by hand. Per your answer: persist via
     localStorage; if a file is too big for its quota, fall back to
     session-only with a clear message rather than fail silently. */
  var STORAGE_KEY = 'coverage-optimizer-rates';

  function bytesToBase64(bytes) {
    var CHUNK = 0x8000, parts = [];
    for (var i = 0; i < bytes.length; i += CHUNK) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
    }
    return btoa(parts.join(''));
  }
  function base64ToBytes(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /** `kind` is 'termLife' or 'permLife' — each keeps its own entry under the
      one storage key rather than the two overwriting each other, so
      importing a fresh Term Life file doesn't wipe an already-loaded
      Permanent Life one (or vice versa). */
  function persistRates(kind, bytes, fileName) {
    try {
      var existing = {};
      try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (e2) { existing = {}; }
      existing[kind] = { fileName: fileName, base64: bytesToBase64(bytes) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
      toast('"' + fileName + '" is loaded for this session, but too large to remember across a reload ' +
        '(' + e.message + ') — you\'ll need to re-import it next time you open the tool.', 'err');
    }
  }

  function restorePersistedRates() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
    if (!raw) return;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return; }
    ['termLife', 'permLife'].forEach(function (kind) {
      var entry = parsed && parsed[kind];
      if (!entry || !entry.base64) return;
      try { detectAndIngest(base64ToBytes(entry.base64), entry.fileName); }
      catch (e) { /* corrupt cache — ignore; operator re-imports */ }
    });
  }

  // ---------------------------------------------------------------- status
  var toastTimer = null;
  /* No shared toast() on the bridge — same call as optimizer_history.js
     (§ its own file header): cheaper as a small local copy than a bridge
     accessor every split-off tab would otherwise need to request. */
  function toast(msg, kind) {
    var n = $('toast');
    n.textContent = msg;
    n.className = 'toast show' + (kind ? ' toast--' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.className = 'toast'; }, kind === 'err' ? 5000 : 3000);
  }

  /** The PERSISTENT "what's currently loaded" summary (two lines, one per
      category) — separate from toast()'s transient "here's what just
      happened" feedback for the one action that just ran. Rebuilt from
      termLifeMeta/permLifeMeta after every ingest attempt, success or not,
      so it always reflects real current state. */
  function renderStatus() {
    var el = $('ratesStatus');
    if (!el) return;

    var termLine, warn = false;
    if (!termLifeMeta) {
      termLine = 'Term Life: no file loaded yet.';
    } else if (termLifeMeta.missingSheets.length) {
      termLine = 'Term Life: "' + termLifeMeta.fileName + '" — missing sheet(s) ' + termLifeMeta.missingSheets.join(', ') + '.';
      warn = true;
    } else {
      var total = TERM_LIFE_DURATIONS.reduce(function (s, suf) { return s + (termLifeMeta.counts[suf] || 0); }, 0);
      termLine = 'Term Life: "' + termLifeMeta.fileName + '" — ' + total + ' row(s) across ' + TERM_LIFE_DURATIONS.length + ' sheets.';
    }

    var permLine;
    if (!permLifeMeta) {
      permLine = 'Permanent Life: no file loaded yet.';
    } else if (permLifeMeta.missingSheet) {
      permLine = 'Permanent Life: "' + permLifeMeta.fileName + '" — missing sheet "' + PERM_LIFE_SHEET + '".';
      warn = true;
    } else {
      permLine = 'Permanent Life: "' + permLifeMeta.fileName + '" — ' + permLifeMeta.count + ' row(s).';
    }

    el.innerHTML = core.esc(termLine) + '<br>' + core.esc(permLine);
    el.className = 'rate-status' + (warn ? ' rate-status--warn' : '');
  }

  // ---------------------------------------------------------------- render
  function dashCell(extraClass) {
    return '<td class="r' + (extraClass ? ' ' + extraClass : '') + '"><span class="muted" title="Not calculated yet">—</span></td>';
  }

  /** LEFT table: Rate Band Code + one 4-column group per insured actually
      assigned to this coverage (an empty "— Select —" slot contributes no
      group — nothing to look up yet). Every data cell is pending (§ file
      header) regardless of category. */
  function insuredRatesTable(c, slots) {
    var headGroup = '<th rowspan="2" class="r">Rate Band Code</th>' + slots.map(function (s, i) {
      var ins = core.findInsured(s.insuredId);
      var label = 'Insured ' + (i + 1) + (ins ? ' — ' + core.esc(ins.name) : '');
      return '<th colspan="4" class="r' + (i > 0 ? ' col-soft-sep' : '') + '">' + label + '</th>';
    }).join('');
    var headSub = slots.map(function (s, i) {
      return ['PR_' + (i + 1), 'EPR_' + (i + 1), 'PR_BD_' + (i + 1), 'EPR_BD_' + (i + 1)]
        .map(function (l, j) { return '<th class="r' + (j === 0 && i > 0 ? ' col-soft-sep' : '') + '">' + l + '</th>'; })
        .join('');
    }).join('');

    var bandRows = BAND_TABLES[c.category].map(function (b) {
      var cells = slots.map(function (s, i) {
        return [0, 1, 2, 3].map(function (j) {
          return core.pendingCell(j === 0 && i > 0 ? 'col-soft-sep' : null);
        }).join('');
      }).join('');
      return '<tr><td class="r">' + core.esc(b.code) + '</td>' + cells + '</tr>';
    }).join('');

    return '<table class="ins rate-tab-table">' +
        '<thead><tr>' + headGroup + '</tr><tr>' + headSub + '</tr></thead>' +
        '<tbody>' + bandRows + '</tbody>' +
      '</table>';
  }

  /** RIGHT table: Total (muted "—" — sum formula known, blocked on the
      pending PR_i/EPR_i inputs) / BD_Total (same) / BD_Final (amber pending
      — its own formula isn't final yet, § file header). Always the same 9
      columns regardless of how many insureds are on the coverage. */
  function totalsRatesTable(c) {
    var GROUPS = [
      { label: 'Total', cols: ['PR_Total', 'EPR_Total', 'PEP_Total'], pending: false },
      { label: 'BD_Total', cols: ['PR_BD_Total', 'EPR_BD_Total', 'PEP_BD_Total'], pending: false },
      { label: 'BD_Final', cols: ['PR_BD_Final', 'EPR_BD_Final', 'PEP_BD_Final'], pending: true }
    ];
    var headGroup = GROUPS.map(function (g, gi) {
      return '<th colspan="3" class="r' + (gi > 0 ? ' col-hard-sep' : '') + '">' + g.label + '</th>';
    }).join('');
    var headSub = GROUPS.map(function (g, gi) {
      return g.cols.map(function (l, j) {
        return '<th class="r' + (j === 0 && gi > 0 ? ' col-hard-sep' : '') + '">' + l + '</th>';
      }).join('');
    }).join('');

    var bandRows = BAND_TABLES[c.category].map(function () {
      return '<tr>' + GROUPS.map(function (g, gi) {
        return g.cols.map(function (l, j) {
          var extra = (j === 0 && gi > 0) ? 'col-hard-sep' : null;
          return g.pending ? core.pendingCell(extra) : dashCell(extra);
        }).join('');
      }).join('') + '</tr>';
    }).join('');

    return '<table class="ins rate-tab-table">' +
        '<thead><tr>' + headGroup + '</tr><tr>' + headSub + '</tr></thead>' +
        '<tbody>' + bandRows + '</tbody>' +
      '</table>';
  }

  function coverageRatesCard(c) {
    var title = core.esc(core.coverageTitle(c));
    if (!BAND_TABLES[c.category]) {
      return '<div class="card card--out">' +
          '<div class="card-head card-head--band"><span class="card-title">' + title + '</span></div>' +
          '<div class="proj-slot"><div class="t">' + title + '</div>' +
            '<div class="s">Rates for this Coverage Category aren\'t built yet.</div></div>' +
        '</div>';
    }
    var slots = c.insureds.filter(function (s) { return s.insuredId; });
    var bandCount = BAND_TABLES[c.category].length;
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band">' +
          '<span class="card-title">' + title + '</span>' +
          '<span class="card-note">' + bandCount + ' rate band' + (bandCount === 1 ? '' : 's') + '</span>' +
        '</div>' +
        '<div class="rate-body">' +
          '<div class="rate-scroll table-scroll-wrap">' + insuredRatesTable(c, slots) + '</div>' +
          '<div class="rate-fixed">' + totalsRatesTable(c) + '</div>' +
        '</div>' +
      '</div>';
  }

  function renderRatesTab() {
    if (!$('ratesCoverageList')) return;   // not built yet — see init() ordering
    var list = core.coverages();
    $('ratesCoverageList').innerHTML = list.length
      ? list.map(coverageRatesCard).join('')
      : '<div class="card"><div class="proj-slot"><div class="s">No coverages yet — add one in Coverage Input.</div></div></div>';
  }

  function ratesTabShell() {
    return '<div class="card">' +
        '<div class="card-body">' +
          '<div class="rate-import-bar">' +
            '<button class="btn btn--sm" id="btnImportRates" type="button" ' +
              'title="Pick a .xlsx file — Term Life or Permanent Life is detected automatically from its own sheet names">' +
              'Import Rates File</button>' +
            '<button class="btn btn--sm" id="btnLoadDefaultRates" type="button" ' +
              'title="Tries ' + core.esc(TERM_LIFE_FILE_PATH) + ' and ' + core.esc(PERM_LIFE_FILE_PATH) + '">' +
              'Load from ' + core.esc(RATES_FOLDER) + '/</button>' +
            '<input type="file" id="ratesFileInput" accept=".xlsx" hidden>' +
          '</div>' +
          '<div class="rate-status muted" id="ratesStatus">Term Life: no file loaded yet.<br>Permanent Life: no file loaded yet.</div>' +
        '</div>' +
      '</div>' +
      '<div id="ratesCoverageList"></div>';
  }

  function initRatesTab() {
    $('ratesTabHost').innerHTML = ratesTabShell();
    renderRatesTab();
    restorePersistedRates();   // may call detectAndIngest -> renderRatesTab + renderStatus again

    $('ratesTabHost').addEventListener('click', function (e) {
      if (e.target.id === 'btnImportRates') $('ratesFileInput').click();
      else if (e.target.id === 'btnLoadDefaultRates') loadFromRatesFolder();
    });
    $('ratesFileInput').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) handleFilePicked(file);
      e.target.value = '';
    });

    // Adding/removing/editing a coverage or insured all flow through this —
    // keeps the container list and each one's insured groups in step.
    core.onChange(renderRatesTab);
  }

  initRatesTab();
})();
