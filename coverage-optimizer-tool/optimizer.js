/* Coverage Optimizer — Life. Client.
 *
 * One of two tool pages (the other is inforce.js). Each page is
 * self-contained; the header dropdown navigates between them. Only the theme
 * choice carries across, via localStorage.
 *
 * This page is a scaffold: the shell, the tab set and one empty container per
 * tab. The views themselves are not built yet. When they are, the extract
 * parser, the field descriptors and the validated-input controls can be
 * lifted from inforce.js — they were written to be portable, and
 * UI_REFERENCE.md documents them.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- utils
  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Ported verbatim from inforce.js (INFORCE_REFERENCE.md §8) — one grouped-
     number parser/formatter for the whole app. Unused until Coverage Input
     needed real money/percentage fields. */
  function toNum(raw) {
    if (typeof raw === 'number') return isFinite(raw) ? raw : null;
    var c = String(raw === null || raw === undefined ? '' : raw).replace(/[\s,$]/g, '').replace(/%$/, '');
    if (c === '' || !/^-?\d*\.?\d*$/.test(c)) return null;
    var n = Number(c);
    return isFinite(n) ? n : null;
  }

  function group(n, dec) {
    // Number('') is 0 and isFinite('') is true, so an empty value would
    // otherwise render as "0" — a real figure the operator never entered.
    if (n === null || n === undefined || n === '' || !isFinite(n)) return '';
    var neg = n < 0, parts = Math.abs(n).toFixed(dec || 0).split('.');
    return (neg ? '-' : '') + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (parts[1] ? '.' + parts[1] : '');
  }

  function decimals(n) {
    var s = String(n), i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  }

  var toastTimer = null;
  function toast(msg, kind) {
    var n = $('toast');
    n.textContent = msg;
    n.className = 'toast show' + (kind ? ' toast--' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.className = 'toast'; }, kind === 'err' ? 5000 : 3000);
  }

  // ------------------------------------------------------- dates / ages
  /* Ported verbatim from inforce.js (see INFORCE_REFERENCE.md §8) rather than
     reimplemented — one date parser for the whole app. */
  var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var DATE_FORMATS = 'DD-MMM-YYYY, YYYY-MM-DD, YYYYMMDD or YYYY/MM/DD';

  function buildDate(y, mi, d) {
    if (mi < 0 || mi > 11 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mi, d));
    if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mi || dt.getUTCFullYear() !== y) return null;
    return dt;
  }

  function parseDate(s) {
    var t = String(s === null || s === undefined ? '' : s).trim();
    var m;

    m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(t);
    if (m) return buildDate(+m[3], MONTHS.indexOf(m[2].toUpperCase()), +m[1]);

    m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(t);
    if (m) return buildDate(+m[1], +m[2] - 1, +m[3]);

    m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
    if (m) return buildDate(+m[1], +m[2] - 1, +m[3]);

    return null;
  }

  function fmtDate(dt) {
    return String(dt.getUTCDate()).padStart(2, '0') + '-' + MONTHS[dt.getUTCMonth()] + '-' + dt.getUTCFullYear();
  }

  /* Specified algorithm, implemented exactly as given (a 30-day-month day
     count, not calendar-accurate) — this is what an actuarial "age nearest
     birthday" convention looks like, and matching it exactly is the whole
     point: this tool exists to validate figures against another platform, so
     an approximation that merely agrees "most of the time" is worse than
     useless here.

     The steps double as the age-last-birthday calculation too: `age` after
     step 3 (year, then month/day borrow) *is* the real/last-birthday age;
     steps 4-7 conditionally add 1 to produce the nearest-birthday age. */
  function agesAt(birth, asOf) {
    var b = parseDate(birth), a = parseDate(asOf);
    if (!b || !a) return { real: null, nearest: null };

    // 1. Years.
    var age = a.getUTCFullYear() - b.getUTCFullYear();

    // 2. Months, borrowing a year if negative.
    var months = a.getUTCMonth() - b.getUTCMonth();
    if (months < 0) { months += 12; age -= 1; }

    // 3. Days, borrowing a (30-day) month if negative.
    var days = a.getUTCDate() - b.getUTCDate();
    if (days < 0) { days += 30; months -= 1; }

    var real = age;                 // age last birthday, after the borrows above

    // 4-7. Round to nearest birthday.
    var nearest = age;
    if (months > 6) nearest = age + 1;
    else if (months === 6 && days > 0) nearest = age + 1;
    else if (months === 6 && days === 0) nearest = age;
    else if (months < 6) nearest = age;

    return { real: real, nearest: nearest };
  }

  /* This page has no policy extract and so no projection date to measure
     ages against by default — today is the sensible default, but the
     operator can override it (see "reference date", below). Built as a UTC
     midnight Date so it round-trips through fmtDate/parseDate exactly like
     every other date in the app. */
  function todayStr() {
    var n = new Date();
    return fmtDate(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
  }

  // ----------------------------------------------------------------- tools
  /* Kept identical to the table in inforce.js so the two menus agree. */
  var TOOLS = [
    { id: 'inforce',   href: 'inforce.html',   mark: 'IT', name: 'Inforce Tool',       swatch: '#35663E',
      note: 'Validate an in-force policy extract' },
    { id: 'optimizer', href: 'optimizer.html', mark: 'CO', name: 'Coverage Optimizer', swatch: '#345165',
      note: 'Optimise the coverage structure' }
  ];
  var THIS_TOOL = 'optimizer';

  function renderToolMenu() {
    $('toolMenu').innerHTML = TOOLS.map(function (o) {
      var on = o.id === THIS_TOOL;
      return '<button class="brand-opt" role="option" data-tool="' + o.id + '"' +
             ' aria-selected="' + on + '">' +
               '<span class="mark" style="background:' + o.swatch + ';color:#fff">' +
                 esc(o.mark) + '</span>' +
               '<span class="brand-opt-txt">' +
                 '<span class="brand-opt-name">' + esc(o.name) + '</span>' +
                 '<span class="brand-opt-note">' + esc(o.note) + '</span>' +
               '</span>' +
               (on ? '<span class="tick">✓</span>' : '') +
             '</button>';
    }).join('');
  }

  function openToolMenu(open) {
    $('toolMenu').hidden = !open;
    $('toolSelect').setAttribute('aria-expanded', String(open));
  }

  function selectTool(id) {
    openToolMenu(false);
    if (id === THIS_TOOL) { $('toolSelect').focus(); return; }
    TOOLS.forEach(function (t) { if (t.id === id) location.href = t.href; });
  }

  // ----------------------------------------------------------------- theme
  /* Same key as inforce.js, so the choice follows the operator between pages. */
  var THEME_KEY = 'life-tool-theme';

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  }
  function loadTheme() {
    var t = 'light';
    try { t = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { /* no storage */ }
    applyTheme(t);
  }
  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* no storage */ }
  }

  // --------------------------------------------------------- insured input
  /* Add/remove logic mirrors the Inforce Tool (INFORCE_REFERENCE.md §6-8):
     one descriptor per field, a validated control per field, commit-on-change
     with a deferred re-render so focus survives an edit. Unlike Inforce there
     is no extract here, so every insured is "new" from the moment it is
     created — Remove is always a hard delete, never a soft withdraw. */
  var INSURED_FIELDS = [
    { k: 'name', l: 'Name', t: 'txt', maxLen: 30 },
    // `blank: true` — starts unset (''); the dropdown gets a leading "— Select —"
    // option (blankOpt) and validateIns lets it be chosen again to clear. A
    // string instead of `true` is that option's own label — Sex's column is
    // only wide enough for "M"/"F", so its blank option is a bare "—".
    { k: 'sex', l: 'Sex', t: 'enum', blank: '—', opts: [['M', 'M'], ['F', 'F']] },
    { k: 'rate', l: 'Rate', t: 'enum', blank: true,
      opts: [['pref', 'Preferred / Non-smoker'], ['reg', 'Regular / Smoker']] },
    { k: 'birthdate', l: 'Birthdate', t: 'date', ph: 'DD-MMM-YYYY' },
    { k: 'ageCalc', l: 'Age Calculation', t: 'enum',
      opts: [['nearest', 'Age Nearest'], ['last', 'Last Birthday']] }
  ];
  var INS_FIELD_MAP = {};
  INSURED_FIELDS.forEach(function (f) { INS_FIELD_MAP[f.k] = f; });

  /* The Age Calculated cell's own LABEL tracks the Age Calculation dropdown —
     distinct wording from the dropdown's own option text ("Last Birthday"
     there, "Age Last" here), exactly as specified. */
  var AGE_CALC_LABELS = { nearest: 'Age Nearest', last: 'Age Last' };

  function validateIns(f, raw) {
    var s = typeof raw === 'string' ? raw.trim() : raw;
    if (s === '' || s === null || s === undefined) {
      return f.blank ? { ok: true, v: '' } : { ok: false, msg: f.l + ' is required' };
    }

    if (f.t === 'txt') {
      s = String(s);
      if (f.maxLen !== undefined && s.length > f.maxLen) {
        return { ok: false, msg: f.l + ' must be at most ' + f.maxLen + ' characters' };
      }
      return { ok: true, v: s };
    }

    if (f.t === 'enum') {
      var hit = null;
      f.opts.forEach(function (o) { if (o[0] === String(s)) hit = o[0]; });
      if (!hit) return { ok: false, msg: f.l + ' must be ' + f.opts.map(function (o) { return o[0]; }).join(' or ') };
      return { ok: true, v: hit };
    }

    // 'date' — birthdate. Real and nearest age must both land in 0-120, the
    // stated range for the two derived age fields; a birthdate that would
    // put either outside it is rejected here rather than left to display an
    // out-of-range figure downstream. Measured against the operator-editable
    // reference date (settings.refDate), not always literally today.
    var dt = parseDate(s);
    if (!dt) return { ok: false, msg: f.l + ' must be a valid date — ' + DATE_FORMATS };
    var check = agesAt(fmtDate(dt), settings.refDate);
    if (check.real === null || check.real < 0 || check.real > 120 ||
        check.nearest === null || check.nearest < 0 || check.nearest > 120) {
      return { ok: false, msg: f.l + ' must produce an age between 0 and 120' };
    }
    return { ok: true, v: fmtDate(dt) };
  }

  /* Two small pieces shared by every field that can start unset (Insured
     Input, Coverage Input, Settings' Payment Frequency):
       blankOpt — the leading "— Select —" <option> of an enum flagged
         `blank: true`, selected while the value is blank. Without it a blank
         value matches no <option> and the browser DISPLAYS the first real one
         — the same display/model split covRateControl's own comment describes.
       needCls  — ` fi--need`, the yellow "still to fill in" highlight, while a
         value is blank. Derived from the record on every render, never
         stored, so it disappears the moment a value lands. */
  function blankOpt(f, v) {
    return f.blank ? '<option value=""' + (v ? '' : ' selected') + '>' + (f.blank === true ? '— Select —' : f.blank) + '</option>' : '';
  }
  function needCls(v) {
    return (v === '' || v === null || v === undefined) ? ' fi--need' : '';
  }

  function insControl(f, v, fk) {
    var need = needCls(v);
    if (f.t === 'enum') {
      return '<select class="fi' + need + '" data-fk="' + fk + '">' + blankOpt(f, v) + f.opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    }
    return '<input class="fi fi--txt' + need + '" data-fk="' + fk + '"' +
           ' value="' + esc(v) + '" spellcheck="false" autocomplete="off"' +
           (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') +
           (f.maxLen ? ' maxlength="' + f.maxLen + '"' : '') + '>';
  }

  function resolveIns(fk) {
    var p = String(fk).split('|');   // 'ins' | insuredId | fieldKey
    var rec = null;
    insureds.forEach(function (i) { if (i._id === p[1]) rec = i; });
    return { f: INS_FIELD_MAP[p[2]], rec: rec };
  }

  var insureds = [];
  var insSeq = 0;

  /* Scans current names for "Insured-N" and returns the lowest unused N —
     same idiom as the Inforce coverage-numbering (nextCoverageNumber). Only
     the initial value; the operator can rename freely afterward. */
  function nextInsuredName() {
    var used = {};
    insureds.forEach(function (i) { used[String(i.name || '').toUpperCase()] = 1; });
    for (var n = 1; n <= 999; n++) {
      var cand = 'Insured-' + n;
      if (!used[cand.toUpperCase()]) return cand;
    }
    return 'Insured-' + (insureds.length + 1);
  }

  function newInsuredRecord() {
    return {
      _id: 'ins' + (++insSeq),
      name: nextInsuredName(),
      sex: '',                 // no default — the operator picks (highlighted until then)
      rate: '',                // no default — same
      birthdate: '',
      ageCalc: 'nearest'
    };
  }

  /** One editable cell: micro label over its input/select. */
  function insFieldCell(f, rec) {
    return '<div class="fc"><span class="rs-k">' + esc(f.l) + '</span>' +
           insControl(f, rec[f.k], 'ins|' + rec._id + '|' + f.k) + '</div>';
  }

  /** One read-only cell: micro label over a plain value, never an input —
      Age Real and Age Calculated are always computed, never entered. */
  function insValueCell(label, v) {
    return '<div class="fc"><span class="rs-k">' + esc(label) + '</span>' +
           '<span class="rs-v num' + (v === null ? ' is-empty' : '') + '">' +
             (v === null ? '—' : v) + '</span></div>';
  }

  function insuredCard(rec, idx) {
    var ages = agesAt(rec.birthdate, settings.refDate);
    var calcAge = rec.ageCalc === 'last' ? ages.real : ages.nearest;
    var canRemove = insureds.length > 1;

    // One row of all 7 — was Name/Sex/Rate then Birthdate/Age Calculation/
    // Age Real/Age Calculated on two rows; Insured Input moved to 2/3 width
    // (§2) specifically to make this single row fit.
    var row =
      insFieldCell(INS_FIELD_MAP.name, rec) +
      insFieldCell(INS_FIELD_MAP.sex, rec) +
      insFieldCell(INS_FIELD_MAP.rate, rec) +
      insFieldCell(INS_FIELD_MAP.birthdate, rec) +
      insFieldCell(INS_FIELD_MAP.ageCalc, rec) +
      insValueCell('Age Real', ages.real) +
      insValueCell(AGE_CALC_LABELS[rec.ageCalc] || 'Age Calculated', calcAge);

    return '<div class="insured-card">' +
        '<div class="insured-head">' +
          '<span class="insured-no">' + (idx + 1) + '</span>' +
          '<span class="insured-title">' + esc(rec.name || 'Insured') + '</span>' +
          '<button class="btn btn--sm btn--danger" data-act="rmins" data-id="' + rec._id + '"' +
            (canRemove ? '' : ' disabled title="At least one insured is required"') + '>Remove</button>' +
        '</div>' +
        '<div class="insured-fields">' +
          '<div class="fc-row fc-row--7">' + row + '</div>' +
        '</div>' +
      '</div>';
  }

  function insuredInputShell() {
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band">' +
          '<span class="card-title">Insured Input</span>' +
          '<span class="spacer"></span>' +
          '<span class="card-note" id="insCount"></span>' +
        '</div>' +
        '<div id="insuredList"></div>' +
        '<div class="card-foot">' +
          '<span class="spacer"></span>' +
          '<button class="btn btn--primary btn--sm" id="btnAddInsured">+ Add Insured</button>' +
        '</div>' +
      '</div>';
  }

  /* Same deferred-render pattern as inforce.js render(): `change` fires
     before focus reaches the next control, so rendering synchronously would
     capture document.body as the active element and drop focus. */
  var pendingIns = null;
  function deferRenderInsureds() {
    if (pendingIns) return;
    pendingIns = setTimeout(function () { pendingIns = null; renderInsuredList(); }, 0);
  }

  function renderInsuredList() {
    if (pendingIns) { clearTimeout(pendingIns); pendingIns = null; }

    var act = document.activeElement;
    var fk = act && act.dataset ? act.dataset.fk : null;
    var typing = fk && act.tagName === 'INPUT' ? act.value : null;
    var from = fk && act.tagName === 'INPUT' ? act.selectionStart : null;
    var to = fk && act.tagName === 'INPUT' ? act.selectionEnd : null;

    $('insuredList').innerHTML = insureds.map(insuredCard).join('');
    $('insCount').textContent = insureds.length + ' insured' + (insureds.length === 1 ? '' : 's');

    if (!fk) { syncCoverageInsuredRefs(); renderCoverageList(); return; }
    var back = document.querySelector('[data-fk="' + fk + '"]');
    if (back) {
      if (typing !== null && back.value !== typing) back.value = typing;
      back.focus();
      if (from !== null) { try { back.setSelectionRange(from, to); } catch (e) { /* selection unsupported */ } }
    }

    // Coverage Input's Insured/Sex/Age cells and its Rate options all derive
    // from `insureds` (name, sex, birthdate, ageCalc, rate) — refresh it on
    // every insured-list change, same as Insured Input refreshes itself.
    // `syncCoverageInsuredRefs` first drops any coverage's reference to an
    // insured that was just removed, so nothing points at a dangling _id.
    syncCoverageInsuredRefs();
    renderCoverageList();
  }

  function insCommit(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.fk) return;
    var r = resolveIns(el.dataset.fk), f = r.f, rec = r.rec;
    if (!f || !rec) return;

    var res = validateIns(f, el.value);
    if (!res.ok) {
      el.classList.add('fi--bad');
      el.title = res.msg;
      toast(res.msg, 'err');
      return;
    }
    el.classList.remove('fi--bad');
    rec[f.k] = res.v;
    deferRenderInsureds();
  }

  function insLive(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.fk) return;
    var f = resolveIns(el.dataset.fk).f;
    if (!f) return;
    el.classList.toggle('fi--bad', !validateIns(f, el.value).ok);
    if (el.tagName === 'INPUT') el.classList.toggle('fi--need', el.value.trim() === '');   // clears as they type
  }

  function initInsuredInput() {
    insureds = [newInsuredRecord()];         // start with exactly one
    $('insuredInputHost').innerHTML = insuredInputShell();
    renderInsuredList();

    $('insuredList').addEventListener('change', insCommit);
    $('insuredList').addEventListener('input', insLive);
    $('insuredList').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-act="rmins"]') : null;
      if (!b || b.disabled) return;
      insureds = insureds.filter(function (i) { return i._id !== b.dataset.id; });
      renderInsuredList();
    });
    $('btnAddInsured').addEventListener('click', function () {
      insureds.push(newInsuredRecord());
      renderInsuredList();
    });
  }

  // -------------------------------------------------------------- settings
  /* The Reference Date / Multi-Coverage Discount / Payment Frequency panel,
     top-right on Input & Results. Page-level, not per-insured: `refDate` is
     what every insured's Age Real / Age Calculated is measured against
     (§ dates/ages above), so changing it recomputes every insured card. */
  var settings = {
    refDate: todayStr(),
    mcd: false,            // Multi-Coverage Discount — no stated default; off until the operator opts in
    freq: '',              // Payment Frequency — no default; blank until the operator picks one
    premAdjPct: 100,       // Prem. Adj. % — 100% ("unchanged") is the stated default for a multiplicative factor
    premAdjPctDur: 0,      // Prem. Adj. % Dur. — stated default; see the field's own `min: 0` note below
    premAdjAmt: 0,         // Prem. Adj. $ — stated default, an additive adjustment so 0 means "none"
    premAdjAmtDur: 0       // Prem. Adj. $ Dur. — stated default; see the field's own `min: 0` note below
  };

  var SETTINGS_FIELDS = [
    { k: 'refDate', l: 'Reference Date', t: 'date', ph: 'DD-MMM-YYYY' },
    { k: 'freq', l: 'Payment Frequency', t: 'enum', blank: true,
      opts: [['monthly', 'Monthly'], ['annually', 'Annually']] },
    { k: 'premAdjPct', l: 'Prem. Adj. %', t: 'pct', min: 0, max: 1000000, u: '%' },
    // Specified range is "1 to 999", but the specified DEFAULT is 0 — outside
    // that range, and this field is never optional (§2a), so min is relaxed
    // to 0 here rather than leaving the field's own default fail its own
    // validation. 0 reads as "no duration set"; 1-999 is a real duration.
    { k: 'premAdjPctDur', l: 'Prem. Adj. % Dur.', t: 'int', min: 0, max: 999 },
    { k: 'premAdjAmt', l: 'Prem. Adj. $', t: 'money', min: 0, max: 999999999.99, dec: 2, u: 'CAD' },
    { k: 'premAdjAmtDur', l: 'Prem. Adj. $ Dur.', t: 'int', min: 0, max: 999 }
  ];
  var SETTINGS_FIELD_MAP = {};
  SETTINGS_FIELDS.forEach(function (f) { SETTINGS_FIELD_MAP[f.k] = f; });

  /* Same validate/control shape as the insured fields, minus the 0-120 age
     check — that constraint belongs to a birthdate, not a reference date.
     Generalised to money/int/pct (mirrors validateCov's numeric branch)
     once Settings grew the 4 Prem. Adj. fields — date/enum were the only
     two types here before that. None of these fields are optional: unlike
     Coverage Input's numeric fields, every Settings field always holds
     something, even if that something is a stated default of 0 — except
     Payment Frequency, which starts blank (`blank: true`). */
  function validateSettings(f, raw) {
    var s = typeof raw === 'string' ? raw.trim() : raw;
    if (s === '' || s === null || s === undefined) {
      return f.blank ? { ok: true, v: '' } : { ok: false, msg: f.l + ' is required' };
    }

    if (f.t === 'date') {
      var dt = parseDate(s);
      if (!dt) return { ok: false, msg: f.l + ' must be a valid date — ' + DATE_FORMATS };
      // Reference Date specifically (not a general 'date'-type rule): a day
      // of 29/30/31, in any month, falls back to the 28th — stated by the
      // request as its own rule, independent of the date's own real month
      // length (31-DEC and 29-FEB both land on the 28th, not just the
      // days that don't exist in shorter months).
      if (f.k === 'refDate' && dt.getUTCDate() >= 29) {
        dt = buildDate(dt.getUTCFullYear(), dt.getUTCMonth(), 28);
      }
      return { ok: true, v: fmtDate(dt) };
    }
    if (f.t === 'enum') {
      var hit = null;
      f.opts.forEach(function (o) { if (o[0] === String(s)) hit = o[0]; });
      if (!hit) return { ok: false, msg: f.l + ' must be ' + f.opts.map(function (o) { return o[0]; }).join(' or ') };
      return { ok: true, v: hit };
    }
    var n = toNum(s);
    if (n === null) return { ok: false, msg: f.l + ' must be a number' };
    if (f.t === 'int' && n % 1 !== 0) return { ok: false, msg: f.l + ' must be a whole number' };
    if (f.t === 'money' && decimals(n) > (f.dec || 2)) {
      return { ok: false, msg: f.l + ' allows at most ' + (f.dec || 2) + ' decimal places' };
    }
    if (f.min !== undefined && n < f.min) return { ok: false, msg: f.l + ' must be at least ' + group(f.min, f.dec || 0) };
    if (f.max !== undefined && n > f.max) return { ok: false, msg: f.l + ' must not exceed ' + group(f.max, f.dec || 0) };
    return { ok: true, v: n };
  }

  /* Same numeric display rule as covRaw (§2b) — thousands separators, no
     unit suffix in the box itself. Settings' own numeric fields reuse it
     directly rather than duplicating it; nothing in it is Coverage-specific. */
  function settingsControl(f) {
    var fk = 'set|' + f.k, v = settings[f.k];
    if (f.t === 'enum') {
      return '<select class="fi" data-fk="' + fk + '">' + blankOpt(f, v) + f.opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    }
    if (f.t === 'date') {
      return '<input class="fi fi--txt" data-fk="' + fk + '" value="' + esc(v) + '"' +
             ' spellcheck="false" autocomplete="off"' +
             (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>';
    }
    return '<input class="fi" data-fk="' + fk + '" value="' + esc(covRaw(f, v)) + '"' +
           ' spellcheck="false" autocomplete="off">';
  }

  function switchControl() {
    return '<button class="switch" type="button" role="switch" data-act="toggle-mcd"' +
           ' aria-checked="' + settings.mcd + '">' + (settings.mcd ? 'ON' : 'OFF') + '</button>';
  }

  function settingsCell(f) {
    return '<div class="rs"><span class="rs-k">' + esc(f.l) + '</span>' + settingsControl(f) + '</div>';
  }

  /* Same shape as resultsBar(): a banded tag on the left, then one cell per
     field — label on top, control below — laid out horizontally rather than
     the .kv label-left/value-right stack this used before. Reuses .resultbar/
     .resultbar-tag/.rs/.rs-k verbatim so the two containers are the same
     height and read as a matched pair, not two different components.

     Order is specified exactly: Reference Date | Payment Frequency |
     Multi-Coverage Discount | Prem. Adj. % | Prem. Adj. % Dur. | Prem. Adj. $
     | Prem. Adj. $ Dur. This bar is now full-width (§4 — it stands alone,
     no longer paired with a Results strip beside it), which is what makes
     room for the 4 new cells beside the original 3. */
  function settingsPanelShell() {
    return '<div class="resultbar">' +
        '<span class="resultbar-tag">Settings</span>' +
        settingsCell(SETTINGS_FIELD_MAP.refDate) +
        settingsCell(SETTINGS_FIELD_MAP.freq) +
        '<div class="rs"><span class="rs-k">Multi-Coverage Discount</span>' + switchControl() + '</div>' +
        settingsCell(SETTINGS_FIELD_MAP.premAdjPct) +
        settingsCell(SETTINGS_FIELD_MAP.premAdjPctDur) +
        settingsCell(SETTINGS_FIELD_MAP.premAdjAmt) +
        settingsCell(SETTINGS_FIELD_MAP.premAdjAmtDur) +
      '</div>';
  }

  function settingsCommit(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.fk) return;
    var p = el.dataset.fk.split('|');           // 'set' | fieldKey
    if (p[0] !== 'set') return;
    var f = SETTINGS_FIELD_MAP[p[1]];
    if (!f) return;

    var res = validateSettings(f, el.value);
    if (!res.ok) {
      el.classList.add('fi--bad');
      el.title = res.msg;
      toast(res.msg, 'err');
      return;
    }
    el.classList.remove('fi--bad');
    settings[f.k] = res.v;

    // This field is not part of a repeating list, so nothing else re-renders
    // it the way renderInsuredList() does for an insured's own fields —
    // echo the canonical form back explicitly (matters for refDate: e.g.
    // "2026-01-01" in, "01-JAN-2026" back; matters for the 4 Prem. Adj.
    // fields too — echoing the raw number would show "1234.5", not the
    // grouped "1,234.50" every other numeric field on the page displays).
    // Safe unconditionally: `change` fires after the input has already
    // blurred.
    el.value = (f.t === 'date' || f.t === 'enum') ? res.v : covRaw(f, res.v);   // DOM property, not markup — no esc()

    // Only refDate feeds a calculation (every insured's ages); freq/mcd are
    // stored but nothing downstream reads them yet.
    if (f.k === 'refDate') deferRenderInsureds();

    // The Coverages tab (its own file — § the public bridge) mirrors several
    // Settings fields (Frequency of Payment, all 4 Prem. Adj. fields) —
    // notify on every commit, not just refDate's.
    notifyOptimizerCoreChange();
  }

  function settingsLive(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.fk) return;
    var p = el.dataset.fk.split('|');
    if (p[0] !== 'set') return;
    var f = SETTINGS_FIELD_MAP[p[1]];
    if (!f) return;
    el.classList.toggle('fi--bad', !validateSettings(f, el.value).ok);
  }

  function initSettingsPanel() {
    $('settingsPanelHost').innerHTML = settingsPanelShell();
    $('settingsPanelHost').addEventListener('change', settingsCommit);
    $('settingsPanelHost').addEventListener('input', settingsLive);
    $('settingsPanelHost').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act="toggle-mcd"]') : null;
      if (!b) return;
      settings.mcd = !settings.mcd;
      b.setAttribute('aria-checked', String(settings.mcd));
      b.textContent = settings.mcd ? 'ON' : 'OFF';
      notifyOptimizerCoreChange();   // the Coverages tab's own "Has MCD" column
    });
  }

  // -------------------------------------------------------------- coverage input
  /* Add/remove logic mirrors Insured Input (§ above), one level deeper: each
     coverage is a repeatable record like an insured, and each coverage in
     turn holds its own repeatable list of insured "slots" (who is on this
     coverage, at what rate, with what extra premium). Every cascade below —
     Category -> Coverage -> Coverage Type -> Coverage Fee, and Coverage Type
     -> how many insured slots are allowed — is driven off this one
     `coverages` array; nothing is duplicated in the DOM that isn't re-derived
     from it on every render. */

  var COVERAGE_CATEGORIES = [
    ['termLife', 'Term Life'],
    ['permLife', 'Permanent Life'],
    ['ciTerm', 'Term Critical Illness'],
    ['ciPerm', 'Permanent Critical Illness'],
    ['ciBiz', 'Critical Illness for Business Owners']
  ];
  var COVERAGE_CATEGORY_MAP = {};
  COVERAGE_CATEGORIES.forEach(function (o) { COVERAGE_CATEGORY_MAP[o[0]] = o[1]; });

  var COVERAGE_OPTIONS = {
    termLife: ['Term 10', 'Term 15', 'Term 20', 'Term 25', 'Term 30', 'Term to 65'],
    permLife: ['WL 10 Pay', 'WL 15 Pay', 'WL 20 Pay', 'WL to 65', 'WL to 100', 'Term to 100'],
    ciTerm: ['Health Priorities - Term 10', 'Health Priorities - Term 20',
      'Health Priorities - Term to 65', 'Health Priorities - Term to 75'],
    ciPerm: ['Health Priorities - 10 Pay', 'Health Priorities - 20 Pay',
      'Health Priorities - Child, 20 Pay', 'Health Priorities - To 100'],
    ciBiz: ['Health Priorities - Business, Term to 75', 'Health Priorities - Business, Term to 100']
  };

  /* Display abbreviation maps — named vars (not just inline in the
     OptimizerCore object literal below) so axisKeyPrefix() (§ below) can
     read them too, not only external split-off tabs through the bridge. */
  var COVERAGE_ABBR = {
    'Term 10': 'T10', 'Term 15': 'T15', 'Term 20': 'T20',
    'Term 25': 'T25', 'Term 30': 'T30', 'Term to 65': 'T65',
    'WL 10 Pay': 'VEG10', 'WL 15 Pay': 'VEG15', 'WL 20 Pay': 'VEG20',
    'WL to 65': 'VEG65', 'WL to 100': 'VEG100', 'Term to 100': 'T100'
  };
  var COVTYPE_ABBR = {
    'Individual': 'Individual',
    'Joint First-to-Die': 'JFTD',
    'Joint Last-to-Die': 'JLTD',
    'Joint Last-to-Die, Paid-up 1st Death': 'JLTDPU'
  };

  /* Highest duration first — the order the spec gives for which Term Life
     coverage in the whole list gets the $40 fee (every other Term Life
     coverage gets $20). A coverage type not in this list (shouldn't happen)
     sorts last, i.e. never wins the $40. */
  var TERM_LIFE_DURATION_PRIORITY = ['Term to 65', 'Term 30', 'Term 25', 'Term 20', 'Term 15', 'Term 10'];

  /* Coverage Type list depends on Category, and for Term Life, on Coverage
     too (Term to 65 has no Joint First-to-Die). Critical Illness of any kind
     has none yet — "leave blank for now", per the spec — an empty list here
     is what renders that field as an inert placeholder box instead of a
     dropdown (see covControl). */
  function covTypeOptions(category, coverage) {
    if (category === 'termLife') {
      return coverage === 'Term to 65' ? ['Individual'] : ['Individual', 'Joint First-to-Die'];
    }
    if (category === 'permLife') {
      return ['Individual', 'Joint First-to-Die', 'Joint Last-to-Die', 'Joint Last-to-Die, Paid-up 1st Death'];
    }
    return [];
  }

  /* Individual = exactly one insured slot. Joint First-to-Die = up to 5 for
     Term Life but only 2 for Permanent Life (it used to be 5 for both), so
     the cap depends on Category as well as Coverage Type. Joint Last-to-Die
     and Joint Last-to-Die, Paid-up 1st Death (Permanent Life only) = exactly
     2 — a "last to die" benefit is only meaningful between two lives. An
     unset Coverage Type (today, only the CI categories, whose Coverage Type
     isn't implemented yet) is treated as Individual — the conservative
     single-insured default until that logic exists. */
  function maxInsuredsFor(category, covType) {
    if (covType === 'Joint First-to-Die') return category === 'permLife' ? 2 : 5;
    if (covType === 'Joint Last-to-Die' || covType === 'Joint Last-to-Die, Paid-up 1st Death') return 2;
    return 1;
  }

  /* Permanent Life with any joint Coverage Type — the one combination that
     gets the third, "Joint" container under a coverage's insured slots in
     Coverage Input (covJointSlot), and whose Axis Key uses the fixed joint
     Sex/Rate below instead of an insured's own. */
  var JOINT_SEX = 'M', JOINT_RATE = 'N';
  function isJointPerm(c) {
    return c.category === 'permLife' && (c.covType === 'Joint First-to-Die' ||
      c.covType === 'Joint Last-to-Die' || c.covType === 'Joint Last-to-Die, Paid-up 1st Death');
  }
  /* On such a coverage each insured's own Rate and Extra Premium boxes are
     disabled — the Joint container carries the equivalent instead. They render
     blank (not whatever stale value the slot still holds) with this title. */
  var JOINT_OFF = 'Not used on a joint coverage — see the Joint container below';

  /* A joint Perm coverage's Joint Age (offset 0) or Joint Age Backdated
     (offset -1: the same "age - 1" stand-in the Rates tab's _BD columns use
     for an insured, since the Backdate tab is still unwired). null when it
     isn't a joint Perm coverage, the Joint Age box is blank, or the result
     would be negative. The Rates lookups and the Insureds tab both read it. */
  function jointAge(c, offset) {
    if (!isJointPerm(c) || !c.joint || c.joint.age === null || c.joint.age === undefined) return null;
    var a = c.joint.age + offset;
    return a < 0 ? null : a;
  }

  /* A joint Perm coverage's Joint-container figures as display strings, in the
     order the Insureds and Coverages tabs both list them: Joint Age, Equiv.
     Substd. %, Flat Extra Prem. $ Perm, Flat Extra Prem. $ Term, Flat Extra
     Prem. $ Duration, Joint Age Backdated. "—" for a blank box, and for every
     figure when the coverage has no joint side. One formatter, two tabs. */
  function jointFigures(c) {
    var j = c.joint || {}, on = isJointPerm(c), bd = jointAge(c, -1);
    function num(v, dec) {                      // no `dec` -> as many decimals as it was typed with (the % field)
      if (!on || v === null || v === undefined) return '—';
      return group(v, dec === undefined ? decimals(v) : dec);
    }
    return [num(j.age, 0), num(j.extraPct), num(j.extraFlat, 2), num(j.extraTempAmt, 2),
            num(j.extraTempYears, 0), bd === null ? '—' : String(bd)];
  }

  /* Term Life has 3 preferred / 2 regular rate codes; every other category
     collapses to a single P or R code (its own rate structure isn't
     specified yet). Keyed off the REFERENCED INSURED's own Rate field from
     Insured Input (pref/reg), not anything stored on the coverage itself. */
  function rateOptionsFor(category, insuredRate) {
    if (category === 'termLife') return insuredRate === 'reg' ? ['R1', 'R2'] : ['P1', 'P2', 'P3'];
    return insuredRate === 'reg' ? ['R'] : ['P'];
  }

  function findInsured(id) {
    var hit = null;
    insureds.forEach(function (i) { if (i._id === id) hit = i; });
    return hit;
  }

  /* Coverage-level fields — one compact row of all 6 (§2b requires this to
     read as one line, not two: Category through Input). See coverageCard().
     `coverage` and `covType`'s option lists depend on the record itself,
     hence `optsFn` instead of a fixed `opts` array — the generic enum
     handling below calls whichever is present.

     `blank: true` — starts unset (''); the dropdown gets a leading "— Select —"
     option (blankOpt) and validateCov lets it be chosen again to clear.
     `need: true` — highlighted yellow (needCls) while the field is blank. */
  var COV_FIELDS = [
    { k: 'category', l: 'Coverage Category', t: 'enum', blank: true, need: true, opts: COVERAGE_CATEGORIES },
    { k: 'coverage', l: 'Coverage', t: 'enum', blank: true, need: true,
      optsFn: function (rec) { return (COVERAGE_OPTIONS[rec.category] || []).map(function (s) { return [s, s]; }); } },
    { k: 'covType', l: 'Coverage Type', t: 'enum', blank: true, need: true,
      optsFn: function (rec) { return covTypeOptions(rec.category, rec.coverage).map(function (s) { return [s, s]; }); } },
    { k: 'fee', l: 'Coverage Fee', t: 'money', min: 0, max: 999999999.99, dec: 2, opt: 1, u: 'CAD' },
    { k: 'calcType', l: 'Calculation Type', t: 'enum',
      opts: [['premium', 'Input Premium'], ['amount', 'Coverage Amount']] },
    // Shortened from "Input Premium/Insurance Amount" — the field holds
    // whichever of the two Calculation Type means, and the row is now too
    // tight for the full name. No unit suffix either, for the same reason.
    // As listed: a Coverage Amount, a whole number (AMOUNT_PREMIUM below is
    // the Input Premium kind).
    { k: 'amount', l: 'Input', t: 'int', min: 0, max: 999999999, opt: 1, need: true }
  ];
  var COV_FIELD_MAP = {};
  COV_FIELDS.forEach(function (f) { COV_FIELD_MAP[f.k] = f; });

  /* Input's kind follows Calculation Type: a whole-number Coverage Amount, or
     — Input Premium — a premium with 2 decimals. validateCov/covControl swap
     the descriptor through effField(); covCommit clears Input when
     Calculation Type changes (the number would mean something else). */
  var AMOUNT_PREMIUM = { k: 'amount', l: 'Input', t: 'money', min: 0, max: 999999999.99, dec: 2, opt: 1, need: true };
  function effField(f, rec) {
    return f.k === 'amount' && rec && rec.calcType === 'premium' ? AMOUNT_PREMIUM : f;
  }

  /* Per-insured-slot fields. `insuredId` and `rate` are handled by their own
     bespoke controls/commit branches below (their option lists depend on
     sibling slots and on the referenced insured, not a fixed or per-record
     list the generic enum path can resolve) — they're in this map only so
     their labels (`.l`) come from one place like every other field. The
     other four are ordinary optional numeric fields. */
  var COVINS_FIELDS = [
    { k: 'insuredId', l: 'Insured' },
    { k: 'rate', l: 'Rate' },
    // All four now default to a real 0 rather than blank (§ newCovInsuredSlot
    // below), so none are `opt` any more — a blank commit is rejected the
    // same way Settings' fields are; typing 0 is how the operator clears one
    // back to its neutral default. extraTempYears' stated range is "1 to
    // 999", but its stated default is 0 — outside that range — so min is
    // relaxed to 0 here for the same reason it is on Settings' two Prem. Adj.
    // *Dur. fields: 0 reads as "no duration set", 1-999 as a real one.
    { k: 'extraPct', l: 'Permanent %', t: 'pct', min: 0, max: 1000000, u: '%' },
    { k: 'extraFlat', l: 'Permanent $', t: 'money', min: 0, max: 999999999.99, dec: 2, u: 'CAD' },
    { k: 'extraTempAmt', l: 'Temporary $/1000', t: 'money', min: 0, max: 999999999.99, dec: 2, u: 'CAD' },
    { k: 'extraTempYears', l: 'Years', t: 'int', min: 0, max: 999 }
  ];
  /* The Joint container's own inputs (rec.joint — one set per coverage, not
     per slot). Same descriptor shape as COV_FIELDS, so validateCov/covControl/
     covRaw/covLive apply unchanged. All five start blank and are highlighted
     (`need`) until filled; `opt` lets a cleared box commit back to blank —
     unlike an insured slot's Extra Premium, whose defaults are a real 0.
     Flat Perm and Flat Term/Duration lock each other once one side has a
     value (covJointSlot), like a slot's Extra Premium; a locked box isn't
     highlighted, since there's nothing to fill in. */
  var JOINT_FIELDS = [
    { k: 'age', l: 'Joint Age', t: 'int', min: 0, max: 999, opt: 1, need: true },
    { k: 'extraPct', l: 'Equiv. Substd. %', t: 'pct', min: 0, max: 10000, u: '%', opt: 1, need: true },
    { k: 'extraFlat', l: 'Flat Extra Prem. $ Perm', t: 'money', min: 0, max: 9999.99, dec: 2, u: 'CAD', opt: 1, need: true },
    { k: 'extraTempAmt', l: 'Flat Extra Prem. $ Term', t: 'money', min: 0, max: 9999.99, dec: 2, u: 'CAD', opt: 1, need: true },
    { k: 'extraTempYears', l: 'Flat Extra Prem. $ Duration', t: 'int', min: 0, max: 999, opt: 1, need: true }
  ];
  var JOINT_FIELD_MAP = {};
  JOINT_FIELDS.forEach(function (f) { JOINT_FIELD_MAP[f.k] = f; });

  var COVINS_FIELD_MAP = {};
  COVINS_FIELDS.forEach(function (f) { COVINS_FIELD_MAP[f.k] = f; });

  /* Same shape as validateIns, generalised over both coverage-level and
     insured-slot fields (an enum field's options may depend on the record —
     `f.optsFn(rec)` — where Insured Input's enums never needed that). */
  function validateCov(f, raw, rec) {
    f = effField(f, rec);
    var s = typeof raw === 'string' ? raw.trim() : raw;
    if (s === '' || s === null || s === undefined) {
      return (f.opt || f.blank) ? { ok: true, v: '' } : { ok: false, msg: f.l + ' is required' };
    }
    if (f.t === 'enum') {
      var opts = f.optsFn ? f.optsFn(rec) : f.opts;
      var hit = null;
      opts.forEach(function (o) { if (o[0] === String(s)) hit = o[0]; });
      if (!hit) return { ok: false, msg: f.l + ' must be one of the available options' };
      return { ok: true, v: hit };
    }
    var n = toNum(s);
    if (n === null) return { ok: false, msg: f.l + ' must be a number' };
    if (f.t === 'int' && n % 1 !== 0) return { ok: false, msg: f.l + ' must be a whole number' };
    if (f.t === 'money' && decimals(n) > (f.dec || 2)) {
      return { ok: false, msg: f.l + ' allows at most ' + (f.dec || 2) + ' decimal places' };
    }
    if (f.min !== undefined && n < f.min) return { ok: false, msg: f.l + ' must be at least ' + group(f.min, f.dec || 0) };
    if (f.max !== undefined && n > f.max) return { ok: false, msg: f.l + ' must not exceed ' + group(f.max, f.dec || 0) };
    return { ok: true, v: n };
  }

  /** Value as it belongs in an input: numbers keep thousands separators, same
      reasoning (and the same helpers) as Inforce's own money/pct fields. */
  function covRaw(f, v) {
    if (v === null || v === undefined || v === '') return '';
    if (f.t === 'money') return group(v, f.dec || 2);
    if (f.t === 'int') return group(v, 0);
    if (f.t === 'pct') return group(v, decimals(v));
    return String(v);
  }

  /** Generic control for every coverage-level and insured-slot field EXCEPT
      insuredId/rate (see insRefControl/covRateControl). An enum field with no
      options right now (Coverage Type under a CI category) renders as an
      inert placeholder box — same "keeps its box, unmistakably inert"
      treatment Inforce gives a locked field — rather than a dropdown with
      nothing in it. */
  function covControl(f, v, fk, rec) {
    f = effField(f, rec);
    var need = f.need ? needCls(v) : '';
    if (f.t === 'enum') {
      var opts = f.optsFn ? f.optsFn(rec) : f.opts;
      if (!opts.length) {
        // Nothing to pick from: either no Category chosen yet, or a CI one.
        return '<input class="fi fi--ro" value="" readonly tabindex="-1" placeholder="—"' +
               ' title="' + (rec.category ? 'Not available for this Coverage Category yet' : 'Select a Coverage Category first') + '">';
      }
      return '<select class="fi' + need + '" data-fk="' + fk + '">' + blankOpt(f, v) + opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    }
    // Every non-enum field on this page is numeric (money/int/pct) — right-
    // aligned via the base .fi rule, same as Inforce's own numeric fields.
    return '<input class="fi' + need + '" data-fk="' + fk + '"' +
           ' value="' + esc(covRaw(f, v)) + '" spellcheck="false" autocomplete="off">';
  }

  function covFieldCell(f, rec) {
    var fk = 'cov|' + rec._id + '|' + f.k;
    var unit = f.u ? ' <span class="muted">' + esc(f.u) + '</span>' : '';
    return '<div class="fc"><span class="rs-k">' + esc(f.l) + unit + '</span>' + covControl(f, rec[f.k], fk, rec) + '</div>';
  }

  /* One tiny sub-field inside the Extra Premium cell (below) — same control
     as any other insured-slot field, but with a short label instead of the
     field's full name, since all four now have to fit side by side in a
     single row cell. The full name survives as `title` so it's still
     discoverable on hover.

     `locked`, when true, renders the same inert `.fi--ro` box every other
     "not editable right now" field on this page uses — `readonly`,
     `tabindex="-1"`, no `data-fk` — rather than the normal control. Used by
     covExtraCell() below for the Permanent $ / Temporary $ mutual
     exclusion: the box still shows whatever value it holds, just can't be
     typed into while the other side of the pair has one. */
  function covInsExtraMiniField(f, rec, slot, shortLabel, locked) {
    var v = slot[f.k];
    var control;
    if (locked) {
      var off = locked === JOINT_OFF;    // not applicable at all — blank, not the slot's stored value
      control = '<input class="fi fi--ro" value="' + (off ? '' : esc(covRaw(f, v))) + '" readonly tabindex="-1"' +
                (off ? ' placeholder="—"' : '') +
                ' title="' + (off ? JOINT_OFF : 'Clear the other Extra Premium amount to edit this') + '">';
    } else {
      var fk = 'covins|' + rec._id + '~' + slot._id + '|' + f.k;
      control = covControl(f, v, fk, rec);
    }
    return '<div class="cov-extra-f" title="' + esc(f.l) + '">' +
        '<span class="cov-extra-f-k">' + esc(shortLabel) + '</span>' + control +
      '</div>';
  }

  /* A field counts as "has an entry" once it holds a real, non-zero value.
     0 is these fields' neutral DEFAULT (§ newCovInsuredSlot), not an
     operator-entered figure, so it must read the same as blank here — 0 in
     both Permanent $ and Temporary $ at once (their shared starting state)
     must not lock them against each other from the moment a slot exists.
     Kept as its own helper since covExtraCell needs it on three different
     fields at once. */
  function isFilledCov(v) { return v !== null && v !== undefined && v !== '' && v !== 0; }

  /** The Extra Premium cell: one `.fc` cell, like any other, but its
      "control" is a mini-row of the 4 sub-fields rather than a single
      input/select — this is what lets Insured/Sex/Age/Rate/Extra Premium
      all sit on one line per insured slot.

      Permanent $ and Temporary $ (either its amount or its duration) are
      mutually exclusive — an insured is either getting a flat permanent
      extra or a temporary per-mille one, never both — so whichever side
      already has an entry locks the other rather than letting both be
      filled in at once. Permanent % is independent of this and never locks. */
  function covExtraCell(rec, slot) {
    var permFilled = isFilledCov(slot.extraFlat);
    var termFilled = isFilledCov(slot.extraTempAmt) || isFilledCov(slot.extraTempYears);
    var off = isJointPerm(rec) ? JOINT_OFF : false;    // all four disabled on a joint coverage
    var mini =
      covInsExtraMiniField(COVINS_FIELD_MAP.extraPct, rec, slot, 'Perm %', off) +
      covInsExtraMiniField(COVINS_FIELD_MAP.extraFlat, rec, slot, 'Perm $', off || termFilled) +
      covInsExtraMiniField(COVINS_FIELD_MAP.extraTempAmt, rec, slot, 'Term $', off || permFilled) +
      covInsExtraMiniField(COVINS_FIELD_MAP.extraTempYears, rec, slot, 'Term $ Dur.', off || permFilled);
    return '<div class="fc cov-extra-cell"><span class="rs-k">Extra Premium</span>' +
           '<div class="cov-extra-mini">' + mini + '</div></div>';
  }

  /** The Insured dropdown for one slot: every insured from Insured Input,
      minus whichever ones this SAME coverage's OTHER slots already hold (an
      insured can only be on a coverage once) — this slot's own current
      choice stays selectable. A blank first option lets the operator clear
      the slot back to unassigned without removing it outright. */
  function insuredRefOptions(rec, slot) {
    var chosen = {};
    rec.insureds.forEach(function (s) { if (s !== slot && s.insuredId) chosen[s.insuredId] = 1; });
    var opts = [['', '— Select —']];
    insureds.forEach(function (i) { if (!chosen[i._id]) opts.push([i._id, i.name || 'Insured']); });
    return opts;
  }

  function insRefControl(rec, slot) {
    var fk = 'covins|' + rec._id + '~' + slot._id + '|insuredId';
    var opts = insuredRefOptions(rec, slot);
    return '<select class="fi' + needCls(slot.insuredId) + '" data-fk="' + fk + '">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === slot.insuredId ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select>';
  }

  /** Rate options come from the CATEGORY (this coverage) and the referenced
      insured's own Rate (pref/reg, from Insured Input) — nothing stored on
      the slot decides this. No insured chosen yet -> no options -> the same
      inert placeholder box covControl gives an empty enum. Same when the
      insured has no Rate yet, or the coverage no Category yet — rateOptionsFor
      would otherwise fall through to the Preferred codes and invent one. */
  function covRateOptions(rec, slot) {
    var ins = findInsured(slot.insuredId);
    return ins && ins.rate && rec.category ? rateOptionsFor(rec.category, ins.rate).map(function (s) { return [s, s]; }) : [];
  }

  /* The blank "— Select —" first option is load-bearing, not decoration, and
     is the SAME device the Insured dropdown above uses for the same reason.
     `slot.rate` starts blank and is reset to blank whenever the referenced
     insured changes (covCommit), because the old code may not exist in the
     new insured's option set. Without a blank option to point at, a blank
     `slot.rate` matches none of P1/P2/P3, no <option> carries `selected`,
     and the browser falls back to DISPLAYING the first one — so the cell
     read "P1" while the record held "". Worse, picking the P1 already on
     display fires no `change` event at all (the value never changed from
     the browser's point of view), so that rate could never commit: only
     picking P2/P3 ever did. A blank option keeps blank visibly blank and
     makes every real code an actual change that commits. Do not "simplify"
     it away by defaulting `slot.rate` to the first option instead — P1 is
     the best rate class, not a neutral one, and inventing it silently is
     exactly what §0 rule 6 forbids. */
  function covRateControl(rec, slot) {
    var fk = 'covins|' + rec._id + '~' + slot._id + '|rate';
    if (isJointPerm(rec)) {                                  // disabled — see JOINT_OFF
      return '<input class="fi fi--ro" value="" readonly tabindex="-1" placeholder="—" title="' + JOINT_OFF + '">';
    }
    var opts = covRateOptions(rec, slot);
    if (!opts.length) {
      return '<input class="fi fi--ro" value="" readonly tabindex="-1" placeholder="—"' +
             ' title="Select a Coverage Category and an insured (with a Rate) first">';
    }
    opts = [['', '— Select —']].concat(opts);
    return '<select class="fi' + needCls(slot.rate) + '" data-fk="' + fk + '">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === slot.rate ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select>';
  }

  function covValueCell(label, v, numeric) {
    return '<div class="fc"><span class="rs-k">' + esc(label) + '</span>' +
           '<span class="rs-v' + (numeric ? ' num' : '') + (v === null || v === undefined ? ' is-empty' : '') + '">' +
             (v === null || v === undefined ? '—' : esc(String(v))) + '</span></div>';
  }

  /** The age Coverage Input shows for a slot's insured: Age Real or Age
      Calculated, whichever that insured's own Age Calculation is set to —
      same rule Insured Input itself uses for its "Age Calculated" cell. */
  function slotAge(slot) {
    var ins = findInsured(slot.insuredId);
    if (!ins) return null;
    var ages = agesAt(ins.birthdate, settings.refDate);
    return ins.ageCalc === 'last' ? ages.real : ages.nearest;
  }

  var coverages = [];
  var covSeq = 0, covInsSeq = 0;

  function newCovInsuredSlot() {
    return {
      _id: 'ci' + (++covInsSeq),
      insuredId: '', rate: '',
      // Stated defaults: 0%, $0.00, $0.00, 0 years — not blank. See
      // isFilledCov and COVINS_FIELDS above for how this interacts with the
      // Permanent $ / Temporary $ mutual exclusion and the Years field's
      // relaxed range.
      extraPct: 0, extraFlat: 0, extraTempAmt: 0, extraTempYears: 0
    };
  }

  /* Category, Coverage and Coverage Type start blank — no default; the
     operator picks each (highlighted until then). Calculation Type is the
     one field with a stated default: Coverage Amount. */
  function newCoverageRecord() {
    return {
      _id: 'cov' + (++covSeq),
      category: '', coverage: '', covType: '',
      fee: null, feeManual: false,
      calcType: 'amount', amount: null,
      insureds: [newCovInsuredSlot()],
      joint: newJoint()
    };
  }

  /* All blank — the Joint container's inputs (JOINT_FIELDS) start unset and
     highlighted. Kept on the record even while the Coverage Type isn't a joint
     one, so flipping between joint types (or back) doesn't lose what was
     typed; it's simply not shown, and nothing reads it, unless isJointPerm. */
  function newJoint() {
    return { age: null, extraPct: null, extraFlat: null, extraTempAmt: null, extraTempYears: null };
  }

  /* Coverage Fee auto-default. Term Life: whichever Term Life coverage has
     the highest duration (first hit in TERM_LIFE_DURATION_PRIORITY, ties
     broken by whichever was added first) gets $40; every other Term Life
     coverage gets $20 — recomputed from scratch on every render, so adding,
     removing or changing any Term Life coverage keeps the assignment
     correct. Permanent Life is always $40, unconditionally. Critical Illness
     is left alone entirely (no default — "leave blank for now"). A record
     the operator has directly edited (`feeManual`) is skipped by all of
     this; see covCommit. A Term Life record with no Coverage chosen yet has
     no duration to rank, so it sits out entirely (fee stays blank) rather
     than winning the $40 by default. */
  function recalcFees() {
    var termRecs = coverages.filter(function (c) { return c.category === 'termLife' && c.coverage; });
    var bestIdx = -1, bestRec = null;
    termRecs.forEach(function (c) {
      var idx = TERM_LIFE_DURATION_PRIORITY.indexOf(c.coverage);
      if (idx === -1) idx = TERM_LIFE_DURATION_PRIORITY.length;
      if (bestRec === null || idx < bestIdx) { bestIdx = idx; bestRec = c; }
    });
    termRecs.forEach(function (c) { if (!c.feeManual) c.fee = (c === bestRec) ? 40 : 20; });
    coverages.forEach(function (c) { if (c.category === 'permLife' && !c.feeManual) c.fee = 40; });
  }

  /** A Coverage Type change (direct, or as a side effect of Category/Coverage
      changing) may lower the insured-slot cap below the current count —
      truncate to the cap and say so, rather than leaving an invalid excess
      in place silently. */
  function enforceInsuredCap(rec) {
    var cap = maxInsuredsFor(rec.category, rec.covType);
    if (rec.insureds.length > cap) {
      rec.insureds = rec.insureds.slice(0, cap);
      toast('Coverage Type change reduced this coverage to ' + cap + ' insured' + (cap === 1 ? '' : 's') + '.');
    }
  }

  /* Keeps every coverage slot consistent with the insureds it points at.
     Called from renderInsuredList() on every insured-list change. Two rules:

       1. An insured removed in Insured Input leaves slots pointing at an
          `_id` that no longer exists — clear the reference and the Rate
          derived from it, rather than leave it dangling.
       2. A slot's Rate must always be one of ITS OWN currently-valid
          options, or blank. The option set depends on the referenced
          insured's own Rate field (pref/reg) as well as the coverage's
          Category — so flipping an insured from Preferred to Regular in
          Insured Input invalidates any P-code already stored against it on
          every coverage. covCommit clears slot rates on the paths IT owns
          (the slot's insured changing, the coverage's Category changing);
          this is the path it can't see, because the edit happens in a
          different container entirely. Left unchecked the record kept e.g.
          "P1" for a smoker, no <option> matched it, and the cell displayed
          the blank option while the model held a rate class that is not
          even offered — the same display/model divergence covRateControl's
          own blank option exists to prevent, arriving by another route. */
  function syncCoverageInsuredRefs() {
    if (!coverages.length) return;
    var live = {};
    insureds.forEach(function (i) { live[i._id] = 1; });
    coverages.forEach(function (c) {
      c.insureds.forEach(function (s) {
        if (s.insuredId && !live[s.insuredId]) { s.insuredId = ''; s.rate = ''; return; }
        if (!s.rate) return;
        var stillValid = false;
        covRateOptions(c, s).forEach(function (o) { if (o[0] === s.rate) stillValid = true; });
        if (!stillValid) s.rate = '';
      });
    });
  }

  function resolveCov(fk) {
    var p = String(fk).split('|');
    if (p[0] === 'cov') {                          // 'cov' | covId | fieldKey
      var rec = null;
      coverages.forEach(function (c) { if (c._id === p[1]) rec = c; });
      return { kind: 'cov', rec: rec, key: p[2], f: COV_FIELD_MAP[p[2]] };
    }
    if (p[0] === 'covins') {                        // 'covins' | covId~slotId | fieldKey
      var ids = p[1].split('~'), rec2 = null, slot = null;
      coverages.forEach(function (c) {
        if (c._id === ids[0]) { rec2 = c; c.insureds.forEach(function (s) { if (s._id === ids[1]) slot = s; }); }
      });
      return { kind: 'covins', rec: rec2, slot: slot, key: p[2], f: COVINS_FIELD_MAP[p[2]] };
    }
    if (p[0] === 'joint') {                         // 'joint' | covId | fieldKey
      var rec3 = null;
      coverages.forEach(function (c) { if (c._id === p[1]) rec3 = c; });
      return { kind: 'joint', rec: rec3, key: p[2], f: JOINT_FIELD_MAP[p[2]] };
    }
    return {};
  }

  function coverageTitle(rec) {
    var cat = COVERAGE_CATEGORY_MAP[rec.category];
    if (!cat) return 'New Coverage';                  // no Category chosen yet
    return rec.coverage ? cat + ' — ' + rec.coverage : cat;
  }

  /* One row per insured slot: Insured / Sex / Age / Rate / Extra Premium,
     all five cells side by side (§2b requires this to read as one line, not
     a 4-cell row plus a separate box beneath it) — Extra Premium's own four
     sub-fields are nested inside its one cell (covExtraCell), not spread
     across the row as their own cells. */
  function covInsuredSlot(rec, slot, canRemove) {
    var ins = findInsured(slot.insuredId);
    var row = '<div class="fc-row cov-ins-row">' +
        '<div class="fc"><span class="rs-k">' + esc(COVINS_FIELD_MAP.insuredId.l) + '</span>' + insRefControl(rec, slot) + '</div>' +
        covValueCell('Sex', ins ? ins.sex : null, false) +
        covValueCell('Age', slotAge(slot), true) +
        '<div class="fc"><span class="rs-k">' + esc(COVINS_FIELD_MAP.rate.l) + '</span>' + covRateControl(rec, slot) + '</div>' +
        covExtraCell(rec, slot) +
      '</div>';

    return '<div class="cov-ins-slot">' +
        '<div class="cov-ins-slot-head">' +
          '<button class="btn btn--sm btn--danger" data-act="rmcovins" data-cov="' + rec._id + '" data-slot="' + slot._id + '"' +
            (canRemove ? '' : ' disabled title="A coverage must retain at least one insured"') + '>Remove</button>' +
        '</div>' + row +
      '</div>';
  }

  /* The Joint container — a third slot-shaped box under the insured slots,
     only for Permanent Life with a joint Coverage Type (isJointPerm). Same
     `.cov-ins-row` grid as a real slot so every column lines up with the two
     insureds above it: Insured / Joint Sex / Joint Age / Joint Rate / Extra
     Premium. Insured is read-only, "Joint <name 1> / <name 2>" from the two
     slots just above (—, not a partial name, until both are chosen); Joint
     Sex and Joint Rate are fixed (JOINT_SEX/JOINT_RATE, locked boxes); Joint
     Age and the four Extra Premium boxes are the operator's own input
     (rec.joint, JOINT_FIELDS). */
  function covJointField(f, rec) {
    return covControl(f, rec.joint[f.k], 'joint|' + rec._id + '|' + f.k, rec);
  }
  function covJointFixed(label, v) {
    return '<div class="fc"><span class="rs-k">' + esc(label) + '</span>' +
           '<input class="fi fi--ro" value="' + esc(v) + '" readonly tabindex="-1" title="Fixed — can\'t be changed"></div>';
  }
  function covJointMiniField(f, rec, locked) {
    var control = locked
      ? '<input class="fi fi--ro" value="' + esc(covRaw(f, rec.joint[f.k])) + '" readonly tabindex="-1"' +
        ' title="Clear the other Flat Extra Prem. amount to edit this">'
      : covJointField(f, rec);
    return '<div class="cov-extra-f" title="' + esc(f.l + (f.u ? ' (' + f.u + ')' : '')) + '">' +
        '<span class="cov-extra-f-k">' + esc(f.l) + '</span>' + control +
      '</div>';
  }
  function covJointSlot(rec) {
    // Flat Perm vs Flat Term/Duration lock each other — the same rule (and
    // isFilledCov, so a typed 0 doesn't lock) as a slot's Extra Premium.
    var permFilled = isFilledCov(rec.joint.extraFlat);
    var termFilled = isFilledCov(rec.joint.extraTempAmt) || isFilledCov(rec.joint.extraTempYears);
    var locked = { extraFlat: termFilled, extraTempAmt: permFilled, extraTempYears: permFilled };
    var names = rec.insureds.map(function (s) { var i = findInsured(s.insuredId); return i ? (i.name || 'Insured') : ''; });
    var label = (names.length === 2 && names[0] && names[1]) ? 'Joint ' + names[0] + ' / ' + names[1] : null;
    var row = '<div class="fc-row cov-ins-row">' +
        '<div class="fc"><span class="rs-k">Insured</span>' +
          '<span class="rs-v' + (label ? '' : ' is-empty') + '"' + (label ? ' title="' + esc(label) + '"' : '') + '>' +
            (label ? esc(label) : '—') + '</span></div>' +
        covJointFixed('Joint Sex', JOINT_SEX) +
        '<div class="fc"><span class="rs-k">' + esc(JOINT_FIELD_MAP.age.l) + '</span>' + covJointField(JOINT_FIELD_MAP.age, rec) + '</div>' +
        covJointFixed('Joint Rate', JOINT_RATE) +
        '<div class="fc cov-extra-cell"><span class="rs-k">Extra Premium</span><div class="cov-extra-mini">' +
          ['extraPct', 'extraFlat', 'extraTempAmt', 'extraTempYears'].map(function (k) {
            return covJointMiniField(JOINT_FIELD_MAP[k], rec, locked[k]);
          }).join('') +
        '</div></div>' +
      '</div>';
    return '<div class="cov-ins-slot cov-joint-slot">' +
        '<div class="cov-ins-slot-head"><span class="micro">Joint</span></div>' + row +
      '</div>';
  }

  function coverageCard(rec, idx) {
    var canRemoveCov = coverages.length > 1;
    var fieldsRow = COV_FIELDS.map(function (f) { return covFieldCell(f, rec); }).join('');

    var maxIns = maxInsuredsFor(rec.category, rec.covType);
    var canAddIns = rec.insureds.length < maxIns;
    var canRemoveIns = rec.insureds.length > 1;
    var slotsHtml = rec.insureds.map(function (slot) { return covInsuredSlot(rec, slot, canRemoveIns); }).join('');

    return '<div class="coverage-card">' +
        '<div class="coverage-head">' +
          '<span class="coverage-no">' + (idx + 1) + '</span>' +
          '<span class="coverage-title">' + esc(coverageTitle(rec)) + '</span>' +
          '<button class="btn btn--sm btn--danger" data-act="rmcov" data-id="' + rec._id + '"' +
            (canRemoveCov ? '' : ' disabled title="At least one coverage is required"') + '>Remove</button>' +
        '</div>' +
        '<div class="fc-row cov-row-all">' + fieldsRow + '</div>' +
        '<div class="cov-insured-wrap">' +
          '<div class="cov-insured-head"><span class="micro">Insured(s)</span>' +
            '<span class="muted mono" style="font-size:10px">' + rec.insureds.length + ' of ' + maxIns + '</span></div>' +
          slotsHtml +
          (isJointPerm(rec) ? covJointSlot(rec) : '') +
          '<div class="card-foot">' +
            '<span class="spacer"></span>' +
            '<button class="btn btn--sm btn--primary" data-act="addcovins" data-cov="' + rec._id + '"' +
              (canAddIns ? '' : ' disabled title="This Coverage Type allows at most ' + maxIns + ' insured' + (maxIns === 1 ? '' : 's') + '"') +
              '>+ Add Insured</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function coverageInputShell() {
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band">' +
          '<span class="card-title">Coverage Input</span>' +
          '<span class="spacer"></span>' +
          '<span class="card-note" id="covCount"></span>' +
        '</div>' +
        '<div id="coverageList"></div>' +
        '<div class="card-foot">' +
          '<span class="spacer"></span>' +
          '<button class="btn btn--primary btn--sm" id="btnAddCoverage">+ Add Coverage</button>' +
        '</div>' +
      '</div>';
  }

  var pendingCov = null;
  function deferRenderCoverages() {
    if (pendingCov) return;
    pendingCov = setTimeout(function () { pendingCov = null; renderCoverageList(); }, 0);
  }

  function renderCoverageList() {
    if (pendingCov) { clearTimeout(pendingCov); pendingCov = null; }
    if (!$('coverageList')) return;   // not built yet — see init() ordering

    recalcFees();

    var act = document.activeElement;
    var fk = act && act.dataset ? act.dataset.fk : null;
    var typing = fk && act.tagName === 'INPUT' ? act.value : null;
    var from = fk && act.tagName === 'INPUT' ? act.selectionStart : null;
    var to = fk && act.tagName === 'INPUT' ? act.selectionEnd : null;

    $('coverageList').innerHTML = coverages.map(coverageCard).join('');
    $('covCount').textContent = coverages.length + ' coverage' + (coverages.length === 1 ? '' : 's');

    // Results' per-coverage table (§ results) is one row per coverage — keep
    // it in step with every coverage add/remove/edit, the same way Coverage
    // Input itself stays in step with every insured change.
    renderResultsPanel();

    // The Coverages tab (optimizer_coverages.js, its own file) has its own
    // per-coverage table too — notify it the same way, through the public
    // bridge (§ below) rather than reaching into another file's internals.
    notifyOptimizerCoreChange();

    if (!fk) return;
    var back = document.querySelector('[data-fk="' + fk + '"]');
    if (!back) return;
    if (typing !== null && back.value !== typing) back.value = typing;
    back.focus();
    if (from !== null) { try { back.setSelectionRange(from, to); } catch (e) { /* selection unsupported */ } }
  }

  function covCommit(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.fk) return;
    var r = resolveCov(el.dataset.fk);
    if (!r.rec) return;

    if (r.kind === 'cov') {
      var f = r.f, rec = r.rec, key = r.key;
      if (!f) return;
      var res = validateCov(f, el.value, rec);
      if (!res.ok) { el.classList.add('fi--bad'); el.title = res.msg; toast(res.msg, 'err'); return; }
      el.classList.remove('fi--bad');
      rec[key] = (res.v === '' && f.t !== 'enum') ? null : res.v;   // a cleared dropdown stays '' (never null)

      if (key === 'category') {
        rec.coverage = ''; rec.covType = '';                   // no defaults — the operator re-picks both
        rec.feeManual = false; rec.fee = null;
        rec.insureds.forEach(function (s) { s.rate = ''; });   // Rate options depend on category
        enforceInsuredCap(rec);
      } else if (key === 'coverage') {
        // Keep the Coverage Type if it's still offered (Term to 65 has no
        // Joint First-to-Die); otherwise back to blank, not the first option.
        if (covTypeOptions(rec.category, rec.coverage).indexOf(rec.covType) === -1) rec.covType = '';
        rec.feeManual = false; rec.fee = null;                 // duration changed — re-derive the default
        enforceInsuredCap(rec);
      } else if (key === 'covType') {
        enforceInsuredCap(rec);
        // Permanent Life joint: both lives are always there — no manual "+ Add Insured".
        if (isJointPerm(rec) && rec.insureds.length < 2) rec.insureds.push(newCovInsuredSlot());
      } else if (key === 'calcType') {
        if (rec.amount !== null && rec.amount !== undefined) {
          rec.amount = null;                       // a premium and a coverage amount aren't the same number
          toast('Input cleared — it now means ' + (rec.calcType === 'premium' ? 'a premium (2 decimals)' : 'a coverage amount (whole number)') + '.');
        }
      } else if (key === 'fee') {
        // Clearing the box back to blank hands control back to recalcFees()
        // (feeManual = false); typing any other value opts this record out
        // of the auto-default until cleared again.
        rec.feeManual = (res.v !== '' && res.v !== null);
      }
      deferRenderCoverages();
      return;
    }

    if (r.kind === 'joint') {
      if (!r.f) return;
      var resJ = validateCov(r.f, el.value, r.rec);
      if (!resJ.ok) { el.classList.add('fi--bad'); el.title = resJ.msg; toast(resJ.msg, 'err'); return; }
      el.classList.remove('fi--bad');
      r.rec.joint[r.key] = resJ.v === '' ? null : resJ.v;
      deferRenderCoverages();
      return;
    }

    // r.kind === 'covins'
    var slot = r.slot, rec2 = r.rec;
    if (!slot) return;
    if (r.key === 'insuredId') {
      slot.insuredId = el.value;
      slot.rate = '';                                          // old code no longer means anything
      deferRenderCoverages();
      return;
    }
    if (r.key === 'rate') {
      // The blank "— Select —" option (covRateControl) commits as a real
      // clear, the same way the Insured dropdown's own blank option does —
      // without this branch the operator could pick it and have nothing
      // happen, the row snapping back on the next render.
      if (el.value === '') { slot.rate = ''; deferRenderCoverages(); return; }
      var opts = covRateOptions(rec2, slot), hit = null;
      opts.forEach(function (o) { if (o[0] === el.value) hit = o[0]; });
      if (hit) { slot.rate = hit; deferRenderCoverages(); }
      return;
    }
    if (!r.f) return;
    var res2 = validateCov(r.f, el.value, rec2);
    if (!res2.ok) { el.classList.add('fi--bad'); el.title = res2.msg; toast(res2.msg, 'err'); return; }
    el.classList.remove('fi--bad');
    slot[r.key] = res2.v === '' ? null : res2.v;
    deferRenderCoverages();
  }

  function covLive(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.fk) return;
    var r = resolveCov(el.dataset.fk);
    if (!r.f || r.f.t === 'enum' || r.key === 'insuredId' || r.key === 'rate') return;
    el.classList.toggle('fi--bad', !validateCov(r.f, el.value, r.rec).ok);
    if (r.f.need) el.classList.toggle('fi--need', el.value.trim() === '');   // clears as they type
  }

  function initCoverageInput() {
    coverages = [newCoverageRecord()];
    $('coverageInputHost').innerHTML = coverageInputShell();
    renderCoverageList();

    $('coverageList').addEventListener('change', covCommit);
    $('coverageList').addEventListener('input', covLive);
    $('coverageList').addEventListener('click', function (e) {
      var rm = e.target.closest ? e.target.closest('button[data-act="rmcov"]') : null;
      if (rm && !rm.disabled) {
        coverages = coverages.filter(function (c) { return c._id !== rm.dataset.id; });
        renderCoverageList();
        return;
      }
      var add = e.target.closest ? e.target.closest('button[data-act="addcovins"]') : null;
      if (add && !add.disabled) {
        var rec = null;
        coverages.forEach(function (c) { if (c._id === add.dataset.cov) rec = c; });
        if (rec && rec.insureds.length < maxInsuredsFor(rec.category, rec.covType)) {
          rec.insureds.push(newCovInsuredSlot());
          renderCoverageList();
        }
        return;
      }
      var rmIns = e.target.closest ? e.target.closest('button[data-act="rmcovins"]') : null;
      if (rmIns && !rmIns.disabled) {
        var rec2 = null;
        coverages.forEach(function (c) { if (c._id === rmIns.dataset.cov) rec2 = c; });
        if (rec2 && rec2.insureds.length > 1) {
          rec2.insureds = rec2.insureds.filter(function (s) { return s._id !== rmIns.dataset.slot; });
          renderCoverageList();
        }
      }
    });
    $('btnAddCoverage').addEventListener('click', function () {
      coverages.push(newCoverageRecord());
      renderCoverageList();
    });
  }

  // ------------------------------------------------------------- results
  /* Right side of optInput's one .split (§ buildPanes), sticky beside the
     stacked Insured Input + Coverage Input column. Two subcontainers:

       1. One row per coverage, 5 figure columns each — a per-coverage
          breakdown that used to be one flat 6-figure strip shared across
          every coverage. Rebuilt every time `coverages` changes (add,
          remove, or any field edit that could change a coverage's title),
          via the same hook renderCoverageList() already uses to keep
          Coverage Input's own dependents in sync (§2b).
       2. A 3-figure summary across all coverages, in the SAME .resultbar/
          .rs shape the original 6-figure strip used — reuses resultsBar()
          directly rather than a second bespoke builder.

     Nothing here is calculated yet — every cell is still the same "—, not
     calculated yet" placeholder resultsBar() has always shown. This section
     only reorganizes WHERE those eventual figures will live; no formula
     exists for any of them. */
  var RESULTS_COVERAGE_FIELDS = [
    'Prem. Basis Ins. Amt', 'Highest Amt (Min.)', 'Highest Amt (Max.)', 'Modal Prem', 'Modal Prem Backdated'
  ];
  var RESULTS_SUMMARY_FIELDS = ['Modal Premium', 'Modal Premium Backdated', 'Backdate Savings Date'];

  function resultsPanelShell() {
    return '<div class="card card--out">' +
        '<div class="card-head card-head--band"><span class="card-title">Results</span></div>' +
        '<div id="resultsCoverageWrap"></div>' +
        '<div id="resultsSummaryWrap"></div>' +
      '</div>';
  }

  /** One row per coverage; a coverage's identity is its number + title
      (coverageTitle(), same as its own card's own header — §2b), same as
      every other cross-reference on this page rather than a duplicated
      name. Plain "—" placeholders, not `.rs-v` (built for a `.fc`/`.rs`
      cell's flex layout, not a table cell). */
  /** Prem. Basis Ins. Amt and Highest Amt (Max./Min.) are computed in
      optimizer_coverages.js — it owns the Modal Prem. formula they are the
      inverse of — and lent back
      through the bridge. Null until that file has loaded (it comes after this
      one, optimizer.html), which the first render can hit; the re-render on
      the next change, or when the rate files report in, fills them. */
  function highestAmtFor(c) {
    var api = window.OptimizerCore;
    return api && api.highestAmt ? api.highestAmt(c) : null;
  }

  function premBasisFor(c) {
    var api = window.OptimizerCore;
    return api && api.premBasis ? api.premBasis(c) : null;
  }

  /** One solved Results figure. Blank — not "—" — when the column does not
      apply to this coverage's Calculation Type (Prem. Basis Ins. Amt is for
      Input Premium, the two Highest Amt for Coverage Amount): per the request,
      each shows a value for one and nothing for the other. Amber where there
      is no formula, red where the rate lookup failed, muted "—" with the
      reason in its tooltip while an input is missing; the figure's own tooltip
      names the premium it was solved against. */
  function solvedCell(r, value) {
    if (!r) return '<td class="r"><span class="muted" title="Not calculated yet">—</span></td>';
    if (r.blank) return '<td class="r"></td>';
    if (r.pending) return window.OptimizerCore.pendingCell();
    if (r.error) return '<td class="r cell-error" title="' + esc(r.error) + '">Error</td>';
    if (r.blocked) return '<td class="r"><span class="muted" title="' + esc(r.blocked) + '">—</span></td>';
    return '<td class="r" title="' + esc(r.tip) + '">' + esc(group(value, 0)) + '</td>';
  }

  function resultsCoverageTable() {
    if (!coverages.length) {
      return '<div class="proj-slot" style="margin:8px;"><div class="s">Add a coverage to see its figures here.</div></div>';
    }
    var headCells = RESULTS_COVERAGE_FIELDS.map(function (l) { return '<th class="r">' + esc(l) + '</th>'; }).join('');
    var bodyRows = coverages.map(function (c, idx) {
      var h = highestAmtFor(c), pb = premBasisFor(c);
      var cells = RESULTS_COVERAGE_FIELDS.map(function (label) {
        if (label === 'Prem. Basis Ins. Amt') return solvedCell(pb, pb && pb.amount);
        if (label.indexOf('Highest Amt') === 0) return solvedCell(h, h && (label.indexOf('Max') > 0 ? h.max : h.min));
        return '<td class="r"><span class="muted" title="Not calculated yet">—</span></td>';
      }).join('');
      return '<tr><td>' + (idx + 1) + '. ' + esc(coverageTitle(c)) + '</td>' + cells + '</tr>';
    }).join('');
    return '<div class="results-cov-wrap"><table class="ins">' +
        '<thead><tr><th>Coverage</th>' + headCells + '</tr></thead>' +
        '<tbody>' + bodyRows + '</tbody>' +
      '</table></div>';
  }

  function renderResultsPanel() {
    if (!$('resultsCoverageWrap')) return;   // not built yet — see init() ordering
    $('resultsCoverageWrap').innerHTML = resultsCoverageTable();
    $('resultsSummaryWrap').innerHTML = resultsBar('Summary', RESULTS_SUMMARY_FIELDS);
  }

  function initResultsPanel() {
    $('resultsHost').innerHTML = resultsPanelShell();
    renderResultsPanel();
    // Highest Amt needs the rate files; optimizer_rates.js fires this as each
    // one reports in (the same hook the Coverages/Backdate tabs listen on).
    document.addEventListener('ratesstatus', renderResultsPanel);
  }

  // ------------------------------------------------------------------ tabs
  /* One entry per tab. `split` gives a tab the same two-thirds / one-third
     layout the Inforce Home pane uses, with the two container titles.
     `optInput` is fully special-cased in buildPanes() (Settings full-width,
     then Insured Input + Coverage Input stacked beside Results — § there),
     so it carries neither `split` nor a result-fields list of its own; every
     other tab still gets the generic two-`slot()` treatment from `split`.
     Adding a tab is one line here; its pane and button are generated. */
  var TABS = [
    { id: 'optInput',     label: 'Input & Results' },
    { id: 'optCoverages', label: 'Coverages' },
    { id: 'optInsureds',  label: 'Insureds' },
    { id: 'optRates',     label: 'Rates' },
    { id: 'optBackdate',  label: 'Backdate' },
    { id: 'optEqAge',     label: 'Eq. Age / Substd Prem.' },
    { id: 'optHistory',   label: 'History' }
  ];

  /** An empty banded container, ready for its view to be dropped in. */
  function slot(title) {
    return '<div class="card">' +
        '<div class="card-head card-head--band">' +
          '<span class="card-title">' + esc(title) + '</span></div>' +
        '<div class="proj-slot">' +
          '<div class="t">' + esc(title) + '</div>' +
          '<div class="s">Not built yet. This container is where the ' +
            esc(title) + ' view will render.</div>' +
        '</div>' +
      '</div>';
  }

  /** A thin figures row: a left-edge tag, then one read-only cell per field.
      Originally the whole "Results" strip on its own; now reused for just
      the Results container's own summary subcontainer (§ results), which is
      why the tag text is a parameter rather than hardcoded. */
  function resultsBar(tag, fields) {
    return '<div class="resultbar">' +
        '<span class="resultbar-tag">' + esc(tag) + '</span>' +
        fields.map(function (label) {
          return '<div class="rs">' +
                   '<span class="rs-k">' + esc(label) + '</span>' +
                   '<span class="rs-v is-empty" title="Not calculated yet">—</span>' +
                 '</div>';
        }).join('') +
      '</div>';
  }

  function renderTabs() {
    $('tabList').innerHTML = TABS.map(function (x) {
      return '<button class="tab" role="tab" data-pane="' + x.id + '" aria-selected="false">' +
             esc(x.label) + '</button>';
    }).join('');
  }

  function buildPanes() {
    $('panes').innerHTML = TABS.map(function (x) {
      var body;
      if (x.id === 'optInput') {
        // Settings stands alone, full width, above everything else. Below
        // it, ONE .split: Insured Input and Coverage Input stacked in the
        // 2/3 .split-main column, Results sticky beside both of them in the
        // 1/3 .split-side — not two separate .split blocks the way this
        // used to be paired (Results+Settings, then Coverage+Insured); all
        // three live containers get a stable host id so their own init…()
        // can render into them once panes exist.
        body =
          '<div id="settingsPanelHost"></div>' +
          '<div class="split">' +
            '<div class="split-main">' +
              '<div id="insuredInputHost"></div>' +
              '<div id="coverageInputHost"></div>' +
            '</div>' +
            '<div class="split-side" id="resultsHost"></div>' +
          '</div>';
      } else if (x.id === 'optCoverages') {
        // Live (optimizer_coverages.js), not a placeholder slot — same idiom
        // as optInput's own hosts above, just in its own file/IIFE (§ the
        // public bridge, below). buildPanes() still owns the pane's outer
        // shape; the tab's own script only ever fills the empty host.
        body = '<div id="coveragesTabHost"></div>';
      } else if (x.id === 'optInsureds') {
        // Live (optimizer_insureds.js) — same idiom as optCoverages above.
        body = '<div id="insuredsTabHost"></div>';
      } else if (x.id === 'optBackdate') {
        // Live (optimizer_backdate.js) — same idiom as optCoverages/optInsureds
        // above. Its own two containers stack top/bottom inside this one host,
        // not the generic .split (that's a left/right layout, § buildPanes).
        body = '<div id="backdateTabHost"></div>';
      } else if (x.id === 'optHistory') {
        // Live (optimizer_history.js) — same idiom as the other split-off
        // tabs, EXCEPT this one is also the one file allowed to WRITE shared
        // state back into optimizer.js (via OptimizerCore.restoreState — see
        // the public bridge, below) when the operator picks a saved test
        // case to reload.
        body = '<div id="historyTabHost"></div>';
      } else if (x.id === 'optRates') {
        // Live (optimizer_rates.js) — same idiom as the other split-off tabs.
        body = '<div id="ratesTabHost"></div>';
      } else if (x.split) {
        body = '<div class="split">' +
            '<div class="split-main">' + slot(x.split[0]) + '</div>' +
            '<div class="split-side">' + slot(x.split[1]) + '</div>' +
          '</div>';
      } else {
        body = slot(x.label);
      }
      return '<section class="pane" id="' + x.id + '" role="tabpanel" hidden>' + body + '</section>';
    }).join('');
  }

  function showTab(pane) {
    var label = '';
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      var on = t.dataset.pane === pane;
      t.setAttribute('aria-selected', String(on));
      if (on) label = t.textContent;
    });
    TABS.forEach(function (x) { $(x.id).hidden = x.id !== pane; });
    $('stTab').textContent = label;
  }

  // -------------------------------------------------------------- save/load
  /* Serializing/restoring the full operator input set (Settings, Insureds,
     Coverages) for the History tab (optimizer_history.js, its own file) to
     save and reload a complete test case. Kept HERE rather than in
     History's own file because restoring is a bulk overwrite of
     `coverages`/`insureds`/`settings` — exactly the write the bridge is
     deliberately read-only against everywhere else (§ below, invariant
     #25). `restoreState` is the one narrow, explicit exception: implemented
     and validated entirely in this file, only ever CALLED from History's. */

  /** Highest numeric suffix among `_id` strings starting with `prefix` — used
      after a restore so a freshly-added record's `_id` never collides with
      one that came back from a loaded snapshot. */
  function maxIdSeq(ids, prefix) {
    var max = 0;
    ids.forEach(function (id) {
      if (typeof id !== 'string' || id.indexOf(prefix) !== 0) return;
      var n = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return max;
  }

  /** A plain-JSON, deep-cloned snapshot of every operator input that feeds
      Coverage Input/Insured Input/Settings — everything needed to reproduce
      this page's own outputs later. Unit Value (optimizer_coverages.js's own
      field, outside this model, §2d) is NOT included here — History reads
      it separately through getSnapshot('unitValues'), below. */
  function snapshotState() {
    return JSON.parse(JSON.stringify({ settings: settings, insureds: insureds, coverages: coverages }));
  }

  var SETTINGS_KEYS = ['refDate', 'freq', 'mcd', 'premAdjPct', 'premAdjPctDur', 'premAdjAmt', 'premAdjAmtDur'];

  /** The one deliberate write exception to the read-only bridge (§ below,
      invariant #25) — restoring a saved test case is a bulk overwrite of
      shared state that only optimizer.js may perform, but History's own file
      is what triggers it (the operator clicking Load). `snap` is the same
      shape snapshotState() produces (or a hand-edited/imported .json file
      claiming to be one — defended against below, not trusted blindly). */
  function restoreState(snap) {
    if (!snap) return;

    // `settings` is exposed on the bridge as the object itself (not a getter
    // function, unlike coverages/insureds below) — mutate its own fields in
    // place rather than reassigning the variable, or OptimizerCore.settings
    // would keep pointing at the old object.
    SETTINGS_KEYS.forEach(function (k) {
      if (snap.settings && k in snap.settings) settings[k] = snap.settings[k];
    });

    // A malformed/hand-edited file could carry an empty list; both floors
    // (§9 invariants #8/#16 — never below one insured, never below one
    // coverage) must hold regardless of what was loaded.
    insureds = (snap.insureds && snap.insureds.length) ? snap.insureds : [newInsuredRecord()];
    coverages = (snap.coverages && snap.coverages.length) ? snap.coverages : [newCoverageRecord()];
    coverages.forEach(function (c) { if (!c.joint) c.joint = newJoint(); });   // saved before the Joint container existed

    insSeq = Math.max(insSeq, maxIdSeq(insureds.map(function (i) { return i._id; }), 'ins'));
    covSeq = Math.max(covSeq, maxIdSeq(coverages.map(function (c) { return c._id; }), 'cov'));
    var slotIds = [];
    coverages.forEach(function (c) { (c.insureds || []).forEach(function (s) { slotIds.push(s._id); }); });
    covInsSeq = Math.max(covInsSeq, maxIdSeq(slotIds, 'ci'));

    // Settings fields aren't part of a repeating list, so nothing else
    // re-renders them (same reason settingsCommit echoes its own field back,
    // §2a) — rebuild the whole bar so every control reflects the loaded value.
    $('settingsPanelHost').innerHTML = settingsPanelShell();

    // Cascades through syncCoverageInsuredRefs/renderCoverageList/
    // renderResultsPanel/notifyOptimizerCoreChange — refreshes every other
    // live region (Coverage Input, Results, Coverages/Insureds/Backdate tabs)
    // in one call, the same as any other insureds-list change.
    renderInsuredList();
  }

  // ----------------------------------------------------------------- axis key
  /* Preferred/Non-smoker -> N, Regular/Smoker -> S, blank Rate -> '' (never
     defaulted to N). Originally local to
     optimizer_insureds.js (its own "Insured Rate" column, §2e); moved here
     once axisKeyPrefix() below became a SECOND consumer needing the exact
     same mapping — the same "shared pieces move to the bridge the moment a
     second file needs them" rule COVERAGE_ABBR/COVTYPE_ABBR already follow. */
  function insuredRateCode(ins) {
    return ins.rate === 'reg' ? 'S' : ins.rate === 'pref' ? 'N' : '';
  }

  /* The 26-character Axis Key PREFIX — everything except the 6-character
     rate band code, which is a Rates-tab concept (one row per band, §
     optimizer_rates.js) that has no place on a per-insured Insureds-tab row.
     Two category-specific layouts; both return null (never a guessed
     string) when the category isn't one of these two, or a value the
     format depends on isn't available yet (no Coverage Rate chosen, an
     unrecognised covType, …) — the same "blank stays blank" rule as
     everywhere else on this page. */
  function axisKeyPrefixTermLife(c, ins, slot) {
    var typeChar = c.covType === 'Individual' ? '_' : (c.covType === 'Joint First-to-Die' ? 'C' : null);
    var coverageCode = COVERAGE_ABBR[c.coverage];
    if (typeChar === null || !coverageCode || !slot.rate || !ins.sex || !ins.rate) return null;
    // Joint First-to-Die has no MCD-rated table — the block stays blank
    // (no rate would be found under "_RMC_") even when Has MCD is TRUE.
    var mcdOn = settings.mcd && c.covType !== 'Joint First-to-Die';
    var mcdBlock = mcdOn ? 'RMC_2509_' : '____2509_';
    return 'DT' + typeChar + coverageCode + '______' + mcdBlock + ins.sex + insuredRateCode(ins) + slot.rate + '_';
  }

  /* VEG100 ('WL to 100') and T100 ('Term to 100') are 6 and 4 characters —
     COVERAGE_ABBR's own values, unchanged since they're also what the
     Coverages/Insureds tabs display — neither fits the stated 5-character
     slot for Permanent Life. Rather than guess at a truncated/padded form
     that was never specified, those two products simply can't produce a key
     yet (null below); every other Permanent Life product is unaffected. */
  function axisKeyPrefixPermLife(c, ins) {
    var coverageCode = COVERAGE_ABBR[c.coverage];
    if (!coverageCode || coverageCode.length !== 5 || !c.covType) return null;   // blank Coverage Type ≠ Individual
    var isJoint = isJointPerm(c);
    if (!isJoint && (!ins.sex || !ins.rate)) return null;
    var sexChar = isJoint ? JOINT_SEX : ins.sex;
    var rateChar = isJoint ? JOINT_RATE : insuredRateCode(ins);
    return 'DT' + '_' + coverageCode + '________2007_' + sexChar + rateChar + '___';
  }

  function axisKeyPrefix(c, slot) {
    var ins = findInsured(slot.insuredId);
    if (!ins) return null;
    if (c.category === 'termLife') return axisKeyPrefixTermLife(c, ins, slot);
    if (c.category === 'permLife') return axisKeyPrefixPermLife(c, ins);
    return null;   // Critical Illness — no Axis Key format given yet
  }

  // ------------------------------------------------------------ public bridge
  /* The one deliberate exception to "everything lives inside one IIFE, no
     globals" (§0). Some tabs — starting with Coverages — live in their own
     file/IIFE instead, for the same reason `optimizer-engine.js` was always
     allowed to be a second file: easier to structure, refactor and debug in
     isolation as the page grows past a handful of live regions. There is no
     build step or module loader here, so a global is the only way two plain
     <script> tags can share state while still opening from disk — the
     alternative, `type="module"`, fails via `file://` in Chromium. This
     exposes READ access to shared state/utilities and a change hook only;
     nothing here lets another file mutate `coverages`/`settings` directly —
     every write still goes through this file's own commit handlers.
     `registerSnapshot`/`restoreState` (below) are the two narrow exceptions,
     both scoped to the Save/Load feature specifically — see their own
     comments for why each is safe. */
  var coreChangeListeners = [];
  function notifyOptimizerCoreChange() {
    coreChangeListeners.forEach(function (fn) { fn(); });
  }

  /* A split-off tab's own LOCAL state (not part of coverages/insureds/
     settings) that should still be captured/restored by a saved test case —
     Unit Value (optimizer_coverages.js, §2d) is the only one today. That
     file calls registerSnapshot('unitValues', {get, set}) once it's loaded;
     History (optimizer_history.js) reads/writes it through getSnapshot/
     setSnapshot rather than reaching into optimizer_coverages.js directly.
     The mutation itself still happens inside optimizer_coverages.js's own
     `set` callback — this is indirection, not a bypass of "each file owns
     its own state". */
  var snapshotProviders = {};
  window.OptimizerCore = {
    coverages: function () { return coverages; },   // live array, not a snapshot
    insureds: function () { return insureds; },     // same, for the Insureds tab (§2e)
    settings: settings,                             // live object, same reason
    COVERAGE_CATEGORY_MAP: COVERAGE_CATEGORY_MAP,
    esc: esc, group: group, toNum: toNum, decimals: decimals,
    coverageTitle: coverageTitle, findInsured: findInsured, agesAt: agesAt,
    /* Date parsing/formatting — not needed on the bridge until the Backdate
       tab (§ optimizer_backdate.js) became the first split-off tab to do its
       own date arithmetic (surrounding birthdays, a midpoint date, Illustration
       Date minus 6 months). Extended here rather than re-ported a second time. */
    parseDate: parseDate, fmtDate: fmtDate, buildDate: buildDate,
    /* Display abbreviation maps — named vars now (§ COVERAGE_OPTIONS,
       above), referenced here rather than redefined, specifically so a
       SECOND split-off tab (Insureds, §2e — its own Coverage/Coverage Type
       columns need the exact same codes) reads the one shared copy rather
       than a second hand-typed one that could quietly drift out of sync. */
    COVERAGE_ABBR: COVERAGE_ABBR,
    COVTYPE_ABBR: COVTYPE_ABBR,
    /** Preferred/Non-smoker -> N, Regular/Smoker -> S (§ axis key, above). */
    insuredRateCode: insuredRateCode,
    /** Permanent Life + a joint Coverage Type, and the fixed Joint Sex/Rate
        its Joint container (Coverage Input) uses — the Insureds tab's Joint
        columns key off these (§ isJointPerm, above). */
    isJointPerm: isJointPerm, jointAge: jointAge, jointFigures: jointFigures, JOINT_SEX: JOINT_SEX, JOINT_RATE: JOINT_RATE,
    /** The 26-character Axis Key prefix for one (coverage, insured slot)
        pair — null if the category/product/covType combination can't
        produce one yet (§ axis key, above). The Rates tab appends its own
        6-character rate band code to complete the full 32-character key. */
    axisKeyPrefix: axisKeyPrefix,
    /** One "formula not yet provided" cell — `.cell-pending` (optimizer.css),
        amber/warn rather than the page's usual muted "—" for a plain
        not-yet-calculated figure, since these are explicitly flagged as
        pending formulas, not just outputs nothing has read yet. `extraClass`
        adds e.g. `col-hard-sep` without a split-off tab needing to know
        `cell-pending`'s own class name to combine the two. */
    pendingCell: function (extraClass) {
      return '<td class="r cell-pending' + (extraClass ? ' ' + extraClass : '') + '"' +
             ' title="Formula not yet provided">—</td>';
    },
    /** Registers `fn` to run after any commit that could change `coverages`,
        `insureds`, or `settings` — coverage/insured add/remove/edit, or a
        Settings field commit (including the Multi-Coverage Discount toggle).
        Fires more often than strictly necessary rather than trying to
        distinguish exactly which writes another tab cares about — cheap and
        always correct, the same trade-off `recalcFees()` already makes
        running on every render. */
    onChange: function (fn) { coreChangeListeners.push(fn); },
    /** Lets a split-off tab file offer its own local state up for Save/Load
        to include — see `snapshotProviders` above. */
    registerSnapshot: function (key, provider) { snapshotProviders[key] = provider; },
    getSnapshot: function (key) { return snapshotProviders[key] ? snapshotProviders[key].get() : undefined; },
    setSnapshot: function (key, data) { if (snapshotProviders[key]) snapshotProviders[key].set(data); },
    /** A deep-cloned, plain-JSON snapshot of Settings/Insureds/Coverages —
        read-only, like every other bridge accessor (§ save/load, above). */
    snapshotState: snapshotState,
    /** The one deliberate WRITE exception to this otherwise read-only bridge
        — restoring a saved test case (§ save/load, above). Only ever called
        from optimizer_history.js. */
    restoreState: restoreState
  };

  // ------------------------------------------------------------------ init
  loadTheme();
  renderToolMenu();
  renderTabs();
  buildPanes();
  initSettingsPanel();
  initResultsPanel();      // before initCoverageInput: seeds #resultsCoverageWrap
                           // so the first renderCoverageList() call (inside
                           // initCoverageInput) has something to render into.
  initCoverageInput();     // before initInsuredInput: seeds `coverages` and
                           // #coverageList so the first renderInsuredList()
                           // call (inside initInsuredInput) has something to
                           // sync/render into, not just a no-op guard.
  initInsuredInput();
  showTab(TABS[0].id);

  $('toolSelect').addEventListener('click', function () {
    openToolMenu($('toolMenu').hidden);
  });
  $('toolMenu').addEventListener('click', function (e) {
    var opt = e.target.closest ? e.target.closest('.brand-opt') : null;
    if (opt) selectTool(opt.dataset.tool);
  });
  document.addEventListener('click', function (e) {
    if (!$('toolMenu').hidden && !$('brandBlock').contains(e.target)) openToolMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('toolMenu').hidden) { openToolMenu(false); $('toolSelect').focus(); }
    // Enter commits by blurring, so `change` always fires with focus gone —
    // same reasoning as inforce.js (INFORCE_REFERENCE.md §9).
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.fk) { e.preventDefault(); e.target.blur(); }
  });

  // Select on focus, so typing over an existing value replaces it cleanly.
  document.addEventListener('focusin', function (e) {
    if (e.target.dataset && e.target.dataset.fk && e.target.tagName === 'INPUT') e.target.select();
  });

  $('tabList').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.tab') : null;
    if (b) showTab(b.dataset.pane);
  });

  $('btnTheme').addEventListener('click', toggleTheme);
})();
