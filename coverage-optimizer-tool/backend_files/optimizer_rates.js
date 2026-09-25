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
 * The rates load from rates/ on EVERY launch (initRatesTab → loadFromRatesFolder),
 * driving the pre-load page's status rows and bar (setRateState/showProgress;
 * optimizer_preload.js holds the tool back until both say Loaded). Nothing is
 * cached across launches on purpose: the files in rates/ are the source of truth.
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
 *     keeps every Duration 1-100 it finds — the tables read Duration 1, the
 *     Backdate Projection every later one (bandTotalsAtYear).
 *   - PR_i / PR_BD_i are wired (baseRateResult(), § below) — the ported old
 *     workbook formula: Term Life always uses the individual insured's own
 *     Age Nearest/Last (Calculated) at Duration 1; Permanent Life Individual
 *     the same age. Permanent Life Joint First-to-Die / Joint Last-to-Die /
 *     JLTDPU: the same lookup on the joint Axis Key (Joint Sex/Joint Rate)
 *     with the Joint Age of the coverage's Joint container (lookupAge) — the
 *     equivalent single age of the two insureds, calculated in optimizer.js
 *     (equivAge), not typed. PR_BD_i is the identical lookup at (age - 1); on
 *     a joint coverage it is Joint Age Backdated — equivAge re-run with each
 *     Backdate-Eligible insured a year younger (age - 1 is the confirmed
 *     production rule). A lookup that runs but can't resolve a number (no Axis
 *     Key yet, no rate file loaded, no matching row, no birthdate, no Joint Age)
 *     renders core's the new .cell-error "Error" cell, not a silent blank —
 *     the old formula's IFERROR(...;"") reinterpreted as a visible failure
 *     rather than a blank one.
 *   - EPR_i / EPR_BD_i are wired too (extraRateResult(), § below). Term Life:
 *     EPR_N is simply PR_N, for every Term Life coverage (T10-T65),
 *     Individual or Joint First-to-Die. Permanent Life: the SUBSTANDARD rate
 *     — the Axis Key (the insured's own; the joint one on JFTD/JLTD/JLTDPU)
 *     with its first 3 characters ("DT_") replaced by "DTS" (S = Substandard),
 *     looked up in the same perm_rates workbook by that key and the same age
 *     PR_N uses (the insured's own, or the Joint Age); EPR_BD_i is the same
 *     lookup at age - 1 / Joint Age Backdated.
 *   - PEP_i / PEP_BD_i (pepResult(), § below): a percentage (100 means x1.00)
 *     times EPR_i / EPR_BD_i — the insured's "Perm Extra Prem. %" (slot.
 *     extraPct), or on a joint Permanent Life coverage the Joint container's
 *     "Equiv. Substd. %". Error exactly when the EPR it's built on is, or
 *     when that % is still blank.
 *   - PR_BD_Final/EPR_BD_Final/PEP_BD_Final (finalResult(), § below): per
 *     insured, the current value (PR_N / EPR_N / PEP_N) unless the insured is
 *     Backdate Eligible (the Backdate tab's column, core.backdateEligible)
 *     AND the backdated value (…_BD_N) is strictly lower — then that one. Then
 *     summed exactly like Total (every insured, or Insured 1 alone on the
 *     joint Permanent Life types). An insured whose eligibility isn't known
 *     yet (blank birthdate) can't be decided — Error, never a guess.
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
  var RATES_FOLDER = 'rates';   // a sibling of backend_files/ (fetched as ../rates/…)
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
  /* The two 2017 Permanent products have their own band lists (no B00250 in either; WL to 100 adds
     B00001 = 1,000, Term to 100 adds B01000 = 1,000,000). bandsFor(c) is what every band lookup uses. */
  var LEGACY_BANDS = {
    'WL to 100': [
      { code: 'B00001', amount: 1000 }, { code: 'B00010', amount: 10000 }, { code: 'B00025', amount: 25000 },
      { code: 'B00050', amount: 50000 }, { code: 'B00100', amount: 100000 }, { code: 'B00500', amount: 500000 }
    ],
    'Term to 100': [
      { code: 'B00010', amount: 10000 }, { code: 'B00025', amount: 25000 }, { code: 'B00050', amount: 50000 },
      { code: 'B00100', amount: 100000 }, { code: 'B00500', amount: 500000 }, { code: 'B01000', amount: 1000000 }
    ]
  };
  function bandsFor(c) { return (c.category === 'permLife' && LEGACY_BANDS[c.coverage]) || BAND_TABLES[c.category]; }

  // ------------------------------------------------------------- workbook
  /* termLifeTables[suffix][axisKey][duration][age] = rate. Every Duration
     1-100 is kept: the tables read Duration 1, the Backdate Projection
     every later one (bandTotalsAtYear). Populated by ingestTermLifeWorkbook(); empty
     until a file is loaded (the pre-load page does that on every launch —
     loadFromRatesFolder(), below). */
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
     (below) fires off Term Life and Permanent Life together; both
     legitimately need to run, just not at once (they'd fight over the one
     progress bar). Each job runs to completion, including its own
     renderRatesTab()/renderStatus() calls, before the next one starts. */
  /* A rate-file problem for the top-bar message list (core.raise): one message per
     file (`kind`), replaced by the next attempt and cleared when that file
     loads cleanly. A manual import of an unrecognisable file has no kind. */
  function loadIssue(kind, msg) { core.raise('f:' + (kind || 'import'), 'Rates — ' + msg); }
  function loadFixed(kind) { core.resolve('f:' + kind); core.resolve('f:import'); }

  /** Rate cells that held text or an error (#N/A…) instead of a number: skipped, so
      their lookups are "no row" Errors — this says the file itself is the cause. */
  function skippedIssue(kind, fileName, n) {
    if (n) loadIssue(kind, '"' + fileName + '" loaded, but ' + n + ' rate cell(s) held text or an error instead of a number and were skipped — lookups that land on them will be an Error. Check the source workbook.');
  }

  var importQueue = [];
  var importing = false;
  var current = null;   // the job running now — afterImport() needs its `kind`

  /** Reads the bytes as a workbook and routes to the right ingester by
      looking at its OWN sheet names — "temp_rates_" -> Term Life,
      "perm_rates_" -> Permanent Life — rather than a second button/picker
      per category. One file, one drop point; the workbook says what it is.
      `kind` ('termLife'/'permLife') is only the pre-load page's expectation
      of which file this is (loadFromRatesFolder) — routing never trusts it. */
  function detectAndIngest(bytes, fileName, kind) {
    importQueue.push({ bytes: bytes, fileName: fileName, kind: kind });
    if (!importing) runNextImport();
  }

  function runNextImport() {
    if (!importQueue.length) return;
    var job = importQueue.shift();
    current = job;
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
        loadIssue(job.kind, 'could not read "' + job.fileName + '" as an Excel (.xlsx) file: ' + e.message + '. Re-export it or pick another file.');
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
        loadIssue(job.kind, '"' + job.fileName + '" isn\'t a Term Life or Permanent Life rate workbook — none of its sheets starts with "temp_rates_" or "perm_rates_" (its sheets: ' +
          wb.SheetNames.slice(0, 6).join(', ') + (wb.SheetNames.length > 6 ? ', …' : '') + ').');
        afterImport();
      }
    }, 0);
  }

  function afterImport() {
    importing = false;
    // Whatever went wrong (unreadable, wrong workbook, missing sheet), a file
    // the pre-load page was waiting on that never reached "Loaded" is "Not loaded".
    if (current && current.kind && $('plRate_' + current.kind).dataset.state === 'loading') setRateState(current.kind, 'notloaded');
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
    var tables = {}, counts = {}, missing = [], skipped = 0;
    var sheetIdx = 0;
    TERM_LIFE_DURATIONS.forEach(function (s) { setSheetState(s, 'notloaded'); });   // a fresh read: every sheet starts red

    function nextSheet() {
      if (sheetIdx >= TERM_LIFE_DURATIONS.length) { finish(); return; }
      var suffix = TERM_LIFE_DURATIONS[sheetIdx];
      var sheetName = 'temp_rates_' + RATE_VERSION + '_' + suffix;
      var ws = wb.Sheets[sheetName];
      var label = 'Reading "' + fileName + '" — sheet ' + (sheetIdx + 1) + ' of ' + TERM_LIFE_DURATIONS.length + ' (' + sheetName + ')';
      showProgress(label, Math.round((sheetIdx / TERM_LIFE_DURATIONS.length) * 100));
      setSheetState(suffix, 'loading');

      if (!ws) {
        missing.push(sheetName); tables[suffix] = {}; counts[suffix] = 0;
        setSheetState(suffix, 'notloaded');
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
          if (!isFinite(Number(v))) { skipped++; continue; }           // text / #N/A — a hole, not a NaN rate
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
        setSheetState(suffix, n ? 'loaded' : 'notloaded');
        sheetIdx++;
        setTimeout(nextSheet, 0);
      });
    }

    function finish() {
      termLifeTables = tables;
      termLifeMeta = { fileName: fileName, counts: counts, missingSheets: missing };
      setRateState('termLife', missing.length ? 'notloaded' : 'loaded');
      renderRatesTab();
      renderStatus();

      var total = TERM_LIFE_DURATIONS.reduce(function (s, suf) { return s + (counts[suf] || 0); }, 0);
      if (missing.length) {
        toast('Loaded "' + fileName + '", but couldn\'t find sheet(s): ' + missing.join(', ') + '.', 'err');
        loadIssue('termLife', '"' + fileName + '" is missing sheet(s) ' + missing.join(', ') + ' — Term Life rates stay "Not loaded" until the file has all ' + TERM_LIFE_DURATIONS.length + ' sheets.');
      } else if (!total) {
        setRateState('termLife', 'notloaded');
        toast('"' + fileName + '" has no usable rate rows.', 'err');
        loadIssue('termLife', '"' + fileName + '" has the right sheets but no usable rate rows — expected the Axis Key in column D, the Duration (1-100) in column E and the rates from column G.');
      } else {
        toast('Loaded "' + fileName + '" — ' + total + ' rate row(s) across ' + TERM_LIFE_DURATIONS.length + ' sheets.');
        loadFixed('termLife');
        skippedIssue('termLife', fileName, skipped);
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
      setRateState('permLife', 'notloaded');
      renderStatus();
      toast('Loaded "' + fileName + '", but couldn\'t find sheet "' + PERM_LIFE_SHEET + '".', 'err');
      loadIssue('permLife', '"' + fileName + '" has no sheet named "' + PERM_LIFE_SHEET + '" — Permanent Life rates stay "Not loaded".');
      done();
      return;
    }

    showProgress('Reading "' + fileName + '"…', 0);
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    var table = {}, n = 0, skipped = 0;

    processRowsChunked(rows, function (row) {
      if (!row || row[3] === null || row[3] === '') return;         // ColD, Axis Key
      var rowNum = Number(row[4]);                                   // ColE, Age + 1
      if (!isFinite(rowNum) || rowNum < 1 || rowNum > 100) return;    // skips the -2 sentinel, any junk
      var v = row[6];                                                // ColG, the rate
      if (v === null || v === undefined || v === '') return;
      var axisKey = String(row[3]).trim(), age = rowNum - 1;
      if (!(axisKey in table)) table[axisKey] = {};
      if (!isFinite(Number(v))) { skipped++; return; }               // text / #N/A — a hole, not a NaN rate
      table[axisKey][age] = Number(v);
      n++;
    }, function (doneCount, total) {
      showProgress('Reading "' + fileName + '" — ' + doneCount + '/' + total + ' rows', Math.round((doneCount / total) * 100));
    }, function () {
      permLifeTable = table;
      permLifeMeta = { fileName: fileName, count: n, missingSheet: false };
      setRateState('permLife', n ? 'loaded' : 'notloaded');
      renderRatesTab();
      renderStatus();
      if (n) {
        toast('Loaded "' + fileName + '" — ' + n + ' rate row(s).');
        loadFixed('permLife');
        skippedIssue('permLife', fileName, skipped);
      } else {
        toast('"' + fileName + '" has no usable rate rows.', 'err');
        loadIssue('permLife', '"' + fileName + '" has the right sheet but no usable rate rows — expected the Axis Key in column D, Age + 1 (1-100) in column E and the rate in column G.');
      }
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
    reader.onerror = function () { toast('Could not read that file.', 'err'); loadIssue(null, 'could not read "' + file.name + '" from disk.'); };
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
    [['termLife', TERM_LIFE_FILE_PATH, TERM_LIFE_FILENAME], ['permLife', PERM_LIFE_FILE_PATH, PERM_LIFE_FILENAME]].forEach(function (f) {
      var kind = f[0], path = f[1], name = f[2];
      setRateState(kind, 'loading');
      fetch('../' + path).then(function (res) {   // the page lives in backend_files/, rates/ is its sibling
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      }).then(function (buf) {
        detectAndIngest(new Uint8Array(buf), name, kind);
      }).catch(function (err) {
        setRateState(kind, 'notloaded');
        $('plLabel').textContent = 'Could not load "' + path + '" (' + err.message + ') — check the file is in ' + RATES_FOLDER + '/, then Retry.';
        toast('Could not load "' + path + '" (' + err.message + ') — check the file is in ' + RATES_FOLDER +
          '/ and the tool was started with _start-coverage-optimizer.bat.', 'err');
        loadIssue(kind, 'could not load "' + path + '" (' + err.message + '). Check the file is in the ' + RATES_FOLDER +
          '/ folder (next to backend_files/) and that the tool was started with _start-coverage-optimizer.bat (a page opened straight from disk can\'t read it).');
      });
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

  /** The loading bar itself — shown for the whole duration of an import
      (§ importQueue/runNextImport above), hidden again once the queue is
      empty. `pct` is 0-100; label names what's happening right now (which
      file, which sheet, how many rows) rather than leaving the operator
      staring at an unexplained bar. */
  function showProgress(label, pct) {
    var v = Math.max(0, Math.min(100, pct));
    $('plLabel').textContent = label;                 // the pre-load page's own bar (optimizer.html)
    $('plBar').value = v;
    var wrap = $('rateProgress');
    if (!wrap) return;
    wrap.hidden = false;
    $('rateProgressLabel').textContent = label;
    $('rateProgressBar').value = v;
  }

  /* The pre-load page's per-file status rows (#plRate_<kind>, optimizer.html):
     `data-state` drives the red / yellow / green marker (optimizer_preload.css).
     'ratesstatus' tells optimizer_preload.js to re-check its Start gate. */
  var RATE_STATE_TEXT = { notloaded: 'Not loaded', loading: 'Loading', loaded: 'Loaded' };
  /* One line per Term Life sheet under the Term Life row (#plSheets, "Term 10" … "Term 65"),
     red → yellow → green as ingestTermLifeWorkbook reads each one. Progress detail only —
     the Start gate watches the two `.pl-rate` file rows, not these. */
  function setSheetState(suffix, state) {
    var row = $('plSheet_' + suffix);
    if (!row) return;
    row.dataset.state = state;
    row.querySelector('.pl-state').textContent = RATE_STATE_TEXT[state];
  }
  function setRateState(kind, state) {
    var row = $('plRate_' + kind);
    row.dataset.state = state;
    row.querySelector('.pl-state').textContent = RATE_STATE_TEXT[state];
    $('plRetry').disabled = !!document.querySelector('.pl-rate[data-state="loading"]');
    $('plRetry').hidden = !document.querySelector('.pl-rate[data-state="notloaded"]');   // only offered when something failed
    if (!document.querySelector('.pl-rate:not([data-state="loaded"])')) {
      $('plLabel').textContent = 'All rates loaded';
      $('plBar').value = 100;
    } else if (!document.querySelector('.pl-rate[data-state="loading"]')) {   // settled, but not all loaded
      $('plLabel').textContent = 'Not every rate file loaded — check rates/, then Retry.';
      $('plBar').value = 0;
    }
    document.dispatchEvent(new Event('ratesstatus'));
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
  function errorCell(extraClass, why) {
    return '<td class="r cell-error' + (extraClass ? ' ' + extraClass : '') + '" title="' + core.esc(why || 'Could not resolve a rate for this cell') + '">Error</td>';
  }

  /** A failed lookup, with the reason in words ({ error, why }): it goes to the
      cell's tooltip and, through ratesIssues() below, to the top-bar message. */
  function fail(why) { return { error: true, why: why }; }

  /** Why lookupAge() came back null. */
  function ageWhy(c, ins, ageOffset) {
    if (core.isJointPerm(c)) return 'the Joint Age can\'t be calculated: ' + core.equivAge(c, ageOffset < 0).why;
    if (!ins) return 'no insured is chosen on this slot';
    return 'Insured "' + (ins.name || 'Insured') + '" has no valid Birthdate (or the Reference Date is invalid), so there is no age to look up';
  }

  /** Why a lookup found no row: the file isn't (fully) loaded, or it has no row
      for this Axis Key at this age. */
  function missingRow(c, axisKey, age) {
    var term = c.category === 'termLife', file = term ? 'Term Life' : 'Permanent Life';
    var loaded = term ? termLifeMeta && !termLifeMeta.missingSheets.length : permLifeMeta && !permLifeMeta.missingSheet;
    return loaded ? 'the ' + file + ' rate file has no row for Axis Key ' + axisKey + ' at age ' + age
                  : 'the ' + file + ' rate file isn\'t loaded (Rates tab → Load from ' + RATES_FOLDER + '/)';
  }

  /** Age Real or Age Nearest, whichever the insured's own Age Calculation
      setting picks — same rule as everywhere else on this page (Insured
      Input, Coverage Input, the Insureds tab's own Age column). */
  function insuredAge(ins) {
    var ages = core.agesAt(ins.birthdate, core.settings.refDate);
    return ins.ageCalc === 'last' ? ages.real : ages.nearest;
  }

  /** The age a lookup matches on. Joint Permanent Life (JFTD, JLTD, JLTDPU):
      the Joint container's Joint Age — Joint Age Backdated when `ageOffset`
      is -1 — the same values the Insureds tab shows (core.jointAge). Every
      other coverage: the insured's own Age Nearest/Last, plus `ageOffset`.
      null → the caller reports Error (blank birthdate/Sex/Rate, Joint Age not calculable, no insured). */
  function lookupAge(c, ins, ageOffset) {
    if (core.isJointPerm(c)) return core.jointAge(c, ageOffset);
    if (!ins) return null;
    var age = insuredAge(ins);
    return age === null ? null : age + ageOffset;
  }

  /** The ported old-workbook PR_N formula (see chat / Lambda_Formulas.md for
      the original LET/CUBEVALUE version). `ageOffset` is 0 for PR_i, -1 for
      PR_BD_i — PR_BD_i is the exact same lookup at (Age Nearest/Last
      Calculated - 1), not a real backdated age (Backdate and Rates stay
      deliberately unwired, §9 invariant #39).
        - Term Life: always the individual insured's own age, Duration elapsedYears + 1 (1 on the tables) —
          Coverage Type never matters for Term Life in the old formula.
        - Permanent Life: no duration axis. Individual: the insured's own age
          and Sex/Rate. Joint First-to-Die / Joint Last-to-Die / JLTDPU: the
          same lookup but on the joint Axis Key (Joint Sex/Joint Rate, see
          core.axisKeyPrefix) and the Joint Age (lookupAge) — so every insured
          on the coverage shows the same figure.
      Returns { pending: true }, { error: true }, or { value: <rate> } —
      never a guessed number. */
  function baseRateResult(c, ins, slot, band, ageOffset, elapsedYears) {
    var age = lookupAge(c, ins, ageOffset);
    if (age === null) return fail(ageWhy(c, ins, ageOffset));
    var prefix = core.axisKeyPrefix(c, slot);
    if (!prefix) return fail('no Axis Key can be built: ' + core.axisKeyWhy(c, slot));
    var axisKey = prefix + band.code;
    var rate;
    if (c.category === 'termLife') {
      var suffix = TERM_LIFE_COVERAGE_SUFFIX[c.coverage];
      if (!suffix) return fail('"' + c.coverage + '" has no Term Life rate sheet');
      rate = lookupTermLifeRate(suffix, axisKey, age, (elapsedYears || 0) + 1);   // Duration = elapsed policy years + 1 (§12.2's shift)
    } else {
      rate = lookupPermLifeRate(axisKey, age);   // no duration axis for Permanent Life — only the pay period (permStillPaying) varies by year
    }
    if (rate === null) return fail(missingRow(c, axisKey, age));
    return { value: rate };
  }

  /** EPR_N / EPR_BD_N — the Extra Premium Rate. `ageOffset` works exactly
      like baseRateResult()'s (0 for EPR_i, -1 for EPR_BD_i).
        - Term Life: EPR_N is simply PR_N — every Term Life coverage
          (T10-T65), Individual or Joint First-to-Die alike — so this just
          returns baseRateResult()'s own result unchanged (a PR error is an
          EPR error too, never a separately guessed figure).
        - Permanent Life: the SUBSTANDARD rate — the Axis Key (the insured's
          own, or the joint one on JFTD/JLTD/JLTDPU) with its first 3
          characters ("DT_") replaced by "DTS" (S = Substandard), looked up in
          the same perm_rates workbook by that key and lookupAge() — the
          insured's Age Nearest/Last, or the Joint Age on a joint coverage —
          the same way PR_N is. (Substandard rows sit in the same sheet under
          their own "DTS…" Axis Keys, so ingestPermLifeWorkbook() already has
          them.)
      Same { pending } / { error } / { value } return shape as
      baseRateResult() — never a guessed number. */
  /* PR key -> EPR key: 'DT_…' -> 'DTS…' (3rd character), and for the 2017 products 'T_…' -> 'TS…' (2nd). */
  function substandardKey(k) { return k.charAt(0) === 'T' ? 'TS' + k.slice(2) : 'DTS' + k.slice(3); }

  function extraRateResult(c, ins, slot, band, ageOffset, elapsedYears) {
    if (c.category === 'termLife') return baseRateResult(c, ins, slot, band, ageOffset, elapsedYears);
    var age = lookupAge(c, ins, ageOffset);
    if (age === null) return fail(ageWhy(c, ins, ageOffset));
    var prefix = core.axisKeyPrefix(c, slot);
    if (!prefix) return fail('no Axis Key can be built: ' + core.axisKeyWhy(c, slot));
    var subKey = substandardKey(prefix + band.code);         // the Substandard row of the same key
    var rate = lookupPermLifeRate(subKey, age);
    if (rate === null) return fail(missingRow(c, subKey, age).replace('has no row', 'has no Substandard row'));
    return { value: rate };
  }

  /** PEP_N / PEP_BD_N — a percentage (hence / 100) times EPR_N / EPR_BD_N: the
      insured's Perm Extra Prem. % (slot.extraPct) — or, on a joint Permanent
      Life coverage, the Joint container's Equiv. Substd. % (c.joint.extraPct;
      still blank → Error, like any other missing input). Pending or error
      exactly when the EPR it's built on is. */
  function pepResult(c, ins, slot, band, ageOffset, elapsedYears) {
    var epr = extraRateResult(c, ins, slot, band, ageOffset, elapsedYears);
    if (epr.pending || epr.error) return epr;
    var pct = core.isJointPerm(c) ? c.joint.extraPct : slot.extraPct;
    if (pct === null || pct === undefined) {
      return fail(core.isJointPerm(c) ? 'Equiv. Substd. % is blank in the Joint container (type 0 if there is none)'
                                      : 'Perm Extra Prem. % is blank on this insured slot');
    }
    return { value: epr.value * pct / 100 };
  }

  /** One per-insured cell's result. `j` is the column's 0-5 position inside
      an insured's group — PR, EPR, PEP, then the same three at age - 1 — the
      index insuredRatesTable() and totalResult() both walk, so the two
      tables can't disagree on which lookup a column means. */
  function cellResult(c, ins, slot, band, j, elapsedYears) {
    var ageOffset = j >= 3 ? -1 : 0;                                   // the backdated trio uses age - 1
    return j % 3 === 0 ? baseRateResult(c, ins, slot, band, ageOffset, elapsedYears)     // PR_i / PR_BD_i
      : j % 3 === 1 ? extraRateResult(c, ins, slot, band, ageOffset, elapsedYears)       // EPR_i / EPR_BD_i
      : pepResult(c, ins, slot, band, ageOffset, elapsedYears);                          // PEP_i / PEP_BD_i
  }

  /** BD_Final's per-insured pick for column `j` (0 PR, 1 EPR, 2 PEP): the
      current value (…_N) — unless the insured is Backdate Eligible AND the
      backdated value (…_BD_N, column j + 3) is strictly lower, then that one.
      Same { value } / { error } / { pending } shape as cellResult(). The
      backdated value is only looked up for an eligible insured, so a missing
      …_BD_N row can't spoil an insured who keeps …_N. */
  function finalResult(c, ins, slot, band, j) {
    var n = cellResult(c, ins, slot, band, j);
    if (n.error || n.pending) return n;
    var eligible = ins && core.backdateEligible ? core.backdateEligible(ins) : null;   // true / false / null (unknown)
    if (eligible === null) {
      return fail(ins ? 'BD_Final needs Backdate Eligible, and Insured "' + (ins.name || 'Insured') + '" has no valid Birthdate' : 'no insured is chosen on this slot');
    }
    if (!eligible) return n;
    var bd = cellResult(c, ins, slot, band, j + 3);
    if (bd.error || bd.pending) return bd;
    return bd.value < n.value ? bd : n;
  }

  /** Total / BD_Total / BD_Final cell: the SUM of per-insured column `j`
      (cellResult()'s own index — 0-2 for Total, 3-5 for BD_Total; with `final`,
      0-2 through finalResult() for BD_Final) over the insureds that
      count. Term Life and Permanent Life Individual: all of them. Permanent
      Life Joint First-to-Die / Joint Last-to-Die / JLTDPU: Insured 1 alone
      (PR_Total = PR_1, and likewise EPR/PEP). Returns null when there's no
      insured to sum yet; an Error anywhere in the sum is an Error, else a
      pending anywhere is pending — never a partial sum. The raw rates are
      summed, only the display rounds. */
  function totalResult(c, slots, band, j, final, elapsedYears) {
    var counted = c.category === 'permLife' && c.covType !== 'Individual' ? slots.slice(0, 1) : slots;
    if (!counted.length) return null;
    var sum = 0, pending = false;
    // ponytail: re-runs the lookups the left table already did — a handful of
    // property reads per cell; cache per render if a lookup ever gets costly.
    for (var i = 0; i < counted.length; i++) {
      var res = (final ? finalResult : cellResult)(c, core.findInsured(counted[i].insuredId), counted[i], band, j, elapsedYears);
      if (res.error) return res;
      if (res.pending) pending = true;
      else sum += res.value;
    }
    return pending ? { pending: true } : { value: sum };
  }

  /** The rate band a coverage falls in: the closest LOWER band — the highest
      band whose face amount is <= the amount (BAND_TABLES ascend; at or above
      the top band it's the top one). Term Life: 30,000 -> B00025, 99,999 ->
      B00050, 8,974,632 -> B02000; Permanent Life: 17,500 -> B00010, 249,999 ->
      B00100, 250,001 -> B00250. The amount is the Coverage Amount — or, on
      Calculation Type "Input Premium", the Results' own Prem. Basis Ins. Amt
      (core.premBasis, optimizer_coverages.js), which is the most that premium
      buys. { band }, or { why } while there's no answer: no bands for the
      Category, no amount, or an amount below the lowest band. */
  function bandAt(c, amount) {
    var bands = bandsFor(c), hit = null;
    if (!bands || amount === null || amount === undefined) return null;
    bands.forEach(function (b) { if (b.amount <= amount) hit = b; });
    return hit;
  }

  function bandFor(c) {
    if (!bandsFor(c)) return { why: 'no rate bands for this Coverage Category' };
    var amount = c.amount;
    if (c.calcType === 'premium') {                 // the band follows Prem. Basis Ins. Amt
      var pb = core.premBasis ? core.premBasis(c) : null;
      if (!pb) return { why: 'needs Prem. Basis Ins. Amt' };
      if (pb.error || pb.blocked || pb.pending) return { why: pb.error || pb.blocked || 'Prem. Basis Ins. Amt has no formula for this Coverage Category' };
      amount = pb.amount;
    }
    if (amount === null || amount === undefined) {
      return { why: c.calcType === 'premium' ? 'needs the Input premium' : 'needs a Coverage Amount' };
    }
    var hit = bandAt(c, amount);
    return hit ? { band: hit } : { why: 'amount is below the lowest rate band' };
  }

  /** Backdate tab (published on the bridge, initRatesTab): an insured's "all
      coverages" rate — the SUM, over every coverage that insured is on, of
      that coverage's PR_N (PR_BD_N when `backdated`) at the coverage's own
      band (bandFor). Returns { value, detail } (`detail` lists each part, for
      a tooltip), { error } or { blocked } (both carry the reason) — never a
      partial sum: a lookup that fails is an error, a coverage with no band
      yet (or the insured on no coverage) is blocked, error wins. */
  function allCovRate(insuredId, backdated) {
    var sum = 0, parts = [], error = null, blocked = null;
    core.coverages().forEach(function (c, ci) {
      c.insureds.forEach(function (s) {
        if (s.insuredId !== insuredId) return;
        var label = (ci + 1) + '. ' + core.coverageTitle(c), b = bandFor(c);
        if (!b.band) { blocked = blocked || label + ' — ' + b.why; return; }
        var res = cellResult(c, core.findInsured(insuredId), s, b.band, backdated ? 3 : 0);
        if (res.error) error = error || label + ' — no rate found at ' + b.band.code + ': ' + res.why;
        else if (res.pending) blocked = blocked || label + ' — rate pending';
        else { sum += res.value; parts.push(label + ' · ' + b.band.code + ' · ' + core.group(res.value, 2)); }
      });
    });
    if (error) return { error: error };
    if (blocked) return { blocked: blocked };
    return parts.length ? { value: sum, detail: parts.join(' + ') } : { blocked: 'not on any coverage yet' };
  }

  /** PR_Total / PEP_Total on ONE band — the same two figures the Total block
      shows on that band's row. { band, pr, pep }, or { blocked } / { error }
      with the reason — never a partial answer. bandTotals() is the coverage's
      own band (Modal Prem.); bandTotalsAll() below is every band. */
  // Which pair of columns a caller wants off a band: the plain per-insured
  // totals (Modal Prem.), or the same two run through finalResult — the
  // BD_Final block (Modal Prem. Backdated). `[key, cellResult column, final?,
  // name for the message]`.
  var PLAIN_COLS = [['pr', 0, false, 'PR_Total'], ['pep', 2, false, 'PEP_Total']];
  var FINAL_COLS = [['pr', 0, true, 'PR_BD_Final'], ['pep', 2, true, 'PEP_BD_Final']];

  function bandTotalsFor(c, slots, band, cols) {
    var out = { band: band };
    for (var i = 0; i < cols.length; i++) {
      var t = totalResult(c, slots, band, cols[i][1], cols[i][2]);
      if (!t) return { blocked: 'no insured chosen on this coverage' };
      if (t.error) return { error: 'no rate found at ' + band.code + ' (' + cols[i][3] + '): ' + t.why };
      if (t.pending) return { blocked: cols[i][3] + ' is pending' };
      out[cols[i][0]] = t.value;
    }
    return out;
  }

  function bandTotalsOn(c, cols) {
    var b = bandFor(c);
    if (!b.band) return { blocked: b.why };
    return bandTotalsFor(c, c.insureds.filter(function (s) { return s.insuredId; }), b.band, cols);
  }

  function bandTotals(c) { return bandTotalsOn(c, PLAIN_COLS); }

  /** The same two figures on the same band, from the BD_Final block instead —
      what Modal Prem. Backdated is built from. Kept a separate call rather
      than extra fields on bandTotals() so that a BD_Final the Backdate tab
      cannot decide (an insured with no birthdate, § finalResult) never takes
      Modal Prem. itself down with it. */
  function bandFinalTotals(c) { return bandTotalsOn(c, FINAL_COLS); }

  /** Whether a Permanent Life coverage still charges anything at elapsed policy YEAR `elapsedYears`
      (0 = issue year): WL 10/15/20 Pay stop after their own N years; WL to 65 / WL to 100 / Term to
      100 stop once the issue age reaches 65 / 100 / 100 — the SAME age lookupAge() already resolves
      for the rate itself (the Joint Age on a joint coverage, the one insured's own age otherwise),
      so this can never disagree with which age the coverage is actually rated on. No cap known for
      a product -> pays indefinitely (defensive; every Permanent product today has one). Term Life's
      own end (its rate table running dry past age 85, confirmed by the requester) is detected from
      the lookup itself (isRowGoneAtYear, below), not here — there's no separate "still paying" rule
      to encode for it. */
  var PERM_PAY_YEARS = { 'WL 10 Pay': 10, 'WL 15 Pay': 15, 'WL 20 Pay': 20 };
  var PERM_AGE_CAP = { 'WL to 65': 65, 'WL to 100': 100, 'Term to 100': 100 };
  function permStillPaying(c, ins, backdated, elapsedYears) {
    if (PERM_PAY_YEARS[c.coverage] !== undefined) return elapsedYears < PERM_PAY_YEARS[c.coverage];
    var cap = PERM_AGE_CAP[c.coverage];
    if (cap === undefined) return true;
    var age = lookupAge(c, ins, backdated ? -1 : 0);
    return age === null ? true : (age + elapsedYears) < cap;
  }

  /** A Term Life row simply not existing past this duration is the table's own "ends at age 85"
      shape (confirmed by the requester — not a hole to fix) — distinct from every OTHER reason a
      lookup can fail (no Axis Key, no age, file not loaded, …), which stays a real Error regardless
      of the year. Only kicks in once `elapsedYears > 0` — a missing row at year 0 is today's
      ordinary Error (the coverage was never ratable in the first place). */
  function isRowGoneAtYear(why, elapsedYears) {
    return elapsedYears > 0 && /has no row for Axis Key/.test(why);
  }

  /** PR_Total / PEP_Total at a specific elapsed policy YEAR (0 = today/issue year), on the
      coverage's own band, current side (backdated=false) or backdated side (backdated=true — age
      - 1, the same convention as every other _BD figure on this page, confirmed §12.5/TO_DO C-2).
      Built for the Backdate Projection's per-year premium (optimizer_coverages.js's premiumAtYear);
      reuses bandFor()/totalResult() so it can never disagree with the Rates tab's own cells at
      elapsedYears=0.
        { pr, pep }, { ended: true } (this coverage charges nothing from here on — Term Life's rate
      table ran out, or a limited-pay/age-capped Permanent product's pay period is over), { blocked }
      or { error }. */
  /** A "no row" failure at elapsedYears>0 is only really "ended" (the table's own confirmed
      shape, § isRowGoneAtYear) if the SAME lookup succeeded at year 0 — otherwise the coverage was
      never ratable at all (a bad Axis Key, a file that's missing this product entirely, …), and
      every year should show that same real error, not a silently-invented "ended" the moment the
      "no row" wording happens to match. One extra year-0 check, only when a later year fails. */
  function endedOrError(c, band, slots, j, elapsedYears, why) {
    if (!isRowGoneAtYear(why, elapsedYears)) return { error: why };
    var year0 = totalResult(c, slots, band, j, false, 0);
    return (year0 && !year0.error && !year0.pending) ? { ended: true } : { error: why };
  }

  function bandTotalsAtYear(c, elapsedYears, backdated) {
    var b = bandFor(c);
    if (!b.band) return { blocked: b.why };
    var slots = c.insureds.filter(function (s) { return s.insuredId; });
    if (!slots.length) return { blocked: 'no insured chosen on this coverage' };
    if (c.category === 'permLife') {
      var repIns = core.findInsured(slots[0].insuredId);   // joint: ignored by lookupAge (Joint Age covers both); individual: the one insured
      if (repIns && !permStillPaying(c, repIns, backdated, elapsedYears)) return { ended: true };
    }
    var jPr = backdated ? 3 : 0, jPep = backdated ? 5 : 2;
    var pr = totalResult(c, slots, b.band, jPr, false, elapsedYears);
    if (!pr) return { blocked: 'no insured chosen on this coverage' };
    if (pr.error) return endedOrError(c, b.band, slots, jPr, elapsedYears, pr.why);
    if (pr.pending) return { blocked: 'PR is pending' };
    var pep = totalResult(c, slots, b.band, jPep, false, elapsedYears);
    if (pep.error) return endedOrError(c, b.band, slots, jPep, elapsedYears, pep.why);
    if (pep.pending) return { blocked: 'PEP is pending' };
    return { pr: pr.value, pep: pep.value };
  }

  /** Every rate the Rates tab shows, as plain JSON — saved with a test case (optimizer_history.js) for
      reference only, never read back on Load. Per coverage, per band: PR_n … PEP_BD_n per insured slot,
      then the TOTAL / BD_TOTAL / BD_FINAL trios — the same cellResult() / totalResult() as the cells. A
      figure; "Error: <why>"; or null (pending / nothing to sum). `band` is the coverage's own band. */
  function ratesDump() {
    function v(r) { return !r || r.pending ? null : r.error ? 'Error: ' + r.why : r.value; }
    var TRIO = ['PR', 'EPR', 'PEP'];
    return core.coverages().map(function (c, ci) {
      var slots = c.insureds.filter(function (s) { return s.insuredId; }), bands = {}, own = bandFor(c);
      (bandsFor(c) || []).forEach(function (b) {
        var row = {};
        slots.forEach(function (s, i) {
          var ins = core.findInsured(s.insuredId);
          TRIO.concat(['PR_BD', 'EPR_BD', 'PEP_BD']).forEach(function (n, j) { row[n + '_' + (i + 1)] = v(cellResult(c, ins, s, b, j)); });
        });
        TRIO.forEach(function (n, j) { row[n + '_TOTAL'] = v(totalResult(c, slots, b, j)); });
        TRIO.forEach(function (n, j) { row[n + '_BD_TOTAL'] = v(totalResult(c, slots, b, j + 3)); });
        TRIO.forEach(function (n, j) { row[n + '_BD_FINAL'] = v(totalResult(c, slots, b, j, true)); });
        bands[b.code] = row;
      });
      return {
        coverage: (ci + 1) + '. ' + core.coverageTitle(c),
        insureds: slots.map(function (s, i) { var ins = core.findInsured(s.insuredId); return (i + 1) + ': ' + (ins ? ins.name : ''); }),
        band: own.band ? own.band.code : null,
        bands: bands
      };
    });
  }

  /** Results' Highest Amt (§ optimizer_coverages.js): the same two figures for
      EVERY band of the coverage's Category, in BAND_TABLES order — the whole
      Total column as the Rates tab shows it, which is what the "could a bigger
      amount cost the same?" search inverts. { list: [{band, pr, pep}, …] }, or
      the first { blocked } / { error } that stops any one of them. */
  function bandTotalsAll(c) {
    var bands = bandsFor(c);
    if (!bands) return { blocked: 'no rate bands for this Coverage Category' };
    var slots = c.insureds.filter(function (s) { return s.insuredId; }), list = [], stop = null;
    bands.forEach(function (b) {
      if (stop) return;
      var t = bandTotalsFor(c, slots, b, PLAIN_COLS);
      if (t.error || t.blocked) { stop = t; return; }
      list.push(t);
    });
    return stop || { list: list };
  }

  /** The top-bar messages for this tab (core.diagnostics): every lookup that
      would show a red Error here, with its reason — by calling the very same
      cellResult() / finalResult() the tables do, so message and cell can't
      disagree. Grouped so one cause is one message: a reason that doesn't depend
      on the band (no Sex, no Birthdate, file not loaded, …) collapses to a single
      line, and a "no row" reason says which bands it hit. A joint Permanent Life
      coverage reports once (its two insureds share one Joint Age and Axis Key).
      A rate file that isn't loaded is one message per file, not one per coverage. */
  function ratesIssues() {
    var out = [], notLoaded = {};
    core.coverages().forEach(function (c, ci) {
      var bands = bandsFor(c);
      var slots = c.insureds.filter(function (s) { return s.insuredId; });
      if (!bands || !slots.length) return;
      var joint = core.isJointPerm(c);
      var where = 'Rates — Coverage ' + (ci + 1) + ' (' + core.coverageTitle(c) + ')';
      slots.forEach(function (s, si) {
        var ins = core.findInsured(s.insuredId), seen = {}, order = [];
        var who = joint ? ' · Joint' : ' · Insured ' + (si + 1) + (ins ? ' (' + ins.name + ')' : '');
        function note(res, band) {
          if (!res.error) return;
          var k = res.why.split(band.code).join('‹band›').replace(/ at age \d+/, '');   // one reason, whatever the band or age
          if (!seen[k]) { seen[k] = { why: res.why, bands: [] }; order.push(k); }
          if (seen[k].bands.indexOf(band.code) < 0) seen[k].bands.push(band.code);
        }
        bands.forEach(function (b) {
          [0, 1, 2, 3, 4, 5].forEach(function (j) { note(cellResult(c, ins, s, b, j), b); });
          [0, 1, 2].forEach(function (j) { note(finalResult(c, ins, s, b, j), b); });
        });
        order.forEach(function (k) {
          var e = seen[k], m = /the (Term Life|Permanent Life) rate file isn't loaded/.exec(e.why);
          if (m) {                                                            // the file, not this coverage
            if (notLoaded[m[1]]) return;
            notLoaded[m[1]] = 1;
            out.push({ key: 'd:load:' + m[1], msg: 'Rates — the ' + m[1] + ' rate file isn\'t loaded, so every ' + m[1] +
              ' rate is an Error. Load it from the Rates tab (Load from ' + RATES_FOLDER + '/, or Import Rates File).' });
            return;
          }
          out.push({ key: 'd:rate:' + c._id + ':' + (joint ? 'J' : s._id) + ':' + k,
            msg: where + who + ': ' + e.why + (e.bands.length < bands.length ? ' [' + e.bands.join(', ') + ']' : '') + '.' });
        });
      });
    });
    return out;
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

    var bandRows = bandsFor(c).map(function (b) {
      var cells = slots.map(function (s, i) {
        var ins = core.findInsured(s.insuredId);
        return [0, 1, 2, 3, 4, 5].map(function (j) {
          var extraClass = (j === 0 && i > 0) ? 'col-soft-sep' : (j >= 3 ? 'rate-bd' : null);
          var res = cellResult(c, ins, s, b, j);
          if (res.pending) return core.pendingCell(extraClass);
          if (res.error) return errorCell(extraClass, res.why);
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

  /** RIGHT table: Total / BD_Total / BD_Final — all sums of totalResult(): a
      figure, a red Error, or the muted "—" while an input is missing.
      `first` is the group's opening column index for cellResult(); `final`
      routes BD_Final through finalResult() (§ file header). Always the same
      9 columns regardless of how many insureds are on the coverage; `slots`
      is the same assigned-insured list insuredRatesTable() gets. */
  function totalsRatesTable(c, slots) {
    var GROUPS = [
      { label: 'Total', cols: ['PR_Total', 'EPR_Total', 'PEP_Total'], first: 0 },
      { label: 'BD_Total', cols: ['PR_BD_Total', 'EPR_BD_Total', 'PEP_BD_Total'], first: 3, bd: true },
      { label: 'BD_Final', cols: ['PR_BD_Final', 'EPR_BD_Final', 'PEP_BD_Final'], first: 0, final: true }
    ];
    var headGroup = GROUPS.map(function (g, gi) {
      return '<th colspan="3" class="rate-grp' + (gi > 0 ? ' col-hard-sep' : '') + '">' + g.label + '</th>';
    }).join('');
    var headSub = GROUPS.map(function (g, gi) {
      return g.cols.map(function (l, j) {
        return '<th class="r' + (j === 0 && gi > 0 ? ' col-hard-sep' : '') + (g.bd ? ' rate-bd' : '') + '">' + l + '</th>';
      }).join('');
    }).join('');

    var bandRows = bandsFor(c).map(function (b) {
      return '<tr>' + GROUPS.map(function (g, gi) {
        return g.cols.map(function (l, j) {
          var extra = [(j === 0 && gi > 0) ? 'col-hard-sep' : '', g.bd ? 'rate-bd' : ''].join(' ').trim();
          var res = totalResult(c, slots, b, g.first + j, g.final);
          if (!res || res.pending) return dashCell(extra);
          if (res.error) return errorCell(extra, res.why);
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
    if (!bandsFor(c)) {
      return '<div class="card card--out">' +
          '<div class="card-head card-head--band"><span class="card-title">' + title + '</span></div>' +
          '<div class="proj-slot"><div class="t">' + title + '</div>' +
            '<div class="s">' + (c.category ? 'Rates for this Coverage Category aren\'t built yet.'
            : 'Choose a Coverage Category in Coverage Input to see its rates.') + '</div></div>' +
        '</div>';
    }
    var slots = c.insureds.filter(function (s) { return s.insuredId; });
    var bandCount = bandsFor(c).length;
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
    core.allCovRate = allCovRate;   // lent out from here: the Backdate tab's rate sums …
    core.bandTotals = bandTotals;   // … the Coverages tab's PR_Total / PEP_Total at the coverage's band …
    core.bandFinalTotals = bandFinalTotals;   // … the same two from BD_Final, for Modal Prem. Backdated …
    core.bandAt = bandAt;           // … and, for Results' Highest Amt, the band an amount falls in
    core.bandTotalsAll = bandTotalsAll;
    core.bandTotalsAtYear = bandTotalsAtYear;
    core.ratesDump = ratesDump;     // … and every rate, for a saved test case's reference copy (optimizer_history.js)
    core.ratesFiles = function () { return { termLife: termLifeMeta && termLifeMeta.fileName, permLife: permLifeMeta && permLifeMeta.fileName }; };   // … and the Backdate Projection's per-year premium (optimizer_coverages.js)
    core.diagnostics(ratesIssues);   // the top-bar messages: why a cell here is an Error
    $('plSheets').innerHTML = TERM_LIFE_DURATIONS.map(function (s) {   // "Term 10" … "Term 65" (t10 → Term 10)
      return '<div class="pl-sheet" id="plSheet_' + s + '" data-state="notloaded"><span class="dot"></span>' +
             '<span class="pl-name">Term ' + s.slice(1) + '</span><span class="pl-state">Not loaded</span></div>';
    }).join('');
    loadFromRatesFolder();     // every launch — the pre-load page (optimizer_preload.js) waits on both files
    $('plRetry').addEventListener('click', loadFromRatesFolder);

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
