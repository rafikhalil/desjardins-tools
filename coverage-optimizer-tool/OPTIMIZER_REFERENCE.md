# Coverage Optimizer — Template Reference

Complete specification of the **Coverage Optimizer** front end
(`optimizer.html`, `optimizer.css`, `optimizer.js`), written to be handed to a
coding agent that will build the tool's views and calculations into it.

The sibling page, the Inforce Tool (`inforce.*`), has its own reference:
`INFORCE_REFERENCE.md`. The two share a component set and a header switcher,
nothing else; this document describes the Optimizer page only.

**Read this first, in full, before writing code.** The Optimizer is no longer
mostly scaffold: **six of seven tabs are live** — Input & Results (Settings,
Insured Input, Coverage Input, Results), Coverages, Insureds, Rates, Backdate
and History all add/remove/edit, validate, cascade dropdowns, run the exact
specified age algorithm, and re-render focus-safely. **Eq. Age / Substd
Prem. is the one tab still an empty container.** Read the live tabs before
building anything new — they are this page's own reference implementation,
not just Inforce's, and the newer ones (§2f–§2h) are the current template for
how a split-off tab is structured, not just §2b–§2e. Your job on anything
still open is to build into the containers/conventions that already exist,
the same way each of these did.

- Version: UI v0.4.0
- Stack: hand-written HTML + CSS + ES5 JavaScript, plus one vendored parsing
  library (`xlsx.full.min.js`, SheetJS — §0 rule 2, §2f). **Zero other
  dependencies, zero build step, no framework, no bundler, no package.json.**
- Files: `optimizer.html`, `optimizer.css`, `optimizer.js`, the five split-off
  tab file pairs (§1), `xlsx.full.min.js`, `start-server.bat`, plus this
  reference and `OPTIMIZER_INSTRUCTIONS.md`.

---

## 0. Ground rules

These are non-negotiable constraints of the project. Violating them is the most
likely way to produce an unusable result.

1. **Do not add dependencies.** No React, Vue, jQuery, lodash, date-fns,
   charting libraries, bundlers, or transpilers. If you need something
   external, load it as a single vendored `<script>` file or write it by hand.
   The tool must keep running by opening `optimizer.html` directly. **This
   allowance has been exercised exactly once**: `xlsx.full.min.js` (SheetJS,
   §2f) — a real `.xlsx` reader is not something anyone hand-writes, unlike
   everything else on this page. It's a plain vendored `<script>`, no build
   step, still works via `file://`; only the *optional* "Load from `rates/`"
   convenience button (§2f) needs an http(s) server (`fetch()` of a local
   path is blocked on `file://`) — the manual file picker next to it does not
   and is what keeps rule 1's file://-first guarantee intact.
2. **Do not add files** beyond what is strictly required. A large calculation
   engine (`optimizer-engine.js`) is acceptable, and so is a live TAB getting
   its own file pair when it earns its keep — `optimizer_coverages.css`/`.js`
   (§1, §2d) was the first; `optimizer_insureds.*` (§2e), `optimizer_rates.*`
   (§2f), `optimizer_backdate.*` (§2g) and `optimizer_history.*` (§2h)
   followed the identical pattern, reading shared state through the one
   deliberate global that pattern requires (`window.OptimizerCore`), never a
   second one. **History (§2h) is the one exception inside that pattern**: it
   also calls the bridge's one deliberate WRITE path (`OptimizerCore.
   restoreState`, §2d) — every other split-off tab stays strictly read-only.
   `start-server.bat` is a dev convenience (wraps §1 "Running it"), not part
   of the running app, and isn't held to this rule. Anything beyond all of
   this needs justification.
3. **ES5 syntax only in `optimizer.js`** (and any file that splits off from
   it the same way `optimizer_coverages.js` did). `var`, `function`, string
   concatenation. No arrow functions, `const`/`let`, template literals, or
   `class` — every one of these files is uniform and should stay uniform. (A
   separate CALCULATION engine file may use modern syntax, but keep it
   dependency-free.)
4. **Every file's own code lives inside one IIFE.** `optimizer.js` is
   `(function () { 'use strict'; ... })();`; `optimizer_coverages.js` is its
   own, separate one. **`window.OptimizerCore` is the one deliberate
   exception** — the read-only bridge a split-off tab file needs to reach
   `optimizer.js`'s shared state without a build step or module loader (§2d).
   Nothing else is ever a global, and no other file gets its own bridge
   object — everything a future split-off tab needs goes through this same
   one, extended if it doesn't already expose enough.
5. **Do not restyle anything.** Colour, spacing, type scale and layout have all
   been reviewed and signed off. Use the existing CSS classes and design tokens.
6. **Never invent a value.** A default, a placeholder zero, or a
   silently-coerced number is worse than a blank. Blank means blank.
7. **Port, don't reinvent.** The Inforce Tool already has a validated-input
   control, a field-descriptor schema, date parsing, number formatting and an
   extract parser. If the Optimizer needs any of these, copy them from
   `inforce.js` (see §8) rather than writing a second version.

---

## 1. File map

```
inforce-tool/
├── optimizer.html               static shell: top bar (incl. Save Test, §2h), tab bar, pane host, status bar, toast
├── optimizer.css                slate palette + every component class
├── optimizer.js                 one IIFE: switcher, theme, tabs, pane generation, the "core" tabs, the public bridge
├── optimizer_coverages.css      Coverages tab (§2d) — own file, own IIFE, own <link>/<script>
├── optimizer_coverages.js
├── optimizer_insureds.css       Insureds tab (§2e) — same pattern
├── optimizer_insureds.js
├── optimizer_rates.css          Rates tab (§2f) — same pattern
├── optimizer_rates.js
├── optimizer_backdate.css       Backdate tab (§2g) — same pattern
├── optimizer_backdate.js
├── optimizer_history.css        History tab + the top-bar Save Test controls (§2h) — same pattern
├── optimizer_history.js
├── xlsx.full.min.js             vendored SheetJS build (§0 rule 1) — the one dependency this page has
├── start-server.bat             double-click convenience for "Running it", below — not part of the app itself
├── data/                        where Save Test's downloaded .json test cases land (§2h) — created by the browser, not shipped
├── rates/                       where imported rate workbooks are expected (§2f) — empty until real files are dropped in
├── OPTIMIZER_REFERENCE.md       this file
├── OPTIMIZER_INSTRUCTIONS.md    custom instructions for the coding platform
│
├── inforce.html / .css / .js    the sibling tool — out of scope here
└── INFORCE_REFERENCE.md / INFORCE_INSTRUCTIONS.md
```

**A live tab may live in its own file pair instead of inside `optimizer.js`/
`.css`.** Coverages (§2d), Insureds (§2e), Rates (§2f), Backdate (§2g) and
History (§2h) all do: their own `<link>`/`<script>` in `optimizer.html`,
loaded after `optimizer.js`/`.css` (load order only matters insofar as each
file must come after whatever it depends on — none of the five split-off tab
files depend on each other, only on `optimizer.js`, and `optimizer_rates.js`
additionally needs `xlsx.full.min.js` loaded first), reading shared state
through the one deliberate global `window.OptimizerCore` exposes rather than
folding their own code into an already-large `optimizer.js`. This is the
`optimizer-engine.js` allowance (§0 rule 2) generalised to "one extra file
pair per tab, when it earns its keep" rather than one single second file —
**Eq. Age / Substd Prem. is the one tab left to build**; expect it to follow
the same pattern, landing in its own file pair rather than inside
`optimizer.js` itself. **A capability two split-off tabs both need — an
abbreviation map, a cell-formatting helper — moves onto the bridge once the
SECOND tab needs it** (§2d), not duplicated into a second copy;
`COVERAGE_ABBR`/`COVTYPE_ABBR`/`pendingCell`/`insuredRateCode` are the worked
examples (§2d's own table lists the rest, including the two, `parseDate`-
family and `axisKeyPrefix`, added for a tab that needed them without a
second tab needing them yet — extended pre-emptively only when the requester
themselves said a near-term second consumer was coming, § §2f/§2g's own notes).

**`optimizer.css` and `inforce.css` share every component rule byte-for-byte;
only the palette tokens differ.** They were generated from one source. If you
change a component rule in `optimizer.css`, make the identical change in
`inforce.css` — visual consistency across the two tools depends on it. Adding
a *new* rule for an Optimizer-only component is fine; changing a shared one is
not. None of `optimizer_coverages.css`/`optimizer_insureds.css`/
`optimizer_rates.css`/`optimizer_backdate.css`/`optimizer_history.css` has an
Inforce equivalent and this rule doesn't apply to any of them — each is free
to define whatever it needs, as long as it only ever reuses tokens/classes
`optimizer.css` already defines rather than duplicating or restyling them
(§2d).

### Running it

Opening `optimizer.html` directly from disk works — `optimizer.js` is a classic
script, not a module — and this must keep working (§0 rule 1); the one thing
that doesn't work this way is Rates' *optional* "Load from `rates/`" button
(§2f), which needs an http(s) server because `fetch()` of a local file is
blocked on `file://`. For development, prefer a local server so the browser
does not serve stale files, and so that button works too. Either double-click
**`start-server.bat`** (finds `python`/`py` on PATH, starts the server in its
own window, opens `optimizer.html` in the default browser automatically,
closing that window stops the server) or run the same command it wraps by hand:

```bash
python -m http.server 8000
```

> **Caching gotcha.** `python -m http.server` sends no cache headers, and
> browsers will happily hold on to an old `optimizer.js` after you edit it. If
> a change appears not to take effect, hard-reload or restart the server on a
> different port before you start debugging your own code.

---

## 2. What exists today

Everything on the page is generated from two small tables in `optimizer.js`.

### The tool switcher

The header block is a dropdown listing both tools. Picking the Inforce Tool
**navigates** to `inforce.html`; picking the current tool just closes the
menu.

The table is duplicated verbatim in both scripts so the menus agree. **If you
edit it here, edit it in `inforce.js` too.**

```js
var TOOLS = [
  { id: 'inforce',   href: 'inforce.html',   mark: 'IT', name: 'Inforce Tool',       swatch: '#35663E', note: '...' },
  { id: 'optimizer', href: 'optimizer.html', mark: 'CO', name: 'Coverage Optimizer', swatch: '#345165', note: '...' }
];
var THIS_TOOL = 'optimizer';
```

Each menu badge wears its own tool's `swatch` colour (inline style), not this
page's palette, so the operator sees what they are switching into.

### Theme

Light is the default. The choice is persisted in `localStorage` under the key
`life-tool-theme` — the same key `inforce.js` uses, so it follows the operator
between pages. All storage access is wrapped in `try/catch`; the tool runs
without it. **The OS `prefers-color-scheme` is deliberately not consulted** —
two people looking at the same case on different machines must see identical
colours.

### Tabs and panes

```js
var TABS = [
  { id: 'optInput',     label: 'Input & Results' },
  { id: 'optCoverages', label: 'Coverages' },
  { id: 'optInsureds',  label: 'Insureds' },
  { id: 'optRates',     label: 'Rates' },
  { id: 'optBackdate',  label: 'Backdate' },
  { id: 'optEqAge',     label: 'Eq. Age / Substd Prem.' },
  { id: 'optHistory',   label: 'History' }
];
```

- `renderTabs()` generates one `<button class="tab">` per entry into `#tabList`.
- `buildPanes()` generates one `<section class="pane" id="<id>">` per entry
  into `#panes`, each holding an empty banded container (`slot(title)`) by
  default.
- An entry with `split: [leftTitle, rightTitle]` gets the 2/3 + 1/3
  two-container layout instead — **no current tab actually uses this generic
  form any more**: `optInput` is fully special-cased (below); `optCoverages`/
  `optInsureds`/`optRates`/`optBackdate`/`optHistory` are each special-cased
  too, to a single empty host div (`coveragesTabHost` / `insuredsTabHost` /
  `ratesTabHost` / `backdateTabHost` / `historyTabHost`) that tab's own
  `init…Tab()` fills — same idiom as `optInput`'s own hosts, just one host
  per pane instead of four. `split` is still there for the one tab left to
  build, `optEqAge`, if its shape turns out to fit it.
- `showTab(id)` sets `aria-selected` on the buttons, un-hides exactly one pane,
  and writes the tab label into `#stTab` in the status bar.
- The first tab is shown on load. **Panes are not gated on anything** — there
  is no extract import on this page; Rates' own rate-file import (§2f) is
  local to that one tab and never blocks any other pane from showing.

`optInput` is a special case in `buildPanes()`: **Settings stands alone,
full width, above one `.split`** whose `.split-main` holds Insured Input
stacked directly above Coverage Input (both 2/3 width), and whose
`.split-side` holds Results (1/3 width, sticky):

```
┌─────────────────────────────────────────────────────────────────┐
│ Settings (resultsBar, full width — 7 fields)                    │
├───────────────────────────────────────┬─────────────────────────┤
│ Insured Input (2/3)                   │                         │
├───────────────────────────────────────┤ Results (1/3, sticky)   │
│ Coverage Input (2/3)                  │                         │
└───────────────────────────────────────┴─────────────────────────┘
```

This is ONE `.split` (§4), not two side by side — Insured Input and Coverage
Input are just two stacked `<div>`s inside the same `.split-main`, so they
both land at exactly 2/3 width with no bespoke alignment work, and Results
(the `.split-side`) stays sticky beside the full height of both of them, not
just one. Settings sits outside the `.split` entirely, as a bare
`.resultbar` with no width constraint of its own — it fills whatever the
pane gives it, which is why widening it to "full width" needed no new CSS:
removing the `.split-side` it used to sit in was enough.

Coverage Input, Insured Input, Settings and Results are all **live** (§
below), not placeholder slots — each gets an empty host (`id=
"coverageInputHost"` / `id="insuredInputHost"` / `id="settingsPanelHost"` /
`id="resultsHost"`) that its own `init…()` fills once panes exist. Init order
matters here beyond the usual: `initResultsPanel()` runs before
`initCoverageInput()`, which itself runs before `initInsuredInput()`. Results'
per-coverage table (§ below) is rebuilt from inside `renderCoverageList()`
itself, and `renderCoverageList()` is rebuilt from inside `renderInsuredList()`
— so each host needs to already exist by the time the render call chain
that refreshes it first fires, or its own guard just no-ops (harmless, but
means that container's first paint would be briefly stale/empty otherwise).

### Insured Input (live — not a placeholder)

The top of `optInput`'s main column is a working add/remove/edit list, built
to the same interaction rules as the Inforce Tool's insured handling
same interaction rules as the Inforce Tool's insured handling
(`INFORCE_REFERENCE.md` §6): one banded sub-container per insured, a Remove
button per sub-container, an Add button below all of them. It starts with
exactly one insured and has no upper limit.

Unlike Inforce, **there is no extract on this page**, so every insured here is
"new" from the moment it exists — there is no baseline to soft-withdraw
against. Remove is therefore always a **hard delete** (Inforce's `dropins`
case), never the soft withdraw-with-Restore Inforce uses for an imported life.

Five fields per insured, all in `INSURED_FIELDS` (this file's own array —
**not** `inforce.js`'s array of the same name; the two are separate, scoped to
their own page) plus two read-only derived cells:

| Field | Key | Type | Constraint | Default |
|---|---|---|---|---|
| Name | `name` | text | ≤ 30 characters, any content | `Insured-1`, `Insured-2`, … — lowest number not currently in use, scanned fresh on every Add (so renaming or removing frees its number) |
| Sex | `sex` | enum | `M` / `F` | `M` |
| Rate | `rate` | enum | `pref` ("Preferred / Non-smoker") / `reg` ("Regular / Smoker") — internal codes, not shown | `pref` |
| Birthdate | `birthdate` | date | `DD-MMM-YYYY`; also accepts `YYYY-MM-DD`, `YYYYMMDD`, `YYYY/MM/DD` (ported `parseDate`, `INFORCE_REFERENCE.md` §8) | blank |
| Age Calculation | `ageCalc` | enum | `nearest` ("Age Nearest") / `last` ("Last Birthday") | `nearest` |
| *Age Real* | — | derived, read-only | age last birthday | `agesAt(...).real` |
| *Age Calculated* | — | derived, read-only | `agesAt(...).nearest` when Age Calculation is `nearest`, otherwise the same value as Age Real | `agesAt(...).real` or `.nearest` |

**The Age Calculated cell's own label tracks the Age Calculation dropdown** —
`AGE_CALC_LABELS = { nearest: 'Age Nearest', last: 'Age Last' }`, looked up by
`rec.ageCalc` each render. Note the wording is deliberately **not** identical
to the dropdown's own option text: the dropdown's `last` option reads "Last
Birthday", but the label above the resulting figure reads "Age Last" — two
different strings for two different UI roles, both specified exactly.

**Reference date: an operator-editable setting, not always literally
today.** Every insured's ages are measured against `settings.refDate` (see
"Settings panel", below) — a single page-level value, not per-insured. It
initialises to today (`todayStr()`) but the operator can change it, and doing
so recomputes every insured's Age Real and Age Calculated immediately
(`deferRenderInsureds()` on commit). Recomputed on every render, not cached.
Changing the reference date does **not** retroactively re-validate birthdates
already entered — if a later reference date pushes an existing insured's age
past 120, the figure is simply displayed as computed; nothing rejects it after
the fact. Only entering a *new* birthdate re-checks the range, against
whatever `settings.refDate` holds at that moment.

**Birthdate validation enforces the stated 0–120 age range up front**: a date
that would put either Age Real or Age Calculated outside 0–120 (checked
against the *current* reference date) is rejected at commit, with the
previous valid value left in place — it never reaches a derived row as an
out-of-range figure.

**The age algorithm is a specific, exact stepwise procedure, not the "actual
midpoint" heuristic an earlier draft used.** `agesAt(birth, asOf)` must
produce identical results to another platform doing the same 30-day-month
age-nearest-birthday convention, so approximating it is not acceptable here —
this is the one piece of business logic on this page precise enough to be
worth writing out in full:

```
1. age    = asOf.year  - birth.year
2. months = asOf.month - birth.month
   if months < 0:  months += 12;  age -= 1
3. days   = asOf.day   - birth.day
   if days < 0:    days += 30;    months -= 1
   [ age here == Age Real / "age last birthday" ]
4. nearest = age
   if months > 6:                        nearest = age + 1
   else if months == 6 and days > 0:     nearest = age + 1
   else if months == 6 and days == 0:    nearest = age
   else if months < 6:                   nearest = age
```

Step 3's day borrow uses a flat **30**, not the calendar month's real length —
this is a 30/360-style day count, a known actuarial convention, and departing
from it (e.g. "fixing" it to use real month lengths) would silently break
agreement with the other platform this tool validates against. `real` is the
`age` value produced after step 3, before any of step 4's rounding; `nearest`
is step 4's result. Verified against hand-traced cases (22-JUL-1974 vs
01-JAN-2026 → 51/51; 15-MAR-1990 vs 01-JAN-2026 → 35/36) before being
committed — reproduce those two before trusting any change to this function.

The two derived cells are **not** rendered through the field-control system at
all (no `.fi--ro`, no `data-fk`) — they're plain text, the `.rs-k`/`.rs-v`
label-over-value pair the Results strip (§2 "The Results strip", §4) already
uses for a calculated figure. There is nothing to lock or unlock; they are
never a field the operator could enter in the first place.

**Layout: one row of all 7, not two stacked rows.** Was Name/Sex/Rate then
Birthdate/Age Calculation/Age Real/Age Calculated on separate rows; a later
request moved Insured Input to 2/3 width specifically to fit all 7 on one
line instead (`.fc-row.fc-row--7`), in this order: **Name | Sex | Rate |
Birthdate | Age Calculation | Age Real | Age Calculated.** Every cell —
editable or derived — is a `.fc`: a micro label (`.rs-k`) over its control or
value. This is deliberately **not** the Inforce policy-sidebar `.kv` row
(label-left, value-right, one field per row); a `.kv` list of seven rows was
tried first and was too tall for what the fields need.

```css
.insured-fields .fc-row--7 { grid-template-columns: 2fr 0.5fr 1.4fr 0.95fr 1.05fr 0.55fr 0.65fr; }
```

Name gets by far the largest share — it's the only field here that can run
to this page's 30-character maximum — followed by Rate ("Preferred /
Non-smoker") and Age Calculation ("Last Birthday"), both `<select>`s which,
unlike a text input, show no ellipsis when their closed value is wider than
the box and so clip outright rather than degrading gracefully. Sex and the
two derived age cells are never more than a couple of characters. **Verified
against the longest realistic value in every cell at once** — a 29-character
Name, "Preferred / Non-smoker", "Last Birthday", a real birthdate — at
1250px, the narrowest width before the split stacks; margins there run
roughly 11-33px, tightest on Rate. If you ever change these fields' content
(a longer option label, a renamed field), **re-run that same check — don't
just eyeball it.**

`.fc-row`/`.fc` themselves are unscoped and generic — the "micro label over a
control or value" cell shape, plus the row-of-cells grid that holds them, used
by any dense field grid on the page (Coverage Input, § below, is the other
one). Only the *column weights* here are specific to this one grid — pinned
under `.insured-fields .fc-row--7` — and only make sense at this fixed
7-cell shape; they are not a generic reusable grid the way `.fgrid` is.

Key functions (all in `optimizer.js`, alongside the tab/switcher code):

| Function | Purpose |
|---|---|
| `INSURED_FIELDS`, `INS_FIELD_MAP` | the five-field descriptor table and its key lookup |
| `AGE_CALC_LABELS` | `{ nearest: 'Age Nearest', last: 'Age Last' }` — the Age Calculated cell's dynamic label |
| `validateIns(f, raw)` | coerce + validate one field; the 0–120 age check lives in the `'date'` branch |
| `insControl(f, v, fk)` | build the `<input>`/`<select>` for one field |
| `resolveIns(fk)` | `data-fk` (`ins\|<id>\|<field>`) → `{ f, rec }` |
| `newInsuredRecord()`, `nextInsuredName()` | a fresh record with its default name |
| `insFieldCell(f, rec)` | one editable cell: `.rs-k` label over the field's control |
| `insValueCell(label, v)` | one read-only cell: `.rs-k` label over a plain `.rs-v` value (or `—`) |
| `insuredCard(rec, idx)` | one sub-container: banded head (badge + live name + Remove), then `.insured-fields` holding one `.fc-row.fc-row--7` — all 7 fields in order |
| `insuredInputShell()` | the outer card: band header, `#insuredList` host, `#btnAddInsured` footer |
| `renderInsuredList()`, `deferRenderInsureds()` | the focus-safe re-render pair — see §7 |
| `insCommit(e)`, `insLive(e)` | `change` (validate + write) and `input` (live `.fi--bad` toggle only) handlers |
| `initInsuredInput()` | one-time: seed the single starting insured, render the shell, wire the three listeners below |

The last remaining insured's Remove button is `disabled` (title: "At least one
insured is required") — the same floor Inforce enforces on a coverage's last
life. Nothing enforces an upper limit.

## 2a. Settings panel (live)

Top of `optInput`, full width, standalone above the Insured Input/Coverage
Input/Results split (`#settingsPanelHost`, filled by `initSettingsPanel()`).
Built from the exact same markup/classes as a Results-style figures bar —
`.resultbar`/`.resultbar-tag`/`.rs`/`.rs-k` — rather than its own card: a
left-edge all-caps "SETTINGS" tag, then one `.rs` cell per field with an
all-caps micro-label on top and the live control below it, laid out
horizontally. It used to sit beside a Results strip at 1/3 width and had to
match that strip's height exactly; Results has since moved into its own
richer container (§ below), so Settings now simply fills the full pane width
with no companion to match. Seven page-level fields, none per-insured, left
to right in the bar:

| Field | Key | Type | Constraint | Default |
|---|---|---|---|---|
| Reference Date | `refDate` | date | same 4 formats as Birthdate, normalises to `DD-MMM-YYYY` | `todayStr()` |
| Payment Frequency | `freq` | enum | `monthly` ("Monthly") / `annually` ("Annually") | `monthly` — **not specified; "Monthly" chosen as the common case** |
| Multi-Coverage Discount | `mcd` | boolean | ON / OFF, via a button-style switch, not a `<select>` | `false` — **not specified by the request; off until the operator opts in was the conservative reading** |
| Prem. Adj. % | `premAdjPct` | pct | 0–1,000,000%, no decimal-place cap | `100` — a multiplicative factor, so 100% ("unchanged") is the stated neutral default |
| Prem. Adj. % Dur. | `premAdjPctDur` | int | 1–999 is the stated range, but see below | `0` |
| Prem. Adj. $ | `premAdjAmt` | money | $0–999,999,999.99, 2dp | `0` — an additive adjustment, so 0 ("none") is the stated neutral default |
| Prem. Adj. $ Dur. | `premAdjAmtDur` | int | 1–999 is the stated range, but see below | `0` |

**The two "\* Dur." fields' own default (0) sits outside their own stated
range (1-999).** None of the 7 Settings fields are optional — every one
always holds a number, unlike Coverage Input's own optional numeric fields
— so a default that failed the field's own `min` would make the field
invalid the instant the page loads. `min` is relaxed to `0` for these two
specifically (`SETTINGS_FIELDS`, `optimizer.js`) to resolve that: `0` reads
as "no duration set", `1`-`999` as a real one. The same reconciliation
applies to Coverage Input's own `extraTempYears` field once its default
also became `0` (§2b) — it isn't unique to Settings.

`refDate` is the only one of the seven with any downstream effect today: it
is what `agesAt()` measures every insured's ages against (§2 "Insured Input").
The other six are stored and displayed but nothing reads them yet.

```js
var settings = {
  refDate: todayStr(), mcd: false, freq: 'monthly',
  premAdjPct: 100, premAdjPctDur: 0, premAdjAmt: 0, premAdjAmtDur: 0
};
```

Key functions:

| Function | Purpose |
|---|---|
| `SETTINGS_FIELDS`, `SETTINGS_FIELD_MAP` | descriptor table for all 6 non-boolean fields (`mcd` is not in it, see below) |
| `validateSettings(f, raw)` | date/enum/money/int/pct — generalised (mirrors `validateCov`'s numeric branch, §2b) once the 4 Prem. Adj. fields arrived; date and enum were the only two types here before that. No field is `opt` — see above |
| `settingsControl(f)` | builds the `<input>`/`<select>`, `data-fk="set|<fieldKey>"`; numeric types reuse `covRaw` directly for thousands-separated display rather than a second copy of the same formatting rule |
| `switchControl()` | the Multi-Coverage Discount toggle — a `<button role="switch">` whose own text *is* its state ("ON"/"OFF"), not a field-descriptor control; wired by `data-act="toggle-mcd"`, not `data-fk` |
| `settingsCell(f)`, `settingsPanelShell()` | one `.rs` cell, and the whole bar in the specified order: reuses `.resultbar`/`.resultbar-tag`/`.rs`/`.rs-k` verbatim from a Results-style bar — left-edge "SETTINGS" tag, then one `.rs` cell per field, label on top / control below, laid out horizontally |
| `settingsCommit(e)`, `settingsLive(e)` | `change` (validate + write) / `input` (live `.fi--bad`) handlers, scoped to `#settingsPanelHost` |
| `initSettingsPanel()` | one-time: render the shell, wire `change`/`input`/`click` on the host |

**`settingsCommit` explicitly echoes the canonical value back to the input**
— a real bug, caught during development: unlike `insCommit`, whose value
re-echoes for free because `deferRenderInsureds()` regenerates the whole card
(including the field just edited), each Settings field is standalone with
nothing else re-rendering it. Without the explicit echo, `settings.refDate`
held the correct canonical value internally (confirmed by correct downstream
age math) while the input kept displaying whatever the operator had typed,
e.g. `"2026-01-01"` instead of `"01-JAN-2026"`. **Any future standalone
(non-repeating-list) field needs this same explicit echo — it is not
automatic outside a list re-render.** The echo itself has to branch on type
now: `el.value = res.v` was correct when every field was date-or-enum (both
already display-ready strings), but a numeric field's `res.v` is a raw
number (e.g. `1234.5`) — echoing it directly would show `"1234.5"`, not the
grouped `"1,234.50"` every other numeric field on the page displays. The
fix: `(f.t === 'date' || f.t === 'enum') ? res.v : covRaw(f, res.v)`.

The switch has no sliding-thumb animation — the design system rules that out
("no overly fancy animations", §0) — and a button stating its own state as
text ("ON"/"OFF") is both simpler to implement correctly and more explicit
than a bare colour change in a dense financial-tool UI.

### What is *not* here

- No `state` object, no dataset, no import, no `parseWorkbook`.
- No field descriptors or validation for the five still-placeholder tabs —
  Coverages, Insureds, Rates, Backdate, Eq. Age / Substd Prem. (Coverage
  Input, Insured Input, Settings and Results, all four on `optInput`, are
  live — see above and § below.)
- No calculation of any kind — `mcd`, `freq`, the 4 Prem. Adj. fields,
  Coverage Fee, and the Input figure are all captured but unused; every cell
  in Results (§ below) is still the same "—, not calculated yet" placeholder
  it always was. Nothing on the page reads any of them yet.

Everything else exists in `inforce.js` and is documented in
`INFORCE_REFERENCE.md`. See §8 for what to port and how.

---

## 2b. Coverage Input (live)

Left side of `optInput`'s second `.split`, 2/3 width (`#coverageInputHost`).
Same repeatable-record shell as Insured Input, one level deeper: each
coverage is a record like an insured, and each coverage in turn holds its own
repeating list of insured **slots** — who is on this coverage, at what rate,
with what extra premium. Starts with one coverage, no upper limit, same
"last one can't be removed" floor as Insured Input.

### Coverage-level fields (one row of 6)

| Field | Key | Type | Options / range | Default |
|---|---|---|---|---|
| Coverage Category | `category` | enum | Term Life, Permanent Life, Term Critical Illness, Permanent Critical Illness, Critical Illness for Business Owners | Term Life |
| Coverage | `coverage` | enum, depends on Category | see `COVERAGE_OPTIONS` | first option in the category |
| Coverage Type | `covType` | enum, depends on Category (+ Coverage for Term Life) | see `covTypeOptions()`; **empty for any Critical Illness category** — not specified yet | first valid option, or blank |
| Coverage Fee | `fee` | money, optional | $0–999,999,999.99, 2dp — **range not specified by the request; assumed for consistency with the page's other money fields** | auto (see below), blank for CI |
| Calculation Type | `calcType` | enum | Input Premium / Coverage Amount | Input Premium |
| Input | `amount` | money, optional | $0.00–999,999,999.99, 2dp — the range is exactly as specified, but the field itself was originally labelled "Input Premium/Insurance Amount"; shortened to "Input" (no unit shown either) once the row below was compacted onto one line and had no room left for the full name | blank |

One row of 6, not the two rows of 3 this was originally built as — a later
request explicitly asked for all six on one line. The longest option text
here (a Critical Illness product name, or "Joint Last-to-Die, Paid-up 1st
Death") still can't ellipsis inside a `<select>` the way an overflowing text
input can, so fitting six of these on one line took more than just picking
column weights: `.cov-row-all` also carries its own tighter cell padding and
a smaller (9.5px, down from the page's usual 11.5px) control font, scoped to
this one row only. **Verified against every category/coverage/covType
combination's actual longest string, including the two money fields' own
worst case (`999,999,999.99`), at 1250px — the narrowest width the split
doesn't stack at.** It fits, but by design margin as thin as ~1px on the
tightest cell (Coverage Category, when set to the longest Critical Illness
label); this is a real, measured trade-off of the compaction request, not
slack left on the table — don't shrink this row further, or add a 7th field
to it, without re-running that same measurement.

**Coverage Type left blank for Critical Illness** renders as the same inert
placeholder box `control()`'s locked path gives an Inforce field — an
`.fi--ro` input, `readonly`, `tabindex="-1"`, `placeholder="—"` — never an
empty, clickable `<select>`. `covControl()`'s enum branch takes this path
whenever a field's option list (`f.opts` or `f.optsFn(rec)`) is empty; it's
the general mechanism, not a Coverage-Type-specific special case, and the
same path is what the Rate cell (below) falls back to before an insured is
chosen.

**Coverage Fee — the auto-default is dynamic, but a manual edit sticks.**

- Term Life: whichever Term Life coverage currently in the list has the
  highest duration — first match, in order, against
  `TERM_LIFE_DURATION_PRIORITY = ['Term to 65', 'Term 30', 'Term 25',
  'Term 20', 'Term 15', 'Term 10']` — gets **$40**; every other Term Life
  coverage gets **$20**. **Two Term Life coverages tied on the same duration
  (two "Term to 65" rows, say): whichever was added first keeps the $40 —
  not specified by the request, and not distinguishable any other way** since
  nothing else ranks them.
- Permanent Life: always **$40**, unconditionally, regardless of which
  Coverage is selected.
- Critical Illness: no default at all — left blank, "to be implemented
  later" per the request. The box is still a live, ordinary, editable input
  (unlike Coverage Type above) — nothing stops the operator typing a figure
  in by hand even though no auto-calc exists yet for this category.
- `recalcFees()` recomputes ALL Term Life and Permanent Life fees from
  scratch on **every** render (cheap and idempotent — it only ever touches
  the two categories above, and only the records among them that aren't
  `feeManual`), so adding, removing, or changing any coverage keeps every
  other coverage's fee correct without hunting for exactly which records are
  affected.
- **A directly-edited Coverage Fee opts that one record out of the
  auto-default** (`feeManual = true`) until the box is cleared back to blank,
  at which point `feeManual` resets to `false` and `recalcFees()` fills the
  default back in on the next render. This wasn't specified either way; a
  spreadsheet-style "type over the formula, clear it to restore the formula"
  model was picked as the least surprising one available, and it reuses the
  same optional-field validation every other blank-allowed field already has
  — no separate "reset to auto" control was added.
- Category or Coverage changing on a record resets that record's `feeManual`
  to `false` and its `fee` to `null` first (the *duration*, or the category's
  fee rule, just changed, so the previous figure — manual or not — may no
  longer mean anything); `recalcFees()` then fills in whatever the new
  category/coverage combination implies.

### The insured(s) on this coverage (nested subcontainer, row 2 of the card)

Same Add/Remove logic as Insured Input, one level in: each slot is its own
bordered box (`.cov-ins-slot`) inside the coverage card's `.cov-insured-wrap`,
with a `+ Add Insured` footer and a per-slot Remove button. A coverage always
keeps at least one slot (Remove disabled at the floor, same as everywhere
else on this page).

**The subcontainer carries a blue tint** (`--accent-soft` background,
`--accent-line` border on the wrap and on every slot inside it) instead of
staying a plain extension of the coverage card's own surface — it was
reported hard to tell apart from the rest of the card otherwise. This is
deliberately the ACCENT (blue) pair, not a third band colour: the coverage
card already has an outer border and a banded head, and a third distinct
colour on top of those would read as a third level of the SAME hierarchy
rather than a tint distinguishing one zone within it.

| Field | Key | Notes |
|---|---|---|
| Insured | `insuredId` | `<select>` of every Insured Input record, **minus whichever this SAME coverage's other slots already hold** (an insured can't be on one coverage twice) — the same insured CAN appear on multiple *different* coverages, nothing here restricts that. A blank `"— Select —"` first option lets the slot be cleared without being removed. |
| Sex | — | read-only, the referenced insured's own Sex. `—` if no insured chosen. |
| Age | — | read-only, `agesAt(insured.birthdate, settings.refDate)` — Age Real or Age Calculated, whichever that insured's OWN Age Calculation setting picks (§2), same rule Insured Input itself uses. `—` if no insured chosen or its birthdate is blank. |
| Rate | `rate` | `<select>`, options from `rateOptionsFor(category, insured.rate)` — see below. The same empty-options → inert-placeholder-box path as Coverage Type when no insured is chosen yet. |
| Permanent % | `extraPct` | 0–1,000,000%, no decimal-place cap (matches Inforce's own `permanentExtraPremiumPct` field) — default `0` |
| Permanent $ | `extraFlat` | $0–999,999,999.99, 2dp — default `0` |
| Temporary $/1000 | `extraTempAmt` | $0–999,999,999.99, 2dp — default `0` |
| Years | `extraTempYears` | 1–999 is the stated range, but the stated default is `0` — `min` relaxed to `0` for the same reason as Settings' two `*Dur.` fields (§2a): 0 reads as "no duration set" |

**None of the four are `opt` any more.** They used to default to blank
(`opt: 1`, blank stayed valid); a later request gave all four a real `0`
default instead, so a blank commit is now rejected the same way any other
required field's is — typing `0` is how the operator clears one back to its
neutral default, not deleting the text to blank.

**All 8 columns — Insured, Sex, Age, Rate, and the four Extra Premium
sub-fields — sit on one line per slot.** The last four used to be a separate
row in a bordered box below Insured/Sex/Age/Rate; a later compaction request
pulled them onto the same line instead, nested inside one final cell
(`.cov-extra-cell`) rather than dropped as their own row. Each of the four
becomes a label-over-input pair of its own inside that cell
(`.cov-extra-mini`/`.cov-extra-f`/`.cov-extra-f-k`, built by
`covInsExtraMiniField`) — there wasn't room left for their full names once
they moved onto the shared line, so the visible label shortens to **Perm %**,
**Perm $**, **Term $**, **Term $ Dur.** respectively; each sub-field's
`title` attribute still carries its full name (e.g. "Permanent %") for
hover. The cell's own heading, "Extra Premium" (`.cov-extra-cell > .rs-k`),
is centred — every other `.fc` label on the page is left-aligned, but this
one cell has 4 sub-fields under it rather than 1, and a left-aligned label
read as belonging to just the first of them.

**Permanent $ and Temporary $ (either its amount or its duration) are
mutually exclusive — an insured is either getting a flat permanent extra or
a temporary per-mille one, never both.** Whichever side gets an entry first
locks the other: filling Permanent $ disables Term $ *and* Term $ Dur.;
filling either Term $ or Term $ Dur. disables Permanent $. A disabled field
renders exactly like any other "not editable right now" box on this page —
`.fi--ro`, `readonly`, `tabindex="-1"`, no `data-fk` (§7's rule: a locked
field keeps its box, but Tab skips it and nothing inert can be committed) —
it isn't a separate mechanism, just reached a different way (a sibling
field's value, rather than a Category whose Coverage Type isn't implemented
yet). Setting the field that's holding the lock back to its default (`0`)
releases it: `covExtraCell()` recomputes which side (if either) is filled on
every render, so there's no separate "unlock" action to remember. **Permanent
% is independent of this pair and never locks** — nothing in the request
tied it to either side.

**"Filled" means non-zero, not merely non-blank.** `isFilledCov(v)` treats
`0` the same as blank — it has to, now that Permanent $ and both Temporary $
fields all default to `0` (above): if `0` counted as "filled", a brand-new
slot would have BOTH sides of the pair "filled" simultaneously the instant it
existed, locking each other forever with no way to ever enter either one.
Checking non-zero rather than non-blank is what keeps a freshly-created
slot's Extra Premium fields all open.

**Rate options** come from TWO things at once — the coverage's own Category,
and the referenced insured's own Rate field back in Insured Input (`pref` /
`reg`) — never anything stored on the slot itself:

| Category | Insured Input Rate = Preferred | Insured Input Rate = Regular |
|---|---|---|
| Term Life | P1, P2, P3 | R1, R2 |
| any other category | P | R |

Changing which insured a slot points at clears that slot's `rate` (the old
code may not even exist in the new insured's option set); changing a
coverage's Category clears **every** slot's `rate` on that coverage (Rate's
whole option set depends on Category).

**The Rate dropdown carries a blank `"— Select —"` first option, and that is
load-bearing** — the same device the Insured dropdown above uses, for the
same reason. Two real bugs lived here before it existed, both variants of
one failure: *a `slot.rate` that matches none of the rendered options makes
the browser display the first option anyway, while the record holds
something else.*

1. **A blank rate displayed as "P1".** A fresh slot's `rate` is `''`, so no
   `<option>` carried `selected` and the browser fell back to showing P1.
   Worse, picking the P1 already on display fires **no `change` event** (the
   value never changed, as far as the browser is concerned), so that rate
   could never commit — only P2/P3 ever did. The operator saw "P1" on every
   slot, and only the ones they'd actively changed were really set. With a
   blank option present, blank stays visibly blank and every real code is an
   actual change that commits.
2. **A stale rate survived an insured's own Rate flipping.** The option set
   depends on the referenced insured's `pref`/`reg`, but that field is
   edited in *Insured Input*, which `covCommit` never sees — so a slot kept
   e.g. `P1` for an insured who had become a smoker, a rate class not even
   offered any more. `syncCoverageInsuredRefs()` now also drops any rate
   that is no longer one of its slot's valid options (below).

**Do not "simplify" the blank option away by defaulting `slot.rate` to the
first option instead.** P1 is the best rate class, not a neutral one;
silently assigning it is precisely the invented value §0 rule 6 forbids, and
in a tool whose whole job is reconciling figures against another platform an
assumed rate class would produce a wrong premium that looks right, with no
visual cue that anything was assumed.

**Coverage Type governs how many insured slots a coverage allows** —
`maxInsuredsFor(covType)`:

| Coverage Type | Cap | Category it can appear on |
|---|---|---|
| `Individual` | **1** | any |
| `Joint First-to-Die` | **5** | Term Life or Permanent Life — same cap either way |
| `Joint Last-to-Die` | **2** | Permanent Life only |
| `Joint Last-to-Die, Paid-up 1st Death` | **2** | Permanent Life only |
| *(unset)* | **1** | Critical Illness (any of the three) |

`Individual` renders as a plain `<select>`, not literally capped-at-1-but-
still-a-list — the Add button just disables once the single slot exists.
**An unset Coverage Type — today, only the Critical Illness categories, whose
real Coverage Type logic doesn't exist yet — is treated as Individual (cap of
1).** Not specified by the request; the conservative single-insured default
until CI's own Coverage Type rules are written, rather than guessing at a
number. The two Joint Last-to-Die variants share a cap of 2 rather than 5 —
"last to die" is only a meaningful benefit between two lives, per the
request.

If a Coverage Type change (direct, or as a side effect of Category/Coverage
resetting it) lowers the cap below the coverage's current slot count,
`enforceInsuredCap()` truncates to the new cap (keeping the first N slots) and
toasts that this happened, rather than leaving an over-the-cap coverage in
place silently.

**`syncCoverageInsuredRefs()` keeps every slot consistent with the insureds
it points at**, on every insured-list change, right alongside the
Sex/Age/Insured-option refresh every insured edit already needs (see "One
`insureds` array feeds two containers", below). Two rules:

1. **Removing an insured in Insured Input clears any coverage slot that
   referenced it** — `insuredId` and its now-meaningless `rate` both reset
   to blank, rather than leaving a dangling reference.
2. **A slot's `rate` must always be one of ITS OWN currently-valid options,
   or blank** — anything else is dropped. This is the rule that catches the
   path `covCommit` structurally cannot: an insured's `pref`/`reg` flipping
   in *Insured Input* changes the option set for every slot referencing that
   insured, on every coverage, and none of those edits pass through Coverage
   Input's own commit handler. Stated as an invariant rather than a list of
   triggers on purpose — any future upstream change that can invalidate a
   rate is covered by it automatically.

### One `insureds` array feeds two containers

Coverage Input's Insured dropdown, Sex/Age cells, and Rate options all derive
live from Insured Input's own `insureds` array — nothing about an insured is
duplicated into a coverage record except the chosen `_id`. Concretely,
`renderInsuredList()` (§2) calls `syncCoverageInsuredRefs()` then
`renderCoverageList()` at the end of **every** run, regardless of what
triggered it — an edit, an Add, a Remove, or `settings.refDate` changing —
so Coverage Input is never looking at stale insured data. This is also why
`initCoverageInput()` runs before `initInsuredInput()` in the init sequence
(§2's diagram, above): the host and `coverages` array need to exist before
that first call lands.

### Coverage naming and numbering

There's no Name field on a coverage — the header badge (`.coverage-no`, same
treatment as `.insured-no`) is just the list position, and the title next to
it is generated (`coverageTitle()`): `"<Category label> — <Coverage
label>"`, e.g. "Term Life — Term 20". It updates live as either dropdown
changes, the same way Insured Input's card title tracks the Name field.

Key functions (all in `optimizer.js`, after the Settings section):

| Function | Purpose |
|---|---|
| `COVERAGE_CATEGORIES`, `COVERAGE_OPTIONS`, `TERM_LIFE_DURATION_PRIORITY` | the fixed option lists and the fee priority order, straight from the request |
| `covTypeOptions(category, coverage)`, `maxInsuredsFor(covType)`, `rateOptionsFor(category, insuredRate)` | the three cascades — Coverage Type, insured-slot cap, Rate — as pure functions of their inputs |
| `COV_FIELDS`/`COV_FIELD_MAP`, `COVINS_FIELDS`/`COVINS_FIELD_MAP` | coverage-level and insured-slot field descriptors; `coverage`/`covType` use `optsFn(rec)` instead of a fixed `opts` array since their options depend on the record |
| `validateCov(f, raw, rec)`, `covControl(f, v, fk, rec)`, `covRaw(f, v)` | the generic validate/build/format trio, same shape as Insured Input's but option-list-aware |
| `insRefControl`/`insuredRefOptions`, `covRateControl`/`covRateOptions` | the two bespoke controls `covControl` doesn't handle — their option lists depend on sibling slots or the referenced insured, not the record alone |
| `covExtraCell(rec, slot)`, `covInsExtraMiniField(f, rec, slot, shortLabel, locked)`, `isFilledCov(v)` | the Extra Premium cell and its 4 sub-fields — all 4 sit inside ONE `.fc` cell on the insured slot's single row, each with a short visible label (Perm %/Perm $/Term $/Term $ Dur.) and the full field name in `title`; `covExtraCell` also computes and applies the Permanent $ / Temporary $ mutual-exclusion lock (`locked` renders the `.fi--ro` inert box instead of the normal control) |
| `recalcFees()` | the Coverage Fee auto-default, run at the top of every `renderCoverageList()` |
| `enforceInsuredCap(rec)`, `syncCoverageInsuredRefs()` | the two "keep the model consistent after something outside this field changed" cleanups |
| `newCoverageRecord()`, `newCovInsuredSlot()` | fresh records with their defaults |
| `resolveCov(fk)` | `data-fk` → `{ kind, rec, slot, key, f }` — one resolver for both `cov\|<id>\|<field>` and `covins\|<covId>~<slotId>\|<field>` grammars |
| `coverageCard(rec, idx)`, `covInsuredSlot(rec, slot, canRemove)` | the two-level markup builders |
| `renderCoverageList()`, `deferRenderCoverages()` | the focus-safe re-render pair — identical pattern to Insured Input's, see §7. Also calls `renderResultsPanel()` (§2c) on every run, so Results' per-coverage table never lags behind `coverages` |
| `covCommit(e)`, `covLive(e)` | `change`/`input` handlers; `covCommit` also carries every cascade above (category/coverage/covType side effects, the fee-manual toggle, insuredId/rate's bespoke branches) |
| `initCoverageInput()` | one-time: seed the single starting coverage, render the shell, wire the listeners |

---

## 2c. Results (live)

Right side of `optInput`'s one `.split` (§2's diagram), 1/3 width, sticky
(`#resultsHost`, filled by `initResultsPanel()`). Used to be a single
6-figure `.resultbar` strip paired with Settings above the Coverage/Insured
Input row; a later request split those 6 figures across two purpose-built
subcontainers inside one `.card`, and moved Results down to replace Insured
Input's old spot beside the (now-stacked) Insured Input + Coverage Input
column.

**Subcontainer 1 — one row per coverage.** A `<table class="ins">` (the same
figures-table look Inforce's own insured table uses, not a new one), one row
per entry in `coverages`, columns:

| Column | Source |
|---|---|
| Coverage | `coverageTitle(c)` — the same "N. Category — Coverage" string that coverage's own card header shows (§2b); nothing is duplicated, just cross-referenced |
| Prem. Basis Ins. Amt | not calculated — `—` |
| Highest Amt (Min.) | not calculated — `—` |
| Highest Amt (Max.) | not calculated — `—` |
| Modal Prem | not calculated — `—` |
| Modal Prem Backdated | not calculated — `—` |

Rebuilt by `resultsCoverageTable()` every time `renderCoverageList()` runs
(§2b) — add, remove, or edit any coverage and this table is never more than
one render behind it.

**Headers and cells wrap onto multiple lines rather than needing to scroll.**
6 columns of financial figures don't fit a 1/3-width sidebar as single
nowrap lines — `.ins`'s own default, shared with Inforce's insured table —
so this table overrides that, scoped to `.results-cov-wrap` only:
`table-layout: fixed`, Coverage at 30% width and the 5 figure columns
splitting the rest evenly, `white-space: normal` on both header and body
cells. The overriding selectors repeat `.ins` alongside `.results-cov-wrap`
(`.results-cov-wrap .ins thead th`, not just `.results-cov-wrap thead th`)
specifically to out-specify `.ins thead th`/`.ins tbody td` — that pair is a
SHARED rule with `inforce.css` and must keep winning everywhere else `.ins`
appears; this table's own behaviour has to out-rank it by specificity, not
by editing the shared rule or relying on being later in the file (fragile —
this section is physically earlier in `optimizer.css` than `.ins`'s own
definition). **Verified live at 1250px (the narrowest pre-stack width) with
the single longest possible Coverage cell content** (a Critical-Illness
category paired with its longest Coverage name, ~86 characters) — the cell
wraps to several lines rather than forcing the column wider, and
`.results-cov-wrap`'s `scrollWidth` never exceeds its `clientWidth`.
`overflow-x: auto` stays on the wrapper as a safety net, not the mechanism
doing the work — the fixed layout is.

An empty `coverages` array (can't actually happen — Coverage Input enforces
a floor of one, §9 — but handled
defensively) shows a `.proj-slot`-style placeholder instead of a headers-only
table.

**Subcontainer 2 — a 3-figure summary**, in the exact `.resultbar`/`.rs`
shape the original 6-figure strip used — `resultsBar('Summary', [...])`,
the SAME function subcontainer 1 doesn't use, called with a different tag
and a shorter field list rather than a second bespoke builder:

- **Modal Premium** — stated to be the sum of every coverage's own Modal
  Prem once that figure exists; today, `—`, same as every other cell here.
- **Modal Premium Backdated** — sum of every coverage's own Modal Prem
  Backdated; `—` today.
- **Backdate Savings Date** — `—` today.

No summing happens anywhere in the code yet — there is nothing to sum, since
no coverage produces a real Modal Prem figure yet either. This section
describes where that sum will eventually be computed, not a computation that
exists today.

Key functions:

| Function | Purpose |
|---|---|
| `RESULTS_COVERAGE_FIELDS`, `RESULTS_SUMMARY_FIELDS` | the two fixed column/field lists, straight from the request |
| `resultsPanelShell()` | the outer `.card card--out`: banded "Results" head, then the two subcontainer hosts |
| `resultsCoverageTable()` | subcontainer 1 — one `<tr>` per coverage, or the empty-state placeholder |
| `renderResultsPanel()` | rebuilds both subcontainers; no-ops if `#resultsCoverageWrap` doesn't exist yet (init-order guard, same idiom as `renderCoverageList`) |
| `initResultsPanel()` | one-time: render the shell, then the initial render. Runs BEFORE `initCoverageInput()` — see §2's diagram — so the host already exists the first time `renderCoverageList()` tries to refresh it |

Nothing in Results is ever a `data-fk` control — every cell is `—` or a
plain string, since these are all engine outputs the operator never sets by
hand (the same rule the original Results strip always followed). There is
therefore no commit/live handler pair for this container, unlike every other
live region on this page.

---

## 2d. Coverages tab (live) — `optimizer_coverages.css`/`.js`

The `optCoverages` pane, first of what are now five tabs built as their own
file pair rather than folded into `optimizer.js`/`.css` — see §1 for why.
**The template all four later ones (§2e–§2h) followed**, not a one-off; only
History (§2h) departs from it, and only in the one specific way noted below.

### The public bridge

No split-off tab file touches `coverages`/`settings`/`insureds` directly —
each knows nothing about `optimizer.js`'s internals beyond one object,
`window.OptimizerCore` (defined near the end of `optimizer.js`, just before
its `init` section):

| Member | What it is |
|---|---|
| `coverages()`, `insureds()` | return the LIVE arrays (functions, not snapshots — always current); `insureds()` was added when the Insureds tab (§2e) needed it, Coverages never has |
| `settings` | the live `settings` object itself (read its fields directly; never reassign it) |
| `COVERAGE_CATEGORY_MAP` | category key → display label |
| `COVERAGE_ABBR`, `COVTYPE_ABBR` | the two display-abbreviation maps — named vars in `optimizer.js` (not just inline in this object literal, so `axisKeyPrefix()` below can read them too), referenced here so every split-off tab reads the one shared copy |
| `esc`, `group`, `toNum`, `decimals`, `agesAt`, `findInsured` | the same utilities/functions `optimizer.js` itself uses — ported once, reused everywhere, not copied a third time |
| `parseDate`, `fmtDate`, `buildDate` | date parsing/formatting — not on the bridge until Backdate (§2g) became the first split-off tab to do its own date arithmetic (surrounding birthdays, a midpoint date, Illustration Date minus 6 months) |
| `insuredRateCode(ins)` | Preferred/Non-smoker → `N`, Regular/Smoker → `S` — started local to the Insureds tab (§2e), moved here once `axisKeyPrefix` (next) became a second consumer |
| `axisKeyPrefix(coverage, slot)` | the 26-character Axis Key prefix for one (coverage, insured slot) pair — `null` if the category/product/covType combination can't produce one yet (§2e "Axis Key"). Implemented in `optimizer.js`, not a tab file, because it needs `settings.mcd` directly and is already known to have a second consumer coming (Rates, §2f) the moment its own rate-band lookup is wired up |
| `coverageTitle` | the "N. Category — Coverage" string builder (§2b) |
| `pendingCell(extraClass)` | builds one "formula not yet provided" `<td>` (`.cell-pending`, `optimizer.css`) — lives on the bridge, not a tab file, since every split-off tab ends up needing the identical cell |
| `onChange(fn)` | registers `fn` to run after any commit that could change `coverages`, `insureds`, or `settings` |
| `registerSnapshot(key, {get, set})`, `getSnapshot(key)`, `setSnapshot(key, data)` | lets a split-off tab offer its own local state up for Save/Load to include, without `optimizer.js` needing to know that state exists — Rates' own imported-rates cache does NOT use this (§2f explains why: it's not part of a saved test case), Coverages' Unit Value (§ below) is the only user today |
| `snapshotState()` | a deep-cloned, plain-JSON snapshot of Settings/Insureds/Coverages — read-only, like every other accessor above |
| `restoreState(snap)` | **the one deliberate WRITE exception to this otherwise read-only bridge** (below) — only ever called from `optimizer_history.js` (§2h) |

`notifyOptimizerCoreChange()` (private to `optimizer.js`) fires this on
every coverage-list render (`renderCoverageList`, so any coverage add/
remove/edit — including an Insured Input edit, which re-renders Coverage
Input too, §2b) and every Settings commit (`settingsCommit`, plus the
Multi-Coverage Discount toggle handler specifically, since that one bypasses
`settingsCommit`). It over-notifies rather than trying to distinguish
exactly which writes this tab cares about — cheap, always correct, the same
trade-off `recalcFees()` already makes running unconditionally on every
render (§2b).

**Shared pieces move to the bridge the moment a SECOND split-off tab needs
them, not before.** `COVERAGE_ABBR`/`COVTYPE_ABBR`/`pendingCell` all started
out defined inside `optimizer_coverages.js` itself — perfectly fine while
Coverages was the only tab using them — and moved to `OptimizerCore` once
the Insureds tab (§2e) needed the exact same three; `insuredRateCode`
followed the identical path when `axisKeyPrefix` became its second consumer.
Don't re-add a local copy of any of these to a future split-off tab file "to
keep it self-contained"; extend the bridge instead, the same way all of them
were. `axisKeyPrefix` itself is the one deliberate exception to "wait for a
second consumer" — it was placed on the bridge the moment it was built, on
the strength of the request itself already naming Rates (§2f) as the
near-term second consumer, not a guess at future need (§9).

**This bridge is read-only from every split-off tab file EXCEPT ONE
function.** There is no general `OptimizerCore.setX(…)` — every write to
`coverages`/`settings`/`insureds` still goes through `optimizer.js`'s own
commit handlers exclusively, and every split-off tab manages whatever NEW
state is entirely its own (Unit Value, below) through `registerSnapshot`
rather than reaching into the core model. `restoreState(snap)` is the one
narrow, deliberate exception: reloading a saved test case (§2h) is
inherently a bulk overwrite of `coverages`/`settings`/`insureds`, which only
`optimizer.js` may ever perform (§9) — implemented and fully validated
inside `optimizer.js` itself, just invoked from History's own file when the
operator clicks Load. No other bridge member, and no other split-off tab,
gets this capability.

### The table

One row per coverage from Coverage Input, in the same order; 16 columns,
left to right:

| Column | Source |
|---|---|
| Coverage ID | `idx + 1` — the plain number, same as Coverage Input's own `.coverage-no` badge; NOT the full "N. Category — Coverage" title Results' table shows (§2c) |
| Frequency of Payment | `settings.freq`, display label ("Monthly"/"Annually") |
| Coverage Category | `COVERAGE_CATEGORY_MAP[c.category]` |
| Coverage | `COVERAGE_ABBR[c.coverage]`, or the raw name if not in the map — see below |
| Prem. Adj. % | `settings.premAdjPct` |
| Prem. Adj. % Dur. | `settings.premAdjPctDur` |
| Prem. Adj. $ | `settings.premAdjAmt` |
| Prem. Adj. $ Dur. | `settings.premAdjAmtDur` |
| Has MCD | `settings.mcd ? 'TRUE' : 'FALSE'` — literal strings, not a switch or a checkbox; the request specifies the text |
| Coverage Type | `COVTYPE_ABBR[c.covType]` — `Individual` (spelled out, per the request), `JFTD`, `JLTD`, `JLTDPU`; `—` for a blank `covType` (Critical Illness, whose Coverage Type isn't implemented yet, §2b) |
| Unit Value | own field, this tab only — see below |
| Temp Extra Premium | no formula yet — highlighted, not the usual `—` |
| Modal Factor | `settings.freq === 'annually' ? '1.00' : '0.09'` — exactly as specified; not derived (`1/12` ≈ `0.083`, not `0.09`) |
| Coverage Fee | `c.fee` (§2b) — `—` if null (blank, e.g. an un-entered Critical Illness fee) |
| Modal Prem. | no formula yet — highlighted |
| Modal Prem. Backdated | no formula yet — highlighted |

Six of these (Frequency of Payment, the 4 Prem. Adj. fields, Has MCD) mirror
Settings; three (Coverage ID, Coverage Category/Coverage, Coverage Fee)
mirror Coverage Input. **None of the six are editable here** — this tab
displays them, it doesn't duplicate their commit path; change them at their
own source (Settings or Coverage Input) and this table updates on the next
`onChange` notification.

**Coverage abbreviation (`core.COVERAGE_ABBR`) is specified only for Term
Life's and Permanent Life's coverage names** — all 12 of `COVERAGE_OPTIONS`'
`termLife`/`permLife` entries map to a code (`Term 10` → `T10`, `WL to 65` →
`VEG65`, …); Critical Illness coverage names (any of the three CI
categories) have no specified code, and fall back to the raw name rather
than inventing one — consistent with those categories' Coverage Type/Fee
also being unimplemented (§2b).

**Three columns have no formula yet** (Temp Extra Premium, Modal Prem.,
Modal Prem. Backdated) — each renders `core.pendingCell()`: amber/
`--warn-soft` background, `--warn` text, title "Formula not yet provided".
This is deliberately NOT the page's usual muted `--ink-4` "—" for a plain
not-yet-calculated figure (Results, §2c) — the request calls these out as
formulas still to come, a different, more visible kind of "not here yet"
than an ordinary unimplemented output.

**Unit Value is a genuinely new field — not part of Coverage Input's own
record.** Kept as its own `covId`-keyed map (`unitValues`) inside
`optimizer_coverages.js`, not added to the shared `coverages` array in
`optimizer.js` — this tab's own state stays self-contained rather than
extending the core model for a field only this tab reads or writes. Defaults
to `1000` for a new coverage; `syncUnitValues()` (called at the top of every
render) adds a default entry for any coverage that doesn't have one yet and
deletes any entry whose coverage no longer exists — the same "keep local
state in step with the shared list" idiom `syncCoverageInsuredRefs` uses in
`optimizer.js` (§2b), just for a field the core model doesn't know about at
all. **No range was specified**; validated as a whole number, 1 to
999,999,999 — this page's usual unbounded-but-not-infinite integer range,
assumed for consistency rather than left unvalidated.

The table is deliberately allowed to need a horizontal scroll —
`.table-scroll-wrap { overflow-x: auto; }` (`optimizer.css`, shared with
Insureds, §2e), no fixed layout or wrapping text the way Results' own table
needed (§2c) — 16 columns essentially never fit any sidebar or pane width
without either scrolling or compressing every figure illegibly, and the
request explicitly permits scrolling here.

Key functions (all in `optimizer_coverages.js` unless noted otherwise):

| Function | Purpose |
|---|---|
| `COLUMNS` | the column-header list, straight from the request (the two abbreviation maps it draws on live on the bridge now — see above) |
| `unitValueFor(covId)`, `syncUnitValues()`, `validateUnitValue(raw)` | the new field's own state, sync, and validation |
| `modalFactorFor()`, `moneyOrDash(v)` | the two small cell-formatting helpers this tab still owns itself (`pendingCell` moved to the bridge, above) |
| `coverageRow(c, idx)`, `coveragesTabShell()` | the markup builders |
| `renderCoveragesTab()` | rebuilds the table body; no-ops if `#covTabBody` doesn't exist yet |
| `covTabCommit(e)`, `covTabLive(e)` | `change`/`input` handlers for Unit Value, the only editable column — `data-fk="covtab|<covId>|unitValue"`, its own grammar, distinct from `optimizer.js`'s `cov|`/`covins|` (not that collision is actually possible — different delegated-listener scope entirely — but consistent with this page's "one grammar per scope" convention, §6) |
| `initCoveragesTab()` | one-time: render the shell, wire `change`/`input` on the host, register with `OptimizerCore.onChange` |

---

## 2e. Insureds tab (live) — `optimizer_insureds.css`/`.js`

The `optInsureds` pane, built the same way as Coverages (§2d, §1) — its own
file pair, reading `window.OptimizerCore` only. **Nothing on this tab is
editable** — every column is mirrored (read-only), pending, or (Axis Key
only) computed from the others — so, like Results (§2c), there's no
commit/live handler pair here at all.

### One row per (coverage, insured-on-that-coverage) pair

The request describes the row set as a nested loop — "a split for each
coverage, then a sub-split for each insured on the coverage" — and that's
exactly how `buildRows()` generates them, just flattened into ONE table's
rows rather than nested containers: for every coverage, for every one of
its insured slots that actually has an insured chosen, one row. An insured
on 3 different coverages produces 3 rows; a coverage with 2 insureds
produces 2 rows. A slot with no insured picked yet (`slot.insuredId === ''`)
contributes nothing.

**Verified against the request's own worked example** — Coverage 1 holds
Insured 1 and Insured 2, Coverage 2 holds Insured 2, Coverage 3 holds
Insured 2 and Insured 3 — reproduces exactly the five rows specified:
`1_1`, `1_2`, `2_2`, `3_2`, `3_3`, in that order.

### The table — 22 columns, two hard separators

First 13 columns, left to right:

| Column | Source |
|---|---|
| Coverage ID & Insured ID | `(cIdx+1) + '_' + (insIdx+1)` — both plain positions in their own array, same numbering Coverage Input's `.coverage-no` and Insured Input's `.insured-no` badges already use, NOT either record's internal `_id` string |
| Sex | the referenced insured's own Sex (Insured Input) |
| Insured Rate | Insured Input's own Rate, recoded: `pref` → `N`, `reg` → `S` — a DIFFERENT 2-letter code from Coverage Rate's own P/R-based one (next), not to be confused with it |
| Age Nearest/Last (Calculated) | `agesAt(insured.birthdate, settings.refDate)` — Age Real or Age Nearest, whichever that insured's own Age Calculation setting picks (§2, §2b — the same rule everywhere else on this page uses it) |
| Coverage Rate | that slot's own `rate` (§2b) — `P1`/`P2`/`P3`/`R1`/`R2` for Term Life, `P`/`R` for everything else; `—` if blank |
| Perm Extra Prem. % | `slot.extraPct` |
| Perm Extra Prem. $ | `slot.extraFlat` |
| Term Extra Prem. $ | `slot.extraTempAmt` |
| Term Extra Prem. $ Dur. | `slot.extraTempYears` |
| Coverage Category | that specific coverage's own category (§2b) — NOT a page-level value; two rows for the same insured on two different coverages can show two different categories |
| Coverage | `core.COVERAGE_ABBR[c.coverage]`, same map and same fallback rule as Coverages (§2d) |
| Coverage Type | `core.COVTYPE_ABBR[c.covType]`, same map as Coverages |
| Has MCD | `settings.mcd ? 'TRUE' : 'FALSE'` — the one page-level (not per-row) column in this first group, same as Coverages' own |

**Hard separator**, then 8 columns with no formula yet — Joint Sex, Joint
Rate, Joint Age, Joint Extra Prem. %, Joint Extra Prem. $, Joint Age
Backdated, Joint Extra Prem. % Backdated, Joint Extra Prem. $ Backdated —
each `core.pendingCell()` (§2d).

**Hard separator**, then one more column — Axis Key.

**Axis Key is a computed 26-character PREFIX, not a pending placeholder —
`core.axisKeyPrefix(r.c, r.slot)` (§2d).** It's the same Axis Key the Rate
file's own `TableName` column is keyed by (§2f), minus the 6-character rate
band code: that part is a Rates-tab concept (one row per band) with no home
on a per-insured row here, so what's shown is everything BEFORE it — the
request's own framing is "we now have the basis for our Axis Key". Rendered
`mono` (tabular, fixed-width reads as the exact character sequence it is)
with a `title` noting it's a prefix. Falls back to the standard
`core.pendingCell('col-hard-sep')` in two cases:
- **Critical Illness** (any of the three categories) — no Axis Key format
  has been given for these yet, same gap as Coverage Type/Coverage Fee
  elsewhere (§2b).
- **Two specific Permanent Life products** — `WL to 100` (`VEG100`, 6
  characters) and `Term to 100` (`T100`, 4 characters). Permanent Life's own
  format reserves exactly 5 characters for this segment; neither
  abbreviation fits it, and `axisKeyPrefixPermLife` (`optimizer.js`) refuses
  to guess at a truncated/padded form that was never specified. Every other
  Permanent Life product (`VEG10`/`VEG15`/`VEG20`/`VEG65`, all exactly 5
  characters) is unaffected.

A "hard separator" is `.col-hard-sep` (`optimizer.css`, §2d) — a visible
vertical divider between column GROUPS, stronger than `.ins`'s own row
hairlines, which don't separate columns at all by default. It's applied to
BOTH the header cell and every body cell at that column position (Joint Sex,
Axis Key) — `core.pendingCell('col-hard-sep')` takes the class as a
parameter for exactly this, so a pending cell doesn't need `.cell-pending`
and `.col-hard-sep` reconciled by hand at each of the two boundaries; the
computed Axis Key cell carries the same class directly for the same reason.

**An empty row set** (no coverage has any insured slot filled yet) shows a
`.proj-slot`-style placeholder spanning every column, not a headers-only
table — the same idea as Results' own empty-`coverages` fallback (§2c),
here for the more commonly-hit case of insureds simply not assigned yet.

Key functions (all in `optimizer_insureds.js`):

| Function | Purpose |
|---|---|
| `COLUMNS`, `HARD_SEP_AT` | the 22-column header list and the two 0-based indices (`13`, `21`) that open a new group |
| `buildRows()` | the nested coverage-then-slot walk that produces the flat row list |
| `calcAge(ins)` | the Age Nearest/Last rule, via `core.agesAt` |
| `axisKeyCell(r)` | the Axis Key cell — `core.axisKeyPrefix(r.c, r.slot)` if it returns one, else the standard pending cell (above) |
| `td(value)`, `rowHtml(r)`, `insuredsTabShell()` | the markup builders |
| `renderInsuredsTab()` | rebuilds the table body (or the empty-state placeholder); no-ops if `#insTabBody` doesn't exist yet |
| `initInsuredsTab()` | one-time: render the shell, register with `OptimizerCore.onChange` — no `change`/`input` listener, since nothing here is ever committed |

---

## 2f. Rates tab (live — file import & parsing done, lookup not yet wired) — `optimizer_rates.css`/`.js`

The `optRates` pane, built the same way as Coverages/Insureds (§2d/§2e, §1) —
its own file pair, reading `window.OptimizerCore` only, plus the one
vendored dependency this page has, `xlsx.full.min.js` (SheetJS, §0 rule 1),
loaded before `optimizer_rates.js` in `optimizer.html`. **The most crucial
tab in the tool, per the request that specified it** — the goal is reading a
real insurance-rates `.xlsx` workbook, finding the rate at every rate band
for every insured on every coverage, at both their current age and age − 1
(for a possible backdate), for both the Premium Rate and the Extra Premium
Rate. That's four rates × N rate bands × M insureds per coverage.

**What's real today**: importing and parsing BOTH rate file formats
end-to-end (tested against locally-built sample workbooks shaped exactly
like the real ones, including the request's own worked examples — see
below), with a real chunked progress bar. **What's still pending**: the
Axis Key CONSTRUCTION formula only covers the 26-character *prefix* so far
(§2e) — completing it with a 6-character rate band code and actually calling
`lookupTermLifeRate`/`lookupPermLifeRate` from this tab's own cells is the
next step, not done yet. Every PR_i/EPR_i-family cell is `core.pendingCell()`
regardless of whether a file is loaded, until that wiring lands.

### Rate bands (fixed, hardcoded)

Given, not derived — 8 bands for Term Life, 6 for Permanent Life. Critical
Illness has none; a coverage in any of those three categories gets the
plain "not built yet" placeholder card instead of a table, the same gap as
Coverage Type/Coverage Fee elsewhere (§2b).

| Category | Bands (code — face amount) |
|---|---|
| Term Life | B00025—25,000 · B00050—50,000 · B00100—100,000 · B00250—250,000 · B00500—500,000 · B01000—1,000,000 · B02000—2,000,000 · B10000—10,000,000 |
| Permanent Life | B00010—10,000 · B00025—25,000 · B00050—50,000 · B00100—100,000 · B00250—250,000 · B00500—500,000 |

`BAND_TABLES` (`optimizer_rates.js`) — a coverage's own row axis in both
table regions below is exactly its category's band list, in this order.

### One container per coverage — two table regions, one row axis

Per the request's own layout, split into a scrollable region and a
static one, sharing the same rate-band row axis so they line up without
extra work (`.rate-body` = flex row; `.rate-scroll` = `.table-scroll-wrap`;
`.rate-fixed` = never scrolls, §5):

```
┌───────────────────────────────────────────┬─────────────────────────────┐
│ Rate Band Code │ Insured 1 (4 cols) │ … ▸ │ Total │ BD_Total │ BD_Final  │
│      (scrolls within itself)               │   (always visible, 9 cols)  │
└───────────────────────────────────────────┴─────────────────────────────┘
```

**LEFT, `.rate-scroll`**: Rate Band Code, then one 4-column group per
*filled* insured slot on that coverage (`Insured N — <name>`, then
`PR_N`/`EPR_N`/`PR_BD_N`/`EPR_BD_N`) — an empty `"— Select —"` slot
contributes no group. A light `.col-soft-sep` divider (thinner than
`.col-hard-sep`, `--line-strong`, §5) marks where one insured's group ends
and the next begins — the request's own "light visible separation between
each insured", distinct from the RIGHT region's stronger one. Every data
cell is `core.pendingCell()` today regardless of category (above).

**RIGHT, `.rate-fixed`**: three 3-column groups — Total (`PR_Total`/
`EPR_Total`/`PEP_Total`), BD_Total (same three, backdated), BD_Final (same
three again) — `.col-hard-sep` between each GROUP, matching the request's
"another hard separation" language. Total/BD_Total render the page's
"blocked on missing upstream data" convention (plain muted `—`, `dashCell()`
— their SUM formula is fully specified, only the PR_i/EPR_i inputs they'd
sum are missing right now, same treatment Results' own "Modal Premium"
gets, §2c) — BD_Final renders `core.pendingCell()` instead, since its own
formula (which insured's rate to use, current or backdated, "based on if
the insured is backdatable or not") is explicitly not final yet, a
different reason than "blocked on an input" (§9).

### Importing a rate file

One `<input type="file" accept=".xlsx">` (`#ratesFileInput`, triggered by
**Import Rates File**) handles both categories: `detectAndIngest()` reads
the workbook and looks at its OWN sheet names — any `temp_rates_` prefix
means Term Life, `perm_rates_` means Permanent Life — rather than a second
button/picker per category. **Load from `rates/`** tries `fetch()`-ing both
known filenames from the `rates/` folder (§1) independently — this only
works when the page is served over http(s) (§0 rule 1, §1 "Running it"); on
`file://` it fails with a calm status message, never a crash, and the
picker above is unaffected either way.

**Config is one small, clearly-marked block at the top of
`optimizer_rates.js`** — `RATE_VERSION` (`'2509'`), `PERM_VERSION`
(`'2007'`), the filenames/sheet names built from them, and
`TERM_LIFE_DURATIONS` (the six sheet-name suffixes, in Coverage Input's own
`COVERAGE_OPTIONS.termLife` order). Deliberately hardcoded, not detected
from the imported file — the request's own answer, given so a future rate
table revision (a new version stamp) is a one-line edit in an obvious spot,
not a code hunt.

**Term Life** — `temp_rates_<RATE_VERSION>_combined.xlsx`, 6 sheets
(`temp_rates_<RATE_VERSION>_t10` … `_t65`), each identically shaped:

| Column | Meaning |
|---|---|
| ColA–ColC | Run Id / Section / Shape — ignored |
| ColD | Axis Key (`TableName`) |
| ColE | Duration — **every value 1–100 is kept**, not just 1 (below) |
| ColF | Op — ignored |
| ColG–ColDB | Age 0–99 (`C1`…`C100`; `ColG` = age 0, 100 columns) |
| ColDC–ColDE | Scenario / Override Id / RunFilter Id — ignored |

`termLifeTables[suffix][axisKey][duration][age] = rate`. **Every Duration
1–100 is imported, not filtered down to Duration 1** — only Duration 1 is
read anywhere today (`lookupTermLifeRate`'s own default parameter), but the
request specifically asked for the whole workbook up front so a later
duration-aware feature never needs a re-import. Verified against the
request's own worked example (Duration 1, ages 19–28 → 1.56, ages 29+ →
2.56 at one Axis Key) and, separately, against a synthetic file with 8 and
100 distinct durations on two Axis Keys — every duration retrieved
correctly and independently (`lookupTermLifeRate(suffix, axisKey, age,
duration)`).

**Permanent Life** — `perm_rates_<PERM_VERSION>_combined.xlsx`, ONE sheet
(`perm_rates_<PERM_VERSION>_combined`), no per-product split (every WL
product's rows live together, distinguished only by Axis Key) and no
duration axis at all:

| Column | Meaning |
|---|---|
| ColA–ColC | Run Id / Section / Shape — ignored |
| ColD | Axis Key |
| ColE | "Row" = Age + 1 — a block starts with a `-2` sentinel row (no rate, skipped), then 1–100 (age 0–99); anything outside 1–100 is skipped the same way, not just a literal `-2` |
| ColF | Op — ignored |
| ColG | the rate (`$`/1000 of insurance, same convention as Term Life) |
| ColH–ColJ | Scenario / Override Id / RunFilter Id — ignored |

`permLifeTable[axisKey][age] = rate`. Verified against the request's own
worked examples exactly: Row 37 → age 36 → the example's own 22.48; Row 20
→ age 19 → 12.34; the `-2` sentinel and an out-of-range junk row both
correctly produce no entry.

### Chunked import with a real progress bar

Parsing is NOT one synchronous pass — `processRowsChunked()` walks a
sheet's rows in `ROW_CHUNK` (500) batches, yielding via `setTimeout(…, 0)`
between them, driving `#rateProgress` (label + native `<progress>`,
`accent-color` themed, §5) with real "sheet N of 6" / "row X/Y" text — not
decorative, since now that Term Life keeps every Duration, a real workbook
is big enough to freeze the tab for a visible moment otherwise. Verified
live: caught the bar mid-import reporting "sheet 2 of 6 … 33%", confirmed
both import buttons disable while it runs and re-enable after.

**One import runs at a time; concurrent requests queue rather than
collide** (`importQueue`/`runNextImport`/`afterImport`) — "Load from
`rates/`" fires off Term Life and Permanent Life together, and
`restorePersistedRates()` does the same on page load; both need to
complete, just not simultaneously (they'd fight over the one progress bar).
Verified by firing both imports back-to-back: both completed correctly, in
sequence, neither's status clobbered by the other.

### Persistence — separate from History, on purpose

Raw file BYTES, not the parsed lookup table, are cached to `localStorage`
under `coverage-optimizer-rates` (base64, one entry per category so
importing one never wipes the other) — smaller than a full JSON dump of
every cell, and a single source of truth: a future fix to the parsing logic
applies on next load with no cache to invalidate by hand. Falls back to
session-only with a toast, not a silent failure, if a file is too big for
the quota. **Deliberately NOT part of a saved History test case** (§2h) —
the imported rate table is shared reference data the tool operates against,
not a scenario input a specific test case owns; reloading an old test case
re-resolves against whatever rates happen to be loaded at the time, not a
frozen copy from when it was saved.

Key functions (all in `optimizer_rates.js` unless noted otherwise):

| Function | Purpose |
|---|---|
| `RATE_VERSION`, `PERM_VERSION`, `TERM_LIFE_FILE_PATH`, `PERM_LIFE_FILE_PATH`, `TERM_LIFE_DURATIONS`, `TERM_LIFE_COVERAGE_SUFFIX` | the one visible config block (above) |
| `BAND_TABLES` | the two fixed rate-band lists |
| `detectAndIngest(bytes, fileName)` | reads the workbook, routes by sheet name, queues the job |
| `ingestTermLifeWorkbook`, `ingestPermLifeWorkbook` | the two category-specific parsers (above), each chunked via `processRowsChunked` |
| `lookupTermLifeRate(suffix, axisKey, age, duration)`, `lookupPermLifeRate(axisKey, age)` | the lookups this file exists to provide — implemented and tested, not yet called by the UI (above) |
| `processRowsChunked(rows, onRow, onProgress, onDone)` | the generic chunked-iteration helper both parsers use |
| `importQueue`, `runNextImport()`, `afterImport()` | the one-import-at-a-time queue |
| `showProgress(label, pct)`, `hideProgress()`, `setImportButtonsDisabled(v)` | the loading-bar UI |
| `handleFilePicked(file)`, `loadFromRatesFolder()` | the two entry points into `detectAndIngest` |
| `bytesToBase64`/`base64ToBytes`, `persistRates(kind, bytes, fileName)`, `restorePersistedRates()` | persistence (above) |
| `insuredRatesTable(c, slots)`, `totalsRatesTable(c)`, `coverageRatesCard(c)` | the markup builders for the two table regions and the outer card |
| `renderRatesTab()`, `ratesTabShell()`, `initRatesTab()` | the render/shell/init trio every split-off tab has |
| `toast(msg, kind)`, `renderStatus()` | transient per-action feedback vs. the persistent "what's loaded" summary (two lines, one per category) — the same split History's own file uses |

---

## 2g. Backdate tab (live) — `optimizer_backdate.css`/`.js`

The `optBackdate` pane, built the same way as the other split-off tabs
(§2d–§2f, §1). **Two containers stack top/bottom, not left/right** — the
one tab on this page that doesn't use `.split` at all; both containers are
siblings inside `#backdateTabHost`, plain block-level stacking.

### Container 1 — Insureds Backdate

One row per insured (from Insured Input directly, not per coverage), every
date measured against the Illustration Date (`settings.refDate` — the same
page-level reference date every other tab uses, never real "today", §9
invariant #12) since that's the one date this container's own header
anchors Max. Backdate Date to.

**Header (`.card-head--band`) carries three figures**, left to right, via a
new Optimizer-only component (`.bd-band-figs`/`.bd-band-fig`, §5 — NOT
`.chip`: `.card-head--band .chip:not(.chip--edit)` force-inverts a chip's
colours inside a band, which would swallow the amber "pending" look Final
Backdate Date needs, so a new class sidesteps that shared-rule collision
instead of touching it):

| Figure | Value |
|---|---|
| Illustration Date | `settings.refDate`, as-is |
| Max. Backdate Date | Illustration Date − 6 months (`subtractMonths`, below) |
| Final Backdate Date | `—`, highlighted amber (`.bd-band-fig--warn`) — formula not yet provided |

13 columns, one row per insured:

| # | Column | Source |
|---|---|---|
| 1 | Insured Name | `ins.name` |
| 2 | Insured Birthdate | `ins.birthdate` |
| 3 | Age Real | `agesAt(ins.birthdate, Illustration Date).real` |
| 4 | Age Nearest/Last | `.real` or `.nearest` per `ins.ageCalc`, same rule used everywhere else (§2, §2e) |
| 5 | Past Birthday | most recent birthday on or before Illustration Date (inclusive) |
| 6 | Midpoint (Possible Backdate) | exact midpoint, in days, between Past and Next Birthday |
| 7 | Next Birthday | the birthday strictly after Illustration Date |
| 8 | Backdate Eligible | `AND(Midpoint ≥ Max. Backdate Date; Midpoint ≤ Illustration Date)` → `TRUE`/`FALSE` |
| 9 | Backdated Age Nearest/Last | `agesAt(ins.birthdate, Midpoint)`, same real/nearest rule as col. 4 |
| 10 | Rate Current (All Cov.) | `core.pendingCell()` — always, no formula yet |
| 11 | Rate Backdated (All Cov.) | `core.pendingCell()` — always, no formula yet |
| 12 | Confirm Backdate | see short-circuit, below |
| 13 | Backdate Date | see short-circuit, below |

**Date math, all in `optimizer_backdate.js`, none of it guessed at without a
flag**:
- `subtractMonths(dt, n)` — plain `Date` normalisation; an out-of-range day
  rolls into the following month on its own (e.g. 31-AUG − 6 ≈ 3-MAR, not
  clamped to the shorter month's last day) — not addressed by the request,
  flagged rather than silently picked.
- `birthdayInYear(birth, y)` — 29-FEB in a non-leap year falls back to
  28-FEB (the closest lived date) rather than skipping that year's
  birthday — not specified, least-surprising choice for the one date this
  can affect.
- `surroundingBirthdays` — a birthday landing exactly on the Illustration
  Date counts as already past, not upcoming (inclusive reading of "most
  recent… that passed").
- `midpointDate` — Past/Next Birthday are 365 or 366 days apart, so an
  exact half-day split is impossible for the (far more common) 365 case;
  **round-half-up** was picked, flagged as a choice, not a given.
- **Day 29/30/31 in a midpoint result falls back to 28** — the exact same
  rule, and reason (any month, not just the ones that day doesn't exist
  in), as Reference Date's own clamp (next paragraph) — stated explicitly
  by the request for both.

**Reference Date (Settings, §2a) clamps the same way**: a day of 29/30/31,
in ANY month, becomes 28 — `validateSettings`'s `'date'` branch,
`optimizer.js`, scoped to `f.k === 'refDate'` specifically (the only date
field this applies to). Verified live: `31-DEC-2025` commits and displays
as `28-DEC-2025`; a midpoint that would land on `30-JUL` displays `28-JUL`,
and that CLAMPED date is what feeds Eligible/Backdated Age downstream, not
the pre-clamp one.

**Confirm Backdate / Backdate Date short-circuit rather than staying
uniformly pending.** The real formulas are `Confirm Backdate = AND(Eligible;
Rate Backdated < Rate Current)` and `Backdate Date = AND(Eligible; Confirm
Backdate) ? Midpoint : BLANK()` — both reference columns 10/11, which have
no formula yet (Rates tab, §2f, hasn't been wired up to feed them — a
deliberate decision to keep the two tabs separate for now, not an
oversight). But `AND(FALSE; anything)` is `FALSE` regardless of what's
missing:

- **Not eligible** → Confirm Backdate is a real, resolved `FALSE` (plain
  text, not amber) and Backdate Date is a real, resolved blank (`dashCell()`
  — muted `—`, the page's "blocked on missing input" convention, §2f, §9).
- **Eligible** → Confirm Backdate genuinely can't be determined yet
  (`core.pendingCell()`), and Backdate Date inherits the same block.

Verified live for both branches: an ineligible insured showed plain
`FALSE`/`—` (no amber); an eligible one showed both cells amber-pending.

### Container 2 — Backdate Projection

**Show Projection** — an on/off switch in the container's own
`card-head--band` (reuses `.switch`, the exact Multi-Coverage Discount
component, §2a; local `data-act="toggle-bdproj"`, this file's own delegated
click handler, not `settingsCommit`). **OFF by default** — not specified
either way; mirrors MCD's own "off until the operator opts in" precedent
(§2a). **OFF collapses `#bdProjBody` (the table) while the band itself
stays visible** — per the request, verified live both directions.

Two more header figures, same `.bd-band-fig--warn` amber pill as Final
Backdate Date: **Monthly Savings Date**, **Annual Savings Date** — both
`—`, formula not yet provided.

Six columns — **Date, Premium Current, Cumul. Prem. Current, Premium
Backdated, Cumul. Prem. Backdated, Difference** — every HEADER cell
(not body cell) rendered amber-pending (`.cell-pending` reused on a `<th>`,
out-specified over `.ins thead th`'s own band styling the same way
`.results-cov-wrap .ins thead th` already does, §2c) — the request's own
"highlight all in yellow" applied to the column set itself. **No rows are
generated** — the request gave the column set but not a row-generation rule
(period, date range), so nothing was invented; a single spanning
placeholder ("Formulas not yet provided — nothing to project yet.") stands
in, the same empty-state idiom used elsewhere (§2c, §2e).

Key functions (all in `optimizer_backdate.js`):

| Function | Purpose |
|---|---|
| `subtractMonths`, `birthdayInYear`, `surroundingBirthdays`, `midpointDate` | the date-math primitives (above) |
| `dashCell()` | the local "blocked on missing input" `<td>` — the muted-`—` counterpart to `core.pendingCell()` |
| `backdateRow(ins, illustration, maxBackdate)` | one Insureds Backdate row, including the Confirm Backdate/Backdate Date short-circuit |
| `insuredsBackdateShell()`, `renderBackdateTab()` | container 1's shell/render |
| `backdateProjectionShell()` | container 2's shell, including the Show Projection switch and the pending-header table |
| `showProjection` | this container's own local UI state — not part of `settings`, never saved (it's a display preference, not an input that produces outputs) |
| `initBackdateTab()` | one-time: render both shells, wire the Show Projection toggle, register with `OptimizerCore.onChange` (container 1 only — container 2 never depends on shared state) |

---

## 2h. History tab (live) — `optimizer_history.css`/`.js`

The `optHistory` pane — last in the tab bar — built the same way as the
other split-off tabs, **except this is the one file allowed to call the
bridge's one deliberate WRITE path**, `OptimizerCore.restoreState` (§2d),
when the operator picks a saved test case to reload. Also the one feature
whose UI spans two physical locations — the History tab itself, and three
controls in `optimizer.html`'s static top bar — but it's still one file/CSS
pair, per the request treating Save/Load as a single feature.

### Top bar controls

In order, immediately before the theme button: **Test Case Name** (text
input, `#tcName`), **Username** (`#tcUser`, fixed dropdown — `Catheryne L.`
/ `Rafi K.` / `Catherine C.`, in that order, no blank option, defaults to
the first), **Save Test** (`#btnSaveTest`). Static markup in
`optimizer.html` (the top bar isn't tab-generated), sized taller than the
base `.fi`'s dense 19px to match the 27px theme button beside them
(`optimizer_history.css`) — wired up by `optimizer_history.js` regardless,
per the "one feature, one file" framing above.

**Save Test** requires a non-blank Test Case Name (toasts and aborts
otherwise, `.fi--bad` on the box); Username always holds a value by
construction. On success: builds one catalog entry, pushes it to the
in-memory/`localStorage` catalog, triggers a `.json` file download,
re-renders the History table, clears the Name box, toasts confirmation.

### Persistence — browser storage AND a portable file, on purpose

This tool has no backend and must keep opening from `file://` (§0 rule 1),
so there is no folder it can silently write to. Every save does BOTH:

- Writes into `localStorage` (`coverage-optimizer-testcases`) — so the
  History tab can list and one-click **Load** it instantly, the same way
  the theme choice already persists there.
- Downloads a `.json` file of the same entry — a real, portable file that
  can be archived or emailed to a colleague ("demonstrate the test case…
  without having to rebuild the inputs").

**A page can never dictate WHERE that download lands** — that's a browser
security boundary, not something this file can route around; it lands
wherever the browser's own configured download directory says. **Import
Test Case** (a button in the History tab's own band, hidden `<input
type="file">` behind it) is the other half: it reads a `.json` file back
via the ordinary file picker and adds it to THIS browser's own catalog —
the only way a colleague's file can ever reach someone else's History,
since nothing here can reach across machines on its own.

### The catalog entry — everything needed to reproduce a test case

`core.snapshotState()` (Settings/Insureds/Coverages, deep-cloned plain
JSON) plus Unit Value (`core.getSnapshot('unitValues')` — Coverages tab's
own field, outside that model entirely, §2d) folded into one `snapshot`
object, wrapped with `id`/`name`/`user`/`savedAt`/`insuredCount`/
`coverageCount`. `savedAt` is built from LOCAL wall-clock time
(`nowStamp()`, its own tiny formatter — deliberately NOT `core.fmtDate`,
which reads a Date's UTC fields for the page's business dates; a save
timestamp has no such requirement, local time is what "just now" means to
whoever clicked the button).

### The table — 8 columns

| Column | Source |
|---|---|
| Test Case Name | `entry.name` |
| Username | `entry.user` |
| Date Saved | `entry.savedAt` |
| Number of Insureds | `entry.insuredCount` |
| Number of Coverages | `entry.coverageCount` |
| Total Modal Premium | `—`, plain muted (NOT amber) — the intended formula (sum of every coverage's own Modal Prem., once that exists) is already known, blocked on an upstream figure that doesn't exist yet, same treatment as Results' own "Modal Premium" and Rates' own Total columns (§2c, §2f) |
| Load | button, `data-act="load-tc"` |
| Delete | button, `data-act="del-tc"` — added on request, not in the original column list, once test cases could accumulate |

**Load — order matters.** `core.restoreState(entry.snapshot)` runs FIRST
(replacing `coverages`/`insureds`/`settings`), THEN
`core.setSnapshot('unitValues', entry.snapshot.unitValues)` — Unit Value's
own `set` callback re-syncs against whatever `coverages` currently holds
(`optimizer_coverages.js`'s `syncUnitValues`), so it has to run AFTER the
coverages it's syncing against already reflect the loaded snapshot, or it
discards the just-restored values as "stale". Verified live: changed a
coverage's Unit Value, saved, changed it again, Loaded — the SAVED value
came back, not the pre-load one. Then switches to `optInput`
(`document.querySelector('.tab[data-pane="optInput"]').click()` — reuses
the existing tab-click mechanism rather than a new bridge export) so the
operator immediately sees what loaded, and toasts confirmation.

**Delete is immediate, no confirmation dialog** — the same convention
Coverage/Insured Remove already uses everywhere else on this page (§2b,
§9); toasts afterward.

Key functions (all in `optimizer_history.js`):

| Function | Purpose |
|---|---|
| `loadCatalog()`, `persistCatalog()` | `localStorage` read/write, both wrapped `try/catch` |
| `buildSnapshot()`, `buildEntry(name, user)` | assembles one catalog entry (above) |
| `doSaveTest()`, `doImportFile(file)`, `doLoad(id)`, `doDelete(id)` | the four actions |
| `nowStamp()`, `safeFileName(name)`, `downloadJSON(filename, obj)` | the save timestamp, filename sanitiser, and Blob-download helper |
| `historyRow(entry)`, `renderHistoryTab()`, `historyTabShell()` | the table markup/render/shell trio |
| `toast(msg, kind)` | its own local copy, same reasoning as Rates' (§2f): cheaper than a bridge accessor for one DOM effect |
| `initHistoryTab()` | one-time: render the shell, wire the History-tab delegated clicks (Load/Delete/Import trigger) AND the top-bar Save Test controls in the same call |

---

## 3. Design tokens

All colour lives in CSS custom properties on `:root`. **Never hard-code a
colour in new code — use a token.**

### Palette structure

`optimizer.css` carries the slate palette as the `:root` default and a dark
variant under `:root[data-theme="dark"]`. It is the Inforce green palette
rotated from hue 131 to hue 205 at identical saturation and lightness, so the
two tools read as one product and two tools at once.

`data-theme="light"` is set in `optimizer.html` and then overridden from
`localStorage` on load.

### Token reference

| Token | Light | Dark | Role |
|---|---|---|---|
| `--canvas` | `#EDEFF2` | `#0D0F12` | page background |
| `--surface` | `#FFFFFF` | `#151920` | card background |
| `--surface-sunk` | `#F5F7FA` | `#111419` | recessed / read-only |
| `--surface-head` | `#F9FAFC` | `#1A1F26` | plain card headers |
| `--line` | `#DCE0E6` | `#262B33` | standard border |
| `--line-strong` | `#C1C8D2` | `#3A414D` | emphasised border |
| `--line-hair` | `#E7EAEF` | `#1E222A` | row separator |
| `--ink` | `#111418` | `#E3E7EC` | primary text |
| `--ink-2` | `#474F5A` | `#A6ADB8` | secondary text |
| `--ink-3` | `#5C6570` | `#949CA8` | labels |
| `--ink-4` | `#69737F` | `#838B97` | muted / micro |
| `--accent` | `#345165` | `#7FA0B8` | brand, primary button |
| `--accent-2` | `#436780` | `#9EBCD0` | hover |
| `--accent-soft` | `#E9EEF3` | `#18202B` | tint background |
| `--accent-line` | `#B7C6D2` | `#2E3E4C` | tint border |
| `--on-accent` | `#FFFFFF` | `#0D0F12` | text on accent |
| `--focus` | `#436780` | `#7FA0B8` | focus ring |
| `--cov-band` | `#2A4256` | `#1E2E3A` | container header band |
| `--cov-band-ink` | `#FFFFFF` | `#DCE5EB` | text on band |
| `--cov-band-sub` | `rgba(255,255,255,.74)` | `rgba(220,229,235,.66)` | muted text on band |
| `--cov-band-line` | `#1F3242` | `#2C4152` | band underline |
| `--cov-border` | `#2A4256` | `#3D5163` | container outline |
| `--ins-band` | `#7492A8` | `#3F5A6E` | sub-container band |
| `--ins-band-ink` | `#142026` | `#E4EBF0` | text on sub-band |
| `--ins-band-line` | `rgba(0,0,0,.18)` | `rgba(0,0,0,.3)` | sub-band underline |
| `--ins-border` | `#5C7E93` | `#486478` | sub-container outline |

The `cov-` and `ins-` prefixes are historical (they were named for the Inforce
coverage and insured containers). On this page read them as **container band**
and **sub-container band** — the dark and the lighter of the two header
treatments.

### Semantic tokens

**These are identical in `inforce.css`.** Brand colour differs between the two
tools; meaning does not. A reader must never have to ask which tool they were
in to interpret a warning.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--edit` | `#7E6115` | `#D2AE5F` | value differs from its source / baseline |
| `--edit-soft` | `#FBF4E3` | `#241F10` | changed-row background |
| `--edit-line` | `#E0CFA2` | `#4A3F1E` | changed-row border |
| `--neg` | `#9B2C22` | `#E4756A` | validation failure, removal |
| `--neg-soft` | `#F8ECEA` | `#2A1917` | failure background |
| `--warn` | `#7A5310` | `#D9AC5A` | advisory |
| `--warn-soft` | `#FAF2E3` | `#26200F` | advisory background |
| `--pos` | `#226B45` | `#56BC88` | positive / ready |

### Non-colour tokens

| Token | Value |
|---|---|
| `--r` | `2px` — the only border radius in the app |
| `--sans` | `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` |
| `--mono` | `ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace` |

### Colour-encoding rules

- **Slate (accent)** — brand, interactive, container identity.
- **Gold (`--edit`)** — *only* "differs from the baseline". Never use it for
  "editable"; an earlier draft did and the whole card turned beige, burying the
  one field that had actually changed.
- **Brick (`--neg`)** — rejected input, removal.
- Everything else is neutral.

---

## 4. Layout

### Shell

`.app` is a 4-row CSS grid filling the viewport, `min-width: 900px`:

```
grid-template-rows: 46px  auto  1fr  24px;
                    topbar tabs viewport statusbar
```

`.viewport` is the only scrolling region (`overflow-y: auto`).

### Two-thirds / one-third split

```css
.split { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; align-items: start; }
.split-main { grid-column: span 2; }
.split-side { grid-column: span 1; position: sticky; top: 0; }
@media (max-width: 1240px) { /* stacks to one column, side becomes static */ }
```

- The side column is **sticky** — it stays put while the main column scrolls.
  On `optInput`, Insured Input on the right stays visible while the operator
  scrolls through Coverage Input on the left.
- Below 1240px both stack vertically, main above side.
- Any tab can get this layout by adding `split: ['Left', 'Right']` to its
  `TABS` entry.

### Two other layouts this page uses, neither one a `TABS` primitive

Both are hand-built inside their own tab's shell function, not a reusable
`split`-style option on `TABS` — worth a name here so a future tab doesn't
reinvent either one:

- **Top/bottom stacking** (Backdate, §2g) — no grid at all, just two
  sibling `<div>`s (each a `.card`) inside one host; block-level elements
  stack vertically on their own. The one tab on this page that isn't
  left/right at any width.
- **Scrollable-beside-static** (Rates, §2f) — a `display: flex` row
  (`.rate-body`) with one child in a `.table-scroll-wrap` (`overflow-x:
  auto`, can grow past its own width) and one child that never scrolls
  (`.rate-fixed`, `flex: 0 0 auto`) — NOT `.split`, which sizes both sides
  by grid columns; this instead lets the LEFT side be exactly as wide as its
  content needs (triggering its own scrollbar independently) while the
  RIGHT side stays a fixed, always-visible width.

### The Results strip primitive

`resultsBar(tag, fields)` builds one thin figures row: a left-edge tag, then
one read-only cell per field. It used to be the whole "Results" container by
itself, full width, then paired 1/3-width beside Settings; both of those
arrangements are gone now — Results is its own richer container with a
table subcontainer of its own (§2c), and `resultsBar()` today builds only
that container's second subcontainer (the 3-figure summary). The function
itself didn't need to change for any of that — only what calls it, and with
what tag/field list, did.

```css
.resultbar { display: flex; align-items: stretch; /* one row, no wrap */ }
.resultbar-tag { flex: none; /* the "RESULTS" label on the left edge */ }
.rs { flex: 1; min-width: 132px; /* one figure: label above value */ }
```

- Every cell is **plain text**, never an `<input>` — `.rs-k` (label) above
  `.rs-v` (value), not a validated control. These are calculated outputs; the
  operator does not set them.
- A value with nothing calculated yet renders `.rs-v.is-empty` holding an
  em dash (`—`), the same "blank stays blank" convention as everywhere else
  in the app — never a placeholder zero.
- The row is deliberately thin — roughly a sixth to an eighth of the height
  of the containers below it, not a full `.card` with its own header band.
  If the figures need to wrap to two rows on a very narrow window, that is a
  regression: widen `.rs`'s `min-width` down or drop a field before letting
  it wrap.
- Below ~900px the strip scrolls **within itself**
  (`overflow-x: auto` on `.resultbar`) rather than forcing the page to scroll
  horizontally. Confirmed at 900px viewport width — the strip scrolls, the
  page does not.

### If you build a dense field grid

The Inforce Tool's coverage grid (`.fgrid` / `.fgroup` / `.fr`) is available in
`optimizer.css`. Its column count is driven by a **container query**, not a
viewport query:

```css
.fgrid { grid-template-columns: repeat(4, minmax(0,1fr)); }
@container (max-width: 780px) { .fgrid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@container (max-width: 400px) { .fgrid { grid-template-columns: minmax(0,1fr); } }
```

The query is against the nearest ancestor with `container-type: inline-size`.
In `inforce.css` that is `.col-cov`. **If you place an `.fgrid` on this page,
give its wrapper `container-type: inline-size`** (for example on
`.split-main`), or the query has nothing to measure and the grid stays at
four columns regardless of width.

---

## 5. Component classes

All of these are in `optimizer.css` and ready to use.

| Class | Purpose |
|---|---|
| `.card` | generic container: surface, `--line` border, 2px radius |
| `.card--out` | container outlined in `--cov-border` |
| `.card-head` | plain header strip on `--surface-head` |
| `.card-head--band` | **dark banded header** (`--cov-band` + white text) — used by every generated slot |
| `.card-body` / `.card-foot` | padded body / footer strip |
| `.card-title` / `.card-note` | 12px 650-weight title / 10px muted note |
| `.cov` / `.cov-head` / `.cov-no` / `.cov-plan` / `.cov-sum` | a banded container with a number badge (Inforce coverage card; reusable for any numbered item) |
| `.fgrid` / `.fgroup` / `.fgroup-head` | 4-column grouped field grid, its columns and their headings |
| `.fr` | one label/value row inside a group |
| `.fk` | field label (11px, `--ink-3`) |
| `.fi` | editable input or select |
| `.fi--txt` | left-aligned variant (text fields; numbers are right-aligned) |
| `.fi--ro` | **read-only: sunk, dashed border, muted ink** |
| `.fi--bad` | failed validation |
| `.fi--name` | wide variant for a name field |
| `.fr.is-chg` | row whose value differs from its baseline (gold tint + ● marker) |
| `.ins-wrap` / `.ins` | inset sub-container (`--ins-border` outline) and its table |
| `.kv` | key-value row, `.kv.is-chg`, `.kv.is-total` |
| `.grouphead` | subsection band (`--ins-band`) |
| `.diff` | change-log table; `.tag--mod` / `.tag--add` / `.tag--del` |
| `.split` / `.split-main` / `.split-side` | 2/3 + 1/3 layout |
| `.resultbar` / `.resultbar-tag` / `.rs` / `.rs-k` / `.rs-v` | **Optimizer-only.** The thin calculated-figures row on `optInput`: the row itself, its left-edge "RESULTS" tag, one cell, its label, its value. `.rs-v.is-empty` for a figure not yet calculated. Reused verbatim by the Settings panel (§2a) — same row shape, but a live control in place of `.rs-v`. Not in `inforce.css`. |
| `.insured-card` / `.insured-head` / `.insured-no` / `.insured-title` | **Optimizer-only.** One insured sub-container in Insured Input: the card, its sage (`--ins-band`) header, the position badge, the live name. Not in `inforce.css`. |
| `.fc-row` / `.fc` | **Optimizer-only, unscoped/generic.** The shared shell every dense field grid on the page uses: `.fc-row` is a grid row with a bottom border, `.fc` is one cell inside it — a control or value under its `.rs-k` label. Dividers use `--ink-4` (not the shared `--line-strong` other borders on the page use — reused, not new, to increase contrast without restyling anything shared) and, via `.fc .rs-k`, `--ink-2` for the label — darker than the Results/Settings bar's own dim `.rs-k`, since a dense grid needs to read at a glance and a thin summary bar does not. Column WEIGHTS are never set here; each grid that uses `.fc-row` supplies its own modifier class for those (`.insured-fields .fc-row--3`/`--4`, `.cov-row-all`/`.cov-ins-row`, below). Not in `inforce.css`. |
| `.insured-fields` / `.fc-row--7` | **Optimizer-only.** Insured Input's single-row field layout: the wrapper, and that one row's 7 column weights (see "Layout" in §2) — the row/cell shell itself is `.fc-row`/`.fc` above. Not in `inforce.css`. |
| `.switch` | **Optimizer-only.** The Multi-Coverage Discount on/off toggle: a pill-shaped `<button role="switch">` whose own text is its state ("ON"/"OFF"). `[aria-checked="true"]` fills it with `--accent`. No thumb, no animation. Not in `inforce.css`. |
| `.coverage-card` / `.coverage-head` / `.coverage-no` / `.coverage-title` | **Optimizer-only** (§2b). A coverage's own sub-container in Coverage Input — visually identical to `.insured-card`'s own four classes (same `--ins-border`/`--ins-band` pair) but kept as separate rules/names since a coverage nests a level deeper than an insured does. Not in `inforce.css`. |
| `.cov-row-all` | **Optimizer-only** (§2b). Column weights for Coverage Input's single 6-cell field row, plus its own tighter cell padding and smaller control font (both scoped to this row only) — the row/cell shell is `.fc-row`/`.fc` above. Not in `inforce.css`. |
| `.cov-insured-wrap` / `.cov-insured-head` | **Optimizer-only** (§2b). The insured-slot list's own inset area (tinted `--accent-soft`, bordered `--accent-line` — the "hard to tell apart" fix) and its "Insured(s) — N of M" header strip. No band of its own — a third colour band, after the outer card and the coverage head, would be one hierarchy level too many. Not in `inforce.css`. |
| `.cov-ins-slot` / `.cov-ins-slot-head` / `.cov-ins-row` | **Optimizer-only** (§2b). One insured slot: its `--accent-line`-bordered box, the strip holding its Remove button, and the column weights for its single Insured/Sex/Age/Rate/Extra-Premium row. Not in `inforce.css`. |
| `.cov-extra-mini` / `.cov-extra-f` / `.cov-extra-f-k` | **Optimizer-only** (§2b). Extra Premium's 4 sub-fields, nested inside their own one `.fc` cell on the insured slot's row rather than a separate row of their own: the mini flex row holding them, one sub-field (label over input, both centred), and its shortened label (Perm %/Perm $/Term $/Term $ Dur.; the full name is each sub-field's `title`). A locked sub-field (the Permanent $ / Temporary $ mutual exclusion) reuses `.fi--ro`, not a class of its own. Not in `inforce.css`. |
| `.results-cov-wrap` | **Optimizer-only** (§2c). The wrapper around Results' per-coverage table — `overflow-x: auto` as a safety net (not `.ins-wrap`'s own `overflow: hidden`, which clips for its own rounded corners), though the real "fits without scrolling" mechanism is the fixed layout + wrapping header/cell text scoped underneath it (`.results-cov-wrap .ins …`, out-specifying `.ins thead th`/`.ins tbody td` on purpose — that pair is shared with `inforce.css` and must stay untouched). The table itself still reuses `.ins`'s header-band/row-divider styling directly. Not in `inforce.css`. |
| `.table-scroll-wrap` | **Optimizer-only** (§2d/§2e). The scrolling wrapper any split-off tab's own wide table uses — `overflow-x: auto`, and — unlike `.results-cov-wrap` — no fixed-layout override, since these tables are explicitly allowed to scroll. Shared between Coverages, Insureds, History (§2h) and Rates' own scrollable insured region (§2f); lives in `optimizer.css` itself, not any one tab's own stylesheet, since all of them need the identical rule. Not in `inforce.css`. |
| `.cell-pending` | **Optimizer-only** (§2d/§2e). The "no formula yet" cell highlight (`--warn-soft`/`--warn`, reused tokens, not new ones) — built by `core.pendingCell()`, shared the same way `.table-scroll-wrap` is; also reused directly on a `<th>` by Backdate Projection's own table (§2g), since `core.pendingCell()` itself only ever builds a `<td>`. Not in `inforce.css`. |
| `.col-hard-sep` | **Optimizer-only** (§2e). A vertical divider between column GROUPS in one of these wide tables — `.ins` itself only ever separates rows. Introduced for Insureds' two "hard separator" boundaries; reused as-is by Rates' own Total/BD_Total/BD_Final boundaries (§2f). Not in `inforce.css`. |
| `.col-soft-sep` | **Optimizer-only** (§2f) — `optimizer_rates.css`, not `optimizer.css` (like `.cov-tab-table` below, this table's one exception). A LIGHTER version of `.col-hard-sep` (`--line-strong`, 1px, vs. `--ins-border` at 2px) — marks where one INSURED's 4-column group ends and the next begins in Rates' own scrollable region, a weaker boundary than a group-of-groups separator deserves. Not in `inforce.css`. |
| `.cov-tab-table` | **Optimizer-only** (§2d) — defined in `optimizer_coverages.css`, not `optimizer.css` (one of two entries in this table that isn't, alongside `.col-soft-sep` above): just `.fi { width: 84px; }`, narrower than the base 92px so Unit Value's input sits comfortably in this table's dense cells. |
| `.hist-tab-table` | **Optimizer-only** (§2h) — reserved hook in `optimizer_history.css`, same convention as `.ins-tab-table`/`.cov-tab-table`, no rule yet. Not in `inforce.css`. |
| `.rate-import-bar` / `.rate-status` (`--warn`/`--err`) | **Optimizer-only** (§2f). Rates' own import controls row, and the persistent two-line "what's loaded" summary beneath it (colour modifiers reuse `--warn`/`--neg`, no new tokens). Not in `inforce.css`. |
| `.rate-progress` / `.rate-progress-label` / `.rate-progress-bar` | **Optimizer-only** (§2f). The chunked-import loading bar — a label plus a native `<progress>` themed via `accent-color: var(--accent)`, no custom track/fill markup needed. Hidden outside an active import. Not in `inforce.css`. |
| `.rate-body` / `.rate-scroll` / `.rate-fixed` / `.rate-tab-table` | **Optimizer-only** (§2f). One coverage's rate card split into two independent table regions sharing one row axis: the flex row itself, the scrollable per-insured side (`.table-scroll-wrap`, above), the side that never scrolls, and the table-width override (`width: auto; min-width: 100%`) that lets `.rate-scroll`'s overflow actually trigger — `.ins`'s own shared `width: 100%` rule would otherwise cap the table at its container and silently prevent scrolling. Not in `inforce.css`. |
| `.bd-band-figs` / `.bd-band-fig` (`--warn`) | **Optimizer-only** (§2g). A "micro label over a value" pair embedded IN a `card-head--band`, for Backdate's Illustration Date/Max. Backdate Date/Final Backdate Date (and Backdate Projection's Monthly/Annual Savings Date). Deliberately NOT `.chip` — `.card-head--band .chip:not(.chip--edit)` (optimizer.css) force-inverts a chip's colours inside a band, which would swallow the `--warn` amber the `--warn` modifier needs; a new class sidesteps that collision instead of touching the shared rule. Not in `inforce.css`. |
| `.proj-slot` | dashed empty placeholder with `.t` title and `.s` subtitle — what the one remaining scaffold tab (Eq. Age / Substd Prem.) shows today, and what every live tab's own empty-state falls back to |
| `.btn` | `--primary`, `--danger`, `--icon`, `--sm` modifiers |
| `.chip` | pill; `--warn`, `--edit` modifiers |
| `.toast` | bottom-right transient message; add `.show`, optional `.toast--err` |
| `.micro` | 9.5px uppercase letterspaced label |
| `.mono` / `.num` / `.muted` | monospace / tabular figures / muted |
| `.pane` | a tab panel; hidden via the `hidden` attribute |

`font-variant-numeric: tabular-nums` is applied to `.num`, `table`, `input`,
`select` and `.mono`. Keep it — figures must line up column by column.

---

## 6. DOM contracts

### Element IDs

| Region | IDs |
|---|---|
| Tool switcher | `brandBlock`, `toolSelect`, `toolMenu` |
| Top bar | `btnTheme`; `tcName`, `tcUser`, `btnSaveTest` (Save Test, §2h — static markup, wired by `optimizer_history.js`) |
| Tabs | `tabList`, `hdrStamp` (empty; reserved for an "as of" stamp) |
| Panes | `panes` (host), then one per tab: `optInput`, `optCoverages`, `optInsureds`, `optRates`, `optBackdate`, `optEqAge`, `optHistory` |
| Settings panel | `settingsPanelHost` (`optInput`, standalone, full width — no longer a split-side) |
| Insured Input | `insuredInputHost` (`optInput`'s one `.split-main`, 1st of its two stacked children), `insuredList`, `insCount`, `btnAddInsured` |
| Coverage Input | `coverageInputHost` (`optInput`'s one `.split-main`, 2nd of its two stacked children), `coverageList`, `covCount`, `btnAddCoverage`. (Inforce's own `coverageList`/`policyCol` ids, referenced below, belong to `inforce.js` on the sibling page — same name, unrelated element, no collision since they're different documents.) |
| Results | `resultsHost` (`optInput`'s one `.split-side`), `resultsCoverageWrap` (subcontainer 1), `resultsSummaryWrap` (subcontainer 2) |
| Coverages tab | `coveragesTabHost` (`optCoverages`'s whole pane, §2d), `covTabBody`, `covTabCount` — all in `optimizer_coverages.js`, not `optimizer.js` |
| Insureds tab | `insuredsTabHost` (`optInsureds`'s whole pane, §2e), `insTabBody`, `insTabCount` — all in `optimizer_insureds.js` |
| Rates tab | `ratesTabHost` (`optRates`'s whole pane, §2f), `ratesFileInput`, `btnImportRates`, `btnLoadDefaultRates`, `rateProgress`/`rateProgressLabel`/`rateProgressBar`, `ratesStatus`, `ratesCoverageList` — all in `optimizer_rates.js` |
| Backdate tab | `backdateTabHost` (`optBackdate`'s whole pane, §2g) — container 1: `bdInsBody`, `bdInsCount`, `bdIllustrationDate`, `bdMaxBackdateDate` — container 2: `bdProjBody` — all in `optimizer_backdate.js` |
| History tab | `historyTabHost` (`optHistory`'s whole pane, §2h), `historyTabBody`, `historyTabCount`, `btnImportTestCase`, `historyImportFile` — all in `optimizer_history.js` |
| Status bar | `stDot`, `stText`, `stTab` |
| Toast | `toast` |

### `data-fk` — field key grammars

Every editable control carries `data-fk`, in one of two grammars depending on
scope:

| Scope | Grammar | Example | Resolved by |
|---|---|---|---|
| Insured (per-record) | `ins\|<insuredId>\|<fieldKey>` | `ins\|ins3\|birthdate` | `resolveIns(fk)` |
| Settings (page-level, no id) | `set\|<fieldKey>` | `set\|refDate` | inline in `settingsCommit`/`settingsLive` (splits on `\|`, checks `p[0] === 'set'`) |
| Coverage (per-record) | `cov\|<coverageId>\|<fieldKey>` | `cov\|cov2\|category` | `resolveCov(fk)` (§2b) |
| Insured slot (per-coverage, per-slot) | `covins\|<coverageId>~<slotId>\|<fieldKey>` | `covins\|cov2~ci4\|extraPct` | `resolveCov(fk)` — same function, `~`-joined id pair distinguishes the two grammars, same idiom as Inforce's own `ins\|<coverageId>~<insuredId>\|<fieldKey>` (`INFORCE_REFERENCE.md` §10) |
| Coverages tab — Unit Value (per-coverage) | `covtab\|<coverageId>\|unitValue` | `covtab\|cov2\|unitValue` | `covTabCommit(e)` in `optimizer_coverages.js` — its OWN grammar/resolver, not `resolveCov`; a different file, a different delegated-listener scope, no actual collision risk, but kept distinct anyway (§2d) |

The insured grammar is a three-part simplification of Inforce's own `ins|`
grammar (`INFORCE_REFERENCE.md` §10), which additionally encodes a parent
coverage — not needed here since an insured has no parent on this page. The
settings grammar has no id segment at all: there is exactly one `refDate` and
one `freq`, never a repeating list, so there is nothing to disambiguate.

The Multi-Coverage Discount switch carries **`data-act="toggle-mcd"`, not
`data-fk`** — it is a click-toggled boolean, not a validated text/enum field,
so it does not go through `resolveIns`/`settingsCommit` at all; its handler
lives inline in `initSettingsPanel()`. **`data-act` is the general pattern
for any click-triggered action that isn't a committed field** — Backdate
Projection's own Show Projection switch (§2g) carries `data-act=
"toggle-bdproj"`, and History's per-row Load/Delete buttons (§2h) carry
`data-act="load-tc"`/`"del-tc"` plus `data-id="<catalog entry id>"`, each
resolved by that tab's own delegated click handler, never `resolveIns`/
`resolveCov`. Rates (§2f) has no `data-fk` OR `data-act` at all yet —
nothing on it is editable or click-triggered until the Axis Key/lookup
wiring lands.

### Event wiring

| Target | Event | Handler |
|---|---|---|
| `#toolSelect` | `click` | toggle the switcher menu |
| `#toolMenu` | `click` | `selectTool` — navigate or close |
| `document` | `click` | close the menu when clicking outside `#brandBlock` |
| `document` | `keydown` | Escape closes the menu; Enter on a `data-fk` element blurs it (commits) |
| `document` | `focusin` | select-all on a focused `data-fk` `<input>` |
| `#tabList` | `click` | `showTab` delegation |
| `#btnTheme` | `click` | `toggleTheme` — flips and persists |
| `#insuredList` | `change` | `insCommit` — validate and write |
| `#insuredList` | `input` | `insLive` — toggle `.fi--bad` only, no write |
| `#insuredList` | `click` | Remove (`data-act="rmins"`) delegation |
| `#btnAddInsured` | `click` | append a new insured record and re-render |
| `#settingsPanelHost` | `change` | `settingsCommit` — validate, write, echo canonical value |
| `#settingsPanelHost` | `input` | `settingsLive` — toggle `.fi--bad` only, no write |
| `#settingsPanelHost` | `click` | Multi-Coverage Discount toggle (`data-act="toggle-mcd"`) delegation |
| `#coverageList` | `change` | `covCommit` — validate, write, and every cascade (§2b) |
| `#coverageList` | `input` | `covLive` — toggle `.fi--bad` only, no write; skips enum fields and the bespoke `insuredId`/`rate` controls, which are always valid by construction |
| `#coverageList` | `click` | Remove coverage (`data-act="rmcov"`), Add/Remove insured slot (`data-act="addcovins"`/`"rmcovins"`) delegation |
| `#btnAddCoverage` | `click` | append a new coverage record and re-render |
| `#ratesTabHost` | `click` | Import Rates File trigger, Load from `rates/` trigger (§2f) — no `data-fk`/`data-act` yet, matched by element `id` directly |
| `#ratesFileInput` | `change` | reads the picked file, routes it through `detectAndIngest` |
| `#backdateTabHost` | `click` | Show Projection toggle (`data-act="toggle-bdproj"`) delegation (§2g) |
| `#historyTabHost` | `click` | Load/Delete (`data-act="load-tc"`/`"del-tc"`) delegation, Import Test Case trigger (§2h) |
| `#historyImportFile` | `change` | reads the picked `.json` file, adds it to the catalog |
| `#btnSaveTest` | `click` | `doSaveTest()` (§2h) — lives in `optimizer_history.js` though the button itself is in the static top bar, not a tab pane |
| `#tcName` | `keydown` | Enter triggers `doSaveTest()`, same as blurring a `data-fk` field commits elsewhere |

`#insuredList`, `#settingsPanelHost`, `#coverageList`, `#ratesTabHost`,
`#backdateTabHost` and `#historyTabHost` are all the pattern to copy for any
further editable region: event delegation on a stable ancestor, as
`inforce.js` does on `#coverageList` / `#policyCol` — the panes are
regenerated by `innerHTML`, so per-element listeners would be lost.

### Helpers already present

| Function | Purpose |
|---|---|
| `$(id)` | `document.getElementById` |
| `esc(v)` | HTML-escape a value before concatenating it into markup. **Use it on every value.** |
| `toast(msg, kind)` | transient message; `kind` is `'err'` or omitted |
| `slot(title)` | an empty banded container |
| `resultsBar(fields)` | the Results strip for `optInput`; one `.rs` cell per entry in `fields` |
| `showTab(id)` | switch panes |
| `parseDate`, `fmtDate`, `buildDate`, `todayStr` | date parsing — ported from `inforce.js` |
| `agesAt` | the exact stepwise age algorithm — **not** ported from `inforce.js`; see "Insured Input" in §2 for the full procedure |
| `validateIns`, `insControl`, `resolveIns` | the scoped validated-field system behind Insured Input |
| `validateSettings`, `settingsControl` | the equivalent pair for Settings — see §2a |
| `toNum`, `group`, `decimals` | ported from `inforce.js` for Coverage Input's money/percentage fields — see §2b, §8 |
| `validateCov`, `covControl`, `resolveCov` | the equivalent trio for Coverage Input, generalised over option lists that can depend on the record — see §2b |

---

## 7. Render model — what to preserve when you build views

The scaffold renders by **full `innerHTML` replacement** into `#panes`. When
you add real content, keep these properties of the Inforce page, which were
hard-won:

- **Generate markup as strings and set `innerHTML`.** No DOM diffing, no
  virtual DOM. Escape every value with `esc()`.
- **Delegate events** on a stable ancestor (`#panes`), never on generated
  elements.
- **If a model write happens inside a `change` handler, defer the re-render
  by one tick.** `change` fires *before* focus reaches the next control;
  rendering synchronously captures `document.body` as the active element,
  drops focus, and breaks Tab after every edit. `inforce.js` has
  `deferRender()` for exactly this — port it along with `render()`'s
  focus/selection carry-over.
- **Read-only fields keep their box** (`.fi--ro`, `readonly`, `tabindex="-1"`,
  no `data-fk`) so Tab runs straight between editable fields and nothing
  inert can be committed.
- **Numbers keep thousands separators inside inputs.** The job is comparing
  figures by eye; `250000` does not read against `250,000`.

All five of these are demonstrated end-to-end in Insured Input
(`insCommit`/`insLive`/`renderInsuredList`/`deferRenderInsureds` in §2) —
confirmed by driving it with real keystrokes: Tab through Name → Sex →
Birthdate → Age Calculation with values committing at each step, focus never
dropping to `<body>`. Use it as the worked example when you build the next
editable region — Coverage Input (§2b) is the same five properties one level
deeper (a repeating list inside a repeating list), including a case §2's
version doesn't hit: a `change` handler that also has to fix up sibling state
(`enforceInsuredCap`, `syncCoverageInsuredRefs`) beyond the one field that
fired it, still inside the same deferred re-render.

**Rates (§2f) adds a sixth property these five didn't anticipate: a render
that legitimately spans MULTIPLE ticks, not just one deferred one.**
Importing a rate workbook chunks its own row-processing loop
(`processRowsChunked`, `setTimeout(…, 0)` between batches) so the page can
repaint a real progress bar and stay responsive while a large import runs —
still full `innerHTML` replacement each time a chunk updates the status
line, still delegated events, just spread across more than the usual one
extra tick. This is additive, not a violation of "defer by one tick" above:
ordinary field commits (everything else on the page) still defer by
exactly one tick; only an explicitly chunked, progress-bar-driving import
loop should ever take more than that.

---

## 8. What to port from `inforce.js`, and when

The Inforce Tool was written so its pieces lift cleanly. Copy them; do not
rewrite them. Each is documented in the named section of
`INFORCE_REFERENCE.md`.

| Need | Port these from `inforce.js` | Reference |
|---|---|---|
| Validated input boxes | `validate`, `show`, `raw`, `control`, `fieldRow`, plus the descriptor pattern (`{ k, l, t, lock, min, max, ... }`) | §7, §8 |
| Dates in `DD-MMM-YYYY` with flexible entry | `MONTHS`, `DATE_FORMATS`, `buildDate`, `parseDate`, `fmtDate` | §8 "Dates" |
| Real and nearest ages | **Do not port Inforce's `agesAt`.** It uses a different (midpoint) heuristic; this page's own `agesAt` (§2) implements the exact stepwise algorithm this tool is required to match, and is already present in `optimizer.js` — reuse it directly. | § "Insured Input" above |
| Grouped number display / parsing | `group`, `toNum`, `decimals` — already ported into `optimizer.js` and in live use by Coverage Input's money/percentage fields (§2b) | §8 |
| Baseline vs working copy with a change log | `state`, `same`, `diff`, `changeLog` | §9 |
| Focus-safe re-rendering | `deferRender`, `render` | §9 |
| The coverage / insured data model | `COVERAGE_FIELDS`, `POLICY_FIELDS`, `INSURED_FIELDS` and the `_id` / `_removed` / `_new` conventions | §6, §7 |

**Resolved: the Optimizer works purely from manual input — it does NOT
import a policy extract.** The tab names (*Coverages*, *Insureds*, *Rates*,
*Backdate*, *Eq. Age / Substd Prem.*) and the *Coverage Input*/*Insured
Input* container titles were genuinely ambiguous on this point when the page
was still mostly scaffold; asked rather than assumed, and confirmed:
**insurance rates are the only thing this page ever imports** (§2f). Every
other input — Settings, every insured, every coverage — is typed in by the
operator; there is no `state`/`same`/`diff`/`changeLog` baseline-vs-working
model on this page at all (that's an Inforce concept, for reconciling
against an imported extract, and doesn't apply here), and never port
`parseWorkbook`/`ingest`/`FIXTURE` for the Rates import — they turned out to
be mocked/stubbed in `inforce.js` itself (no real `.xlsx` reader ever
existed to port), which is exactly why Rates vendors `xlsx.full.min.js`
(SheetJS, §0 rule 1, §2f) instead: a real workbook reader, not
`inforce.js`'s stand-in for one.

---

## 9. Invariants — do not break these

1. No dependencies, no build step; `optimizer.html` opens from disk.
2. Semantic colours (`--edit`, `--neg`, `--warn`, `--pos`) stay identical to
   `inforce.css`.
3. Shared component rules stay identical to `inforce.css`. New Optimizer-only
   rules are fine; edits to shared ones must be mirrored.
4. Blank stays blank — never substitute a default value. If you port `group()`,
   keep its guard: `Number('') === 0` and `isFinite('') === true` would
   otherwise render an empty field as a real `0`.
5. Model mutations inside a `change` handler defer the re-render.
6. Every value concatenated into markup goes through `esc()`.
7. The `TOOLS` table matches `inforce.js` exactly.
8. Insured Input never drops below one insured — the last Remove button stays
   `disabled`.
9. An insured's Remove is always a hard delete (`insureds.filter(...)`).
   There is no baseline on this page to soft-withdraw against, so no
   restore/undo is expected here the way Inforce offers one for an imported
   life.
10. A birthdate that would put Age Real or Age Calculated outside 0–120 is
    rejected at commit (against the *current* reference date), not clamped or
    silently accepted.
11. `agesAt` implements the exact stepwise algorithm specified for this tool
    (§ "Insured Input"), not the "actual midpoint" heuristic `inforce.js`
    uses for its own, differently-scoped age math. Do not merge the two or
    "simplify" this one back toward Inforce's — reproduce the two hand-traced
    cases in §11 before trusting any change here.
12. Every insured's ages are measured against `settings.refDate`, a single
    page-level value — never a per-insured or hardcoded `todayStr()`.
    Changing it recomputes every insured card.
13. `.fc-row--7`'s column weights are already at their measured width limit
    (margins as thin as ~11px on Rate at 1250px, per §2 and §11) for the
    longest realistic value in every cell at once — a 30-character Name in
    particular. Re-run that same measurement before changing these weights,
    Insured Input's own font-size, or its padding.
14. Insured Input and Coverage Input match widths because they're two
    stacked `<div>`s inside the SAME `.split-main` (§2's diagram) — one
    `.split`, not two side by side. Don't split them back into separate
    `.split` blocks without a reason; that reintroduces the "two blocks
    happen to land at the same width" alignment work the single-`.split`
    structure exists to avoid.
15. Settings (§2a) is built from a Results-style bar's own markup —
    `.resultbar`/`.resultbar-tag`/`.rs`/`.rs-k` — not a card of its own, but
    it no longer needs to match another container's height: it stands alone,
    full width, with nothing paired beside it any more. Don't reintroduce a
    height-pin for it without first checking whether it's actually pinned to
    anything again.
16. Coverage Input never drops below one coverage, and a coverage never
    drops below one insured slot — both Remove buttons stay `disabled` at
    their floor, the same pattern as Insured Input's own floor of one.
17. `recalcFees()` is idempotent and runs at the top of every
    `renderCoverageList()` — never called selectively "only when something
    relevant changed." Its result must depend only on the current
    `coverages` array (category, coverage, `feeManual`), never on history —
    removing and re-adding an identical Term Life coverage must reproduce
    the same fee assignment as if it had never been removed.
18. `maxInsuredsFor(covType)` — 1 for Individual or unset, 5 for Joint
    First-to-Die, 2 for either Joint Last-to-Die variant (§2b's table) — is
    the only thing that may ever truncate a coverage's insured-slot list, and
    every path that can change `covType` — a direct edit, or a
    Category/Coverage change that resets it — must call
    `enforceInsuredCap(rec)` afterward. An over-the-cap coverage should never
    be reachable, even transiently across a render.
19. An insured can be referenced by any number of *different* coverages'
    slots, but never by two slots on the *same* coverage — `insuredRefOptions`
    enforces this by excluding sibling slots' choices, not by rejecting a
    commit after the fact.
20. `syncCoverageInsuredRefs()` runs on every insured-list change (inside
    `renderInsuredList()`, unconditionally) — a coverage slot must never be
    left pointing at an insured `_id` that no longer exists in `insureds`,
    **and its `rate` must always be one of that slot's own currently-valid
    options, or blank** (§2b). The second half exists because the option set
    depends on the referenced insured's `pref`/`reg`, edited in a container
    `covCommit` never sees.
21. `.cov-row-all`'s 6 columns are already at their measured width limit
    (single-digit-pixel margin on the tightest cell at 1250px, per §2b and
    §11) — don't add a 7th field to that row, or shrink its weights/padding/
    font further, without re-running that exact measurement. This is a
    deliberate, verified trade-off of a compaction request, not slack.
22. Dense-grid dividers and labels (`.fc-row`/`.fc`/`.fc .rs-k`) use `--ink-4`
    /`--ink-2` — reused existing tokens, chosen specifically for more
    contrast than the shared `--line-strong`/`--ink-3` other borders and
    labels on the page use. Don't fold these back to `--line-strong`/`--ink-3`
    "for consistency" — the whole point was that those read as too faint in
    a dense grid.
23. A slot's Permanent $ and Temporary $ (amount or duration) can never both
    hold a *non-zero* value at once — whichever side is non-zero locks the
    other (`.fi--ro`, no `data-fk`), recomputed fresh on every render from
    the slot's own current values, never a one-time action to undo.
    `isFilledCov` must keep treating `0` as unfilled — all four Extra
    Premium fields default to `0`, so counting `0` as "filled" would lock a
    brand-new slot's Permanent $ and Temporary $ against each other
    permanently, with neither ever enterable. Permanent % is not part of
    this pair and must never lock.
24. Settings' two `*Dur.` fields and Coverage Input's `extraTempYears` all
    have a stated default (`0`) outside their own stated range (`1`-`999`)
    — `min` is relaxed to `0` on all three for exactly this reason (§2a,
    §2b). Don't "fix" this back to `min: 1` without also changing the
    default; either alone breaks (a field whose own default fails its own
    validation, or a default that no longer means "not set").
25. `window.OptimizerCore` (§2d) is READ-ONLY from outside `optimizer.js` —
    no split-off tab file may write `coverages`/`settings` through it,
    directly or otherwise. Every mutation of shared state stays inside
    `optimizer.js`'s own commit handlers; a split-off file adds its own NEW
    state instead (Unit Value is the template) and reads shared state only.
26. A split-off tab file's own per-coverage (or per-insured) local state —
    Unit Value today — must stay in sync with the shared list it's keyed
    against: a default entry for anything new, and its own entry removed
    for anything gone, on every `OptimizerCore.onChange` firing. An entry
    surviving after its coverage is removed (or missing after one is added)
    is the bug to watch for — `syncUnitValues()` exists specifically to
    prevent it.
27. The Insureds tab's row set (§2e) is derived ENTIRELY from `coverages`
    (each coverage's own `insureds` slots) — never cached, never a separate
    list this tab maintains itself. A slot's `insuredId` going blank (the
    operator clears it, or `syncCoverageInsuredRefs` clears it because that
    insured was removed, §2b) must make its row disappear on the very next
    render, not linger with stale data.
28. `COVERAGE_ABBR`/`COVTYPE_ABBR`/`pendingCell` live on `OptimizerCore`
    (§2d), not inside either tab file — Coverages and Insureds must resolve
    to the exact same map/function, never two independently-maintained
    copies that could drift apart.
29. **Any `<select>` whose stored value can legitimately be blank needs a
    blank `<option>` to point at** — the Insured dropdown and the Rate
    dropdown both have one (§2b). Without it, the browser displays the first
    REAL option while the record holds blank, and selecting that displayed
    option fires no `change` event at all, so it can never commit. Both of
    Rate's historical bugs were this. Never "fix" such a mismatch by
    defaulting the record to the first option instead: that invents a value
    (§0 rule 6) — and for Rate specifically it would invent an underwriting
    rate class, in a tool built to reconcile premiums against another
    platform.
30. **`OptimizerCore.restoreState` is the ONLY write path through the
    bridge, and History (§2h) is the ONLY file that may call it.** Every
    other split-off tab stays strictly read-only (§0 rule 4, §2d) — a future
    tab needing to mutate `coverages`/`settings`/`insureds` is a sign it
    belongs inside `optimizer.js` itself (like Coverage Input/Insured
    Input/Settings/Results already do), not a reason to add a second write
    path to the bridge.
31. **Reference Date (Settings) and Midpoint (Backdate, §2g) clamp a day of
    29/30/31 to 28 by the same rule, in two separate places** —
    `validateSettings`'s `'date'` branch (`optimizer.js`) and
    `midpointDate()` (`optimizer_backdate.js`). They must stay in sync; a
    fix to one without the other reintroduces the inconsistency both were
    added to prevent.
32. **Term Life rate parsing keeps every Duration 1–100, not just 1**
    (§2f) — don't "simplify" this back to a Duration-1-only filter for
    performance or tidiness; the request explicitly asked for the whole
    workbook up front specifically so a later duration-aware feature never
    needs a re-import. `lookupTermLifeRate`'s `duration` parameter
    defaulting to 1 is what keeps today's only real caller-shape simple, not
    a sign the other 99 durations are disposable.
33. **`axisKeyPrefix` (§2d, §2e) never guesses at a value the format didn't
    specify** — `WL to 100`/`Term to 100` (`VEG100`/`T100`, 6 and 4
    characters) don't fit Permanent Life's stated 5-character Coverage
    slot, and stay `null` (→ the standard pending cell) rather than being
    truncated or padded to fit. Don't "fix" this by force-truncating; get
    the real 5-character code for those two products and add it to
    `COVERAGE_ABBR` instead, the same way every other product's code is
    already there.
34. **History's Load order is restoreState() THEN setSnapshot('unitValues',
    …), never the other way round** (§2h) — Unit Value's own `set` callback
    re-syncs against whatever `coverages` currently holds, so it has to run
    after `coverages` already reflects the loaded snapshot, or it discards
    the just-restored values as stale.
35. **Rates' own imported-file cache (`coverage-optimizer-rates`,
    `localStorage`) is deliberately separate from a saved History test case
    (`coverage-optimizer-testcases`)** (§2f, §2h) — a rate workbook is
    shared reference data the tool operates against, not a scenario input
    one specific test case owns. Don't fold rate-file state into
    `snapshotState()`/`restoreState()`; a loaded test case should always
    re-resolve against whatever rates happen to be loaded at the time.
36. **Only one rate-file import runs at a time; concurrent requests queue,
    they never run simultaneously** (`importQueue`, §2f) — "Load from
    `rates/`" fires off Term Life and Permanent Life together on purpose,
    and `restorePersistedRates()` does the same on every page load. The
    progress bar and the import buttons' disabled state both assume exactly
    one job in flight; running two at once would have them fight over both.
37. **Backdate Projection's `showProjection` is local, in-memory UI state,
    never persisted and never part of a saved test case** (§2g) — it's a
    display preference (is the table expanded right now), not an input that
    produces outputs, unlike everything `snapshotState()` captures.
38. **Confirm Backdate / Backdate Date's short-circuit is load-bearing, not
    an approximation** (§2g): `AND(FALSE; anything)` is `FALSE` regardless
    of what's missing, so a non-eligible insured shows a real, resolved
    `FALSE`/blank (plain text/muted `—`) — only an ELIGIBLE insured is
    genuinely blocked on Rate Current/Rate Backdated (amber pending). Don't
    collapse this back to "both columns are just pending until Rates
    exists" — that would throw away a distinction the two columns' own
    formulas already make for free.
39. **Backdate and Rates stay deliberately unwired to each other for now**
    (§2f, §2g) — Rates' totals do not feed Backdate's Rate Current/Rate
    Backdated columns, and Backdate's Confirm Backdate does not feed
    anything in Rates' own BD_Final. This was an explicit decision, not an
    oversight; don't "helpfully" connect them without being asked again —
    the exact formulas for both sides of that connection are still to come.

---

## 10. Extension recipes

**Add a tab** — one entry in `TABS`. The button and pane generate. Add
`split: ['Left', 'Right']` for the 2/3 + 1/3 layout.

**Fill a tab** — replace the `slot(title)` call for that tab in `buildPanes()`
with real markup built from the classes in §5. Keep the
`<section class="pane" id="…" hidden>` wrapper; `showTab` depends on it.
Insured Input (§2) is the worked example for a host living inside
`optimizer.js` itself; **for a whole TAB, Rates/Backdate/History (§2f–§2h)
are the current worked examples** — buildPanes() swaps `slot()` for one
empty host `id`, and that tab's own file/IIFE renders the live content into
it once panes exist and wires its own delegated listener(s), reading shared
state through `window.OptimizerCore` only (§2d) — **`optEqAge` is the one
tab still waiting for this treatment.**

**Add a split-off tab that needs to WRITE shared state, not just read it**
— don't. Extend the read-only bridge with another write path only with the
same justification `restoreState` had (§2d, §9 invariant #30): a bulk
overwrite of `coverages`/`settings`/`insureds` that only `optimizer.js` can
safely perform. Everything else — a tab's own local state (Unit Value,
`showProjection`, the imported-rates cache) — goes through
`registerSnapshot`/`getSnapshot`/`setSnapshot` (§2d) or just stays private
to that file, never a second general write path.

**Add a rate category to Rates (§2f)** — Permanent Life is the template for
adding a THIRD, after Term Life: one entry in `BAND_TABLES` (the fixed band
list), a new `ingest<Category>Workbook`/`lookup<Category>Rate` pair
following the same chunked-parsing shape (`processRowsChunked`), and a
branch in `detectAndIngest`'s sheet-name sniffing. `coverageRatesCard`
already generalises over `BAND_TABLES[c.category]` — no UI change needed
once the category has a band table and a real parser behind it.

**Add a settings field** — one entry in `SETTINGS_FIELDS` (date/enum/money/
int/pct — all five generalise already) plus one `settingsCell(f)` call in
`settingsPanelShell()`, in the position matching where it belongs in the
bar's specified order. A boolean needs its own `switchControl()`-style
button and `data-act`, not a `SETTINGS_FIELDS` entry — `mcd` is the
template. If the new field should feed a calculation, add the trigger inside
`settingsCommit`'s `if (f.k === '…')` branch, the same way `refDate` calls
`deferRenderInsureds()`. If its stated default sits outside its own stated
range (like the 4 Prem. Adj. fields' two `*Dur.` members, §2a), relax `min`
to cover the default rather than leaving the field invalid on load.

**Add a coverage-level field** — one entry in `COV_FIELDS` plus one cell in
`coverageCard()`'s single `.cov-row-all` row; `covControl`/`validateCov`/
`covCommit` already generalise over enum/money/int/pct. The row is already at
its measured width limit (see "Coverage-level fields", above) — adding a 7th
cell means re-running that same fit check, not just eyeballing it; a second
row is the fallback if it doesn't fit. If the new field's option list depends
on the record (like `coverage`/`covType` already do), give it `optsFn(rec)`
instead of `opts`. If it should feed a cascade (reset a sibling field,
recompute the fee, re-check the insured cap), add the branch inside
`covCommit`'s `if (key === '…')` chain, the same way `category`'s branch does
several things at once.

**Add an insured-slot field** — if it's a small optional numeric one like the
existing four, the same recipe as a coverage-level field, but as one more
`covInsExtraMiniField` call inside `covExtraCell()` with its own short label;
otherwise it likely belongs in the Insured/Sex/Age/Rate cells of
`covInsuredSlot()`'s single row instead.

**Add a third tool** — a new `.html/.css/.js` triple (copy `optimizer.*` as
the starting point), and one entry added to the `TOOLS` table in **every**
page's script so all menus list it.

**Add an "as of" stamp** — write into `#hdrStamp`; the slot exists and is
styled.

---

## 11. Verification checklist

Every item below was confirmed against the running scaffold at the time this
file was written. After any change, confirm:

- [ ] `optimizer.html` loads from disk and from a server with no console errors.
- [ ] Six tabs render in the stated order; the first is selected on load.
- [ ] Clicking each tab shows exactly one pane and writes its label to the
      status bar.
- [ ] *Input & Results* renders as Settings full-width on top, then one
      `.split`: Insured Input stacked directly above Coverage Input in the
      `.split-main` (2/3), Results in the `.split-side` (1/3) — roughly 2:1
      at 1280px, stacked below 1240px.
- [ ] Insured Input's `.split-main` (the shared one, since it holds Coverage
      Input too) has `getBoundingClientRect().width` matching what a 2/3
      column should be at the current viewport; Results' `.split-side`
      matches the 1/3 complement.
- [ ] Results (§2c) appears only on `optInput`; its summary subcontainer's
      `.resultbar` scrolls within itself at 900px viewport width rather than
      causing the page to scroll horizontally.
- [ ] The coverage-table subcontainer needs NO horizontal scroll at 1250px
      (the narrowest pre-stack width) even with the single longest possible
      Coverage cell (a Critical Illness category + its longest Coverage
      name, ~86 characters) — confirm via `scrollWidth <= clientWidth` on
      `.results-cov-wrap`, not by eye; headers/cells should visibly wrap
      onto multiple lines instead.
- [ ] Confirm `.results-cov-wrap`'s column-width/wrap overrides did NOT
      change Inforce's own insured table (`.ins` on `inforce.html`) — that
      table should still be single-line/nowrap, since the override is scoped
      to `.results-cov-wrap .ins`, not `.ins` itself.
- [ ] Settings starts with Reference Date = today (`todayStr()`), Payment
      Frequency = Monthly, Multi-Coverage Discount = OFF, Prem. Adj. % =
      100, Prem. Adj. % Dur. = 0, Prem. Adj. $ = 0.00, Prem. Adj. $ Dur. = 0
      — in that exact order left to right.
- [ ] Entering a Reference Date in any of the four accepted formats
      normalises to `DD-MMM-YYYY` **in the input itself** (not just
      internally — this is the bug §2a documents) and immediately
      recomputes every insured's Age Real / Age Calculated. The same
      grouped-number echo works for the 4 Prem. Adj. fields (type
      `1234.5` into Prem. Adj. $, confirm it shows `1,234.50`, not `1234.5`).
- [ ] Clicking the Multi-Coverage Discount switch flips its text (ON/OFF)
      and `aria-checked` with no other side effect.
- [ ] Typing a value below 0 into either `*Dur.` Settings field is rejected;
      `0` itself is accepted (it's the stated default, outside the field's
      own stated 1-999 range — §2a explains why `min` is relaxed to 0).
- [ ] Insured Input starts with exactly one insured, named `Insured-1`, Sex
      `M`, Rate `Preferred / Non-smoker`, Birthdate blank, Age Calculation
      `Age Nearest`; both age cells show `—`. Its Remove button is disabled.
- [ ] The card lays out as ONE row of all 7 fields — Name / Sex / Rate /
      Birthdate / Age Calculation / Age Real / Age Calculated, in that order
      — never two stacked rows.
- [ ] The Age Calculated cell's **label** reads "Age Nearest" when Age
      Calculation is Age Nearest, and "Age Last" (not "Last Birthday") when
      it is Last Birthday — switch the dropdown and confirm the label
      updates, not just the value.
- [ ] Reproduce the two hand-traced cases against a fixed reference date of
      `01-JAN-2026`: birthdate `22-JUL-1974` → Real 51, Age Nearest 51;
      birthdate `15-MAR-1990` → Real 35, Age Nearest 36. Any change to
      `agesAt` that fails either of these is wrong, not just imprecise.
- [ ] At the column's narrowest realistic width (viewport just above 1240px,
      where the split stacks), with a 30-character Name entered, none of the
      7 cells clip — the two `<select>`s (Rate, Age Calculation) in
      particular, which can't ellipsis their closed value the way an
      overflowing text input can.
- [ ] Add Insured appends a card named from the lowest unused `Insured-N`
      (rename or remove one and add again — the freed number is reused).
- [ ] Entering a birthdate in any of the four accepted formats normalises to
      `DD-MMM-YYYY` and both age cells populate; switching Age Calculation to
      *Last Birthday* makes Age Calculated equal Age Real (and relabels
      itself "Age Last"); a birthdate more than 6 months past its last
      anniversary (per the step-4 test in `agesAt`, not a literal midpoint)
      makes *Age Nearest* one greater than Age Real.
- [ ] A birthdate implying an age outside 0–120, or a name over 30 characters,
      is rejected — the field marks `.fi--bad`, a toast appears, and the
      underlying record is unchanged (confirm by forcing a re-render, e.g. by
      editing a different field, and checking the rejected field reverted to
      its last valid value).
- [ ] Tab through a whole insured card by keyboard, typing a value into each
      field — focus must land on the next field each time, never on
      `<body>`, and every valid value must commit.
- [ ] With two or more insureds, Remove deletes the card outright — no
      strikethrough, no restore affordance, no log. Removing down to one
      re-disables that insured's Remove button.
- [ ] Coverage Input starts with exactly one coverage: Term Life / Term 10 /
      Individual / Fee $40.00 (the only Term Life coverage, so it trivially
      has "the highest duration") / Input Premium / amount blank. Its Remove
      button is disabled.
- [ ] Changing Coverage Category resets Coverage, Coverage Type, Coverage
      Fee, and every insured slot's Rate — never leaves a stale value from
      the old category showing.
- [ ] Add two more Term Life coverages, set durations so one is "Term to 65"
      — only that one shows Fee $40.00, the other two show $20.00. Remove
      the "Term to 65" one — Fee reassigns to whichever remaining coverage is
      highest-duration, automatically, without touching its own Fee field.
- [ ] Manually type a Fee on one coverage, then add/remove other coverages —
      that Fee never changes. Clear it back to blank — it returns to the
      auto-calculated default on the next render.
- [ ] Permanent Life coverages show Fee $40.00 regardless of which Coverage
      is selected; Critical Illness coverages (any of the three categories)
      show Coverage Type and Coverage Fee both as inert, blank, non-`<select>`
      placeholder boxes, not empty dropdowns.
- [ ] Set a coverage's Coverage Type to Joint First-to-Die (Term Life or
      Permanent Life, either), add insured slots up to 5 (the 6th Add
      attempt is blocked — the button disables at the cap, it does not
      accept a click and reject it). Switch to Joint Last-to-Die or Joint
      Last-to-Die, Paid-up 1st Death (Permanent Life only) — the slot list
      truncates to 2, not 5, with a toast explaining why; the Add button is
      already disabled at exactly 2. Switch back to Individual — truncates
      to 1.
- [ ] Two slots on the SAME coverage cannot select the same insured — once
      chosen in one slot, that insured is absent from every other slot's
      dropdown on that coverage; the same insured remains selectable on a
      *different* coverage.
- [ ] A slot's Sex and Age cells reflect the referenced insured live —
      editing that insured's Birthdate, Age Calculation, or Sex in Insured
      Input, or changing the page's Reference Date, updates the slot's cells
      without touching the coverage directly.
- [ ] Removing an insured that some coverage's slot references clears that
      slot back to unassigned (blank Insured, inert Rate box) — it does not
      leave the slot showing a removed insured's stale name.
- [ ] Rate's options match the table in §2b for both Term Life and any other
      category, for both `pref` and `reg` Insured Input Rate values — 6
      combinations, all four checked at least once.
- [ ] **A freshly-assigned insured's Rate shows `— Select —`, not `P1`** —
      and the record agrees. Read the record, don't trust the cell: a
      dropdown displaying a code the model doesn't hold is the exact bug the
      blank option exists to prevent (§2b). Then pick **P1** specifically
      (not P2/P3) and confirm it commits — picking the FIRST real option is
      the case that silently did nothing before.
- [ ] Picking `— Select —` on a Rate that already held a code clears it back
      to blank in the record, rather than snapping back on the next render.
- [ ] Flip an insured's own Rate (Preferred ↔ Regular) in Insured Input
      while it holds a committed Coverage Rate on one or more coverages:
      every stale code (`P1` for a smoker, `R1` for a non-smoker) must clear
      to blank, on every coverage referencing that insured, and slots
      referencing OTHER insureds must be left untouched. Verify in the
      record and on the Insureds tab (§2e), not just in the dropdown.
- [ ] With a Term Life + Joint First-to-Die coverage carrying 3 insureds,
      all three Rate cells behave independently — this is the configuration
      the "some stay blank" report came from.
- [ ] At the tightest realistic width (viewport just above 1240px), the
      longest option text in every Coverage Input dropdown — the longest
      Category, Coverage, and Coverage Type strings in particular, and both
      money fields at `999,999,999.99` — still fits inside its box; measure
      via `getBoundingClientRect()` against a text-width helper, not by eye.
      **This margin is now single-digit pixels on the tightest cell** (the
      six-fields-on-one-line compaction spent almost all the slack this row
      used to have) — re-run this exact check after any further change to
      `.cov-row-all`'s weights, padding, or font-size, don't just eyeball it.
- [ ] The insured slot's single Insured/Sex/Age/Rate/Extra-Premium row fits
      the longest realistic Insured name (30 characters, Insured Input's own
      cap) and both money sub-fields at `999,999,999.99` with margin to
      spare — this row had much more slack to begin with, so a smaller
      margin here would signal a real problem, not just an expected trade-off.
- [ ] The Insured Input subcontainer (`.cov-insured-wrap`) reads as visually
      distinct from the rest of its coverage card — the accent/blue tint and
      border, not just a line weight, should be what does this; the fix
      being tested for is "hard to tell apart," reported directly.
- [ ] A brand-new insured slot's 4 Extra Premium fields all show their
      stated defaults (Perm % `0`, Perm $ `0.00`, Term $ `0.00`, Term $
      Dur. `0`) and **none of them is disabled** — confirm this explicitly;
      it's the case the mutual-exclusion lock could break by treating `0`
      as "filled" (§2b).
- [ ] Entering a NON-ZERO value in Permanent $ disables (grayed `.fi--ro`,
      not just styled to look disabled) both Term $ and Term $ Dur. on that
      same slot; entering a non-zero value in EITHER Term $ or Term $ Dur.
      disables Permanent $. Setting whichever field is holding the lock back
      to `0` (not blank — blank is now rejected, §2b) releases the other
      side again. Permanent % is never affected either way.
- [ ] The Extra Premium cell's own heading is centred; its own labels'
      (Perm %/Perm $/Term $/Term $ Dur.) text size is visibly larger than
      before — check computed `font-size`, not just by eye — and none of
      the four labels or their inputs (worst case, `999,999,999.99`) clip
      at 1250px viewport width.
- [ ] Adding a coverage adds a matching row to Results' per-coverage table
      (§2c) with the same "N. Category — Coverage" title as that coverage's
      own card header; removing a coverage removes its row. Both happen on
      the SAME render as the add/remove, never a tick behind.
- [ ] The Coverages tab (§2d) renders all 16 columns in the specified order
      with no console error — confirms `window.OptimizerCore` loaded and
      `optimizer_coverages.js` ran before anything tried to read it.
- [ ] Changing Payment Frequency, any of the 4 Prem. Adj. fields, or the
      Multi-Coverage Discount toggle in Settings updates every row of the
      Coverages tab table on the SAME commit, without switching tabs first
      to "refresh" it.
- [ ] Coverage abbreviates correctly both ways: a Term Life/Permanent Life
      coverage shows its code (`Term 10` → `T10`, `WL to 65` → `VEG65`); a
      Critical Illness coverage (any of the three categories) shows its raw,
      unabbreviated name.
- [ ] Modal Factor reads `1.00` when Payment Frequency is Annually, `0.09`
      when Monthly — the literal stated values, not a computed `1/12`.
- [ ] Unit Value defaults to `1,000` for a newly-added coverage and keeps
      whatever the operator typed for an existing one across unrelated
      edits (change Settings, add a different coverage — the first
      coverage's Unit Value must not reset). A value below 1, above
      999,999,999, or non-integer is rejected.
- [ ] Removing a coverage removes its Unit Value entry too (no way to
      observe this directly, but re-adding a coverage afterward must show
      the `1,000` default, not a stale value from the removed one reused by
      `_id` coincidence — `newCoverageRecord()`'s `covSeq` counter never
      repeats an `_id`, so this should be structurally impossible; confirm
      it stays that way).
- [ ] Temp Extra Premium, Modal Prem., and Modal Prem. Backdated render with
      the amber/warn highlight, distinct from Coverage Fee's plain `—` when
      a coverage's fee is blank (a Critical Illness coverage with no fee
      typed in) — the two "nothing here" states must look different.
- [ ] The Coverages tab's own table needs a horizontal scrollbar at any
      realistic width (this one, unlike Results', is expected and fine) and
      the scrollbar actually scrolls the whole table, not just some columns.
- [ ] Confirm `inforce.html`/`inforce.css`/`inforce.js` show no diff — this
      tab's file split touches `optimizer.html`, `optimizer.js` (the
      `optCoverages` host + the public bridge), and the two new files only.
- [ ] The Insureds tab (§2e) reproduces the request's own worked example
      exactly: Coverage 1 → Insured 1 & 2, Coverage 2 → Insured 2, Coverage 3
      → Insured 2 & 3 produces rows `1_1`, `1_2`, `2_2`, `3_2`, `3_3`, in
      that order, no more and no fewer.
- [ ] All 22 columns render in the specified order, with a visible
      `.col-hard-sep` divider immediately before Joint Sex and again before
      Axis Key — check both the header row and at least one body row, not
      just the header.
- [ ] Insured Rate shows `N`/`S` (not `P`/`R` — that's Coverage Rate,
      column 5, a different code entirely) for `pref`/`reg`; Coverage
      Category/Coverage/Coverage Type are the SPECIFIC coverage's own values
      for that row, not a page-level value — an insured on two different
      coverages must show two different values here if those coverages
      differ.
- [ ] Clearing an insured slot in Coverage Input (or removing that insured
      entirely from Insured Input) removes the matching row from this tab on
      the very next render. Adding a new insured to a coverage slot adds a
      row. With zero insureds assigned anywhere, the table shows the
      empty-state placeholder, not a headers-only table.
- [ ] Nothing on this tab is ever a `data-fk` control or accepts a click/
      change — confirm there is no `change`/`input` listener wired to
      `#insuredsTabHost` (unlike Coverages, which has one for Unit Value).
- [ ] `core.COVERAGE_ABBR`/`core.COVTYPE_ABBR`/`core.pendingCell` resolve
      identically on both the Coverages and Insureds tabs — e.g. the same
      coverage shows the same Coverage/Coverage Type code on both tabs at
      once; there is no second, independently-defined copy of any of the
      three in `optimizer_insureds.js`.
- [ ] **Axis Key** (last column, Insureds tab, §2e): a Term Life row with a
      Coverage Rate chosen shows a real 26-character `mono` string starting
      `DT`; toggling Multi-Coverage Discount switches its MCD segment
      between `RMC_2509_`/`____2509_` live; switching Coverage Type to Joint
      First-to-Die changes its 3rd character to `C`. A Permanent Life row
      (Individual) shows a real key with the insured's own Sex/Insured Rate;
      switching to any Joint Coverage Type forces that segment to `MN`
      regardless of the insured's real Sex. `WL to 100`/`Term to 100` and
      any Critical Illness row fall back to the standard pending cell, not a
      wrong or truncated string. Reproduce the request's own hand-traceable
      cases before trusting any change here: Term Life/Individual/MCD off,
      Sex F, Preferred, Rate P1 → exactly `DT_T10__________2509_FNP1_`
      (26 characters); Permanent Life/Individual, WL 10 Pay, Sex F,
      Preferred → exactly `DT_VEG10________2007_FN___`.

- [ ] **Rates tab** loads with no console error even before any file is
      imported — `xlsx.full.min.js` (loaded before `optimizer_rates.js` in
      `optimizer.html`) must resolve first. One container per coverage; a
      Term Life/Permanent Life coverage shows its band-row table (8 or 6
      rows); a Critical Illness coverage shows the plain "not built yet"
      card instead.
- [ ] Per coverage, the LEFT region shows one 4-column group
      (`PR_N`/`EPR_N`/`PR_BD_N`/`EPR_BD_N`) per insured slot that actually
      has an insured chosen — an empty `"— Select —"` slot contributes no
      group — with a light `.col-soft-sep` divider between groups, and
      scrolls independently within itself when there's more than one. The
      RIGHT region (Total/BD_Total/BD_Final, 9 columns, `.col-hard-sep`
      between each 3-column group) never scrolls and stays fully visible
      regardless of how far the left region is scrolled.
- [ ] Total/EPR_Total/PEP_Total and the BD_Total trio show the page's plain
      muted `—` (not amber); BD_Final's three columns show `core.pendingCell()`
      (amber) instead — confirm the visual difference is real, not
      eyeballed, since they mean different things (§9 invariant #38's
      Backdate analogue applies to why "pending" and "blocked" aren't
      interchangeable here either).
- [ ] **Import Rates File** on a `.xlsx` whose sheet names start with
      `temp_rates_` populates the Term Life status line only; one whose
      sheet names start with `perm_rates_` populates the Permanent Life line
      only; importing both (in either order, including back-to-back before
      the first finishes) leaves both lines populated correctly — neither
      import's result is lost or overwritten by the other. A file matching
      neither prefix toasts an error and changes nothing.
- [ ] A real (or realistically-sized synthetic) Term Life import shows the
      progress bar with a real "sheet N of 6 … row X/Y" label and a moving
      `<progress>` value, not an instant flash — both import buttons are
      disabled while it runs and re-enabled after. Confirm every Duration
      1–100 present in the file was kept, not just Duration 1 (§9 invariant
      #32) — row counts in the status line should be roughly 100× what a
      Duration-1-only import would have shown.
- [ ] **Load from `rates/`** on a page opened directly via `file://` fails
      with a calm status message for both files (never a crash, never a
      silent no-op) since `fetch()` is blocked there; the same button
      succeeds when the page is served via `start-server.bat`/`python -m
      http.server` and a real file sits in `rates/`.
- [ ] Reload the page after a successful import (either category): the
      status line still shows the same file/row-count summary with no
      re-import needed — confirms `localStorage` persistence
      (`coverage-optimizer-rates`) round-trips through `restorePersistedRates()`.

- [ ] **Backdate tab, Insureds Backdate**: header shows Illustration Date
      (= Settings' Reference Date, exactly), Max. Backdate Date (exactly 6
      months earlier), and Final Backdate Date as an amber `—` pill. One row
      per insured (not per coverage) — an insured with no birthdate shows
      dashes throughout, including columns 10–13, never a computed-looking
      figure.
- [ ] Enter a birthdate that puts Backdate Eligible at `TRUE`: Confirm
      Backdate and Backdate Date both render `core.pendingCell()` (amber).
      Enter one that puts it at `FALSE`: Confirm Backdate renders a plain
      `FALSE` and Backdate Date a plain muted `—` — NEITHER is amber in this
      case; this is the one place on the page where "not computed" and
      "definitely blank" have to look different on purpose (§9 invariant #38).
- [ ] Enter a Reference Date (Settings) with day 29, 30 or 31, in any month
      — including 29-FEB — and confirm it commits and displays as day 28.
      Find (or construct) an insured/Reference-Date pair whose Midpoint
      would naturally fall on day 29/30/31 and confirm the displayed
      Midpoint is clamped to 28 too, and that Backdate Eligible/Backdated
      Age Nearest/Last are computed from the CLAMPED date, not the pre-clamp
      one.
- [ ] **Backdate Projection**: Show Projection starts OFF — the table is
      hidden but the band (title, switch, two amber pending pills) stays
      visible. Clicking the switch reveals a 6-column table whose HEADER
      cells (not just body cells) are amber-pending, with a single spanning
      "nothing to project yet" placeholder row, no invented data rows.
      Clicking again re-collapses it.

- [ ] **Top bar**: Test Case Name, Username (`Catheryne L.` first, no blank
      option), Save Test, then the theme button, in that exact order.
      Clicking Save Test with an empty name toasts an error and does not
      save; a non-empty name saves, clears the box, and toasts confirmation.
- [ ] Saving downloads a `.json` file (wherever the browser's own download
      location is configured — confirm the tool never claims to control
      this, §2h) AND immediately adds a row to the History tab with the
      right name/username/timestamp/insured-and-coverage counts; Total Modal
      Premium shows a plain muted `—`.
- [ ] Change several inputs after saving (an insured's name, a coverage's
      Unit Value on the Coverages tab), then click **Load** on the earlier
      save: every changed value reverts to what was saved, INCLUDING Unit
      Value (confirms the `restoreState`-then-`setSnapshot('unitValues', …)`
      order, §9 invariant #34) — and the view switches to Input & Results
      automatically.
- [ ] **Delete** removes a History row immediately, no confirmation dialog
      (same convention as Coverage/Insured Remove, §9 invariant on that);
      reload the page and confirm the deletion persisted (the row does not
      reappear).
- [ ] **Import Test Case**: pick a `.json` file previously downloaded by
      Save Test (from this browser or, ideally, a different one) and confirm
      it's added as a new History row with a freshly-generated id — not the
      original file's own id, and not colliding with any existing row.

- [ ] The switcher menu shows both tools, each badge in its own colour, with
      a tick on Coverage Optimizer.
- [ ] Picking Inforce Tool navigates to `inforce.html`; Escape and outside
      clicks close the menu.
- [ ] Toggle dark mode, then navigate to Inforce: the choice carries over.
- [ ] `--accent` resolves to `#345165` (light) / `#7FA0B8` (dark);
      `--edit` resolves to `#7E6115` / `#D2AE5F` — the same as Inforce.
- [ ] No horizontal page scroll at 1280px and 1920px.
