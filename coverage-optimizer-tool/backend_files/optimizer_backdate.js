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
 * The container's own "Final Backdate Date" is the MIN of the Backdate Date
 * column below it (finalBackdateDate), and the Results Summary's "Possible
 * Backdate Date" mirrors it through the bridge.
 *
 * "Backdate Projection": a Show Projection on/off switch (this tab's own
 * local UI state — not part of `coverages`/`insureds`/`settings`, so it
 * lives here rather than being added to the core model for a toggle only
 * this container reads, the same reasoning the Coverages tab's own Unit
 * Value follows) and a 6-column table, ported line-for-line from the
 * operator's own Excel Python-in-Excel projection script (chat, 2026-09-20):
 * two branches (Annual / everything else = Monthly) on settings.freq, each
 * building a union of Current-anniversary and Backdated-anniversary dates
 * and cumulating both sides' premiums. Needs a Final Backdate Date (there is
 * nothing to project against otherwise) and both Modal Premium totals
 * resolved — the same blocked/pending/error states as everywhere else on
 * this page, never an invented row. The Monthly/Annual Savings Date figures
 * in the header are a separate, later task (TO_DO C-3) and stay pending.
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

  // ------------------------------------------------------- projection rows
  /* dt + n months (n may be negative) — subtractMonths already normalises
     through plain Date arithmetic (an out-of-range day rolls into the next
     month, e.g. 31-AUG + 1mo ~= 1-OCT), so this is just its mirror. */
  function addMonths(dt, n) { return subtractMonths(dt, -n); }

  /** Sorted union of two date arrays, deduplicated by day, each entry
      flagged with which side(s) it belongs to — the script's own
      `DatetimeIndex.union()` plus the isCurrent/isBackdated membership
      checks it relies on, done in one pass instead of two array scans. */
  function unionDates(datesA, datesB) {
    var byTime = {};
    function mark(list, key) {
      list.forEach(function (d) {
        var t = d.getTime();
        if (!byTime[t]) byTime[t] = { date: d, inA: false, inB: false };
        byTime[t][key] = true;
      });
    }
    mark(datesA, 'inA');
    mark(datesB, 'inB');
    return Object.keys(byTime).map(Number).sort(function (a, b) { return a - b; })
      .map(function (t) { return byTime[t]; });
  }

  /** Running cumulative sums + Difference (cumC - cumB, per the script's own
      output header) over a { date, payC, payB } row set. */
  function cumulate(rows) {
    var cumC = 0, cumB = 0;
    return rows.map(function (r) {
      cumC += r.payC; cumB += r.payB;
      return { date: r.date, payC: r.payC, cumC: cumC, payB: r.payB, cumB: cumB, diff: cumC - cumB };
    });
  }

  /** Annual branch — union of yearly anniversaries on each side. The first
      Backdated anniversary (the Backdate Date itself) pays only the prorated
      partial-year amount; the first CURRENT anniversary after it pays the
      remainder (the "catch-up" year); every CURRENT anniversary after that
      pays a full Backdated premium; the Backdated side's own later
      anniversaries are checkpoints only (0) — ported exactly as the script's
      own np.where chain has it, including using isCurrent (not isBackdated)
      for that third branch. */
  function projectionAnnual(dateCurrent, dateBackdated, premCurrent, premBackdated) {
    var HORIZON_YEARS = 60;   // no Excel array-size limit here, but no reason to outgrow the original horizon either
    var daysProrated = Math.max(0, Math.round((dateCurrent.getTime() - dateBackdated.getTime()) / MS_PER_DAY));
    var proratedBackdated = premBackdated * (daysProrated / 365);
    var annualBackdated = premBackdated - proratedBackdated;

    var datesCurrent = [], datesBackdated = [];
    for (var y = 0; y <= HORIZON_YEARS; y++) {
      datesCurrent.push(addMonths(dateCurrent, y * 12));
      datesBackdated.push(addMonths(dateBackdated, y * 12));
    }
    var firstCurrent = datesCurrent[0].getTime(), firstBackdated = datesBackdated[0].getTime();

    var rows = unionDates(datesCurrent, datesBackdated).map(function (u) {
      var payC = u.inA ? premCurrent : 0, payB;
      if (u.date.getTime() === firstBackdated) payB = proratedBackdated;
      else if (u.date.getTime() === firstCurrent) payB = annualBackdated;
      else if (u.inA) payB = premBackdated;   // subsequent CURRENT anniversaries, per the script
      else payB = 0;                          // subsequent Backdated-only anniversaries — checkpoint
      return { date: u.date, payC: payC, payB: payB };
    });
    return cumulate(rows);
  }

  /** Monthly branch — union of monthly anniversaries on each side, full
      premium on each side's own dates, no prorating. `searchMonths` is the
      script's own horizon-sizing heuristic (how far out a stable crossing
      could plausibly need); ported as-is since it costs nothing here and the
      eventual Savings Date logic (TO_DO C-3) will want the same horizon. */
  function projectionMonthly(dateCurrent, dateBackdated, premCurrent, premBackdated) {
    var datedifM = (dateCurrent.getUTCFullYear() - dateBackdated.getUTCFullYear()) * 12
      + (dateCurrent.getUTCMonth() - dateBackdated.getUTCMonth())
      - (dateCurrent.getUTCDate() < dateBackdated.getUTCDate() ? 1 : 0);
    var backBeforeCurrent = dateBackdated.getTime() < dateCurrent.getTime()
      ? datedifM + 1 - (dateCurrent.getUTCDate() === dateBackdated.getUTCDate() ? 1 : 0)
      : 0;

    var REQUIRED_STREAK = 5;
    var delta = premCurrent - premBackdated;
    var denomForSizing = delta > 0 ? delta : 1;
    var initialGap = backBeforeCurrent * premBackdated;
    var approxMonths = Math.max(12, Math.ceil(initialGap / denomForSizing));
    var searchMonths = approxMonths + REQUIRED_STREAK + 24;

    var datesCurrent = [], datesBackdated = [];
    for (var i = 0; i < searchMonths; i++) {
      datesCurrent.push(addMonths(dateCurrent, i));
      datesBackdated.push(addMonths(dateBackdated, i));
    }

    var rows = unionDates(datesCurrent, datesBackdated).map(function (u) {
      return { date: u.date, payC: u.inA ? premCurrent : 0, payB: u.inB ? premBackdated : 0 };
    });
    return cumulate(rows);
  }

  /** { rows } or { error/pending/blocked } — the same three non-value states
      every other Backdate/Rates figure can be in. Needs a Final Backdate
      Date to project against, and both Modal Premium totals resolved. */
  function projectionInputs() {
    var fin = finalBackdateDate();
    if (fin.error) return { error: fin.error };
    if (!fin.date) return { blocked: fin.blocked };
    var curTotal = core.premiumTotal('modalPrem'), bdTotal = core.premiumTotal('modalPremBackdated');
    if (curTotal.error || bdTotal.error) return { error: curTotal.error || bdTotal.error };
    if (curTotal.pending || bdTotal.pending) return { pending: true };
    if (curTotal.blocked || bdTotal.blocked) return { blocked: curTotal.blocked || bdTotal.blocked };
    return {
      dateCurrent: core.parseDate(core.settings.refDate), dateBackdated: fin.date,
      premCurrent: curTotal.value, premBackdated: bdTotal.value
    };
  }

  function buildProjection() {
    var x = projectionInputs();
    if (x.error || x.pending || x.blocked) return x;
    var rows = core.settings.freq === 'annually'
      ? projectionAnnual(x.dateCurrent, x.dateBackdated, x.premCurrent, x.premBackdated)
      : projectionMonthly(x.dateCurrent, x.dateBackdated, x.premCurrent, x.premBackdated);
    return { rows: rows };
  }

  /** Annual Savings Date — ported from your annual.md: the first date the
      cumulative Difference reaches or passes the prorated first-year
      Backdated premium (the retroactive amount paid to obtain backdating).
      Always computed on the Annual schedule, regardless of settings.freq —
      it's a separate figure from the visible projection table. */
  function annualSavingsDate() {
    var x = projectionInputs();
    if (x.error || x.pending || x.blocked) return x;
    var daysProrated = Math.max(0, Math.round((x.dateCurrent.getTime() - x.dateBackdated.getTime()) / MS_PER_DAY));
    var proratedBackdated = x.premBackdated * (daysProrated / 365);
    var rows = projectionAnnual(x.dateCurrent, x.dateBackdated, x.premCurrent, x.premBackdated);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].diff >= proratedBackdated) return { date: rows[i].date };
    }
    return { blocked: 'no stabilization within the annual horizon' };
  }

  /** Monthly Savings Date — ported from your monthly.md: no stabilization at
      all when the Backdated premium isn't actually lower; otherwise the
      first date after which the cumulative Difference stays positive for
      the rest of the (same-sized) search window. Always computed on the
      Monthly schedule, regardless of settings.freq. */
  function monthlySavingsDate() {
    var x = projectionInputs();
    if (x.error || x.pending || x.blocked) return x;
    if (x.premCurrent - x.premBackdated <= 0) {
      return { blocked: 'no stabilization — the Backdated premium is not lower than Current' };
    }
    var rows = projectionMonthly(x.dateCurrent, x.dateBackdated, x.premCurrent, x.premBackdated);
    var lastNonPositive = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].diff <= 0) lastNonPositive = i;
    }
    if (lastNonPositive === -1) return { date: rows[0].date };                // positive from the very first row
    if (lastNonPositive >= rows.length - 1) return { blocked: 'no stabilization within the derived window' };
    return { date: rows[lastNonPositive + 1].date };
  }

  function moneyCell(v, sep) { return '<td class="r' + (sep ? ' col-hard-sep' : '') + '">' + core.group(v, 2) + '</td>'; }

  /** The whole row wears .cell-pos once its Difference turns positive —
      cumulative Current has overtaken cumulative Backdated. */
  function projectionRow(r) {
    return '<tr' + (r.diff > 0 ? ' class="cell-pos"' : '') + '>' +
        '<td class="r">' + core.esc(core.fmtDate(r.date)) + '</td>' +
        moneyCell(r.payC, 1) + moneyCell(r.cumC) + moneyCell(r.payB, 1) + moneyCell(r.cumB) + moneyCell(r.diff, 1) +
      '</tr>';
  }

  /** Rebuilds just the table body — called from renderBackdateTab() so the
      Projection stays current with every coverages/insureds/settings/rates
      change, the same as the Insureds Backdate container above. */
  function renderProjectionBody() {
    var body = $('bdProjTableBody');
    if (!body) return;
    var p = buildProjection();
    var msg = p.error
      ? '<span class="cell-error">' + core.esc(p.error) + '</span>'
      : p.pending ? 'Not calculated yet.'
      : p.blocked ? core.esc(p.blocked)
      : null;
    body.innerHTML = msg
      ? '<tr><td colspan="' + PROJECTION_COLUMNS.length + '"><div class="proj-slot" style="margin:0;"><div class="s">' + msg + '</div></div></td></tr>'
      : p.rows.map(projectionRow).join('');
  }

  /** A plain "nothing to show" cell — the page's usual muted "—" for a value
      that genuinely has no figure (blank input, or a fully-resolved blank
      formula result), as opposed to core.pendingCell()'s amber "a formula for
      this column doesn't exist yet" (§ below). */
  function dashCell(why) {
    return '<td class="r"><span class="muted"' + (why ? ' title="' + core.esc(why) + '"' : '') + '>—</span></td>';
  }

  /** A rate the Rates tab looked up but couldn't resolve (see allCovRate) —
      the same red .cell-error the Rates tab uses, reason in the tooltip. */
  function errorCell(why) {
    return '<td class="r cell-error" title="' + core.esc(why) + '">Error</td>';
  }

  /** One allCovRate() result -> its cell: the figure (parts in the tooltip),
      a red Error, or a muted "—" while it's blocked on missing input. */
  function rateCell(r) {
    if (r.error) return errorCell(r.error);
    if (r.blocked) return dashCell(r.blocked);
    return '<td class="r" title="' + core.esc(r.detail) + '">' + core.group(r.value, 2) + '</td>';
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

  /** The surrounding birthdays, the Midpoint (Possible Backdate), and Backdate
      Eligible — the Midpoint falls between Max. Backdate Date and the
      Illustration Date — for one birthdate. One place, so the row below and
      core.backdateEligible (the Rates tab's BD_Final) can't disagree. */
  function eligibility(birth, illustration, maxBackdate) {
    var bdays = surroundingBirthdays(birth, illustration);
    var mid = midpointDate(bdays.past, bdays.next);
    return {
      bdays: bdays, mid: mid,
      eligible: mid.getTime() >= maxBackdate.getTime() && mid.getTime() <= illustration.getTime()
    };
  }

  /** One insured's backdate decision as VALUES rather than cells, so the row
      below and the Final Backdate Date above it can never disagree:
        Rate Current / Rate Backdated (All Cov.) are the sums of the insured's
        PR_N / PR_BD_N over every coverage they are on (core.allCovRate — the
        Rates tab owns the lookups). Confirm Backdate = AND(Eligible; Rate
        Backdated < Rate Current), and Backdate Date is the Midpoint when that
        is TRUE, otherwise BLANK(). Not eligible is FALSE whatever the rates
        say (AND(FALSE; anything)); eligible with a rate unavailable leaves the
        comparison unknown (`unresolved`, carrying that rate's own state).
      Returns { e, cur, bd, date: Date|null, unresolved: null|{error|blocked} }. */
  function insuredBackdate(ins, illustration, maxBackdate) {
    var e = eligibility(core.parseDate(ins.birthdate), illustration, maxBackdate);
    var cur = core.allCovRate(ins._id, false), bd = core.allCovRate(ins._id, true);
    var out = { e: e, cur: cur, bd: bd, date: null, unresolved: null };
    if (!e.eligible) return out;
    if (cur.value === undefined || bd.value === undefined) {
      out.unresolved = (cur.error && cur) || (bd.error && bd) || (cur.value === undefined ? cur : bd);
    } else if (bd.value < cur.value - 1e-9) {   // strict "<", not fooled by float noise (0.1 + 0.2 vs 0.3)
      out.date = e.mid;
    }
    return out;
  }

  /** Final Backdate Date = MIN of the per-insured Backdate Dates, ignoring the
      blank ones — an insured who can't be backdated doesn't hold the others
      back (3 insureds at 13-JUL-2026 / BLANK / 24-MAY-2026 give 24-MAY-2026).
      No dates at all, or nobody with a birthdate, is itself blank. An insured
      whose own date couldn't be resolved makes the MIN unknowable — it might
      have been the earliest — so that state wins over a possibly-wrong date.
      Lent to the Results Summary (optimizer.js) as core.finalBackdateDate. */
  function finalBackdateDate() {
    var illustration = core.parseDate(core.settings.refDate);
    if (!illustration) return { blocked: 'needs a Reference Date' };
    var maxBackdate = subtractMonths(illustration, 6), best = null, unresolved = null;
    core.insureds().forEach(function (ins) {
      if (!ins.birthdate || !core.parseDate(ins.birthdate)) return;   // nothing to contribute
      var r = insuredBackdate(ins, illustration, maxBackdate);
      if (r.unresolved) unresolved = unresolved || r.unresolved;
      else if (r.date && (!best || r.date.getTime() < best.getTime())) best = r.date;
    });
    if (unresolved) return unresolved;
    return best ? { date: best } : { blocked: 'no insured is backdatable' };
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
          dashCell() + dashCell() + dashCell() + dashCell() +   // rates, Confirm, Date: nothing to compute without a birthdate
        '</tr>';
    }

    var ages = core.agesAt(ins.birthdate, core.fmtDate(illustration));
    var ageCalc = ins.ageCalc === 'last' ? ages.real : ages.nearest;

    var r = insuredBackdate(ins, illustration, maxBackdate);
    var bdays = r.e.bdays, mid = r.e.mid, eligible = r.e.eligible, cur = r.cur, bd = r.bd;

    var backdatedAges = core.agesAt(ins.birthdate, core.fmtDate(mid));
    var backdatedAgeCalc = ins.ageCalc === 'last' ? backdatedAges.real : backdatedAges.nearest;

    var confirmCell, backdateDateCell;
    if (r.unresolved) {                         // the comparison can't be made — wear the rate's own state
      confirmCell = backdateDateCell = rateCell(r.unresolved);
    } else if (r.date) {
      confirmCell = '<td class="r">TRUE</td>';
      backdateDateCell = '<td class="r">' + core.esc(core.fmtDate(r.date)) + '</td>';
    } else {
      confirmCell = '<td class="r">FALSE</td>';
      backdateDateCell = dashCell();            // BLANK()
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
        rateCell(cur) +        // Rate Current (All Cov.)
        rateCell(bd) +         // Rate Backdated (All Cov.)
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

    // MIN of the column below it. `.cell-error` is a bare class, so the red
    // "a rate wouldn't resolve" state reads the same here as in any table cell.
    var fin = finalBackdateDate(), el = $('bdFinalBackdateDate');
    el.className = 'bd-band-fig-v' + (fin.error ? ' cell-error' : '');
    el.textContent = fin.date ? core.fmtDate(fin.date) : (fin.error ? 'Error' : '—');
    el.title = fin.date ? 'the earliest Backdate Date below' : (fin.error || fin.blocked);

    var list = core.insureds();
    $('bdInsBody').innerHTML = list.length
      ? list.map(function (ins) { return backdateRow(ins, illustration, maxBackdate); }).join('')
      : '<tr><td colspan="' + COLUMNS.length + '">' +
          '<div class="proj-slot" style="margin:0;"><div class="s">' +
            'No insureds yet — add one in Insured Input.' +
          '</div></div></td></tr>';
    $('bdInsCount').textContent = list.length + ' insured' + (list.length === 1 ? '' : 's');

    renderProjectionBody();
    renderSavingsDates();
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
            '<div class="bd-band-fig">' +
              '<span class="bd-band-fig-k">Final Backdate Date</span>' +
              '<span class="bd-band-fig-v" id="bdFinalBackdateDate">—</span>' +
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

  /** The second container. The table and both Savings Date figures are real
      now (§ file header, renderProjectionBody/renderSavingsDates). Show
      Projection's OFF state hides `#bdProjBody` (the table) while leaving
      the band itself always visible, per the request. */
  function backdateProjectionShell() {
    var headCells = PROJECTION_COLUMNS.map(function (l, i) {
      return '<th class="r' + (i === 1 || i === 3 || i === 5 ? ' col-hard-sep' : '') + '">' + core.esc(l) + '</th>';   // hard separators before Premium Current, Premium Backdated and Difference
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
            '<div class="bd-band-fig">' +
              '<span class="bd-band-fig-k">Monthly Savings Date</span>' +
              '<span class="bd-band-fig-v" id="bdMonthlySavingsDate">—</span>' +
            '</div>' +
            '<div class="bd-band-fig">' +
              '<span class="bd-band-fig-k">Annual Savings Date</span>' +
              '<span class="bd-band-fig-v" id="bdAnnualSavingsDate">—</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="bdProjBody"' + (showProjection ? '' : ' hidden') + '>' +
          '<div class="table-scroll-wrap">' +
            '<table class="ins bd-proj-table">' +
              '<thead><tr>' + headCells + '</tr></thead>' +
              '<tbody id="bdProjTableBody"></tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /** Fills the two header pills — same figure/Error/blocked-with-reason
      convention as Final Backdate Date above, each independent of
      settings.freq (§ annualSavingsDate/monthlySavingsDate). */
  function renderSavingsDates() {
    [['bdMonthlySavingsDate', monthlySavingsDate], ['bdAnnualSavingsDate', annualSavingsDate]].forEach(function (pair) {
      var el = $(pair[0]);
      if (!el) return;
      var r = pair[1]();
      el.className = 'bd-band-fig-v' + (r.error ? ' cell-error' : '');
      el.textContent = r.date ? core.fmtDate(r.date) : (r.error ? 'Error' : '—');
      el.title = r.date ? '' : (r.error || r.blocked || '');
    });
  }

  function initBackdateTab() {
    // Lent to the Rates tab (BD_Final): this insured's Backdate Eligible —
    // true / false, or null while the birthdate is blank/invalid.
    core.finalBackdateDate = finalBackdateDate;   // lent to the Results Summary (optimizer.js)
    core.monthlySavingsDate = monthlySavingsDate; // lent to the Results Summary (optimizer.js)
    core.annualSavingsDate = annualSavingsDate;    // same

    core.backdateEligible = function (ins) {
      var birth = ins.birthdate ? core.parseDate(ins.birthdate) : null, ill = core.parseDate(core.settings.refDate);
      return birth && ill ? eligibility(birth, ill, subtractMonths(ill, 6)).eligible : null;
    };

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
    document.addEventListener('ratesstatus', renderBackdateTab);   // the rate files finished (re)loading

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
