/* Coverage Optimizer — Insureds tab. Client.
 *
 * Own file/IIFE, alongside optimizer_coverages.js — see
 * OPTIMIZER_REFERENCE.md §2e and the "public bridge" section at the bottom
 * of optimizer.js for why. Reads shared state/utilities through
 * `window.OptimizerCore` only, the same rule optimizer_coverages.js follows.
 *
 * One flat table, one row per (coverage, insured-on-that-coverage) PAIR —
 * conceptually, loop over every coverage, then over every insured slot on
 * that coverage that actually has an insured chosen. An insured on 3
 * coverages produces 3 rows, one per coverage; a coverage with 2 insureds
 * produces 2 rows, one per insured. The first 13 columns mirror Coverage
 * Input/Insured Input/Coverages (read-only here); a hard separator, then 10
 * "Joint" columns; another hard separator, then Axis Key. The first 8 Joint
 * columns (Joint Sex … Perm Joint Age Backdated) are filled from the
 * coverage's own Joint container in Coverage Input — Permanent Life with a
 * joint Coverage Type only (core.isJointPerm); every other coverage has no
 * joint side, so they read "—". Perm Joint Age Backdated is Joint Age - 1 (the
 * same stand-in the Rates tab's _BD columns use; the Backdate tab is unwired)
 * and is the age the Rates tab's joint _BD lookups match on; the other two
 * Backdated columns still have no formula. The Coverages tab lists the same
 * columns from Perm Joint Age on (core.jointFigures feeds both). On a joint
 * coverage the insured's own Coverage Rate and Extra
 * Premium columns read "—" too — those Coverage Input boxes are disabled
 * there. Nothing in this tab is editable — every column is either mirrored,
 * pending, or (Axis Key, for Term/Permanent Life rows) computed from the
 * others — so there's no commit/live handler pair here (same as Results,
 * §2c).
 *
 * Axis Key is the 26-character PREFIX only (core.axisKeyPrefix() —
 * optimizer.js, computed there since it needs settings.mcd/coverages/
 * insureds directly, not just what this tab already mirrors) — the
 * 6-character rate band code that completes the real 32-character key is a
 * Rates-tab concept (one row per band) with no home on a per-insured row
 * here. Falls back to the usual pending cell for Critical Illness (no
 * format given) and for the two Permanent Life products whose own
 * abbreviation doesn't fit the format's fixed-width slot (VEG100, T100 —
 * see axisKeyPrefixPermLife's own comment, optimizer.js).
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var core = window.OptimizerCore;

  var COLUMNS = [
    'Coverage ID & Insured ID', 'Sex', 'Insured Rate', 'Age Nearest/Last (Calculated)',
    'Coverage Rate', 'Perm Extra Prem. %', 'Perm Extra Prem. $',
    'Term Extra Prem. $', 'Term Extra Prem. $ Dur.',
    'Coverage Category', 'Coverage', 'Coverage Type', 'Has MCD',
    'Joint Sex', 'Joint Rate', 'Perm Joint Age', 'Perm Equiv. Substd. %', 'Perm Flat Extra Prem. $ Perm',
    'Perm Flat Extra Prem. $ Term', 'Perm Flat Extra Prem. $ Duration',
    'Perm Joint Age Backdated', 'Perm Joint Extra Prem. % Backdated', 'Perm Joint Extra Prem. $ Backdated',
    'Axis Key'
  ];
  // 0-based column indices that open a new group — a "hard" divider (§ file
  // header) precedes Joint Sex and, again, Axis Key.
  var HARD_SEP_AT = { 13: 1, 23: 1 };

  /** One row per (coverage, filled insured slot) pair, in coverage order
      then slot order — exactly the nested loop the request itself
      describes ("a split for each coverage, then a sub-split for each
      insured on the coverage"), flattened into table rows rather than
      nested containers, matching how "Coverage ID & Insured ID" is
      specified as a flat "N_M" key per row, not a two-level grouping in
      the UI. A slot with no insured chosen yet contributes no row. */
  function buildRows() {
    var rows = [];
    var allIns = core.insureds();
    core.coverages().forEach(function (c, cIdx) {
      c.insureds.forEach(function (slot) {
        if (!slot.insuredId) return;
        var ins = core.findInsured(slot.insuredId);
        if (!ins) return;                       // dangling ref shouldn't happen (§2b sync) — defensive
        var insIdx = allIns.indexOf(ins);
        if (insIdx === -1) return;
        rows.push({ c: c, cIdx: cIdx, slot: slot, ins: ins, insIdx: insIdx });
      });
    });
    return rows;
  }

  /** Same rule Insured Input's own "Age Calculated" cell and Coverage
      Input's own "Age" cell both use (§2, §2b): Age Real or Age Nearest,
      whichever that insured's own Age Calculation setting picks. */
  function calcAge(ins) {
    var ages = core.agesAt(ins.birthdate, core.settings.refDate);
    return ins.ageCalc === 'last' ? ages.real : ages.nearest;
  }

  function td(value) {
    return '<td class="r">' + value + '</td>';
  }

  /** Joint Sex … Perm Joint Age Backdated (8 cells) — the coverage's Joint
      container (Coverage Input, `c.joint`) on a Permanent Life joint
      coverage: the fixed Sex/Rate, then the figures (core.jointFigures — what
      the operator has entered, "—" for a box still blank). "—" across the
      board for every other coverage (no joint side to show). */
  function jointCells(c) {
    var on = core.isJointPerm(c);
    var vals = [on ? core.JOINT_SEX : '—', on ? core.JOINT_RATE : '—'].concat(core.jointFigures(c));
    return vals.map(function (v, i) {
      return '<td class="r' + (i === 0 ? ' col-hard-sep' : '') + '">' + core.esc(v) + '</td>';
    }).join('');
  }

  function rowHtml(r) {
    var age = calcAge(r.ins);
    // Rate and the four Extra Premium boxes are disabled on a joint coverage
    // (Coverage Input), so there's nothing of the insured's own to mirror.
    var joint = core.isJointPerm(r.c);
    var perSlot = function (v) { return td(joint ? '—' : v); };
    return '<tr>' +
        td((r.cIdx + 1) + '_' + (r.insIdx + 1)) +
        td(core.esc(r.ins.sex || '—')) +
        td(core.insuredRateCode(r.ins) || '—') +
        td(age === null ? '—' : String(age)) +
        perSlot(r.slot.rate ? core.esc(r.slot.rate) : '—') +
        perSlot(core.group(r.slot.extraPct, core.decimals(r.slot.extraPct))) +
        perSlot(core.group(r.slot.extraFlat, 2)) +
        perSlot(core.group(r.slot.extraTempAmt, 2)) +
        perSlot(core.group(r.slot.extraTempYears, 0)) +
        td(core.esc(core.COVERAGE_CATEGORY_MAP[r.c.category] || '—')) +
        td(core.esc(core.COVERAGE_ABBR[r.c.coverage] || r.c.coverage || '—')) +
        td(core.esc(core.COVTYPE_ABBR[r.c.covType] || '—')) +
        td(core.settings.mcd ? 'TRUE' : 'FALSE') +
        jointCells(r.c) +                     // Joint Sex … Perm Joint Age Backdated
        core.pendingCell() +                  // Perm Joint Extra Prem. % Backdated
        core.pendingCell() +                  // Perm Joint Extra Prem. $ Backdated
        axisKeyCell(r) +
      '</tr>';
  }

  /** The 26-character prefix (§ file header) when the category/product/
      covType combination supports one, else the usual pending cell — same
      fallback core.pendingCell() already gives Coverage Type/Coverage Fee
      for Critical Illness elsewhere on this page. `mono` keeps the fixed-
      width string reading as the exact character sequence it is, the same
      reason table figures use tabular-nums. */
  function axisKeyCell(r) {
    var key = core.axisKeyPrefix(r.c, r.slot);
    return key
      ? '<td class="r col-hard-sep mono" title="Axis Key prefix — the 6-character rate band code is appended in the Rates tab">' +
          core.esc(key) + '</td>'
      : core.pendingCell('col-hard-sep');
  }

  function renderInsuredsTab() {
    if (!$('insTabBody')) return;   // not built yet — see init() ordering
    var rows = buildRows();
    $('insTabBody').innerHTML = rows.length
      ? rows.map(rowHtml).join('')
      : '<tr><td colspan="' + COLUMNS.length + '">' +
          '<div class="proj-slot" style="margin:0;"><div class="s">' +
            'No insureds are assigned to any coverage yet — pick an Insured on a coverage slot in Coverage Input.' +
          '</div></div></td></tr>';
    $('insTabCount').textContent = rows.length + ' row' + (rows.length === 1 ? '' : 's');
  }

  function insuredsTabShell() {
    var headCells = COLUMNS.map(function (l, i) {
      return '<th class="r' + (HARD_SEP_AT[i] ? ' col-hard-sep' : '') + '">' + core.esc(l) + '</th>';
    }).join('');
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band">' +
          '<span class="card-title">Insureds</span>' +
          '<span class="spacer"></span>' +
          '<span class="card-note" id="insTabCount"></span>' +
        '</div>' +
        '<div class="table-scroll-wrap">' +
          '<table class="ins ins-tab-table">' +
            '<thead><tr>' + headCells + '</tr></thead>' +
            '<tbody id="insTabBody"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function initInsuredsTab() {
    $('insuredsTabHost').innerHTML = insuredsTabShell();
    renderInsuredsTab();

    // No editable field on this tab — nothing to commit — so the only
    // wiring needed is the same change hook every other split-off tab uses
    // to stay in step with `coverages`/`insureds`/`settings`.
    core.onChange(renderInsuredsTab);
  }

  initInsuredsTab();
})();
