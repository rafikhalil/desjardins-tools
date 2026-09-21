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
 * per-coverage field this tab alone owns (Unit Value). The 8 "Perm Joint …"
 * columns after Coverage Fee mirror the coverage's Joint container (same
 * columns as the Insureds tab, core.jointFigures; "—" on a coverage with no
 * joint side). Modal Prem. is computed (modalPremCell, the Excel LET() — it
 * reads the Rates tab through core.bandTotals), and this file also owns
 * Results' Prem. Basis Ins. Amt and Highest Amt (Max./Min.) — that same
 * formula run backwards (premBasis / highestAmt, lent to optimizer.js through
 * the bridge). Two columns (the two Perm Joint … Backdated
 * ones — plus Extra Prem. Term $ and both Modal Prem. columns for Critical
 * Illness, whose rules aren't specified) have no
 * formula yet — highlighted amber/"warn" (the closest existing semantic token to
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
    'Modal Factor', 'Coverage Fee',
    // The Joint container's figures — the same 8 columns, in the same order, as the Insureds tab.
    'Perm Joint Age', 'Perm Equiv. Substd. %', 'Perm Flat Extra Prem. $ Perm',
    'Perm Flat Extra Prem. $ Term', 'Perm Flat Extra Prem. $ Duration',
    'Perm Joint Age Backdated', 'Perm Joint Extra Prem. % Backdated', 'Perm Joint Extra Prem. $ Backdated',
    'Modal Prem.', 'Modal Prem. Backdated'
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

  function modalFactor() {                       // null while Payment Frequency is blank — no factor
    var freq = core.settings.freq;
    return freq === 'annually' ? 1 : freq === 'monthly' ? 0.09 : null;
  }
  function modalFactorFor() {
    var mf = modalFactor();
    return mf === null ? '—' : mf.toFixed(2);
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
  function extraTermTotal(c) {                   // the figure (null: nothing to sum yet)
    var total = null;
    if (core.isJointPerm(c)) {
      var j = c.joint || {}, has = function (v) { return v !== null && v !== undefined; };
      if (has(j.extraFlat) || has(j.extraTempAmt)) total = (j.extraFlat || 0) + (j.extraTempAmt || 0);
    } else if (c.covType) {
      c.insureds.forEach(function (s) {
        if (s.insuredId) total = (total || 0) + (s.extraFlat || 0) + (s.extraTempAmt || 0);
      });
    }
    return total;
  }
  function extraTermCell(c) {
    if (c.category !== 'termLife' && c.category !== 'permLife') {
      return c.category ? core.pendingCell() : '<td class="r">—</td>';
    }
    return '<td class="r">' + moneyOrDash(extraTermTotal(c)) + '</td>';
  }

  /* Excel's ROUND / TRUNC, on the DECIMAL value rather than the binary double:
     2.675 rounds to 2.68 (Math.round(x * 100) would give 2.67) and 0.29
     truncated to 6 places stays 0.29. Values are first cut to 15 significant
     digits — what Excel itself works with — so sum noise (5.999999999999999)
     can't tip a TRUNC. Halves round away from zero. */
  function shift(x, d) {
    var n = Number(x.toPrecision(15)), s = String(n);
    return s.indexOf('e') < 0 ? Number(s + 'e' + d) : n * Math.pow(10, d);
  }
  function xRound(x, d) { return (x < 0 ? -1 : 1) * shift(Math.round(shift(Math.abs(x), d)), -d); }
  function xTrunc(x, d) { return (x < 0 ? -1 : 1) * shift(Math.floor(shift(Math.abs(x), d)), -d); }

  /** Modal Prem. — the original Excel LET(), variable by variable (the names
      below are its own).
        Input Premium: Modal Premium = the premium typed in.
        Coverage Amount: insurance_amount = the amount; band_match = the
        closest lower rate band (core.bandTotals); pr_match / pep_match = that
        band's PR_Total / PEP_Total; cost_of_insurance, pep_value, tep_value
        as written; Modal Premium = ROUND((coi + pep + tep) * modal_factor; 2)
        + ROUND(coverage_fee * modal_factor; 2). term_extra_prem is the Extra
        Prem. Term $ column — on a joint Permanent Life coverage the Joint
        container's Flat Extra Prem. $ Perm alone.
      A figure, a muted "—" while an input is missing (the reason is the
      tooltip), or a red Error when the rate lookup fails. Critical Illness
      has no formula yet (amber). */
  /** Everything the Modal Prem. LET() needs that does NOT change with the
      insurance amount — gathered once so Highest Amt's own trial amounts reuse
      it. { ctx } or { blocked } with the reason. */
  function premContext(c) {
    var modal_factor = modalFactor();
    if (modal_factor === null) return { blocked: 'needs a Payment Frequency (Settings)' };
    var joint = core.isJointPerm(c);
    var term_extra_prem = joint ? c.joint.extraFlat : extraTermTotal(c);
    if (term_extra_prem === null || term_extra_prem === undefined) {
      return { blocked: joint ? 'Flat Extra Prem. $ Perm is blank (Joint container)' : 'Extra Prem. Term $ isn\'t available yet' };
    }
    if (c.fee === null || c.fee === undefined) return { blocked: 'needs a Coverage Fee (Coverage Input)' };
    var s = core.settings;
    return { ctx: {
      modal_factor: modal_factor, term_extra_prem: term_extra_prem, coverage_fee: c.fee,
      unit_value: unitValueFor(c._id),
      prem_adj_percentage: s.premAdjPct / 100,   // Settings holds the % as 100 = x1.00
      prem_adj_dollar: s.premAdjAmt
    } };
  }

  /** The Excel LET() itself — pure arithmetic, no DOM and no lookups: the Modal
      Prem. for `insurance_amount` at a band whose PR_Total/PEP_Total are `pr`/
      `pep`. The column calls it once; Highest Amt calls it per trial amount,
      which is why it takes the band's two figures rather than finding them. */
  function modalPremAt(x, pr, pep, insurance_amount) {
    var units = xRound(insurance_amount / x.unit_value, 5);
    var cost_of_insurance = xRound(xRound(xTrunc(pr, 6) * units, 2) * x.prem_adj_percentage + x.prem_adj_dollar, 2);
    var pep_value = xRound(xRound(pep * units, 2) * x.prem_adj_percentage, 2);
    var tep_value = xRound(x.term_extra_prem * units, 2);
    // The outer xRound is NOT in the Excel formula and changes no value: both
    // halves are already 2-decimal figures, so their decimal sum is one too. It
    // is here because the sum of two doubles lands a hair off the double the
    // same decimal parses to — 163.99 + 1.80 is 165.79000000000002, which is
    // `> 165.79`. Prem. Basis Ins. Amt compares a computed premium against the
    // premium the operator typed, so without this every amount that costs
    // exactly the premium was rejected as too expensive (a 165.79 premium
    // returned 152,660, the answer for 165.78, instead of 152,669).
    return {
      coi: cost_of_insurance, pep: pep_value, tep: tep_value,
      modal: xRound(xRound((cost_of_insurance + pep_value + tep_value) * x.modal_factor, 2) +
                    xRound(x.coverage_fee * x.modal_factor, 2), 2)
    };
  }

  /** Modal Prem. as a VALUE — { value, tip } / { blocked } / { error } /
      { pending } — so this tab's own column and the Results table's mirror of
      it (optimizer.js, through core.modalPrem) can never disagree. */
  function modalPrem(c) {
    if (c.calcType === 'premium') {
      return (c.amount === null || c.amount === undefined)
        ? { blocked: 'needs the Input premium' }
        : { value: c.amount, tip: 'the premium entered' };
    }
    if (c.category !== 'termLife' && c.category !== 'permLife') {
      return c.category ? { pending: true } : { blocked: 'choose a Coverage Category' };
    }
    if (c.amount === null || c.amount === undefined) return { blocked: 'needs a Coverage Amount' };
    var t = core.bandTotals(c);                            // band_match, pr_match, pep_match
    if (t.error || t.blocked) return t;
    var x = premContext(c);
    if (x.blocked) return x;
    var p = modalPremAt(x.ctx, t.pr, t.pep, c.amount);
    return { value: p.modal, tip: 'band ' + t.band.code + ' · PR_Total ' + t.pr + ' · PEP_Total ' + t.pep +
      ' · cost_of_insurance ' + p.coi + ' · pep_value ' + p.pep + ' · tep_value ' + p.tep +
      ' · modal_factor ' + x.ctx.modal_factor + ' · coverage_fee ' + x.ctx.coverage_fee };
  }

  /** Modal Prem. Backdated — the same LET() as Modal Prem., on the SAME rate
      band, but built from PR_BD_Final / PEP_BD_Final instead of PR_Total /
      PEP_Total (core.bandFinalTotals, which matches the band through the same
      bandFor): the Coverage Amount's own band, NOT the Highest Amt optimum's;
      or, on Calculation Type "Input Premium", the band of Prem. Basis Ins. Amt.
      `insurance_amount` follows the same rule — the Coverage Amount, or that
      same Prem. Basis Ins. Amt. Unlike Modal Prem., an Input Premium coverage's
      backdated figure is calculated rather than the premium typed in: that is
      the whole point of comparing them. */
  function modalPremBackdated(c) {
    if (c.category !== 'termLife' && c.category !== 'permLife') {
      return c.category ? { pending: true } : { blocked: 'choose a Coverage Category' };
    }
    var insurance_amount = c.amount;
    if (c.calcType === 'premium') {
      var pb = premBasis(c);                               // the amount that premium buys
      if (!pb.amount) return pb;
      insurance_amount = pb.amount;
    }
    if (insurance_amount === null || insurance_amount === undefined) {
      return { blocked: 'needs a Coverage Amount' };
    }
    var t = core.bandFinalTotals(c);
    if (t.error || t.blocked) return t;
    var x = premContext(c);
    if (x.blocked) return x;
    var p = modalPremAt(x.ctx, t.pr, t.pep, insurance_amount);
    return { value: p.modal, tip: 'band ' + t.band.code + ' · on ' + core.group(insurance_amount, 0) +
      ' · PR_BD_Final ' + t.pr + ' · PEP_BD_Final ' + t.pep +
      ' · cost_of_insurance ' + p.coi + ' · pep_value ' + p.pep + ' · tep_value ' + p.tep };
  }

  /** One premium result — Modal Prem. or Modal Prem. Backdated — as a cell. */
  function premCell(m) {
    if (m.pending) return core.pendingCell();
    if (m.error) return '<td class="r cell-error" title="' + core.esc(m.error) + '">Error</td>';
    if (m.blocked) return '<td class="r"><span class="muted" title="' + core.esc(m.blocked) + '">—</span></td>';
    return '<td class="r" title="' + core.esc(m.tip) + '">' + core.group(m.value, 2) + '</td>';
  }

  /* Results' Prem. Basis Ins. Amt and Highest Amt (Max.)/(Min.) — computed
     here, not in optimizer.js, because both are the Modal Prem. formula above
     run backwards; Results only renders what they return (core.premBasis /
     core.highestAmt). They are the SAME search (solveAmount) differing only in
     which premium it is solved against:
       Highest Amt (Max.)   — the Modal Prem. calculated at the operator's own
                              Coverage Amount, so the answer can never come out
                              below the amount they typed (your call).
       Prem. Basis Ins. Amt — the Input Premium they typed, so the answer is
                              simply the most that premium buys.
     Each is blank for the other's Calculation Type.

     The ported Excel LET():
       base_prem   = modal_premium / modal_factor - coverage_fee - prem_adj_dollar
       denominator = prem_adj_percentage * (pr_all + pep_all) + term_extra_prem
       ins_amount_per_band  = IF((base_prem>0)*(denominator>0);
                                 unit_value * base_prem/denominator; NA())
       ins_amount_filtering = kept only while lower_band <= it < upper_band,
                              upper_band being the next band up (the last one
                              capped at TOP_CAP), else 0
     The best survivor is a starting GUESS, not the answer: from there the
     amount walks $1 at a time, pricing the next dollar before taking it, so it
     ends on the LAST amount whose Modal Prem. is still within the premium.
     Highest Amt (Min.) is that answer's own rate band.

     ponytail: the walk is linear in $1 steps, capped at MAX_STEPS. The
     per-band guess normally lands it within a few dozen steps (and every step
     is arithmetic — the per-band totals are fetched once, up front); the cap
     only exists so a render can never hang. */
  var MAX_STEPS = 100000, TOP_CAP = 25000000;

  /** The largest whole-dollar insurance amount whose Modal Prem. is still
      within `target`, never going below `floor`. { amount }, or { blocked } /
      { error }. */
  function solveAmount(c, ctx, all, target, floor) {
    var base_prem = target / ctx.modal_factor - ctx.coverage_fee - ctx.prem_adj_dollar;
    var best = 0, fallback = 0;
    all.list.forEach(function (b, i) {
      var denominator = ctx.prem_adj_percentage * (b.pr + b.pep) + ctx.term_extra_prem;
      if (!(base_prem > 0 && denominator > 0)) return;     // NA() — this band contributes nothing
      var amt = ctx.unit_value * (base_prem / denominator);
      var lower = b.band.amount, upper = all.list[i + 1] ? all.list[i + 1].band.amount : TOP_CAP;
      if (amt >= lower && amt < upper && amt > best) best = amt;
      // ponytail: a guess for the case where the filter rejects every band (the
      // answer sitting right on a boundary) — the estimate pulled DOWN into the
      // band it overshot, so the walk below starts beside the answer instead of
      // crawling from `floor` into MAX_STEPS. Never pulled UP: a band the
      // estimate cannot even reach must not become the starting point.
      if (amt >= lower) { var cand = Math.min(amt, upper - 1); if (cand > fallback) fallback = cand; }
    });

    /** The Modal Prem. of a trial amount, at whichever band THAT amount falls
        in — the band can change under it, which is the whole point. */
    function premAt(amount) {
      var band = core.bandAt(c, amount), hit = null;
      if (!band) return null;
      all.list.forEach(function (b) { if (b.band.code === band.code) hit = b; });
      return hit ? modalPremAt(ctx, hit.pr, hit.pep, amount).modal : null;
    }

    var amount = Math.max(Math.floor(best || fallback), floor), steps = 0, p;
    var stalled = { error: 'the amount did not settle within ' + MAX_STEPS + ' steps' };
    // Nothing below `floor` is on offer, so if even that costs more than the
    // premium there is no answer — say so instead of walking into the cap.
    p = premAt(floor);
    if (p === null || p > target) return { blocked: 'this premium does not reach the lowest rate band' };
    while (amount > floor) {                                       // the guess overshot — back down
      p = premAt(amount);
      if (p !== null && p <= target) break;
      amount--;
      if (++steps > MAX_STEPS) return stalled;
    }
    for (;;) {                                                     // then up, $1 at a time
      p = premAt(amount + 1);
      if (p === null || p > target) break;
      amount++;
      if (++steps > MAX_STEPS) return stalled;
    }
    return { amount: amount };
  }

  /** Everything solveAmount() needs that both callers gather the same way.
      { ctx, all } or the { blocked } / { error } / { pending } to show. */
  function solveInputs(c) {
    if (c.category !== 'termLife' && c.category !== 'permLife') {
      return c.category ? { pending: true } : { blocked: 'choose a Coverage Category' };
    }
    var all = core.bandTotalsAll(c);                       // pr_all / pep_all, every band
    if (all.error || all.blocked) return all;
    var x = premContext(c);
    if (x.blocked) return x;
    return { ctx: x.ctx, all: all };
  }

  function highestAmt(c) {
    if (c.calcType !== 'amount') return { blank: true };   // Input Premium: blank, per the request
    if (c.amount === null || c.amount === undefined) return { blocked: 'needs a Coverage Amount' };
    var own = core.bandTotals(c);                          // the coverage's own band
    if (own.error || own.blocked) return own;
    var inp = solveInputs(c);
    if (!inp.ctx) return inp;
    var target = modalPremAt(inp.ctx, own.pr, own.pep, c.amount).modal;
    var r = solveAmount(c, inp.ctx, inp.all, target, c.amount);
    if (!r.amount) return r;
    // Only worth reporting when the premium reaches a HIGHER rate band (your
    // call): inside the operator's own band the extra dollars are rounding
    // slack, not "the next band costs you the same".
    var band = core.bandAt(c, r.amount);
    if (!band || band.amount <= own.band.amount) {
      return { blocked: 'no higher rate band is within this premium (still ' + own.band.code + ')', info: true };   // not a problem — the message bar skips it
    }
    return { max: r.amount, min: band.amount, tip: 'at Modal Prem. ' + core.group(target, 2) };
  }

  function premBasis(c) {
    if (c.calcType !== 'premium') return { blank: true };  // Coverage Amount: blank, per the request
    if (c.amount === null || c.amount === undefined) return { blocked: 'needs the Input premium' };
    var inp = solveInputs(c);
    if (!inp.ctx) return inp;
    var r = solveAmount(c, inp.ctx, inp.all, c.amount, inp.all.list[0].band.amount);
    if (!r.amount) return r;
    return { amount: r.amount, tip: 'the most the ' + core.group(c.amount, 2) + ' premium buys' };
  }

  /** The top-bar messages for this tab (core.diagnostics): what stops a Term /
      Permanent Life coverage's Modal Prem., Modal Prem. Backdated, Prem. Basis
      Ins. Amt or Highest Amt that the operator can FIX — asked of the very
      functions the cells call, so they can't disagree. Deliberately left out:
        - rate-lookup failures ("no rate found at …"): those are the Rates tab's
          messages, with the real cause (ratesIssues), not repeated here;
        - a plain blank input (no Coverage Amount / Input premium, no insured,
          no Category): the yellow highlight and the cell tooltip cover it;
        - "no higher rate band is within this premium": information, not a fault.
      What is left is ACTIONABLE below. The checks run in dependency order, so a
      reason only shows once everything before it is in place. Payment Frequency
      is one message for the whole page, not one per coverage. */
  var ACTIONABLE = /Payment Frequency|Coverage Fee|Flat Extra Prem|lowest rate band|did not settle/;
  function coverageIssues() {
    var out = [];
    core.coverages().forEach(function (c, ci) {
      if (c.category !== 'termLife' && c.category !== 'permLife') return;
      var where = 'Coverages — Coverage ' + (ci + 1) + ' (' + core.coverageTitle(c) + ')', byWhy = {}, order = [];
      [['Modal Prem.', modalPrem(c)], ['Modal Prem. Backdated', modalPremBackdated(c)],
       ['Prem. Basis Ins. Amt', premBasis(c)], ['Highest Amt', highestAmt(c)]].forEach(function (p) {
        var why = p[1].error || p[1].blocked;
        if (!why || p[1].info || !ACTIONABLE.test(why)) return;
        if (!byWhy[why]) { byWhy[why] = []; order.push(why); }
        byWhy[why].push(p[0]);
      });
      order.forEach(function (why) {
        if (/Payment Frequency/.test(why)) {
          out.push({ key: 'd:freq', msg: 'Settings — Payment Frequency isn\'t set, so no Modal Prem. can be calculated (the monthly / annual modal factor depends on it).' });
          return;
        }
        var reason = /^amount is below/.test(why) ? 'the Coverage Amount is below the lowest rate band — raise it to at least that band'
          : /^this premium does not/.test(why) ? 'the Input premium is too low to buy even the lowest rate band — raise it' : why;
        out.push({ key: 'd:cov:' + c._id + ':' + why, msg: where + ': ' + byWhy[why].join(', ') + ' can\'t be calculated — ' + reason + '.' });
      });
    });
    return out;
  }

  /* Column order matches COLUMNS above exactly — 24 cells, 1 per header.
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
        core.jointFigures(c).map(function (v) { return '<td class="r">' + core.esc(v) + '</td>'; }).join('') +
        core.pendingCell() +   // Perm Joint Extra Prem. % Backdated
        core.pendingCell() +   // Perm Joint Extra Prem. $ Backdated
        premCell(modalPrem(c)) +              // Modal Prem.
        premCell(modalPremBackdated(c)) +     // Modal Prem. Backdated
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
      var n = core.coverages().map(function (c) { return c._id; }).indexOf(p[1]) + 1;
      core.badInput(el, res.msg, 'Coverages — Coverage ' + n);
      return;
    }
    core.goodInput(el);
    unitValues[p[1]] = res.v;
    unitValuesChanged();
  }

  /** Unit Value feeds Modal Prem., which the Results panel mirrors — but it
      lives only in this file, so nothing else re-renders when it changes.
      One event, which optimizer.js's Results listens for. */
  function unitValuesChanged() {
    renderCoveragesTab();
    document.dispatchEvent(new Event('unitvaluechange'));
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
    document.addEventListener('ratesstatus', renderCoveragesTab);   // Modal Prem. needs the rate files

    // Unit Value lives only here — not in optimizer.js's own model (§ file
    // header) — so a saved test case (optimizer_history.js) can't capture or
    // restore it without this tab opting in. `set` is this file's own
    // mutation path (same idea as covTabCommit), just reachable from outside
    // through the bridge rather than a DOM event.
    core.modalPrem = modalPrem;     // lent to Results (optimizer.js): the two premium columns it mirrors …
    core.modalPremBackdated = modalPremBackdated;
    core.highestAmt = highestAmt;   // … the same formula run backwards …
    core.premBasis = premBasis;     // … and the same search against the premium typed in (a premium coverage's band follows it)

    core.diagnostics(coverageIssues);   // the top-bar messages (§ coverageIssues)

    core.registerSnapshot('unitValues', {
      get: function () { return unitValues; },
      set: function (data) {
        unitValues = (data && typeof data === 'object') ? data : {};
        unitValuesChanged();
      }
    });
  }

  initCoveragesTab();
})();
