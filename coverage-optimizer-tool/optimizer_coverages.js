/* Coverage Optimizer — Coverages tab. Client.
 *
 * Own file/IIFE, separate from optimizer.js — see OPTIMIZER_REFERENCE.md
 * §2d and the "public bridge" section at the bottom of optimizer.js for why.
 * Loaded after optimizer.js (optimizer.html); reads shared state/utilities
 * through `window.OptimizerCore` only — never touches `coverages`/`settings`
 * directly, and never assumes anything about optimizer.js's own internals
 * beyond that one exposed surface.
 *
 * One flat table, one row per coverage from Coverage Input, columns per the
 * request. Every column is either mirrored from Coverage Input/Settings
 * (read-only here — this tab doesn't duplicate their editing), computed from
 * them (Extra Prem. Term $ — extraTermCell below), or a genuinely new
 * per-coverage field this tab alone owns (Unit Value). Two columns (Modal
 * Prem., Modal Prem. Backdated — plus Extra Prem. Term $ for Critical
 * Illness, whose rule isn't specified) have no formula
 * yet — highlighted amber/"warn" (the closest existing semantic token to
 * "pending", not a new colour) rather than the page's usual muted "—" for a
 * merely-not-yet-calculated figure, since these are explicitly flagged as
 * formulas still to come, not just outputs no one asked for yet.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var core = window.OptimizerCore;

  // Display abbreviation maps (Coverage's code, Coverage Type's code) live
  // on the bridge, not here — `core.COVERAGE_ABBR`/`core.COVTYPE_ABBR` — so
  // the Insureds tab (§2e) reads the exact same ones rather than a second
  // hand-typed copy that could drift out of sync with this one.

  var COLUMNS = [
    'Coverage ID', 'Frequency of Payment', 'Coverage Category', 'Coverage',
    'Prem. Adj. %', 'Prem. Adj. % Dur.', 'Prem. Adj. $', 'Prem. Adj. $ Dur.',
    'Has MCD', 'Coverage Type', 'Unit Value', 'Extra Prem. Term $',
    'Modal Factor', 'Coverage Fee', 'Modal Prem.', 'Modal Prem. Backdated'
  ];

  /* Unit Value: a new field, specific to this tab — not part of Coverage
     Input's own record (§ Coverage Input never mentions it). Kept as its
     own covId-keyed map rather than added to `coverages` itself, so this
     tab's own state stays self-contained and optimizer.js's core model
     isn't extended for a field only this tab reads or writes. No range was
     specified; 1-999,999,999 (whole numbers) mirrors this page's other
     unbounded-but-not-infinite integer fields (§ OPTIMIZER_REFERENCE.md). */
  var UNIT_VALUE_DEFAULT = 1000;
  var unitValues = {};

  function unitValueFor(covId) {
    if (!(covId in unitValues)) unitValues[covId] = UNIT_VALUE_DEFAULT;
    return unitValues[covId];
  }

  /* New coverages get the default; a coverage removed in Coverage Input
     drops its entry here too — same "don't leave a dangling reference"
     rule `syncCoverageInsuredRefs` follows in optimizer.js. */
  function syncUnitValues() {
    var live = {};
    core.coverages().forEach(function (c) {
      live[c._id] = 1;
      if (!(c._id in unitValues)) unitValues[c._id] = UNIT_VALUE_DEFAULT;
    });
    Object.keys(unitValues).forEach(function (id) { if (!live[id]) delete unitValues[id]; });
  }

  function validateUnitValue(raw) {
    var s = typeof raw === 'string' ? raw.trim() : raw;
    if (s === '' || s === null || s === undefined) return { ok: false, msg: 'Unit Value is required' };
    var n = core.toNum(s);
    if (n === null) return { ok: false, msg: 'Unit Value must be a number' };
    if (n % 1 !== 0) return { ok: false, msg: 'Unit Value must be a whole number' };
    if (n < 1) return { ok: false, msg: 'Unit Value must be at least 1' };
    if (n > 999999999) return { ok: false, msg: 'Unit Value must not exceed 999,999,999' };
    return { ok: true, v: n };
  }

  function modalFactorFor() {
    var freq = core.settings.freq;
    return freq === 'annually' ? '1.00' : freq === 'monthly' ? '0.09' : '—';   // blank frequency → no factor
  }

  function moneyOrDash(v) {
    return (v === null || v === undefined) ? '—' : core.group(v, 2);
  }

  /** Extra Prem. Term $ — the coverage's flat extra dollars, both kinds
      (Term $ and Perm $ added together):
        - Term Life (Individual, JFTD) and Permanent Life (Individual): the
          sum over every insured on the coverage (a slot with an insured
          chosen) of that insured's Perm $ + Term $ from Coverage Input.
        - Permanent Life (JFTD, JLTD, JLTDPU): the Joint container's Flat
          Extra Prem. $ Perm + Flat Extra Prem. $ Term (they lock each other,
          so it's whichever was entered). Both still blank → "—", not 0.
      "—" also while there's nothing to sum yet (no Category/Coverage Type, or
      no insured chosen); Critical Illness has no rule yet, so it stays the
      amber pending cell. */
  function extraTermCell(c) {
    if (c.category !== 'termLife' && c.category !== 'permLife') {
      return c.category ? core.pendingCell() : '<td class="r">—</td>';
    }
    var total = null;
    if (core.isJointPerm(c)) {
      var j = c.joint || {}, has = function (v) { return v !== null && v !== undefined; };
      if (has(j.extraFlat) || has(j.extraTempAmt)) total = (j.extraFlat || 0) + (j.extraTempAmt || 0);
    } else if (c.covType) {
      c.insureds.forEach(function (s) {
        if (s.insuredId) total = (total || 0) + (s.extraFlat || 0) + (s.extraTempAmt || 0);
      });
    }
    return '<td class="r">' + moneyOrDash(total) + '</td>';
  }

  /* Column order matches COLUMNS above exactly — 16 cells, 1 per header.
     "Coverage ID" is the plain index (Coverage Input's own numbering, its
     `.coverage-no` badge), NOT the full "N. Category — Coverage" title
     Results' own table shows (§2c) — the request asks for the ID alone. */
  function coverageRow(c, idx) {
    var s = core.settings;
    return '<tr>' +
        '<td class="r">' + (idx + 1) + '</td>' +
        '<td class="r">' + (s.freq === 'annually' ? 'Annually' : s.freq === 'monthly' ? 'Monthly' : '—') + '</td>' +
        '<td class="r">' + core.esc(core.COVERAGE_CATEGORY_MAP[c.category] || '—') + '</td>' +
        '<td class="r">' + core.esc(core.COVERAGE_ABBR[c.coverage] || c.coverage || '—') + '</td>' +
        '<td class="r">' + core.group(s.premAdjPct, core.decimals(s.premAdjPct)) + '</td>' +
        '<td class="r">' + core.group(s.premAdjPctDur, 0) + '</td>' +
        '<td class="r">' + core.group(s.premAdjAmt, 2) + '</td>' +
        '<td class="r">' + core.group(s.premAdjAmtDur, 0) + '</td>' +
        '<td class="r">' + (s.mcd ? 'TRUE' : 'FALSE') + '</td>' +
        '<td class="r">' + (core.COVTYPE_ABBR[c.covType] || '—') + '</td>' +
        '<td class="r"><input class="fi" data-fk="covtab|' + c._id + '|unitValue"' +
          ' value="' + core.esc(core.group(unitValueFor(c._id), 0)) + '" spellcheck="false" autocomplete="off"></td>' +
        extraTermCell(c) +
        '<td class="r">' + modalFactorFor() + '</td>' +
        '<td class="r">' + moneyOrDash(c.fee) + '</td>' +
        core.pendingCell() +
        core.pendingCell() +
      '</tr>';
  }

  function renderCoveragesTab() {
    if (!$('covTabBody')) return;   // not built yet — see init() ordering
    syncUnitValues();

    var list = core.coverages();
    $('covTabBody').innerHTML = list.map(coverageRow).join('');
    $('covTabCount').textContent = list.length + ' coverage' + (list.length === 1 ? '' : 's');
  }

  function coveragesTabShell() {
    var headCells = COLUMNS.map(function (l) { return '<th class="r">' + core.esc(l) + '</th>'; }).join('');
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band">' +
          '<span class="card-title">Coverages</span>' +
          '<span class="spacer"></span>' +
          '<span class="card-note" id="covTabCount"></span>' +
        '</div>' +
        '<div class="table-scroll-wrap">' +
          '<table class="ins cov-tab-table">' +
            '<thead><tr>' + headCells + '</tr></thead>' +
            '<tbody id="covTabBody"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function covTabCommit(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.fk) return;
    var p = el.dataset.fk.split('|');   // 'covtab' | covId | 'unitValue'
    if (p[0] !== 'covtab' || p[2] !== 'unitValue') return;

    var res = validateUnitValue(el.value);
    if (!res.ok) {
      el.classList.add('fi--bad');
      el.title = res.msg;
      return;
    }
    el.classList.remove('fi--bad');
    unitValues[p[1]] = res.v;
    renderCoveragesTab();
  }

  function covTabLive(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.fk) return;
    el.classList.toggle('fi--bad', !validateUnitValue(el.value).ok);
  }

  function initCoveragesTab() {
    $('coveragesTabHost').innerHTML = coveragesTabShell();
    renderCoveragesTab();

    $('coveragesTabHost').addEventListener('change', covTabCommit);
    $('coveragesTabHost').addEventListener('input', covTabLive);

    // Coverage add/remove/edit, or any Settings commit (Frequency of
    // Payment, the 4 Prem. Adj. fields, Multi-Coverage Discount) — all flow
    // through this one hook (§ optimizer.js "public bridge").
    core.onChange(renderCoveragesTab);

    // Unit Value lives only here — not in optimizer.js's own model (§ file
    // header) — so a saved test case (optimizer_history.js) can't capture or
    // restore it without this tab opting in. `set` is this file's own
    // mutation path (same idea as covTabCommit), just reachable from outside
    // through the bridge rather than a DOM event.
    core.registerSnapshot('unitValues', {
      get: function () { return unitValues; },
      set: function (data) {
        unitValues = (data && typeof data === 'object') ? data : {};
        renderCoveragesTab();
      }
    });
  }

  initCoveragesTab();
})();
