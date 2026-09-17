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
 * Persistence: this tool has no backend and must keep opening from `file://`
 * (§0), so there is no folder it can silently read/write. A saved test case
 * is kept in this browser's own localStorage (so the History tab can list
 * and one-click Load it, the same way the theme choice already persists
 * there) AND downloaded as a portable .json file on every save, so it can be
 * archived or emailed to a colleague. "Import Test Case" (this tab's own
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
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }   // storage unavailable/corrupt — start empty, tool still runs
  }

  function persistCatalog() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog)); }
    catch (e) { /* storage unavailable (quota, private mode, …) — saved case still downloads as a file */ }
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
    return (base || 'test-case').slice(0, 60) + '.json';
  }

  /** There is no backend here (§0 — must keep opening from `file://`), so a
      plain download can never choose an absolute folder on disk — only the
      browser's OWN configured download directory decides where this lands,
      and a page cannot query or override that. Tried prefixing a "data/"
      path onto the filename (Chromium is documented to treat a relative path
      in `download` as a subfolder of its download directory); observed
      instead that this harness's browser sanitises the "/" into the
      filename itself ("data_<name>.json") rather than creating a folder — so
      it was reverted. See optimizer_history.js's own header / the chat
      response for the actual fix (a one-time Chrome download-location
      setting, or File System Access for a real in-app folder handle). */
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
    var nameEl = $('tcName'), userEl = $('tcUser');
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

    var entry = buildEntry(name, userEl.value);
    catalog.push(entry);
    persistCatalog();
    downloadJSON(safeFileName(name), entry);
    renderHistoryTab();

    nameEl.value = '';
    toast('Saved "' + name + '" to History.');
  }

  function doImportFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { toast('Not a valid test case file', 'err'); return; }
      if (!data || typeof data !== 'object' || !data.snapshot || !data.name) {
        toast('Not a valid test case file', 'err');
        return;
      }
      data.id = newId();   // never trust an id from outside this browser — could collide
      catalog.push(data);
      persistCatalog();
      renderHistoryTab();
      toast('Imported "' + data.name + '" into History.');
    };
    reader.onerror = function () { toast('Could not read that file', 'err'); };
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
    core.restoreState(entry.snapshot);
    core.setSnapshot('unitValues', entry.snapshot.unitValues);

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
      if ($('tcName').value.trim()) $('tcName').classList.remove('fi--bad');
    });
  }

  initHistoryTab();
})();
