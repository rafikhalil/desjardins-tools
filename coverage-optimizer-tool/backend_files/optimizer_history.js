/* Coverage Optimizer — Save Test / History. Client.
 *
 * Own file/IIFE — see OPTIMIZER_REFERENCE.md §1/§2d/§2e for why a split-off
 * tab lives outside optimizer.js. Reads shared state/utilities through
 * `window.OptimizerCore` only, the same rule every other split-off tab
 * follows — EXCEPT this is also the one file that calls the bridge's one
 * deliberate WRITE exception, `core.restoreState(...)`, when the operator
 * picks a saved test case to reload (§ optimizer.js "public bridge" and
 * "save/load" sections for why that one exception exists and is safe).
 *
 * Owns the whole Save/Load feature end to end, including the Test Case
 * Name / Username / Save Test controls that live in optimizer.html's static
 * top bar (not inside this tab's own pane) — one feature, one file, even
 * though its UI is split across two physical locations on the page.
 *
 * Persistence: a saved test case is kept in this browser's own localStorage
 * (so the History tab can list and one-click Load it, the same way the theme
 * choice already persists there) AND written as a portable .json file into
 * the tool's `history_data` folder by server.py (saveToDataFolder — the tool is
 * always started from _start-coverage-optimizer.bat; a plain download is only the
 * fallback if the server can't be reached), named with the saver's initials
 * (cl_/rk_/cc_, chosen on the pre-load page), so it can be archived or
 * emailed to a colleague. "Import Test Case" (this tab's own
 * band) reads a .json file back via a plain file picker and adds it to this
 * browser's own list — the only way a colleague's file can ever reach
 * someone else's History, since nothing here can reach across machines on
 * its own.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var core = window.OptimizerCore;

  var STORAGE_KEY = 'coverage-optimizer-testcases';

  var COLUMNS = [
    'Test Case Name', 'Username', 'Date Saved', 'Number of Insureds',
    'Number of Coverages', 'Total Modal Premium', 'Load', 'Delete'
  ];

  // ------------------------------------------------------------- catalog
  function loadCatalog() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* fall through to the message */ }   // storage unavailable/corrupt — start empty, tool still runs
    core.raise('h:store', 'History — the test cases saved in this browser couldn\'t be read, so the list starts empty. The .json files in the history_data/ folder are unaffected (Import Test Case brings one back).');
    return [];
  }

  function persistCatalog() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog)); core.resolve('h:store'); }
    catch (e) {   // storage unavailable (quota, private mode, …) — the history_data/ file is then the only copy
      core.raise('h:store', 'History — this browser wouldn\'t keep the saved test cases (storage full or blocked), so the list will be empty next time you open the tool. The .json file in history_data/ is your copy.');
    }
  }

  var catalog = loadCatalog();

  function newId() { return 'tc' + Date.now() + Math.floor(Math.random() * 1000); }

  // ---------------------------------------------------------------- dates
  /* "Date Saved" is a real wall-clock moment (when the operator clicked Save
     Test), so it's built from local time — deliberately NOT core.fmtDate,
     which reads a Date's UTC fields for the business dates elsewhere on this
     page (birthdates, Reference Date) to keep those unambiguous regardless of
     the operator's timezone. A save timestamp has no such requirement; local
     time is what "just now" means to the person who clicked the button. */
  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function nowStamp() {
    var d = new Date();
    return pad2(d.getDate()) + '-' + MONTHS[d.getMonth()] + '-' + d.getFullYear() +
           ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // ------------------------------------------------------------ file I/O
  function safeFileName(name) {
    var base = String(name || 'test-case').trim().replace(/[^A-Za-z0-9\-_ ]+/g, '').replace(/\s+/g, '_');
    // The saver's initials first (cl_ / rk_ / cc_, set on the pre-load page) so two people's files can't collide.
    return $('tcUser').dataset.ini + '_' + (base || 'test-case').slice(0, 60) + '.json';
  }

  /** Fallback only (see saveToDataFolder): a plain download can't choose a
      folder — the browser's own download directory decides. */
  function downloadJSON(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** POSTs the test case to server.py (_start-coverage-optimizer.bat), which writes it into
      the tool's history_data/ folder and never overwrites — a taken name comes back
      with a timestamp suffix. Resolves { name } — the file name actually written — or
      { why } (page opened from disk, server down, refused) → the caller downloads. */
  function saveToDataFolder(filename, obj) {
    return fetch('../history_data/' + filename, {   // the page lives in backend_files/; history_data/ is its sibling
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj, null, 2)
    }).then(function (r) {
      if (!r.ok) throw new Error('the server answered HTTP ' + r.status);
      return r.json();
    }).then(function (j) { return { name: j.name }; })
      .catch(function (e) { return { why: e.message === 'Failed to fetch' ? 'the tool\'s server isn\'t reachable' : e.message }; });
  }

  /** Every operator input needed to reproduce a test case: Settings/
      Insureds/Coverages (core.snapshotState()) plus Unit Value, which lives
      outside that model entirely (optimizer_coverages.js's own field, §
      optimizer.js "save/load") — folded in here so one `snapshot` object is
      everything Load needs. */
  function buildSnapshot() {
    var snap = core.snapshotState();
    snap.unitValues = JSON.parse(JSON.stringify(core.getSnapshot('unitValues') || {}));
    return snap;
  }

  function buildEntry(name, user) {
    var snap = buildSnapshot();
    return {
      id: newId(),
      name: name,
      user: user,
      savedAt: nowStamp(),
      insuredCount: snap.insureds.length,
      coverageCount: snap.coverages.length,
      snapshot: snap
    };
  }

  // -------------------------------------------------------------- actions
  function doSaveTest() {
    var nameEl = $('tcName');
    var name = nameEl.value.trim();
    if (!name) {
      nameEl.classList.add('fi--bad');
      nameEl.title = 'Enter a Test Case Name before saving';
      toast('Enter a Test Case Name before saving', 'err');
      core.raise('h:name', 'Save Test — enter a Test Case Name (top right) before saving.');
      nameEl.focus();
      return;
    }
    nameEl.classList.remove('fi--bad');
    nameEl.title = 'Test Case Name';
    core.resolve('h:name');

    var entry = buildEntry(name, $('tcUser').textContent);
    catalog.push(entry);
    persistCatalog();
    renderHistoryTab();
    nameEl.value = '';

    var fname = safeFileName(name);
    saveToDataFolder(fname, entry).then(function (r) {
      if (r.name) { toast('Saved "' + name + '" to History and history_data/' + r.name + '.'); core.resolve('h:save'); return; }
      downloadJSON(fname, entry);
      toast('Saved "' + name + '" to History; downloaded instead — history_data/ not reachable (start the tool with _start-coverage-optimizer.bat).', 'err');
      core.raise('h:save', 'Save Test — "' + name + '" is in History but the file couldn\'t be written to history_data/ (' + r.why +
        '); it was downloaded to your Downloads folder instead. Start the tool with _start-coverage-optimizer.bat to save into history_data/.');
    });
  }

  function doImportFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      var bad = function (why) {
        toast('Not a valid test case file', 'err');
        core.raise('h:import', 'History — "' + file.name + '" can\'t be imported: ' + why);
      };
      try { data = JSON.parse(reader.result); } catch (e) { bad('it isn\'t valid JSON (' + e.message + ').'); return; }
      var snap = data && data.snapshot;
      if (!data || typeof data !== 'object' || !data.name) { bad('it has no test case "name" — is it a file saved by this tool?'); return; }
      if (!snap || !Array.isArray(snap.insureds) || !Array.isArray(snap.coverages)) { bad('its "snapshot" has no insureds / coverages lists.'); return; }
      data.id = newId();   // never trust an id from outside this browser — could collide
      catalog.push(data);
      persistCatalog();
      renderHistoryTab();
      core.resolve('h:import');
      toast('Imported "' + data.name + '" into History.');
    };
    reader.onerror = function () {
      toast('Could not read that file', 'err');
      core.raise('h:import', 'History — "' + file.name + '" couldn\'t be read from disk.');
    };
    reader.readAsText(file);
  }

  function doLoad(id) {
    var entry = null;
    catalog.forEach(function (e) { if (e.id === id) entry = e; });
    if (!entry) return;

    // Order matters: restoreState() replaces `coverages` first, so Unit
    // Value's own resync (triggered inside setSnapshot's `set` callback,
    // optimizer_coverages.js) reconciles against the NEW coverage _ids —
    // reversing this order would make it see the OLD coverages still in
    // place and discard the just-restored Unit Values as "stale".
    var backup = buildSnapshot();
    try {
      core.restoreState(entry.snapshot);
      core.setSnapshot('unitValues', entry.snapshot.unitValues);
    } catch (e) {          // a hand-edited / damaged file: put back what was on screen
      core.restoreState(backup);
      core.setSnapshot('unitValues', backup.unitValues);
      toast('Could not load "' + entry.name + '"', 'err');
      core.raise('h:load', 'History — "' + entry.name + '" couldn\'t be loaded (' + e.message + '); what was on screen has been put back. The saved file is probably damaged or hand-edited.');
      return;
    }
    core.resolve('h:load');

    var tabBtn = document.querySelector('.tab[data-pane="optInput"]');
    if (tabBtn) tabBtn.click();

    toast('Loaded "' + entry.name + '".');
  }

  function doDelete(id) {
    var before = catalog.length;
    catalog = catalog.filter(function (e) { return e.id !== id; });
    if (catalog.length === before) return;
    persistCatalog();
    renderHistoryTab();
    toast('Test case removed.');
  }

  // ---------------------------------------------------------------- render
  /* Total Modal Premium — plain muted "—", not core.pendingCell()'s amber
     "no formula yet": the intended formula here (sum of every coverage's own
     Modal Prem., once that exists) is already known, the same way Results'
     own "Modal Premium" summary field is treated (§ optimizer.js Results) —
     it's blocked on an upstream figure that doesn't exist yet, not itself an
     unspecified formula. */
  function historyRow(entry) {
    return '<tr>' +
        '<td class="r">' + core.esc(entry.name) + '</td>' +
        '<td class="r">' + core.esc(entry.user) + '</td>' +
        '<td class="r">' + core.esc(entry.savedAt) + '</td>' +
        '<td class="r">' + entry.insuredCount + '</td>' +
        '<td class="r">' + entry.coverageCount + '</td>' +
        '<td class="r"><span class="muted" title="Not calculated yet">—</span></td>' +
        '<td class="r"><button class="btn btn--sm" data-act="load-tc" data-id="' + core.esc(entry.id) + '">Load</button></td>' +
        '<td class="r"><button class="btn btn--sm btn--danger" data-act="del-tc" data-id="' + core.esc(entry.id) + '">Delete</button></td>' +
      '</tr>';
  }

  function renderHistoryTab() {
    if (!$('historyTabBody')) return;   // not built yet — see init() ordering
    $('historyTabBody').innerHTML = catalog.length
      ? catalog.map(historyRow).join('')
      : '<tr><td colspan="' + COLUMNS.length + '">' +
          '<div class="proj-slot" style="margin:0;"><div class="s">' +
            'No test cases saved yet — use Save Test in the top bar to add one.' +
          '</div></div></td></tr>';
    $('historyTabCount').textContent = catalog.length + ' test case' + (catalog.length === 1 ? '' : 's');
  }

  function historyTabShell() {
    var headCells = COLUMNS.map(function (l) { return '<th class="r">' + core.esc(l) + '</th>'; }).join('');
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band">' +
          '<span class="card-title">History</span>' +
          '<span class="card-note" id="historyTabCount"></span>' +
          '<span class="spacer"></span>' +
          '<button class="btn btn--sm" id="btnImportTestCase" type="button"' +
            ' title="Import a test case .json file someone sent you into this list">Import Test Case</button>' +
          '<input type="file" id="historyImportFile" accept="application/json,.json" hidden>' +
        '</div>' +
        '<div class="table-scroll-wrap">' +
          '<table class="ins hist-tab-table">' +
            '<thead><tr>' + headCells + '</tr></thead>' +
            '<tbody id="historyTabBody"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  // ----------------------------------------------------------------- toast
  /* No shared toast() on the bridge (§ optimizer.js utils) — it's a tiny,
     self-contained DOM effect, so it's cheaper to have its own copy here
     than to add a bridge accessor for one function every split-off tab would
     otherwise need to re-request. Identical behaviour/markup to optimizer.js's
     own. */
  var toastTimer = null;
  function toast(msg, kind) {
    var n = $('toast');
    n.textContent = msg;
    n.className = 'toast show' + (kind ? ' toast--' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.className = 'toast'; }, kind === 'err' ? 5000 : 3000);
  }

  function initHistoryTab() {
    $('historyTabHost').innerHTML = historyTabShell();
    renderHistoryTab();

    $('historyTabHost').addEventListener('click', function (e) {
      var loadBtn = e.target.closest ? e.target.closest('[data-act="load-tc"]') : null;
      if (loadBtn) { doLoad(loadBtn.dataset.id); return; }
      var delBtn = e.target.closest ? e.target.closest('[data-act="del-tc"]') : null;
      if (delBtn) { doDelete(delBtn.dataset.id); return; }
      if (e.target.id === 'btnImportTestCase') $('historyImportFile').click();
    });

    $('historyImportFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) doImportFile(file);
      e.target.value = '';   // clears the picker so importing the same filename again still fires `change`
    });

    // Save Test / Test Case Name live in the static top bar (optimizer.html),
    // not inside #historyTabHost — wired here anyway, per the file header.
    $('btnSaveTest').addEventListener('click', doSaveTest);
    $('tcName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doSaveTest(); }
    });
    $('tcName').addEventListener('input', function () {
      if ($('tcName').value.trim()) { $('tcName').classList.remove('fi--bad'); core.resolve('h:name'); }
    });
  }

  initHistoryTab();
})();
