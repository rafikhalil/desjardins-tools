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
 * Importing is CHUNKED, not one synchronous pass: a real rate workbook —
 * now that Term Life keeps every Duration 1-100, not just 1 (§ below) — is
 * big enough that parsing it in one go would freeze the tab for a visible
 * moment. ingestTermLifeWorkbook()/ingestPermLifeWorkbook() process rows in
 * batches (processRowsChunked(), ROW_CHUNK per tick) via setTimeout(…, 0)
 * between batches, driving a real progress bar (#rateProgress) — sheet N of
 * 6 and row X/Y for Term Life, row X/Y for Permanent Life's one sheet — so
 * the operator sees what's happening rather than a frozen page. One import
 * runs at a time; concurrent requests (e.g. "Load from rates/" firing off
 * both files at once) queue rather than collide (§ importQueue).
 *
 * One container per coverage. Per the request: each coverage's card splits
 * into TWO table regions sharing one row axis (the Coverage Category's fixed
 * rate bands) —
 *   - LEFT, scrollable: one 6-column group per insured on that coverage
 *     (PR_i / EPR_i / PEP_i / PR_BD_i / EPR_BD_i / PEP_BD_i), light separators
 *     between insureds; the Rate Band Code column stays pinned at the left.
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
 *     there's one drop point instead of a button per category. Term Life
 *     keeps every Duration 1-100 it finds, not just Duration 1 — only
 *     Duration 1 is read anywhere today (§ lookupTermLifeRate's own default),
 *     but a later feature needing another duration won't need a re-import.
 *   - PR_i / PR_BD_i are wired (baseRateResult(), § below) — the ported old
 *     workbook formula: Term Life always uses the individual insured's own
 *     Age Nearest/Last (Calculated) at Duration 1; Permanent Life uses that
 *     same age unless Coverage Type is Joint First-to-Die/Joint Last-to-Die,
 *     which needs a joint age ("perm_joint_age" in the old formula) that
 *     isn't computed anywhere yet — those two stay core.pendingCell(). PR_BD_i
 *     is the identical lookup at (Age Nearest/Last Calculated - 1); this is
 *     NOT a real backdated age from the Backdate tab (§9 invariant #39 still
 *     applies — the two tabs stay unwired). A lookup that runs but can't
 *     resolve a number (no Axis Key yet, no rate file loaded, no matching
 *     row, no birthdate) renders core's the new .cell-error "Error" cell,
 *     not a silent blank — the old formula's IFERROR(...;"") reinterpreted
 *     as a visible failure rather than a blank one.
 *   - TODO: Joint Last-to-Die, Paid-up 1st Death (JLTDPU) was added to the
 *     original workbook after this formula was written and was likely never
 *     folded into the joint-age branch — revisit once Joint Age exists.
 *     Today JLTDPU behaves like Individual (own age, not joint), same as the
 *     old formula.
 *   - EPR_i / EPR_BD_i are wired too (extraRateResult(), § below). Term Life:
 *     EPR_N is simply PR_N, for every Term Life coverage (T10-T65),
 *     Individual or Joint First-to-Die. Permanent Life, Individual: the
 *     SUBSTANDARD rate — the insured's own Axis Key with its first 3
 *     characters ("DT_") replaced by "DTS" (S = Substandard), looked up in
 *     the same perm_rates workbook by that key and the insured's Age
 *     Nearest/Last (Calculated), exactly like PR_N; EPR_BD_i is the same
 *     lookup at age - 1. Same Error/pending conventions as PR_i above.
 *   - TODO: Permanent Life EPR_i/EPR_BD_i for Joint First-to-Die / Joint
 *     Last-to-Die / Joint Last-to-Die, Paid-up 1st Death — the substandard
 *     lookup for joint coverages isn't specified yet ("come back to it
 *     later"), so those three stay core.pendingCell(). Unlike PR_i, JLTDPU
 *     does NOT fall through to the individual lookup here.
 *   - PEP_i / PEP_BD_i (pepResult(), § below): the insured's "Perm Extra
 *     Prem. %" (the Insureds tab's column, slot.extraPct — a percentage, so
 *     100 means x1.00) times EPR_i / EPR_BD_i. Permanent Life joint coverages
 *     name the Insureds tab's "Joint Extra Prem. %" instead, but the request
 *     says it's the same value, so there is one % to read for every case.
 *     Pending/Error exactly when the EPR it's built on is — so the three
 *     Permanent Life joint types stay pending until their EPR exists.
 *   - PR_BD_Final/EPR_BD_Final/PEP_BD_Final's own formulas are still coming
 *     (you said "refer to the Backdate tab" for what counts as backdatable,
 *     but the exact formula itself isn't final) — pending regardless of
 *     whether the rest of a row is ever filled in.
 *   - PR_Total/EPR_Total/PEP_Total and the BD_Total trio (totalResult(), §
 *     below) are the SUM of the matching per-insured column: every insured
 *     for Term Life (Individual, Joint First-to-Die) and Permanent Life
 *     Individual; Insured 1 alone (PR_Total = PR_1, …) for Permanent Life
 *     Joint First-to-Die / Joint Last-to-Die / JLTDPU. An Error in any
 *     counted cell makes the total an Error (never a partial sum); a pending
 *     one — or no insured on the coverage yet — leaves the page's other
 *     "blocked on missing upstream data" convention (plain muted "—", not
 *     amber): the SUM formula is specified, only its inputs are missing.
 *     Matches how Results' own "Modal Premium" is treated (§ optimizer.js
 *     Results).
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
  /* termLifeTables[suffix][axisKey][duration][age] = rate. Every Duration
     1-100 is kept, not just Duration 1 — only Duration 1 is actually READ
     anywhere today, but re-importing the whole workbook once a later
     feature needs another duration is wasteful when it's no harder to keep
     all of it the first time. Populated by ingestTermLifeWorkbook(); empty
     until a file is loaded (fresh session) or restored from IndexedDB
     (§ persistence, below). */
  var termLifeTables = {};
  var termLifeMeta = null;   // { fileName, counts: {suffix: rowCount}, missingSheets: [] }

  /* permLifeTable[axisKey][age] = rate — one flat table, no per-product
     split (§ file header: Permanent Life is one sheet, every WL product's
     rows distinguished only by Axis Key) and no duration axis to begin with
     (ColE is Age directly, not a policy-year duration like Term Life's) —
     every row already gets kept. */
  var permLifeTable = {};
  var permLifeMeta = null;   // { fileName, count: rowCount, missingSheet: bool }

  /* Rows processed per UI-yielding tick while importing. A real workbook —
     especially now that every Duration is kept, not just 1 — can be big
     enough that parsing it in one synchronous pass would freeze the tab for
     a visible moment; chunking with a setTimeout(…, 0) between batches lets
     the browser repaint the progress bar and stay responsive in between. */
  var ROW_CHUNK = 500;

  /** Runs `onRow(row)` over `rows[1..]` (row 0 is always the header) in
      ROW_CHUNK batches, yielding between them. `onProgress(done, total)`
      fires after each batch; `onDone()` fires once every row has been
      visited (or immediately, if there were no data rows at all). */
  function processRowsChunked(rows, onRow, onProgress, onDone) {
    var total = Math.max(rows.length - 1, 0);
    if (!total) { onDone(); return; }
    var r = 1;
    function step() {
      var end = Math.min(r + ROW_CHUNK, rows.length);
      for (; r < end; r++) onRow(rows[r]);
      onProgress(r - 1, total);
      if (r < rows.length) setTimeout(step, 0);
      else onDone();
    }
    step();
  }

  /* One import at a time, queued rather than rejected — "Load from rates/"
     (below) fires off Term Life and Permanent Life together, and
     restorePersistedRates() does the same on startup; both legitimately
     need to run, just not at once (they'd fight over the one progress bar).
     Each job runs to completion, including its own persistRates()/
     renderRatesTab()/renderStatus() calls, before the next one starts. */
  var importQueue = [];
  var importing = false;

  /** Reads the bytes as a workbook and routes to the right ingester by
      looking at its OWN sheet names — "temp_rates_" -> Term Life,
      "perm_rates_" -> Permanent Life — rather than a second button/picker
      per category. One file, one drop point; the workbook says what it is. */
  function detectAndIngest(bytes, fileName) {
    importQueue.push({ bytes: bytes, fileName: fileName });
    if (!importing) runNextImport();
  }

  function runNextImport() {
    if (!importQueue.length) return;
    var job = importQueue.shift();
    importing = true;
    setImportButtonsDisabled(true);
    showProgress('Reading "' + job.fileName + '"…', 0);

    // Yield one tick before the (still synchronous) XLSX.read() itself, so
    // the "Reading…" state actually paints before that call blocks the
    // thread — the finer-grained chunked progress below covers the rest.
    setTimeout(function () {
      var wb;
      try { wb = XLSX.read(job.bytes, { type: 'array' }); }
      catch (e) {
        toast('Could not read "' + job.fileName + '" as an Excel file (' + e.message + ').', 'err');
        afterImport();
        return;
      }

      var isTermLife = wb.SheetNames.some(function (n) { return /^temp_rates_/i.test(n); });
      var isPermLife = wb.SheetNames.some(function (n) { return /^perm_rates_/i.test(n); });

      if (isTermLife) ingestTermLifeWorkbook(wb, job.bytes, job.fileName, afterImport);
      else if (isPermLife) ingestPermLifeWorkbook(wb, job.bytes, job.fileName, afterImport);
      else {
        toast('"' + job.fileName + '" doesn\'t look like a Term Life or Permanent Life rate workbook ' +
          '(expected a sheet name starting with "temp_rates_" or "perm_rates_").', 'err');
        afterImport();
      }
    }, 0);
  }

  function afterImport() {
    importing = false;
    hideProgress();
    runNextImport();
    if (!importing) setImportButtonsDisabled(false);
  }

  /** Parses one Term Life workbook per the exact layout described: for each
      of the 6 known sheets, ColD = Axis Key, ColE = Duration (every 1-100
      kept, § termLifeTables above), ColG..ColDB = age 0..99 (100 columns,
      0-based offset from ColG). Column arithmetic: ColA=0 ... ColG=6 ...
      ColDB=105 (6+100-1), ColDC=106 (Scenario, ignored). Sheets are visited
      one at a time (not Promise.all — a real workbook is more valuable read
      correctly than fast, and staying sequential keeps memory/CPU bounded
      to one sheet at a time); `done` fires after the last one, success or not. */
  function ingestTermLifeWorkbook(wb, bytes, fileName, done) {
    var tables = {}, counts = {}, missing = [];
    var sheetIdx = 0;

    function nextSheet() {
      if (sheetIdx >= TERM_LIFE_DURATIONS.length) { finish(); return; }
      var suffix = TERM_LIFE_DURATIONS[sheetIdx];
      var sheetName = 'temp_rates_' + RATE_VERSION + '_' + suffix;
      var ws = wb.Sheets[sheetName];
      var label = 'Reading "' + fileName + '" — sheet ' + (sheetIdx + 1) + ' of ' + TERM_LIFE_DURATIONS.length + ' (' + sheetName + ')';
      showProgress(label, Math.round((sheetIdx / TERM_LIFE_DURATIONS.length) * 100));

      if (!ws) {
        missing.push(sheetName); tables[suffix] = {}; counts[suffix] = 0;
        sheetIdx++;
        setTimeout(nextSheet, 0);
        return;
      }

      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      var table = {}, n = 0;

      processRowsChunked(rows, function (row) {
        if (!row || row[3] === null || row[3] === '') return;      // ColD, Axis Key
        var duration = Number(row[4]);                              // ColE, Duration
        if (!isFinite(duration) || duration < 1 || duration > 100) return;
        var axisKey = String(row[3]).trim();
        var ages = {};
        for (var c = 6; c <= 105; c++) {                            // ColG..ColDB = age 0..99
          var v = row[c];
          if (v === null || v === undefined || v === '') continue;
          ages[c - 6] = Number(v);
        }
        if (!(axisKey in table)) table[axisKey] = {};
        if (!(duration in table[axisKey])) n++;
        table[axisKey][duration] = ages;
      }, function (doneCount, total) {
        var overall = Math.round(((sheetIdx + doneCount / total) / TERM_LIFE_DURATIONS.length) * 100);
        showProgress(label + ' — ' + doneCount + '/' + total + ' rows', overall);
      }, function () {
        tables[suffix] = table;
        counts[suffix] = n;
        sheetIdx++;
        setTimeout(nextSheet, 0);
      });
    }

    function finish() {
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
      done();
    }

    nextSheet();
  }

  /** Permanent Life's own layout (much simpler — one sheet, one rate per
      row): ColD = Axis Key, ColE = Age + 1 ("Row" — e.g. Row 37 is age 36,
      Row 20 is age 19), ColG = the rate. A block starts with a Row = -2
      sentinel row that carries no rate and is skipped, along with anything
      else outside the real 1-100 range, rather than trusting -2 as the only
      possible non-data value. No duration axis here (§ permLifeTable
      above), so this is a single chunked pass, not the sheet-by-sheet
      staging Term Life needs. */
  function ingestPermLifeWorkbook(wb, bytes, fileName, done) {
    var ws = wb.Sheets[PERM_LIFE_SHEET];
    if (!ws) {
      permLifeMeta = { fileName: fileName, count: 0, missingSheet: true };
      renderStatus();
      toast('Loaded "' + fileName + '", but couldn\'t find sheet "' + PERM_LIFE_SHEET + '".', 'err');
      done();
      return;
    }

    showProgress('Reading "' + fileName + '"…', 0);
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    var table = {}, n = 0;

    processRowsChunked(rows, function (row) {
      if (!row || row[3] === null || row[3] === '') return;         // ColD, Axis Key
      var rowNum = Number(row[4]);                                   // ColE, Age + 1
      if (!isFinite(rowNum) || rowNum < 1 || rowNum > 100) return;    // skips the -2 sentinel, any junk
      var v = row[6];                                                // ColG, the rate
      if (v === null || v === undefined || v === '') return;
      var axisKey = String(row[3]).trim(), age = rowNum - 1;
      if (!(axisKey in table)) table[axisKey] = {};
      table[axisKey][age] = Number(v);
      n++;
    }, function (doneCount, total) {
      showProgress('Reading "' + fileName + '" — ' + doneCount + '/' + total + ' rows', Math.round((doneCount / total) * 100));
    }, function () {
      permLifeTable = table;
      permLifeMeta = { fileName: fileName, count: n, missingSheet: false };
      persistRates('permLife', bytes, fileName);
      renderRatesTab();
      renderStatus();
      toast('Loaded "' + fileName + '" — ' + n + ' rate row(s).');
      done();
    });
  }

  /** The two lookups this whole file exists to provide — not called by the
      UI yet (§ file header: the Axis Key input isn't available for either
      category), but fully working and exercised by each ingest function's
      own row counts, cross-checked against a locally-built sample workbook
      shaped exactly like the real ones. Both return null for "no such row"
      — never a guessed or defaulted figure. `duration` defaults to 1 — the
      only one anything reads today — but every duration that was in the
      file is there to pass explicitly once a later feature needs one. */
  function lookupTermLifeRate(suffix, axisKey, age, duration) {
    duration = duration || 1;
    var table = termLifeTables[suffix];
    if (!table) return null;
    var byDuration = table[axisKey];
    if (!byDuration) return null;
    var ages = byDuration[duration];
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
  /* Raw file bytes, not the parsed lookup table, are what's cached — a
     future fix to the parsing logic above applies automatically on next
     load instead of needing the cache invalidated by hand. IndexedDB, not
     localStorage: the Term Life workbook alone is ~22MB raw (~29MB once
     base64-encoded, which localStorage requires) — comfortably past most
     browsers' ~5-10MB per-origin localStorage quota, so every real import
     of it was silently failing to persist (a caught QuotaExceededError,
     falling back to the session-only toast below) even though the much
     smaller Permanent Life file (~800KB) persisted fine — exactly the
     "Perm Life survives a reload, Term Life doesn't" bug this was rewritten
     to fix. IndexedDB's quota is disk-space-based (typically hundreds of MB
     or more) and stores binary data natively, so no base64 step is needed
     at all. Still falls back to a session-only toast, not a silent
     failure, if IndexedDB itself is unavailable or a write still fails. */
  var DB_NAME = 'coverage-optimizer-db', DB_STORE = 'rates';
  var dbPromise = null;

  function openRatesDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB is not available in this browser.')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Could not open the local rates database.')); };
    });
    return dbPromise;
  }

  /** `kind` is 'termLife' or 'permLife' — each keeps its own key so
      importing a fresh Term Life file doesn't wipe an already-loaded
      Permanent Life one (or vice versa). Fire-and-forget: a failure here
      only affects whether this file survives a reload, never the current
      session's own ingestion (already done by the time this is called). */
  function persistRates(kind, bytes, fileName) {
    openRatesDb().then(function (db) {
      var tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put({ fileName: fileName, bytes: bytes }, kind);
      tx.onerror = function () {
        toast('"' + fileName + '" is loaded for this session, but could not be remembered across a reload ' +
          '(' + (tx.error && tx.error.message) + ').', 'err');
      };
    }).catch(function (err) {
      toast('"' + fileName + '" is loaded for this session, but too large to remember across a reload ' +
        '(' + err.message + ') — you\'ll need to re-import it next time you open the tool.', 'err');
    });
  }

  function restorePersistedRates() {
    openRatesDb().then(function (db) {
      ['termLife', 'permLife'].forEach(function (kind) {
        var req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(kind);
        req.onsuccess = function () {
          var entry = req.result;
          if (!entry || !entry.bytes) return;
          try { detectAndIngest(entry.bytes, entry.fileName); }
          catch (e) { /* corrupt cache — ignore; operator re-imports */ }
        };
      });
    }).catch(function () { /* no IndexedDB available — operator re-imports manually */ });
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

  /** The loading bar itself — shown for the whole duration of an import
      (§ importQueue/runNextImport above), hidden again once the queue is
      empty. `pct` is 0-100; label names what's happening right now (which
      file, which sheet, how many rows) rather than leaving the operator
      staring at an unexplained bar. */
  function showProgress(label, pct) {
    var wrap = $('rateProgress');
    if (!wrap) return;
    wrap.hidden = false;
    $('rateProgressLabel').textContent = label;
    $('rateProgressBar').value = Math.max(0, Math.min(100, pct));
  }
  function hideProgress() {
    var wrap = $('rateProgress');
    if (wrap) wrap.hidden = true;
  }
  function setImportButtonsDisabled(disabled) {
    var a = $('btnImportRates'), b = $('btnLoadDefaultRates');
    if (a) a.disabled = disabled;
    if (b) b.disabled = disabled;
  }

  // ---------------------------------------------------------------- render
  function dashCell(extraClass) {
    return '<td class="r' + (extraClass ? ' ' + extraClass : '') + '"><span class="muted" title="Not calculated yet">—</span></td>';
  }

  /** A rate lookup that ran but could not produce a real number — no axis
      key yet (insured/rate not fully chosen), no rate file loaded, or no
      matching row in the workbook. Distinct from core.pendingCell(), which
      means "no formula coded here yet"; this one means the formula ran. */
  function errorCell(extraClass) {
    return '<td class="r cell-error' + (extraClass ? ' ' + extraClass : '') + '" title="Could not resolve a rate for this cell">Error</td>';
  }

  /** Age Real or Age Nearest, whichever the insured's own Age Calculation
      setting picks — same rule as everywhere else on this page (Insured
      Input, Coverage Input, the Insureds tab's own Age column). */
  function insuredAge(ins) {
    var ages = core.agesAt(ins.birthdate, core.settings.refDate);
    return ins.ageCalc === 'last' ? ages.real : ages.nearest;
  }

  /** The ported old-workbook PR_N formula (see chat / Lambda_Formulas.md for
      the original LET/CUBEVALUE version). `ageOffset` is 0 for PR_i, -1 for
      PR_BD_i — PR_BD_i is the exact same lookup at (Age Nearest/Last
      Calculated - 1), not a real backdated age (Backdate and Rates stay
      deliberately unwired, §9 invariant #39).
        - Term Life: always the individual insured's own age, Duration 1 —
          Coverage Type never matters for Term Life in the old formula.
        - Permanent Life, Joint First-to-Die / Joint Last-to-Die: the old
          formula needs a joint age ("perm_joint_age") that isn't computed
          anywhere yet (the Insureds tab's own "Joint Age" column is itself
          still pending) — left pending here too until that exists.
        - Permanent Life, everything else (Individual, JLTDPU, unset — see
          the JLTDPU TODO at the top of this file): the individual insured's
          own age, no duration axis.
      Returns { pending: true }, { error: true }, or { value: <rate> } —
      never a guessed number. */
  function baseRateResult(c, ins, slot, band, ageOffset) {
    if (c.category === 'permLife' && (c.covType === 'Joint First-to-Die' || c.covType === 'Joint Last-to-Die')) {
      return { pending: true };
    }
    if (!ins) return { error: true };
    var age = insuredAge(ins);
    if (age === null) return { error: true };
    age += ageOffset;
    var prefix = core.axisKeyPrefix(c, slot);
    if (!prefix) return { error: true };
    var axisKey = prefix + band.code;
    var rate;
    if (c.category === 'termLife') {
      var suffix = TERM_LIFE_COVERAGE_SUFFIX[c.coverage];
      if (!suffix) return { error: true };
      rate = lookupTermLifeRate(suffix, axisKey, age, 1);
    } else {
      rate = lookupPermLifeRate(axisKey, age);
    }
    if (rate === null) return { error: true };
    return { value: rate };
  }

  /** EPR_N / EPR_BD_N — the Extra Premium Rate. `ageOffset` works exactly
      like baseRateResult()'s (0 for EPR_i, -1 for EPR_BD_i).
        - Term Life: EPR_N is simply PR_N — every Term Life coverage
          (T10-T65), Individual or Joint First-to-Die alike — so this just
          returns baseRateResult()'s own result unchanged (a PR error is an
          EPR error too, never a separately guessed figure).
        - Permanent Life, Individual: the SUBSTANDARD rate — the insured's
          own Axis Key with its first 3 characters ("DT_") replaced by "DTS"
          (S = Substandard), looked up in the same perm_rates workbook by
          that key and the insured's Age Nearest/Last (Calculated), the same
          way PR_N is. (Substandard rows sit in the same sheet under their
          own "DTS…" Axis Keys, so ingestPermLifeWorkbook() already has them.)
        - Permanent Life, anything else (Joint First-to-Die, Joint
          Last-to-Die, Joint Last-to-Die Paid-up 1st Death): TODO — not
          specified yet ("come back to it later"), so pending. Unlike PR_N
          above, JLTDPU waits here too rather than using the individual
          lookup.
      Same { pending } / { error } / { value } return shape as
      baseRateResult() — never a guessed number. */
  function extraRateResult(c, ins, slot, band, ageOffset) {
    if (c.category === 'termLife') return baseRateResult(c, ins, slot, band, ageOffset);
    if (c.covType && c.covType !== 'Individual') return { pending: true };   // blank type falls through to the lookup → no Axis Key → Error
    if (!ins) return { error: true };
    var age = insuredAge(ins);
    if (age === null) return { error: true };
    age += ageOffset;
    var prefix = core.axisKeyPrefix(c, slot);
    if (!prefix) return { error: true };
    var rate = lookupPermLifeRate('DTS' + (prefix + band.code).slice(3), age);
    if (rate === null) return { error: true };
    return { value: rate };
  }

  /** PEP_N / PEP_BD_N — the insured's Perm Extra Prem. % (the Insureds tab's
      column, slot.extraPct; a percentage, hence / 100) times EPR_N /
      EPR_BD_N. Permanent Life joint coverages name "Joint Extra Prem. %"
      instead, but the request says it's the same value — one % to read.
      Pending or error exactly when the EPR it's built on is. */
  function pepResult(c, ins, slot, band, ageOffset) {
    var epr = extraRateResult(c, ins, slot, band, ageOffset);
    if (epr.pending || epr.error) return epr;
    return { value: epr.value * slot.extraPct / 100 };
  }

  /** One per-insured cell's result. `j` is the column's 0-5 position inside
      an insured's group — PR, EPR, PEP, then the same three at age - 1 — the
      index insuredRatesTable() and totalResult() both walk, so the two
      tables can't disagree on which lookup a column means. */
  function cellResult(c, ins, slot, band, j) {
    var ageOffset = j >= 3 ? -1 : 0;                                   // the backdated trio uses age - 1
    return j % 3 === 0 ? baseRateResult(c, ins, slot, band, ageOffset)     // PR_i / PR_BD_i
      : j % 3 === 1 ? extraRateResult(c, ins, slot, band, ageOffset)       // EPR_i / EPR_BD_i
      : pepResult(c, ins, slot, band, ageOffset);                          // PEP_i / PEP_BD_i
  }

  /** Total / BD_Total cell: the SUM of per-insured column `j` (cellResult()'s
      own index — 0-2 for Total, 3-5 for BD_Total) over the insureds that
      count. Term Life and Permanent Life Individual: all of them. Permanent
      Life Joint First-to-Die / Joint Last-to-Die / JLTDPU: Insured 1 alone
      (PR_Total = PR_1, and likewise EPR/PEP). Returns null when there's no
      insured to sum yet; an Error anywhere in the sum is an Error, else a
      pending anywhere is pending — never a partial sum. The raw rates are
      summed, only the display rounds. */
  function totalResult(c, slots, band, j) {
    var counted = c.category === 'permLife' && c.covType !== 'Individual' ? slots.slice(0, 1) : slots;
    if (!counted.length) return null;
    var sum = 0, pending = false;
    // ponytail: re-runs the lookups the left table already did — a handful of
    // property reads per cell; cache per render if a lookup ever gets costly.
    for (var i = 0; i < counted.length; i++) {
      var res = cellResult(c, core.findInsured(counted[i].insuredId), counted[i], band, j);
      if (res.error) return res;
      if (res.pending) pending = true;
      else sum += res.value;
    }
    return pending ? { pending: true } : { value: sum };
  }

  /** LEFT table: Rate Band Code + one 6-column group per insured actually
      assigned to this coverage (an empty "— Select —" slot contributes no
      group — nothing to look up yet): PR, EPR, PEP, then the same three at
      age - 1 (the backdated trio, tinted via `.rate-bd`). Every cell is
      cellResult(): PR via baseRateResult(), EPR via extraRateResult(), PEP
      via pepResult() (§ file header). */
  function insuredRatesTable(c, slots) {
    var headGroup = '<th rowspan="2" class="r rate-band-col">Rate Band Code</th>' + slots.map(function (s, i) {
      var ins = core.findInsured(s.insuredId);
      var label = 'Insured ' + (i + 1) + (ins ? ' — ' + core.esc(ins.name) : '');
      return '<th colspan="6" class="rate-grp' + (i > 0 ? ' col-soft-sep' : '') + '">' + label + '</th>';
    }).join('');
    var headSub = slots.map(function (s, i) {
      return ['PR_', 'EPR_', 'PEP_', 'PR_BD_', 'EPR_BD_', 'PEP_BD_']
        .map(function (l, j) {
          return '<th class="r' + (j === 0 && i > 0 ? ' col-soft-sep' : '') + (j >= 3 ? ' rate-bd' : '') + '">' + l + (i + 1) + '</th>';
        })
        .join('');
    }).join('');
    // No insureds → the second header row is empty and collapses to 0 height,
    // leaving the band rows one header row above the Totals table's. A hidden
    // filler cell in each header row keeps both tables' rows aligned.
    var ph = slots.length ? '' : '<th class="rate-ph">&nbsp;</th>';

    var bandRows = BAND_TABLES[c.category].map(function (b) {
      var cells = slots.map(function (s, i) {
        var ins = core.findInsured(s.insuredId);
        return [0, 1, 2, 3, 4, 5].map(function (j) {
          var extraClass = (j === 0 && i > 0) ? 'col-soft-sep' : (j >= 3 ? 'rate-bd' : null);
          var res = cellResult(c, ins, s, b, j);
          if (res.pending) return core.pendingCell(extraClass);
          if (res.error) return errorCell(extraClass);
          return '<td class="r' + (extraClass ? ' ' + extraClass : '') + '">' + core.esc(core.group(res.value, 2)) + '</td>';
        }).join('');
      }).join('');
      return '<tr><td class="r rate-band-col">' + core.esc(b.code) + '</td>' + cells + '</tr>';
    }).join('');

    return '<table class="ins rate-tab-table">' +
        '<thead><tr>' + headGroup + ph + '</tr><tr>' + headSub + ph + '</tr></thead>' +
        '<tbody>' + bandRows + '</tbody>' +
      '</table>';
  }

  /** RIGHT table: Total / BD_Total (the sums of totalResult() — a figure, a
      red Error, or the muted "—" while an input is missing; `first` is the
      group's opening column index for cellResult()) / BD_Final (amber
      pending — its own formula isn't final yet, § file header). Always the
      same 9 columns regardless of how many insureds are on the coverage;
      `slots` is the same assigned-insured list insuredRatesTable() gets. */
  function totalsRatesTable(c, slots) {
    var GROUPS = [
      { label: 'Total', cols: ['PR_Total', 'EPR_Total', 'PEP_Total'], first: 0, pending: false },
      { label: 'BD_Total', cols: ['PR_BD_Total', 'EPR_BD_Total', 'PEP_BD_Total'], first: 3, pending: false, bd: true },
      { label: 'BD_Final', cols: ['PR_BD_Final', 'EPR_BD_Final', 'PEP_BD_Final'], pending: true }
    ];
    var headGroup = GROUPS.map(function (g, gi) {
      return '<th colspan="3" class="rate-grp' + (gi > 0 ? ' col-hard-sep' : '') + '">' + g.label + '</th>';
    }).join('');
    var headSub = GROUPS.map(function (g, gi) {
      return g.cols.map(function (l, j) {
        return '<th class="r' + (j === 0 && gi > 0 ? ' col-hard-sep' : '') + (g.bd ? ' rate-bd' : '') + '">' + l + '</th>';
      }).join('');
    }).join('');

    var bandRows = BAND_TABLES[c.category].map(function (b) {
      return '<tr>' + GROUPS.map(function (g, gi) {
        return g.cols.map(function (l, j) {
          var extra = [(j === 0 && gi > 0) ? 'col-hard-sep' : '', g.bd ? 'rate-bd' : ''].join(' ').trim();
          if (g.pending) return core.pendingCell(extra);
          var res = totalResult(c, slots, b, g.first + j);
          if (!res || res.pending) return dashCell(extra);
          if (res.error) return errorCell(extra);
          return '<td class="r' + (extra ? ' ' + extra : '') + '">' + core.esc(core.group(res.value, 2)) + '</td>';
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
            '<div class="s">' + (c.category ? 'Rates for this Coverage Category aren\'t built yet.'
            : 'Choose a Coverage Category in Coverage Input to see its rates.') + '</div></div>' +
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
          '<div class="rate-scroll">' + insuredRatesTable(c, slots) + '</div>' +
          '<div class="rate-fixed">' + totalsRatesTable(c, slots) + '</div>' +
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
          '<div class="rate-progress" id="rateProgress" hidden>' +
            '<div class="rate-progress-label" id="rateProgressLabel"></div>' +
            '<progress class="rate-progress-bar" id="rateProgressBar" max="100" value="0"></progress>' +
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
