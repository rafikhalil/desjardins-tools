/* Coverage Optimizer — Backdate tab. Client.
 *
 * Own file/IIFE — see OPTIMIZER_REFERENCE.md §1/§2d/§2e for why a split-off
 * tab lives outside optimizer.js. Reads shared state/utilities through
 * `window.OptimizerCore` only, the same rule optimizer_coverages.js and
 * optimizer_insureds.js follow.
 *
 * Two containers stack top/bottom in this tab (unlike every other tab's
 * left/right .split).
 *
 * "Insureds Backdate": one row per insured from Insured Input, working out
 * whether — and to what date — that insured's coverage could be backdated.
 * Every date here is measured against the Illustration Date (settings.refDate,
 * the same page-level reference date every other tab uses, INVARIANT #12) —
 * never real "today" — since that's the one date this container's own header
 * anchors Max. Backdate Date to.
 *
 * "Backdate Projection": a Show Projection on/off switch (this tab's own
 * local UI state — not part of `coverages`/`insureds`/`settings`, so it
 * lives here rather than being added to the core model for a toggle only
 * this container reads, the same reasoning the Coverages tab's own Unit
 * Value follows), two pending savings-date figures, and a 6-column table
 * whose formulas don't exist yet either — every column highlighted amber
 * rather than given invented rows, since no row-generation rule (period,
 * date range) has been specified.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var core = window.OptimizerCore;

  var MS_PER_DAY = 86400000;

  var COLUMNS = [
    'Insured Name', 'Insured Birthdate', 'Age Real', 'Age Nearest/Last',
    'Past Birthday', 'Midpoint (Possible Backdate)', 'Next Birthday',
    'Backdate Eligible', 'Backdated Age Nearest/Last',
    'Rate Current (All Cov.)', 'Rate Backdated (All Cov.)',
    'Confirm Backdate', 'Backdate Date'
  ];

  var PROJECTION_COLUMNS = [
    'Date', 'Premium Current', 'Cumul. Prem. Current',
    'Premium Backdated', 'Cumul. Prem. Backdated', 'Difference'
  ];

  /* Show Projection — this container's own on/off switch (§ file header).
     Not specified either way; OFF by default mirrors the same conservative
     "off until the operator opts in" reading Settings' own Multi-Coverage
     Discount default already uses (OPTIMIZER_REFERENCE.md §2a). */
  var showProjection = false;

  /** A plain "nothing to show" cell — the page's usual muted "—" for a value
      that genuinely has no figure (blank input, or a fully-resolved blank
      formula result), as opposed to core.pendingCell()'s amber "a formula for
      this column doesn't exist yet" (§ below). */
  function dashCell() {
    return '<td class="r"><span class="muted">—</span></td>';
  }

  /** dt - n months, via plain Date normalisation (JS rolls an out-of-range
      day into the following month on its own, e.g. 31-AUG minus 6 = ~3-MAR,
      not clamped to the shorter month's last day) — not addressed by the
      request; flagged here rather than silently picked. */
  function subtractMonths(dt, n) {
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() - n, dt.getUTCDate()));
  }

  /** The birthday that falls in calendar year `y`, from a birth month/day.
      29-FEB in a non-leap year has no real date; falls back to 28-FEB — the
      closest lived date — rather than skipping that year's birthday. Not
      specified by the request; the least surprising choice available for the
      one birth date this can ever affect. */
  function birthdayInYear(birth, y) {
    var d = core.buildDate(y, birth.getUTCMonth(), birth.getUTCDate());
    if (!d && birth.getUTCMonth() === 1 && birth.getUTCDate() === 29) {
      d = core.buildDate(y, 1, 28);
    }
    return d;
  }

  /** Most recent birthday on or before `asOf`, and the next one strictly
      after it. A birthday landing exactly on the Illustration Date counts as
      already past, not still upcoming — not specified by the request; the
      "most recent... that passed" wording reads as inclusive of asOf itself. */
  function surroundingBirthdays(birth, asOf) {
    var thisYear = birthdayInYear(birth, asOf.getUTCFullYear());
    if (thisYear.getTime() <= asOf.getTime()) {
      return { past: thisYear, next: birthdayInYear(birth, asOf.getUTCFullYear() + 1) };
    }
    return { past: birthdayInYear(birth, asOf.getUTCFullYear() - 1), next: thisYear };
  }

  /** The exact midpoint, in whole days, between two dates — rounded half up.
      Past and Next Birthday are 365 or 366 days apart, so an exact half-day
      split is never possible for the (far more common) 365 case; not
      specified by the request, round-half-up picked as the least surprising
      tie-break available. A day of 29/30/31 in the result then falls back to
      the 28th — same rule, and same reason (any month, not just the ones
      that day doesn't exist in), as Settings' own Reference Date. */
  function midpointDate(a, b) {
    var half = Math.round((b.getTime() - a.getTime()) / MS_PER_DAY / 2);
    var mid = new Date(a.getTime() + half * MS_PER_DAY);
    if (mid.getUTCDate() >= 29) mid = core.buildDate(mid.getUTCFullYear(), mid.getUTCMonth(), 28);
    return mid;
  }

  /** One insured's row. `illustration`/`maxBackdate` are Date objects (or
      null if settings.refDate somehow failed to parse — defensive; Settings
      never actually lets refDate go blank or invalid). A blank Birthdate
      leaves every derived cell blank — same "nothing to compute yet" rule
      Insured Input's own Age Real/Age Calculated cells already follow. */
  function backdateRow(ins, illustration, maxBackdate) {
    var birth = ins.birthdate ? core.parseDate(ins.birthdate) : null;

    if (!birth || !illustration) {
      return '<tr>' +
          '<td class="r">' + core.esc(ins.name) + '</td>' +
          '<td class="r">' + (ins.birthdate ? core.esc(ins.birthdate) : '—') + '</td>' +
          dashCell() + dashCell() + dashCell() + dashCell() + dashCell() + dashCell() + dashCell() +
          core.pendingCell() + core.pendingCell() +   // Rate Current / Rate Backdated — always pending
          dashCell() + dashCell() +
        '</tr>';
    }

    var ages = core.agesAt(ins.birthdate, core.fmtDate(illustration));
    var ageCalc = ins.ageCalc === 'last' ? ages.real : ages.nearest;

    var bdays = surroundingBirthdays(birth, illustration);
    var mid = midpointDate(bdays.past, bdays.next);
    var eligible = mid.getTime() >= maxBackdate.getTime() && mid.getTime() <= illustration.getTime();

    var backdatedAges = core.agesAt(ins.birthdate, core.fmtDate(mid));
    var backdatedAgeCalc = ins.ageCalc === 'last' ? backdatedAges.real : backdatedAges.nearest;

    /* Confirm Backdate = AND(Eligible; Rate Backdated < Rate Current). Rate
       Current/Rate Backdated have no formula yet (Col10/11, always pending),
       so the comparison itself can never be evaluated — EXCEPT that
       AND(FALSE; anything) is FALSE regardless: when this row isn't eligible,
       Confirm Backdate is already a real, fully-resolved FALSE, not an
       unknown. Backdate Date mirrors the same short-circuit one level up. */
    var confirmCell, backdateDateCell;
    if (!eligible) {
      confirmCell = '<td class="r">FALSE</td>';
      backdateDateCell = dashCell();          // AND(FALSE; …) → BLANK()
    } else {
      confirmCell = core.pendingCell();       // blocked on Col10/11
      backdateDateCell = core.pendingCell();  // blocked on Confirm Backdate
    }

    return '<tr>' +
        '<td class="r">' + core.esc(ins.name) + '</td>' +
        '<td class="r">' + core.esc(ins.birthdate) + '</td>' +
        '<td class="r">' + (ages.real === null ? '—' : ages.real) + '</td>' +
        '<td class="r">' + (ageCalc === null ? '—' : ageCalc) + '</td>' +
        '<td class="r">' + core.esc(core.fmtDate(bdays.past)) + '</td>' +
        '<td class="r">' + core.esc(core.fmtDate(mid)) + '</td>' +
        '<td class="r">' + core.esc(core.fmtDate(bdays.next)) + '</td>' +
        '<td class="r">' + (eligible ? 'TRUE' : 'FALSE') + '</td>' +
        '<td class="r">' + (backdatedAgeCalc === null ? '—' : backdatedAgeCalc) + '</td>' +
        core.pendingCell() +   // Rate Current (All Cov.)
        core.pendingCell() +   // Rate Backdated (All Cov.)
        confirmCell +
        backdateDateCell +
      '</tr>';
  }

  function renderBackdateTab() {
    if (!$('bdInsBody')) return;   // not built yet — see init() ordering

    var illustration = core.parseDate(core.settings.refDate);
    var maxBackdate = illustration ? subtractMonths(illustration, 6) : null;

    $('bdIllustrationDate').textContent = illustration ? core.fmtDate(illustration) : '—';
    $('bdMaxBackdateDate').textContent = maxBackdate ? core.fmtDate(maxBackdate) : '—';

    var list = core.insureds();
    $('bdInsBody').innerHTML = list.length
      ? list.map(function (ins) { return backdateRow(ins, illustration, maxBackdate); }).join('')
      : '<tr><td colspan="' + COLUMNS.length + '">' +
          '<div class="proj-slot" style="margin:0;"><div class="s">' +
            'No insureds yet — add one in Insured Input.' +
          '</div></div></td></tr>';
    $('bdInsCount').textContent = list.length + ' insured' + (list.length === 1 ? '' : 's');
  }

  function insuredsBackdateShell() {
    var headCells = COLUMNS.map(function (l) { return '<th class="r">' + core.esc(l) + '</th>'; }).join('');
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band">' +
          '<span class="card-title">Insureds Backdate</span>' +
          '<span class="card-note" id="bdInsCount"></span>' +
          '<span class="spacer"></span>' +
          '<div class="bd-band-figs">' +
            '<div class="bd-band-fig">' +
              '<span class="bd-band-fig-k">Illustration Date</span>' +
              '<span class="bd-band-fig-v" id="bdIllustrationDate">—</span>' +
            '</div>' +
            '<div class="bd-band-fig">' +
              '<span class="bd-band-fig-k">Max. Backdate Date</span>' +
              '<span class="bd-band-fig-v" id="bdMaxBackdateDate">—</span>' +
            '</div>' +
            '<div class="bd-band-fig bd-band-fig--warn" title="Formula not yet provided">' +
              '<span class="bd-band-fig-k">Final Backdate Date</span>' +
              '<span class="bd-band-fig-v">—</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="table-scroll-wrap">' +
          '<table class="ins bd-tab-table">' +
            '<thead><tr>' + headCells + '</tr></thead>' +
            '<tbody id="bdInsBody"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  /** The second container. Its table has no row source yet (§ file header),
      so it's a header-only shell — every header cell wears the amber
      "pending" look (`.cell-pending`, reused on a <th> here rather than a
      <td> — see optimizer_backdate.css for the specificity override that
      needs) plus a single spanning placeholder row, the same empty-state
      idiom the Insureds tab and Results' own coverage table already use for
      "nothing to render yet". Show Projection's OFF state hides `#bdProjBody`
      (the table) while leaving the band itself always visible, per the
      request. */
  function backdateProjectionShell() {
    var headCells = PROJECTION_COLUMNS.map(function (l) {
      return '<th class="r cell-pending" title="Formula not yet provided">' + core.esc(l) + '</th>';
    }).join('');
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band">' +
          '<span class="card-title">Backdate Projection</span>' +
          '<span class="spacer"></span>' +
          '<div class="bd-band-figs">' +
            '<div class="bd-band-fig">' +
              '<span class="bd-band-fig-k">Show Projection</span>' +
              '<button class="switch" type="button" role="switch" data-act="toggle-bdproj"' +
                ' aria-checked="' + showProjection + '">' + (showProjection ? 'ON' : 'OFF') + '</button>' +
            '</div>' +
            '<div class="bd-band-fig bd-band-fig--warn" title="Formula not yet provided">' +
              '<span class="bd-band-fig-k">Monthly Savings Date</span>' +
              '<span class="bd-band-fig-v">—</span>' +
            '</div>' +
            '<div class="bd-band-fig bd-band-fig--warn" title="Formula not yet provided">' +
              '<span class="bd-band-fig-k">Annual Savings Date</span>' +
              '<span class="bd-band-fig-v">—</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="bdProjBody"' + (showProjection ? '' : ' hidden') + '>' +
          '<div class="table-scroll-wrap">' +
            '<table class="ins bd-proj-table">' +
              '<thead><tr>' + headCells + '</tr></thead>' +
              '<tbody><tr><td colspan="' + PROJECTION_COLUMNS.length + '">' +
                '<div class="proj-slot" style="margin:0;"><div class="s">' +
                  'Formulas not yet provided — nothing to project yet.' +
                '</div></div>' +
              '</td></tr></tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function initBackdateTab() {
    $('backdateTabHost').innerHTML = insuredsBackdateShell() + backdateProjectionShell();
    renderBackdateTab();

    // Nothing on Insureds Backdate is editable yet (every column is mirrored,
    // computed, or pending — same as Results/Insureds) — so the only wiring
    // needed there is the shared change hook every split-off tab uses to
    // stay in step with `coverages`/`insureds`/`settings`. Backdate
    // Projection's own render never depends on that state (everything in it
    // is either local UI state or pending), so it's built once here and left
    // alone — only the Show Projection toggle below ever touches it again.
    core.onChange(renderBackdateTab);

    $('backdateTabHost').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act="toggle-bdproj"]') : null;
      if (!b) return;
      showProjection = !showProjection;
      b.setAttribute('aria-checked', String(showProjection));
      b.textContent = showProjection ? 'ON' : 'OFF';
      $('bdProjBody').hidden = !showProjection;
    });
  }

  initBackdateTab();
})();
