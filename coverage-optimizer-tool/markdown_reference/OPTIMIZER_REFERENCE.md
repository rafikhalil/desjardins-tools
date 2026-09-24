# Coverage Optimizer — Template Reference

Complete specification of the **Coverage Optimizer** front end (`optimizer.html`,
`optimizer.css`, `optimizer.js` and the per-tab file pairs), written to be handed
to a coding agent that will maintain and extend the tool.

The sibling page, the Inforce Tool (`inforce.*`), has its own reference:
`INFORCE_REFERENCE.md`. The two share a component set and a header switcher,
nothing else; this document describes the Optimizer page only.

**Read this first, in full, before writing code.** The Optimizer is a working
tool: **all six tabs are live** — Input & Results (Settings, Insured Input,
Coverage Input, Results), Coverages, Insureds, Rates, Backdate and History. It
reads two real insurance-rate workbooks, builds the Axis Key, looks up rates for
every insured / coverage / rate band, computes the joint-life equivalent age,
premiums (Modal Prem., backdated and not), the highest coverage amount a premium
holds, and the backdate decision, and explains every failure in a message bar.
(The former "Eq. Age / Substd. Prem." tab was removed: its calculation runs in the
background, §12.6.) **Read the live tabs before building anything new** — they are
this page's own reference implementation, and the later ones (§2f–§2h) are the
template for a split-off tab.

### Map of this document

| You want… | Read |
|---|---|
| **What is calculated, and how** — every formula, the **Axis Key**, rate bands, joint equivalent age, Modal Prem., Highest Amt, backdating; verified numeric cases | **§12** |
| **Why a cell is an Error** — the message bar, its API, and the **complete error catalogue** | **§13** |
| How to run, deploy, move the tool to another computer; the pre-load page; `server.py`; `TO_DO.md` | **§14** |
| The screens, one section per tab and per input panel | §2 – §2h |
| Design tokens, layout, component classes, DOM contracts | §3 – §6 |
| Rules that must not be broken; recipes; the verification checklist | §9 – §11 |

**Currency.** §12–§14, §1, §2c, §2d–§2h and §11 were rewritten on 2026-09-20 and
describe the tool as it is. §2 – §2b (Insured Input, Settings, Coverage Input) were
updated where behaviour changed (blank defaults with a yellow highlight, the Joint
container, the calculated Joint Age). §3 – §8 are structural and unchanged.
Where an older sentence disagrees with §12–§14, **§12–§14 win**; `TO_DO.md` is the
live list of what is still open.

- Version: UI v0.5.0 (doc revision 2026-09-20; change log in §14.8)
- Stack: hand-written HTML + CSS + ES5 JavaScript, plus one vendored library
  (`xlsx.full.min.js`, SheetJS — §0 rule 1, §2f); a small Python 3 server
  (`server.py`, standard library only) for local use. **No other dependencies,
  no build step, no framework, no bundler, no `package.json`.**
- Files: §1.

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
   step, still works via `file://`; the rate files are loaded from `rates/` with `fetch()`, which
   needs an http(s) server (it is blocked on `file://`) — start the tool with
   `_start-coverage-optimizer.bat` (§14.2). From disk the tool still runs; the load fails and the
   message bar says why (§13 E-1), and the manual **Import Rates File** picker still
   works — that is what keeps rule 1's file://-first guarantee intact.
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
   `server.py` / `_start-coverage-optimizer.bat` (the local server and its launcher, §14.2)
   and `TO_DO.md` are not part of the running page and aren't held to this rule. Anything beyond all of
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
coverage-optimizer-tool/
├── _start-coverage-optimizer.bat   double-click launcher: starts backend_files/server.py (port 8000) and opens the tool — ONE console window
├── backend_files/                  everything the browser loads, plus the server
│   ├── optimizer.html              static shell: top bar (brand, MESSAGE BAR, Test Case Name, user chip, Save Test, theme),
│   │                               tab bar, pane host, status bar, toast, the PRE-LOAD overlay
│   ├── optimizer.css               slate palette + every component class (+ the message bar, §13)
│   ├── optimizer.js                one IIFE: switcher, theme, tabs, panes, Settings / Insured Input / Coverage Input / Results,
│   │                               Axis Key, Joint Age (equivAge), save/load state, message bar, the public bridge
│   ├── optimizer_coverages.css/.js Coverages tab (§2d) — own file, own IIFE, own <link>/<script>; Modal Prem., Highest Amt, Prem. Basis
│   ├── optimizer_insureds.css/.js  Insureds tab (§2e)
│   ├── optimizer_rates.css/.js     Rates tab (§2f) — rate files, every lookup
│   ├── optimizer_backdate.css/.js  Backdate tab (§2g)
│   ├── optimizer_history.css/.js   History tab + the top-bar Save Test controls (§2h)
│   ├── optimizer_preload.css/.js   the pre-load page (§14.3)
│   ├── xlsx.full.min.js            vendored SheetJS build (§0 rule 1) — the one dependency this page has
│   └── server.py                   the local server: serves the TOOL folder + POST /history_data/<name>.json (§14.2)
├── rates/                          the two rate workbooks — confidential, never committed (§12.3, §14.6)
├── history_data/                   saved test cases (<initials>_<name>.json), written by server.py (§14.4)
└── markdown_reference/             the documentation
    ├── OPTIMIZER_REFERENCE.md      this file
    ├── OPTIMIZER_INSTRUCTIONS.md   custom instructions for the coding platform
    ├── TO_DO.md                    the live backlog (§14.7)
    └── yagni_principle.md          the "smallest correct change" coding instruction

(the sibling tool, inforce.html / .css / .js and INFORCE_REFERENCE.md, lives elsewhere and is out of scope here)
```

**A live tab lives in its own file pair instead of inside `optimizer.js`/`.css`.**
Coverages, Insureds, Rates, Backdate and History all do: their own
`<link>`/`<script>` in `optimizer.html`, loaded after `optimizer.js`/`.css`,
reading shared state through the one deliberate global `window.OptimizerCore`.
Load order matters only where a file calls what an earlier one *lends*
(§14.1): `optimizer_rates.js` must come before the Coverages and Backdate files
(they call `core.bandTotals` / `core.allCovRate`), and `xlsx.full.min.js` before
`optimizer_rates.js`. **A capability two tabs both need moves onto the bridge
once the SECOND tab needs it** (§2d), not duplicated — `COVERAGE_ABBR`,
`COVTYPE_ABBR`, `pendingCell`, `insuredRateCode` are the worked examples.
**There is no "Eq. Age / Substd. Prem." tab any more**: its calculation now runs
in the background (§12.6) and its output is the read-only Joint Age in the teal
Joint container.

**`optimizer.css` and `inforce.css` share every component rule byte-for-byte;
only the palette tokens differ.** They were generated from one source. If you
change a component rule in `optimizer.css`, make the identical change in
`inforce.css`. Adding a *new* rule for an Optimizer-only component is fine (the
message bar's `.issues*` and `.btn--sm.btn--icon` are such additions —
`inforce.css` does not have them); changing a shared one is not. The per-tab CSS
files have no Inforce equivalent and may define what they need, reusing only
tokens/classes `optimizer.css` already defines.

### Running it

**Start it with `_start-coverage-optimizer.bat`** (double-click; needs Python 3 on PATH). It
runs `backend_files/server.py` on port 8000 **in that same console window** (one window
only; closing it stops the server) and opens
`http://localhost:8000/backend_files/optimizer.html`. Why a server rather than
opening the `.html` from disk: the pre-load page `fetch()`es the rate files
(blocked on `file://`); the browser must not serve a stale `.js` after an edit
(`server.py` sends `Cache-Control: no-cache`); and Save Test writes straight
into `history_data/` (§14.2). Opening `optimizer.html` from disk still *runs* the tool
(§0 rule 1) — the rate files then fail to load and the message bar says why
(§13 E-1). Run by hand: `python backend_files/server.py 8000`. Full details: §14.

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
  per pane instead of four. `split` remains available for a future tab.
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
| Sex | `sex` | enum | `M` / `F` | **blank** (`—` option; highlighted yellow until chosen) |
| Rate | `rate` | enum | `pref` ("Preferred / Non-smoker") / `reg` ("Regular / Smoker") — internal codes, not shown | **blank** (`— Select —`; highlighted yellow until chosen) |
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
Changing the reference date does **not** retroactively reject birthdates already
entered (only entering a *new* birthdate re-checks the 0–120 range, against whatever
`settings.refDate` holds at that moment) — but if a later reference date pushes an
existing insured outside 0–120 (or before their birth), the **message bar** flags it
(§13 B-3) instead of leaving a silent out-of-range age. A blank Sex or Rate does not
block the page: it shows in yellow, and the rate lookups that need it say so (§13 C-2).

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
| Payment Frequency | `freq` | enum | `monthly` ("Monthly") / `annually` ("Annually") | **blank** (`— Select —`) — no default is invented; **Modal Prem. cannot be calculated until it is set** (the message bar says so, §13 D-1) |
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

**Every Settings field feeds a calculation.** `refDate` is what `agesAt()` measures
every insured's ages against (§2 "Insured Input") and the Illustration Date of the
Backdate tab; `freq` gives the modal factor (§12.8); `premAdjPct` / `premAdjAmt`
enter the Modal Prem. formula (`premAdjPctDur` / `premAdjAmtDur` are stored and
displayed but no formula uses them yet — *TO_DO C-4 leftover*); `mcd` changes the
Axis Key of Term Life coverages that are not Joint First-to-Die (§12.2).

```js
var settings = {
  refDate: todayStr(), mcd: false, freq: '',
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

- No `state` object, no baseline-vs-working-copy, no policy-extract import, no
  `parseWorkbook` (Inforce concepts; §8). **Insurance rates are the only thing this
  page imports** (§2f).
- No calculation lives in Settings itself — the formulas are §12; Settings only
  holds the inputs and validates them.

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
| Coverage Category | `category` | enum | Term Life, Permanent Life, Term Critical Illness, Permanent Critical Illness, Critical Illness for Business Owners | **blank** (yellow until chosen) |
| Coverage | `coverage` | enum, depends on Category | see `COVERAGE_OPTIONS` | **blank** (yellow) |
| Coverage Type | `covType` | enum, depends on Category (+ Coverage for Term Life) | see `covTypeOptions()`; **empty for any Critical Illness category** — not specified yet | **blank** (yellow; none for Critical Illness) |
| Coverage Fee | `fee` | money, optional | $0–999,999,999.99, 2dp — **range not specified by the request; assumed for consistency with the page's other money fields** | auto (see below), blank for CI |
| Calculation Type | `calcType` | enum | Input Premium / Coverage Amount | **Coverage Amount** |
| Input | `amount` | **whole number 0–999,999,999** when Calculation Type is *Coverage Amount*; **money 0–999,999,999.99, 2dp** when it is *Input Premium* (`effField` swaps the descriptor); optional | blank (yellow). Changing Calculation Type clears it with a toast (a premium and an amount are different numbers). The label was shortened from "Input Premium/Insurance Amount" to "Input" when the row was compacted |

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
`maxInsuredsFor(category, covType)`:

| Coverage Type | Cap | Category it can appear on |
|---|---|---|
| `Individual` | **1** | any |
| `Joint First-to-Die` | **5 (Term Life) / 2 (Permanent Life)** | Term Life or Permanent Life |
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

### The Joint container (Permanent Life with a joint Coverage Type)

A **third, teal slot-shaped box** under a coverage's insured slots
(`covJointSlot`, `.cov-joint-slot`, mint tokens `--joint` / `--joint-line`), shown
only when `isJointPerm(c)` — Permanent Life **and** Coverage Type Joint First-to-Die,
Joint Last-to-Die or Joint Last-to-Die, Paid-up 1st Death (JLTDPU). It uses the same
`.cov-ins-row` grid as a real slot, so its columns line up with the two insureds
above it:

| Cell | Content |
|---|---|
| Insured | read-only `Joint <name 1> / <name 2>`; `—` (not a partial name) until both slots have an insured |
| Joint Sex | fixed `M` (`JOINT_SEX`), locked box |
| **Joint Age** | **calculated, read-only** (`equivAge`, §12.6) — the number; `—` while an insured, Sex, Rate or Birthdate is missing (tooltip says which); a red **Error** for a JLTDPU with a life under 18 |
| Joint Rate | fixed `N` (`JOINT_RATE`), locked box |
| Extra Premium (four mini-fields) | **Equiv. Substd. %**, **Flat Extra Prem. $ Perm**, **$ Term**, **$ Duration** — the operator's inputs (`rec.joint`, `JOINT_FIELDS`) |

`JOINT_FIELDS` ranges: Equiv. Substd. % 0–10,000; flat $ 0–9,999.99; duration 0–999.
All four **start blank and are highlighted yellow** until filled (`opt: 1` — a cleared
box commits back to blank, unlike an insured slot's Extra Premium whose default is a
real `0`). **Flat Perm and Flat Term/Duration lock each other** once one has a
non-zero value (`isFilledCov`, same rule as a slot's Extra Premium); a locked box is
not highlighted.

While the coverage is a joint Perm one, each insured slot's **Rate** and **Extra
Premium** boxes are **disabled** (inert `.fi--ro`, blank, title
`JOINT_OFF` = "Not used on a joint coverage — see the Joint container below") —
the container carries their equivalents. Choosing a joint Perm Coverage Type
**adds the second insured slot automatically** (both lives are always there;
JFTD on Permanent Life is capped at 2, JLTD/JLTDPU at 2). `rec.joint` stays on the
record when the Coverage Type changes (so flipping between joint types loses
nothing); nothing reads it unless `isJointPerm`. The Joint Age itself is **not
stored** — a saved test case that still carries an old `joint.age` loads fine and
the value is ignored (`restoreState` gives every coverage a `joint`).

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
| `covTypeOptions(category, coverage)`, `maxInsuredsFor(category, covType)`, `rateOptionsFor(category, insuredRate)` | the three cascades — Coverage Type, insured-slot cap, Rate — as pure functions of their inputs |
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
(`#resultsHost`, filled by `initResultsPanel()`), inside one `.card`. Two
subcontainers. **All figures are calculated** — the formulas are in §12.

**Subcontainer 1 — one row per coverage.** A `<table class="ins">`, one row
per entry in `coverages` (rebuilt by `resultsCoverageTable()` on every
`notifyOptimizerCoreChange()`, so it is never a render behind):

| Column | Source |
|---|---|
| Coverage | `N. ` + `coverageTitle(c)` — the same string the coverage's own card header shows |
| Prem. Basis Ins. Amt | `core.premBasis(c)` — Input Premium coverages only (§12.10); **blank** for Coverage Amount |
| Highest Amt (Min.) | `core.highestAmt(c).min` — Coverage Amount coverages only; **blank** for Input Premium |
| Highest Amt (Max.) | `core.highestAmt(c).max` — same |
| Modal Prem | `core.modalPrem(c)` — **mirrors the Coverages tab** (one function) |
| Modal Prem Backdated | `core.modalPremBackdated(c)` — mirrors the Coverages tab |

`solvedCell()` renders each value/state: a figure (tooltip = how it was solved),
a **blank** cell (column does not apply to this Calculation Type), amber
(pending — Critical Illness), red **Error** (tooltip = why), or a muted `—`
(blocked; tooltip = why, e.g. "needs a Payment Frequency (Settings)").
`highestAmtFor`/`premBasisFor`/`premFor` call through the bridge and return
`null` until the tab files that own those functions have loaded — the first
render can hit that; the next change or the `ratesstatus` event fills it.

**Headers and cells wrap** rather than scroll (`.results-cov-wrap`:
`table-layout: fixed`, Coverage 30%, the five figure columns splitting the
rest, `white-space: normal`; the selectors repeat `.ins` to out-specify the
shared `.ins thead th` rule — do not edit the shared rule).

**Subcontainer 2 — the Summary**, `resultsBar('Summary', summaryFields())`
(the same `.resultbar`/`.rs` shape as Settings):

| Figure | Value |
|---|---|
| Modal Premium | Σ of every coverage's Modal Prem. (`premiumTotal('modalPrem')`) |
| Modal Premium Backdated | Σ of every coverage's Modal Prem. Backdated |
| Possible Backdate Date | the Backdate tab's Final Backdate Date (`core.finalBackdateDate`) |
| Backdate Savings Date | **amber** — waits on the Backdate Projection's Monthly / Annual Savings Date (whichever Payment Frequency picks; *TO_DO C-3*) |

A total is never partial: an Error anywhere ⇒ Error; pending ⇒ pending;
blocked ⇒ blocked (`summaryValue`). Results **re-renders** on every
`notifyOptimizerCoreChange()` (so also on Settings commits — Payment Frequency,
Prem. Adj., MCD), on `ratesstatus` (rate files reporting in) and on
`unitvaluechange` (Unit Value lives in the Coverages tab). Nothing in Results is
a `data-fk` control.

Key functions (`optimizer.js`): `RESULTS_COVERAGE_FIELDS`, `summaryFields`,
`summaryValue(r, fmt)`, `premiumTotal(which)`, `finalBackdateFor`,
`highestAmtFor`/`premBasisFor`/`premFor`, `solvedCell(r, value, dec)`,
`resultsPanelShell`, `resultsCoverageTable`, `renderResultsPanel`,
`initResultsPanel`.

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
| `coverages()`, `insureds()` | return the LIVE arrays (functions, not snapshots — always current) |
| `settings` | the live `settings` object itself (read its fields directly; never reassign it) |
| `COVERAGE_CATEGORY_MAP` | category key → display label |
| `COVERAGE_ABBR`, `COVTYPE_ABBR` | the two display-abbreviation maps (`Term 10` → `T10`, `WL to 65` → `VEG65`; `Joint First-to-Die` → `JFTD`, …) — also what the Axis Key is built from (§12.2) |
| `esc`, `group`, `toNum`, `decimals`, `agesAt`, `findInsured`, `coverageTitle` | the utilities `optimizer.js` itself uses — ported once, reused everywhere |
| `parseDate`, `fmtDate`, `buildDate` | date parsing/formatting (Backdate's date arithmetic, Rates' age lookups) |
| `insuredRateCode(ins)` | Preferred → `N`, Regular → `S` |
| `isJointPerm(c)`, `JOINT_SEX` (`'M'`), `JOINT_RATE` (`'N'`) | Perm Life with any joint Coverage Type, and the fixed joint Sex/Rate its Axis Key uses |
| `jointAge(c, offset)`, `jointFigures(c)`, `equivAge(c, backdated)` | the calculated Joint Age (offset 0) / Joint Age Backdated (offset −1), the container's figures as display strings, and the calculation itself returning `{ v }` or `{ why, err }` (§12.6) |
| `axisKeyPrefix(c, slot)`, `axisKeyWhy(c, slot)` | the 26-character Axis Key prefix, or `null` — and, when `null`, **why** (§12.2) |
| `raise(key, msg[, fk])`, `resolve(key)`, `badInput(el, msg, where)`, `goodInput(el)`, `diagnostics(fn)` | the **message bar** API (§13) |
| `pendingCell(extraClass)` | one "formula not yet provided" `<td>` (`.cell-pending`) |
| `onChange(fn)` | runs `fn` after any commit that could change `coverages`, `insureds` or `settings` |
| `registerSnapshot(key, {get, set})`, `getSnapshot(key)`, `setSnapshot(key, data)` | lets a tab offer its own local state to Save/Load — Coverages' Unit Value is the only user |
| `snapshotState()` | a deep-cloned plain-JSON snapshot of Settings/Insureds/Coverages |
| `restoreState(snap)` | **the one deliberate WRITE exception** (below) — only ever called from `optimizer_history.js` |
| `clearState()` | `restoreState` with default Settings and empty lists (its own floors give one blank insured + one blank coverage) — the same exception, same caller: the top bar's **Clear** button (§2h) |
| *lent by tab files, after they load* | Rates: `allCovRate`, `bandTotals`, `bandFinalTotals`, `bandAt`, `bandTotalsAll` · Coverages: `modalPrem`, `modalPremBackdated`, `highestAmt`, `premBasis` · Backdate: `backdateEligible`, `finalBackdateDate`. Callers must tolerate `undefined` until then (Results does — `highestAmtFor` etc. return `null`) |

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

One row per coverage from Coverage Input, in the same order; **24 columns**,
left to right (the arithmetic behind the last two is §12.8–§12.9):

| Column | Source |
|---|---|
| Coverage ID | `idx + 1` (Coverage Input's own `.coverage-no`) |
| Frequency of Payment | `settings.freq` label (`Monthly` / `Annually`, `—` while blank) |
| Coverage Category | `COVERAGE_CATEGORY_MAP[c.category]` |
| Coverage | `COVERAGE_ABBR[c.coverage]` (raw name for Critical Illness, which has no code) |
| Prem. Adj. % · % Dur. · $ · $ Dur. | `settings.premAdjPct` / `premAdjPctDur` / `premAdjAmt` / `premAdjAmtDur` |
| Has MCD | `settings.mcd ? 'TRUE' : 'FALSE'` |
| Coverage Type | `COVTYPE_ABBR[c.covType]` (`Individual`, `JFTD`, `JLTD`, `JLTDPU`; `—` if blank) |
| Unit Value | own field, this tab only (below) — an input |
| Extra Prem. Term $ | Σ over the coverage's insureds of Perm $ + Term $; joint Perm: Joint *Flat Perm $* + *Flat Term $*; `—` while nothing is entered; amber for Critical Illness (*TO_DO R-3*) |
| Modal Factor | Annually `1.00`, Monthly `0.09` (literal), `—` while Frequency is blank |
| Coverage Fee | `c.fee` (§12.8), `—` if blank |
| Perm Joint Age · Perm Equiv. Substd. % · Perm Flat Extra Prem. $ Perm · $ Term · $ Duration · Perm Joint Age Backdated | the Joint container (`core.jointFigures`) — the **calculated** Joint Age and Joint Age Backdated (§12.6) and the operator's four inputs; `—` on a coverage with no joint side |
| Perm Joint Extra Prem. % Backdated · $ Backdated | **amber** — no formula yet (*TO_DO C-5*) |
| Modal Prem. | `premCell(modalPrem(c))` (§12.8) — figure (tooltip: band, PR_Total, PEP_Total, each LET variable), amber (Critical Illness), red **Error** (tooltip = why), or muted `—` (tooltip = what is missing) |
| Modal Prem. Backdated | `premCell(modalPremBackdated(c))` (§12.9) |

None of the mirrored columns is editable here — change them at their source.

**Unit Value is a field of this tab, not of Coverage Input's record.** A
`covId`-keyed map (`unitValues`) in `optimizer_coverages.js`; default **1,000**;
`syncUnitValues()` (top of every render) adds defaults and drops entries for
removed coverages. Validated: a whole number, 1 – 999,999,999 (a rejection is a
red box, a toast and a message-bar entry, §13 A-9). It is included in a saved
test case through `registerSnapshot('unitValues', …)`, and a change fires the
`unitvaluechange` event that Results listens for.

The table needs a horizontal scroll (`.table-scroll-wrap`); no wrapping.

Key functions (`optimizer_coverages.js`): `COLUMNS`, `unitValueFor`,
`syncUnitValues`, `validateUnitValue`, `modalFactor`/`modalFactorFor`,
`moneyOrDash`, `extraTermTotal`/`extraTermCell`, `shift`/`xRound`/`xTrunc`
(Excel rounding), `premContext`, `modalPremAt`, `modalPrem`,
`modalPremBackdated`, `premCell`, `solveAmount`, `solveInputs`, `highestAmt`,
`premBasis`, `coverageIssues` (message bar), `coverageRow`,
`renderCoveragesTab`, `coveragesTabShell`, `covTabCommit`, `covTabLive`,
`unitValuesChanged`, `initCoveragesTab`.

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

### The table — 24 columns, two hard separators

First 13 columns, left to right:

| Column | Source |
|---|---|
| Coverage ID & Insured ID | `(cIdx+1) + '_' + (insIdx+1)` — list positions (the numbering of the `.coverage-no` / `.insured-no` badges), not `_id` strings |
| Sex | the insured's Sex |
| Insured Rate | Insured Input's Rate recoded `pref` → `N`, `reg` → `S` (a *different* code from Coverage Rate below) |
| Age Nearest/Last (Calculated) | Age Calculated (§12.1) |
| Coverage Rate | the slot's `rate` (`P1`/`P2`/`P3`/`R1`/`R2` Term Life; `P`/`R` otherwise); **`—` on a joint Perm coverage** (the box is disabled) |
| Perm Extra Prem. % · Perm Extra Prem. $ · Term Extra Prem. $ · Term Extra Prem. $ Dur. | the slot's four Extra Premium fields; **`—` on a joint Perm coverage** |
| Coverage Category · Coverage · Coverage Type | that coverage's own values (abbreviated as on the Coverages tab) |
| Has MCD | `settings.mcd` |

**Hard separator**, then **10 "Joint" columns**: Joint Sex, Joint Rate (fixed `M`,
`N` on a joint Perm coverage), Perm Joint Age (**calculated**, §12.6), Perm
Equiv. Substd. %, Perm Flat Extra Prem. $ Perm / $ Term / $ Duration, Perm Joint
Age Backdated (calculated) — all from the Joint container (`jointCells()` here,
`core.jointFigures`); `—` for every coverage without a joint side — then **Perm
Joint Extra Prem. % Backdated** and **$ Backdated**, amber (*TO_DO C-5*).

**Hard separator**, then **Axis Key** — the **26-character prefix**
(`core.axisKeyPrefix(c, slot)`; how it is built, character by character, is
§12.2). It is the key the rate file's column D is indexed by, minus the
6-character band code the Rates tab appends. Rendered `mono`. When no prefix can
be built the cell is the standard amber pending cell — Critical Illness (no format
given) and an incomplete row (no Sex / Rate / Coverage Rate / Coverage Type / Coverage);
`WL to 100` / `Term to 100` show their 27-character 2017-style prefix (§12.2); the **reason** is
what the Rates tab and the message bar quote (`core.axisKeyWhy`).

`.col-hard-sep` (`optimizer.css`) is a visible divider between column *groups*,
applied to both the header cell and every body cell at that position (before
Joint Sex and before Axis Key); `core.pendingCell('col-hard-sep')` takes the
class as a parameter for exactly that.

An **empty row set** (no coverage has an insured chosen yet) shows a
`.proj-slot` placeholder spanning every column.

Key functions (`optimizer_insureds.js`): `COLUMNS`, `HARD_SEP_AT` (`{13, 23}`),
`buildRows`, `calcAge`, `td`, `jointCells`, `rowHtml`, `axisKeyCell`,
`insuredsTabShell`, `renderInsuredsTab`, `initInsuredsTab` (registers
`core.onChange`; no `change`/`input` listener — nothing here is committed).

---

## 2f. Rates tab (live — files load on launch, every lookup wired) — `optimizer_rates.css`/`.js`

The `optRates` pane, built like Coverages/Insureds (§2d/§2e, §1): its own file
pair, reading `window.OptimizerCore` only, plus the one vendored dependency
`xlsx.full.min.js` (SheetJS, §0 rule 1), loaded first. **The most crucial tab
in the tool**: it reads the real rate workbooks and, for **every insured on
every coverage at every rate band**, looks up the Premium Rate (PR), the Extra
Premium Rate (EPR) and the Percentage Extra Premium (PEP) — at the current age
and at age − 1 (a possible backdate) — then sums them. **What each number
means, how the Axis Key is built and how the lookups combine is §12.2–§12.5.**

### What is on the tab

- An import bar: **Import Rates File** (a `.xlsx` picker; the workbook says
  whether it is Term or Perm by its own sheet names) and **Load from `rates/`**;
  a progress bar; a two-line status ("Term Life: "…" — n row(s) across 6
  sheets." / "Permanent Life: …") in warning style if a sheet is missing.
- **One container per coverage** (`coverageRatesCard`). A Term/Perm Life coverage
  shows its band table; a Critical Illness coverage shows "Rates for this
  Coverage Category aren't built yet"; a coverage with no Category yet says to
  choose one.

```
┌─────────────────────────────────────────────┬────────────────────────────────┐
│ Rate Band │ Insured 1 (6 cols) │ Insured 2 … │ Total │ BD_Total │ BD_Final    │
│ (pinned)  │   scrolls within itself          │  always visible, 9 columns     │
└─────────────────────────────────────────────┴────────────────────────────────┘
```

- **LEFT `.rate-scroll`** — Rate Band Code, then one **6-column group per
  insured slot that has an insured chosen**: `PR_n` `EPR_n` `PEP_n` then
  `PR_BD_n` `EPR_BD_n` `PEP_BD_n` (the backdated trio tinted `.rate-bd`), a light
  `.col-soft-sep` between insureds. Every cell is `cellResult()`.
- **RIGHT `.rate-fixed`** — three 3-column groups, `.col-hard-sep` between them:
  **Total** (`PR_Total` `EPR_Total` `PEP_Total`), **BD_Total** (the backdated
  sums) and **BD_Final** (§12.5). For Perm joint coverages the Totals count
  **Insured 1 alone**.

Cells: a figure (2 decimals), a red **Error** (tooltip = the `why` sentence,
which is also a message in the top bar, §13 C), an amber pending cell, or a
muted `—` (a Total with no insured chosen yet).

### Loading the files

`loadFromRatesFolder()` runs **on every launch** (`initRatesTab`) and drives the
pre-load page (§14.3): `setRateState(kind, 'loading'|'loaded'|'notloaded')`
paints the status rows and fires `ratesstatus`. **Nothing is cached** between
launches — the files in `rates/` are the source of truth (an earlier
`localStorage` cache, `coverage-optimizer-rates`, was removed). `fetch()` of a
local file needs http(s): on `file://` the load fails with the reason in the
bar (E-1) and the manual picker still works.

**Config** is one block at the top of the file: `RATE_VERSION` (`'2509'`),
`PERM_VERSION` (`'2007'`), the file and sheet names built from them,
`TERM_LIFE_DURATIONS`, `TERM_LIFE_COVERAGE_SUFFIX` — **and the two literals in
the Axis Key builder** (§12.2 "Changing a rate-table version"). File layouts and
the lookups are in §12.3.

**Chunked import.** `processRowsChunked()` walks a sheet 500 rows per tick
(`ROW_CHUNK`), yielding with `setTimeout(…, 0)`, driving the progress label
("sheet n of 6 … row x/y") and the pre-load bar. **One import runs at a time;
concurrent requests queue** (`importQueue`, `runNextImport`, `afterImport`) —
Term and Perm are fired together on launch. Term Life keeps **every Duration
1–100** (only 1 is read; §9 #32). Text/error cells are skipped and counted
(E-7); a workbook with the right sheets but no usable rows stays "Not loaded"
(E-6).

### Errors

Every failing lookup returns `{ error: true, why }` (`fail()`); the tables show it
as the cell tooltip and `ratesIssues()` (registered with `core.diagnostics`)
turns them into top-bar messages — the same `cellResult()`/`finalResult()`
calls, grouped by cause (§13.1, catalogue C and E).

Key functions (`optimizer_rates.js`): config block · `BAND_TABLES` ·
`ingestTermLifeWorkbook`, `ingestPermLifeWorkbook`, `detectAndIngest`,
`processRowsChunked`, `importQueue`/`runNextImport`/`afterImport`,
`loadFromRatesFolder`, `handleFilePicked` · `lookupTermLifeRate`,
`lookupPermLifeRate` · `lookupAge`, `ageWhy`, `missingRow`, `fail` ·
`baseRateResult` (PR), `extraRateResult` (EPR), `pepResult` (PEP), `cellResult`,
`finalResult`, `totalResult` · `bandAt`, `bandFor`, `bandTotalsOn/For/All`,
`bandTotals`, `bandFinalTotals`, `allCovRate` · `ratesIssues` · `showProgress`,
`hideProgress`, `setRateState`, `renderStatus`, `loadIssue`/`loadFixed`/
`skippedIssue` · `insuredRatesTable`, `totalsRatesTable`, `coverageRatesCard`,
`renderRatesTab`, `ratesTabShell`, `initRatesTab`. Lent to other tabs on the
bridge: `core.allCovRate`, `bandTotals`, `bandFinalTotals`, `bandAt`,
`bandTotalsAll`.

---

## 2g. Backdate tab (live) — `optimizer_backdate.css`/`.js`

The `optBackdate` pane, built like the other split-off tabs (§2d–§2f, §1).
**Two containers stack top/bottom, not left/right** — the one tab that does not
use `.split`; both are siblings inside `#backdateTabHost`. The formulas are in
§12.7; this section is the layout and states.

### Container 1 — Insureds Backdate

One row per **insured** (from Insured Input, not per coverage). Every date is
measured against the Illustration Date (`settings.refDate`, never today, §9 #12).

**Header (`.card-head--band`) — three figures** (`.bd-band-figs` /
`.bd-band-fig`, an Optimizer-only component so it does not collide with the
shared `.chip` band rule): **Illustration Date** (= `settings.refDate`),
**Max. Backdate Date** (− 6 months), **Final Backdate Date** (the earliest
Backdate Date; muted `—` with the reason when none, red *Error* when an
insured's own date cannot be resolved).

13 columns:

| # | Column | Source |
|---|---|---|
| 1 | Insured Name | `ins.name` |
| 2 | Insured Birthdate | `ins.birthdate` |
| 3 | Age Real | `agesAt(birthdate, Illustration Date).real` |
| 4 | Age Nearest/Last | real or nearest per `ins.ageCalc` |
| 5 | Past Birthday | most recent birthday on/before the Illustration Date |
| 6 | Midpoint (Possible Backdate) | rounded-half-up midpoint; day 29–31 → 28 |
| 7 | Next Birthday | the birthday after the Illustration Date |
| 8 | Backdate Eligible | `AND(Midpoint ≥ Max. Backdate Date; Midpoint ≤ Illustration Date)` |
| 9 | Backdated Age Nearest/Last | `agesAt(birthdate, Midpoint)` (informational; not yet used by the Rates `_BD` columns, *TO_DO C-2*) |
| 10 | Rate Current (All Cov.) | `core.allCovRate(insuredId, false)` — Σ of PR_N over the insured's coverages |
| 11 | Rate Backdated (All Cov.) | `core.allCovRate(insuredId, true)` — Σ of PR_BD_N |
| 12 | Confirm Backdate | `Eligible AND Rate Backdated < Rate Current` |
| 13 | Backdate Date | the Midpoint when Confirm Backdate, else blank |

A blank/invalid birthdate leaves every derived cell a muted `—`. Cell states for
10–13: a figure (tooltip lists the parts), a muted `—` (blocked; reason in the
tooltip — e.g. "not on any coverage yet"), a red **Error** (a rate could not be
resolved; tooltip = which coverage/band and the `why`, and the top bar carries
the root cause). **Not eligible ⇒ Confirm Backdate is a real `FALSE`** and Backdate
Date a real blank (`AND(FALSE; anything)` is FALSE regardless of what is missing;
§9 #38).

`core.backdateEligible(ins)` (lent to Rates for BD_Final and to `equivAge` for
Joint Age Backdated) is **eligibility only** — never Confirm Backdate, which
reads the rates and would be circular. `core.finalBackdateDate()` is lent to the
Results Summary.

### Container 2 — Backdate Projection

A **Show Projection** switch in the band (`.switch`, `data-act="toggle-bdproj"`,
**OFF by default**, local UI state — never saved) collapses/expands
`#bdProjBody`; the band stays visible. Two amber pills — **Monthly Savings
Date**, **Annual Savings Date** — and a six-column table (**Date, Premium
Current, Cumul. Prem. Current, Premium Backdated, Cumul. Prem. Backdated,
Difference**) whose *header* cells are amber. **No formulas and no row rule have
been given, so no rows are generated** — a single "Formulas not yet provided"
placeholder stands in (*TO_DO C-3*).

Date primitives (`optimizer_backdate.js`): `subtractMonths`, `birthdayInYear`,
`surroundingBirthdays`, `midpointDate`, `eligibility`, `insuredBackdate`,
`finalBackdateDate`, `backdateRow`, `insuredsBackdateShell`,
`renderBackdateTab`, `backdateProjectionShell`, `initBackdateTab` (registers
`core.onChange`, listens to `ratesstatus`, lends `core.backdateEligible` and
`core.finalBackdateDate`).

---

## 2h. History tab and Save Test (live) — `optimizer_history.css`/`.js`

The `optHistory` pane, built like the other split-off tabs, **except this is the
one file allowed to call the bridge's one deliberate WRITE path**,
`OptimizerCore.restoreState` (§2d), when a saved test case is loaded. It also
owns three controls that live in `optimizer.html`'s static top bar — one feature,
one file.

### Top bar

In order: the **message bar** (§13; not History's), **Test Case Name**
(`#tcName`, ≤ 60 characters), the **user chip** `#tcUser` (filled by the
pre-load page, §14.3 — name as text, initials in `data-ini`), **Save Test**
(`#btnSaveTest`), **Clear** (`#btnClear` — resets the whole test case: default Settings with the Reference Date back to today, one blank Insured, one blank Coverage, Unit Values back to their default (1,000) and the Test Case Name emptied; returns to Input & Results; **no confirmation and no undo**, like every other removal on this page — nothing is saved to History), then the theme button. (There is no Username dropdown any more —
the pre-load page chooses the user.)

**Save Test** requires a non-blank name (red box, a toast and a message-bar
entry otherwise). On success it builds one catalog entry, adds it to History,
clears the name box and writes the file (below).

### Persistence — History list AND a real file

- **History** = the browser's `localStorage` (`coverage-optimizer-testcases`) —
  instant listing and one-click **Load**, **merged at every launch with everything in
  `history_data/`** (below), so a case saved by any of the three users is there when the
  tool opens. Read/write are wrapped in `try/catch` and **failures are reported**
  (§13 F-3), never silent.
- **Loaded from the folder on every start** (`loadFromFolder`): `GET /history_data/` (a
  `server.py` route) returns every `.json` in the folder in one reply. Merged with this
  browser's list **by `id`** (the id is inside the file, so a case is never listed
  twice); a case this browser saved as a file that is no longer in the folder (someone
  deleted it) is dropped; a case that only ever reached Downloads (no `file`) stays.
  Files that are not test cases (no `name` / `snapshot` lists, or not valid JSON) are
  skipped and named in a message (§13 F-6); if the folder cannot be read the list falls
  back to this browser's own cases and says so.
- **The file**: `saveToDataFolder(filename, entry)` POSTs to `server.py`
  (`_start-coverage-optimizer.bat`), which writes `history_data/<initials>_<name>.json` and never
  overwrites (§14.2). It resolves `{ name }` (what was written) or `{ why }`
  (server unreachable / HTTP status). On `{ why }` the case is **downloaded
  instead** (`downloadJSON`) and the bar explains (§13 F-2). A page can never
  choose where a download lands.
- **Import Test Case** reads a `.json` back through a file picker and adds it to
  this browser's list — the only way a colleague's file reaches your History.
  Validated: parseable JSON, a `name`, and a `snapshot` with `insureds` and
  `coverages` arrays (§13 F-4); it **keeps the case's own id** (a new one would list a
  file that also sits in `history_data/` twice) and refuses a case already listed.

### The catalog entry

`{ id, name, user, savedAt, insuredCount, coverageCount, snapshot }` (+ `file`, the
`history_data/` file name, added in memory once written or loaded from the folder) where
`snapshot` = `core.snapshotState()` (Settings, Insureds, Coverages — deep-cloned
JSON) **plus** `unitValues` (the Coverages tab's own field, folded in by
`buildSnapshot`). `savedAt` is local wall-clock (`nowStamp()`). **Rate files are
not part of a test case** — a loaded case re-resolves against whatever rates are
loaded. `restoreState` ignores a legacy `joint.age` (Joint Age is calculated
now).

### The table — 8 columns

Test Case Name · Username · Date Saved · Number of Insureds · Number of
Coverages · Total Modal Premium (muted `—`; could now be the sum of each
coverage's Modal Prem., but a saved case stores inputs, not figures — *TO_DO C-4*)
· **Load** (`data-act="load-tc"`) · **Delete** (`data-act="del-tc"`, immediate, no
confirmation — same convention as Remove elsewhere). **Newest first** (the id starts with
the save time in ms). **Delete also moves the case's file** to `history_data/_deleted/`
(`DELETE /history_data/<name>.json` — moved with a timestamp, **never erased**, so a
mistaken delete is recoverable by moving it back); otherwise the file would reappear at the
next start. If the move fails the case is gone from the list and the bar says the file will
come back (§13 F-7).

**Filter row** (a second header row): **Test Case Name** and **Date Saved** are text boxes
matching *contains*, case-insensitive (`21-SEP-2026`, `SEP`, a word from the name);
**Username** is a dropdown of the people who have saved (*All* by default). The filters
combine (AND); **Clear filters** resets them; the count reads `n of m test cases` while
filtered. Only the table body re-renders, so what you typed keeps focus.

**Load — order matters, and it is guarded.** `buildSnapshot()` takes a backup of
what is on screen, then `core.restoreState(entry.snapshot)` runs **first**, then
`core.setSnapshot('unitValues', …)` (Unit Value's `set` re-syncs against whatever
`coverages` holds, so it must run after them or it discards the restored values
as stale, §9 #34). If either throws (a damaged / hand-edited file) the backup is
restored and the bar reports it (§13 F-5). On success it switches to Input &
Results.

Key functions: `loadCatalog`, `persistCatalog`, `safeFileName`, `downloadJSON`,
`saveToDataFolder`, `buildSnapshot`, `buildEntry`, `doSaveTest`, `doImportFile`,
`doLoad`, `doDelete`, `historyRow`, `renderHistoryTab`, `historyTabShell`, a
local `toast`, `initHistoryTab` (wires the tab's delegated clicks **and** the
top-bar controls).

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
| `.col-soft-sep` | **Optimizer-only** (§2f) — `optimizer_rates.css`, not `optimizer.css` (like `.cov-tab-table` below, this table's one exception). A LIGHTER version of `.col-hard-sep` (`--line-strong`, 1px, vs. `--ins-border` at 2px) — marks where one INSURED's 6-column group ends and the next begins in Rates' own scrollable region, a weaker boundary than a group-of-groups separator deserves. Not in `inforce.css`. |
| `.cov-tab-table` | **Optimizer-only** (§2d) — defined in `optimizer_coverages.css`, not `optimizer.css` (one of two entries in this table that isn't, alongside `.col-soft-sep` above): just `.fi { width: 84px; }`, narrower than the base 92px so Unit Value's input sits comfortably in this table's dense cells. |
| `.hist-tab-table` | **Optimizer-only** (§2h) — reserved hook in `optimizer_history.css`, same convention as `.ins-tab-table`/`.cov-tab-table`, no rule yet. Not in `inforce.css`. |
| `.rate-import-bar` / `.rate-status` (`--warn`/`--err`) | **Optimizer-only** (§2f). Rates' own import controls row, and the persistent two-line "what's loaded" summary beneath it (colour modifiers reuse `--warn`/`--neg`, no new tokens). Not in `inforce.css`. |
| `.rate-progress` / `.rate-progress-label` / `.rate-progress-bar` | **Optimizer-only** (§2f). The chunked-import loading bar — a label plus a native `<progress>` themed via `accent-color: var(--accent)`, no custom track/fill markup needed. Hidden outside an active import. Not in `inforce.css`. |
| `.rate-body` / `.rate-scroll` / `.rate-fixed` / `.rate-tab-table` | **Optimizer-only** (§2f). One coverage's rate card split into two independent table regions sharing one row axis: the flex row itself, the scrollable per-insured side (`.table-scroll-wrap`, above), the side that never scrolls, and the table-width override (`width: auto; min-width: 100%`) that lets `.rate-scroll`'s overflow actually trigger — `.ins`'s own shared `width: 100%` rule would otherwise cap the table at its container and silently prevent scrolling. Not in `inforce.css`. |
| `.bd-band-figs` / `.bd-band-fig` (`--warn`) | **Optimizer-only** (§2g). A "micro label over a value" pair embedded IN a `card-head--band`, for Backdate's Illustration Date/Max. Backdate Date/Final Backdate Date (and Backdate Projection's Monthly/Annual Savings Date). Deliberately NOT `.chip` — `.card-head--band .chip:not(.chip--edit)` (optimizer.css) force-inverts a chip's colours inside a band, which would swallow the `--warn` amber the `--warn` modifier needs; a new class sidesteps that collision instead of touching the shared rule. Not in `inforce.css`. |
| `.proj-slot` | dashed empty placeholder with `.t` title and `.s` subtitle — what every live tab's own empty-state falls back to |
| `.issues` / `.issues-box` / `.issues-ico` / `.issues-txt` / `.issues-nav` / `.issues-n` / `.issues-pop` | **Optimizer-only** (§13). The top-bar message bar: the flex area between the brand block and Test Case Name, the red box, its icon, the two-line-clamped text, the counter + ▲ ▼ group, and the full-text popup. Reuses `--neg` / `--neg-soft` / `--surface` — no new tokens. Not in `inforce.css`. |
| `.btn--sm.btn--icon` | **Optimizer-only**: the 21 px square icon button used by the message bar's ▲ ▼ ✕ (`.btn--icon` alone is 27 px) |
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
| Top bar | `btnTheme`; `tcName`, `tcUser`, `btnSaveTest`, `btnClear` (Save Test / Clear, §2h — static markup, wired by `optimizer_history.js`) · the message bar (§13): `issues`, `issuesBox`, `issuesTxt`, `issuesNav`, `issuesN`, `issuesUp`, `issuesDown`, `issuesX`, `issuesPop` (wired by `initIssueBar()` in `optimizer.js`) |
| Pre-load page | `preload`, `plTitle`, `plRate_termLife`, `plRate_permLife` (`data-state` = `notloaded` / `loading` / `loaded`), `plLabel`, `plBar`, `plRetry`, `plStart`, `plHint`, `plSkip` (dev bypass) — wired by `optimizer_preload.js`; the rate rows by `optimizer_rates.js` (§14.3) |
| Tabs | `tabList`, `hdrStamp` (empty; reserved for an "as of" stamp) |
| Panes | `panes` (host), then one per tab: `optInput`, `optCoverages`, `optInsureds`, `optRates`, `optBackdate`, `optHistory` |
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
`resolveCov`. Rates (§2f) has no `data-fk` OR `data-act`
— its two buttons are matched by element `id`; nothing in its tables is editable.
The message bar's buttons are matched by `id` too, and every *field* that can be
rejected must use `badInput`/`goodInput` (§13, §9 #47).

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
| `#btnClear` | `click` | `doClear()` (§2h) — `core.clearState()`, `setSnapshot('unitValues', {})` (each coverage re-defaults to 1,000), empties `#tcName`; in `optimizer_history.js` like Save Test |
| `#tcName` | `keydown` | Enter triggers `doSaveTest()`, same as blurring a `data-fk` field commits elsewhere |
| `#issuesUp` / `#issuesDown` / `#issuesX` / `#issuesTxt` | `click` | previous / next message (wrapping) · clear the one shown (**Shift+click clears all**) · toggle the full-text popup (Enter/Space too) — `initIssueBar()` |
| `document` | `click` | (also) close the message popup when the click is outside `#issuesBox` |
| `window` | `error`, `unhandledrejection` | raise the "Unexpected error" message (§13 G) |
| `document` | `ratesstatus`, `unitvaluechange` | `refreshIssues()` — and Results, Coverages, Backdate re-render on the same events |

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
| `toast(msg, kind)` | transient message; `kind` is `'err'` or omitted. **A failure the operator needs to act on also goes to the message bar** (`raise` / `badInput`, §13) — a toast disappears in 5 s |
| `raise`, `resolve`, `badInput`, `goodInput`, `diagnostics` | the message-bar API (§13) — also on the bridge |
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
*Backdate*) and the *Coverage Input*/*Insured
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
18. `maxInsuredsFor(category, covType)` — 1 for Individual or unset, 5 for Term Life
    Joint First-to-Die (2 for Permanent Life JFTD), 2 for either Joint Last-to-Die
    variant (§2b's table) — is
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
33. **The Axis Key builder never guesses at a value the format didn't
    specify** (`axisKeyResult`, §12.2). `WL to 100` / `Term to 100` (`VEG100` /
    `T100`) are the two **2017-style** Permanent products: a 27-character prefix +
    band = 33, `T_` + the code padded to 13 with `_` + `17-01_` + sex + rate + `____`,
    with their own band lists (§12.4) — the layout was supplied by the requester,
    not inferred. Any other Permanent code that is not 5 characters (there is none
    today) still returns a `why` rather than a padded key. Every path that can't
    build a key returns a sentence (`axisKeyWhy`) — keep that: it is what the Error
    cells and the message bar quote.
34. **History's Load order is restoreState() THEN setSnapshot('unitValues',
    …), never the other way round** (§2h) — Unit Value's own `set` callback
    re-syncs against whatever `coverages` currently holds, so it has to run
    after `coverages` already reflects the loaded snapshot, or it discards
    the just-restored values as stale.
35. **Rate files are read from `rates/` on every launch and are never cached**
    (§2f, §14.3) — an earlier `localStorage` cache (`coverage-optimizer-rates`)
    was removed on purpose: the files are the source of truth, and a stale cache
    silently priced coverages against old rates. They are also **not** part of
    a saved History test case (`coverage-optimizer-testcases`) — reference data,
    not a scenario input. Don't fold rate state into `snapshotState()`/
    `restoreState()`; a loaded test case re-resolves against whatever rates are
    loaded.
36. **Only one rate-file import runs at a time; concurrent requests queue,
    they never run simultaneously** (`importQueue`, §2f) — "Load from
    `rates/`" fires off Term Life and Permanent Life together on purpose,
    and the launch-time `loadFromRatesFolder()` does the same on every page load. The
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
39. **Backdate and Rates are wired together, one value each way, and the
    direction matters** (§12.5, §12.7). Backdate **reads** Rates
    (`core.allCovRate` — Σ of PR_N / PR_BD_N per insured). Rates (BD_Final) and
    the Joint Age Backdated (`equivAge`) **read** Backdate's *eligibility only*
    (`core.backdateEligible`). **Never** make either read Confirm Backdate or Backdate
    Date: those depend on the rates, which would make the dependency circular.
    `bandFinalTotals` stays a separate call from `bandTotals` so an undecidable
    BD_Final can never take Modal Prem. down with it.
40. **The Joint Age is calculated, never typed** (§12.6). There is no
    `c.joint.age`; `equivAge()` is the only source and `jointAge()` /
    `jointFigures()` are thin readers of it. A saved test case carrying an old
    `joint.age` must keep loading (the field is ignored). The four Joint inputs
    that *are* typed (Equiv. Substd. %, Flat Perm $, Flat Term $, Duration) stay
    manual until a formula is supplied (*TO_DO C-8*).
41. **The Excel-faithful arithmetic is deliberate** (§12.8): `xRound`/`xTrunc`
    work on the decimal value (2.675 → 2.68), Monthly `modal_factor` is the literal
    `0.09` (not 1/12), `prem_adj_percentage` is Prem. Adj. % ÷ 100, and
    `modalPremAt` ends with an outer `ROUND(…, 2)` that is **not** in the Excel
    formula — it exists so a computed premium can be compared with a typed one
    (163.99 + 1.80 = 165.79000000000002). Remove none of these "for tidiness".
42. **A band is the closest LOWER one** (§12.4) — never the nearest, never the
    next one up; an Input Premium coverage's band and amount come from its
    Prem. Basis Ins. Amt, and Modal Prem. Backdated uses the **same** band as
    Modal Prem.
43. **The two rate-version stamps live in two places** (§12.2): `RATE_VERSION` /
    `PERM_VERSION` (`optimizer_rates.js`) **and** the literals in
    `axisKeyTermLife` / `axisKeyPermLife` (`optimizer.js`). Change both or none.
44. **The message bar stays quiet on a blank page** (§13.1). A provider must
    raise only for something the tool cannot do with what was *entered* — never for a
    record the operator has not started (no Category, nothing chosen). A message on
    a pristine page, or a message that says the same thing as a yellow highlight,
    is a bug.
45. **Every failing lookup carries a reason.** A rate function that returns
    `{ error: true }` without a `why`, or the Axis Key / `equivAge` returning no
    sentence, degrades every tooltip and message to a generic line. New failure ⇒
    new `why`, in words, naming the record and the fix (§13.3).
46. **A message is derived from the same result functions the cells use** (§13.1),
    never a second copy of the rule — otherwise the bar and the Rates/Coverages
    cells will disagree the first time the rule changes. Diagnostics need
    **stable, unique keys** (record ids + reason), or two problems collapse into one
    message, or one problem duplicates.
47. **Every rejected field commit goes through `badInput(el, msg, where)` /
    `goodInput(el)`** — never a bare `classList.add('fi--bad')` + `toast()`. The
    message is tied to the box (it disappears when the box is re-rendered,
    corrected or removed); an untied one would linger forever.
48. **`server.py` never overwrites and accepts only a bare `.json` name** (§14.2);
    Save Test falls back to a download rather than losing a case, and says so
    (§13 F-2). Don't loosen the name pattern — it is what keeps a POST inside
    `history_data/`.
49. **Load is transactional** (§2h): back up the on-screen state, `restoreState`,
    then `setSnapshot('unitValues', …)`; on any throw, restore the backup and
    report (§13 F-5). A damaged file must never leave the tool half-loaded.
50. **Text or error cells in a rate workbook are skipped, never coerced**
    (§12.3): `Number('#N/A')` is `NaN`, which would flow through every sum as a
    "number". The skip is counted and reported (§13 E-7).

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
state through `window.OptimizerCore` only (§2d).

**Add a split-off tab that needs to WRITE shared state, not just read it**
— don't. Extend the read-only bridge with another write path only with the
same justification `restoreState` had (§2d, §9 invariant #30): a bulk
overwrite of `coverages`/`settings`/`insureds` that only `optimizer.js` can
safely perform. Everything else — a tab's own local state (Unit Value,
`showProjection`) — goes through
`registerSnapshot`/`getSnapshot`/`setSnapshot` (§2d) or just stays private
to that file, never a second general write path.

**Add a rate category to Rates (§2f)** — Permanent Life is the template for
adding a THIRD, after Term Life: one entry in `BAND_TABLES` (the fixed band
list), a new `ingest<Category>Workbook`/`lookup<Category>Rate` pair
following the same chunked-parsing shape (`processRowsChunked`), and a
branch in `detectAndIngest`'s sheet-name sniffing. `coverageRatesCard`
already generalises over `BAND_TABLES[c.category]` — no UI change needed
once the category has a band table and a real parser behind it.

**Add an error case** — §13.3: an event (`raise`/`resolve`), a rejected field
(`badInput`/`goodInput`) or a diagnostic (`core.diagnostics`), each with a `why`
sentence, and a row in the §13.2 catalogue and the §11.5 checklist.

**Change a rate-table version** — both places, §12.2 / §9 #43.

**Add a Coverage Category's rates (e.g. Critical Illness)** — a `BAND_TABLES`
entry (§12.4), an Axis Key layout in `axisKeyResult` returning `{ key }` / `{ why }`
(§12.2), a rate-file ingester (§2f "Add a rate category"), the fee rule in
`recalcFees`, the Coverage Type list in `covTypeOptions`, and the Modal Prem. rules
(currently amber). Add its failure reasons to the catalogue.

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

Rewritten 2026-09-20 to match the tool as it is now (the earlier list described
the scaffold: blank-default fields, "pending" calculations, a cached rate file).
Run through it after any change and report failures honestly. Items marked **(Δ)**
are the ones most likely to break when a calculation is edited. Numeric cases need
rate files — with the real ones on the work machine, or a small synthetic workbook
(§13.4) whose numbers you compute by hand.

### 11.1 Load and shell
- [ ] Started with `_start-coverage-optimizer.bat`: the **pre-load page** appears; the tool
      behind it is inert (no Tab / click) until **Start**.
- [ ] Both rate rows go red → yellow → green (*Not loaded → Loading → Loaded*) with
      a moving progress bar and label; **Start** stays disabled until a name is
      picked **and** both are green. Rename `rates/…` and reload: the row stays red,
      the label names the file and the HTTP status, **Retry** appears; restore and
      Retry: green.
- [ ] After Start: six tabs in order — Input & Results · Coverages · Insureds · Rates
      · Backdate · History — the first selected; each shows exactly one pane and
      writes its label to the status bar. **No "Eq. Age" tab.**
- [ ] No console errors (a 404 for the rate files is expected only when they are
      absent). A pristine page shows **no** message in the top bar (§9 #44).
- [ ] Top bar, left to right: tool switcher · message area · Test Case Name · user
      chip (your name) · Save Test · theme button. Light/dark both readable;
      no horizontal page scroll at 1280 and 1920 px.
- [ ] The switcher lists both tools (own badge colours, tick on this one); Inforce
      navigates to `inforce.html`; Escape / outside click closes; the theme choice
      carries over.

### 11.2 Inputs (Settings, Insured Input, Coverage Input)
- [ ] **Settings** (left→right): Reference Date (= today) · Payment Frequency
      (**blank**) · Multi-Coverage Discount OFF · Prem. Adj. % 100 · % Dur. 0 ·
      Prem. Adj. $ 0.00 · $ Dur. 0. A date in any of the four formats normalises to
      `DD-MMM-YYYY` **in the box**; day 29/30/31 becomes 28; numbers echo grouped
      (`1234.5` → `1,234.50`); `*Dur.` accepts 0 and rejects negatives.
- [ ] **Insured Input** starts with `Insured-1`; **Sex and Rate are blank (`—` /
      `— Select —`) and highlighted yellow**, Birthdate blank, Age Calculation
      `Age Nearest`; Remove disabled at one. One row of seven cells. Ages:
      reference date `01-JAN-2026`, `22-JUL-1974` → Real 51 / Nearest 51;
      `15-MAR-1990` → 35 / 36 **(Δ)**. Age Calculated's label reads *Age Nearest* /
      *Age Last*. A Name > 30 characters or an age outside 0–120 is rejected (red box,
      toast, **message in the bar**, record unchanged).
- [ ] **Coverage Input** starts with one coverage: Category, Coverage, Coverage Type
      **blank and highlighted**; Calculation Type = *Coverage Amount*; Input blank.
      Input is a **whole number** for Coverage Amount and **2 decimals** for Input
      Premium; switching Calculation Type clears Input with a toast.
- [ ] Changing Category resets Coverage, Coverage Type, Fee and every slot's Rate.
      Fees: Term Life — highest duration $40, the rest $20 (Remove the top one → it
      reassigns); Permanent Life always $40; Critical Illness blank (Coverage Type
      and Fee inert placeholders). A typed fee sticks; clearing it restores the default.
- [ ] Coverage Type caps: Individual 1 · **Term** JFTD 5 · **Perm** JFTD 2 · JLTD 2 ·
      JLTDPU 2; the Add button disables at the cap; lowering the cap truncates with a
      toast. Two slots on one coverage cannot pick the same insured.
- [ ] Rate options: Term Life Preferred P1/P2/P3, Regular R1/R2; any other
      category P / R. A fresh slot shows `— Select —`, not `P1`; picking **P1**
      commits. Flipping an insured's own Rate clears stale codes on every
      coverage that references them.
- [ ] Extra Premium (four mini-fields): defaults `0` / `0.00` / `0.00` / `0` and
      **none disabled**; a non-zero Perm $ locks Term $ and Term $ Dur. and vice versa;
      Perm % never locks.
- [ ] **Joint container** (Perm + JFTD/JLTD/JLTDPU): appears with the second slot
      added automatically; the insureds' own Rate / Extra Premium boxes are disabled;
      Joint Sex `M`, Joint Rate `N`; **Joint Age is read-only and calculated**; the four
      inputs start blank + yellow; Perm $ and Term $/Duration lock each other.
      Removing an insured a slot points at clears the slot.

### 11.3 Calculation regression cases **(Δ)**
Use these before trusting any change to §12.
- [ ] **Axis Key** (Insureds tab, prefix): Term 10 / Individual / F / Preferred / P1 /
      MCD off → `DT_T10__________2509_FNP1_` (26 chars); MCD **on** → segment becomes
      `RMC_2509_`; Coverage Type JFTD → 3rd character `C` and the MCD segment stays
      `____2509_` even with MCD on. Perm WL 10 Pay / Individual / F / Preferred →
      `DT_VEG10________2007_FN___`; any joint type → `…_MN___` whatever the insured's
      sex. `WL to 100` / `Term to 100` / Critical Illness → amber; the Rates tab says why.
- [ ] **Joint Age** (Perm WL 10 Pay; M non-smoker 35 + F smoker 50, "last birthday"):
      JFTD **53** · JLTD **34** · JLTDPU **41**. M-N 60 + F-S 55 JLTDPU → 58. M-N 40 +
      F-N 38 JFTD WL 20 Pay → 46. A JLTDPU with a life under 18 → red Error.
      *Backdated*: WL 10 JFTD M-N 40 / F-S 29: neither backdatable → 44; both → 43.
- [ ] **Band rule**: Term 30,000 → B00025 · 99,999 → B00050 · 8,974,632 → B02000;
      Perm 17,500 → B00010 · 249,999 → B00100 · 250,001 → B00250; below the lowest →
      blocked.
- [ ] **Modal Prem.**: Input Premium ⇒ the typed premium. Coverage Amount ⇒ §12.8 with
      Excel rounding (`2.675 → 2.68`). Monthly factor `0.09`, Annually `1.00`. A blank
      Payment Frequency blocks it (and shows the message).
- [ ] **Highest Amt / Prem. Basis**: 240,000 costs 66.60 ⇒ Max **1,440,109**; premium 66.60
      ⇒ **1,440,109**; premium 165.79 ⇒ **152,669**; 64.66 ⇒ **222,173**; 13.05 ⇒
      **25,010**. Highest Amt appears only when a higher band is reached.
- [ ] **Backdate**: Final Backdate Date of 13-JUL-2026 / blank / 24-MAY-2026 =
      24-MAY-2026; a non-eligible insured shows a real `FALSE` and a blank date; Max.
      Backdate Date = Illustration Date − 6 months; a Midpoint on day 29–31 shows 28.
- [ ] Results **Modal Prem** and **Modal Prem Backdated** equal the Coverages tab's;
      Summary Modal Premium = the sum of the rows; a non-backdatable insured gives
      Backdated = Modal Prem.

### 11.4 The tabs
- [ ] **Coverages**: 24 columns in order (§2d); Unit Value defaults 1,000, survives
      unrelated edits, rejects < 1 / > 999,999,999 / non-integers; Payment Frequency, any
      Prem. Adj. field or MCD updates every row on the same commit; Modal Factor
      `1.00` / `0.09`; the two "Joint Extra Prem. Backdated" columns are amber.
- [ ] **Insureds**: the worked example (Cov 1 → Ins 1 & 2, Cov 2 → Ins 2, Cov 3 → Ins
      2 & 3) gives rows `1_1 1_2 2_2 3_2 3_3`; 24 columns with hard separators before
      *Joint Sex* and *Axis Key*; on a joint coverage the per-slot Rate / Extra Premium
      columns show `—`; no listener on the tab.
- [ ] **Rates**: one container per coverage; a band table (8 Term / 6 Perm) or the
      "not built yet" card; per insured a 6-column group; the right block (Total /
      BD_Total / BD_Final, 9 columns) never scrolls. An Error cell's tooltip is a
      sentence. Import a Term-only then a Perm-only file, then both back-to-back — both
      status lines populate. A non-rate workbook changes nothing and says why.
- [ ] **Backdate**: header shows Illustration Date, Max. Backdate Date, Final Backdate
      Date; 13 columns; rates in columns 10–11 sum the insured's coverages; Confirm
      Backdate / Backdate Date follow §12.7; Show Projection starts OFF and expands
      to amber headers with a single placeholder row.
- [ ] **History**: Save Test with no name is refused (message in the bar); with a name
      it saves, clears the box, adds a row (initials-prefixed) **and writes `history_data/`**;
      **restart the tool: every case in the folder is listed** (drop a case saved by someone else
      into the folder and restart — it appears); the **filter row** narrows by name / user / date
      (`n of m test cases`), Clear filters resets; **Delete** removes the row and moves the file to
      `history_data/_deleted/`;
      change inputs (including Unit Value), **Load** the earlier save → everything
      reverts including Unit Value, and the view returns to Input & Results; Delete
      is immediate; **Import Test Case** adds a row with a fresh id.

### 11.5 The message bar (§13) — every item **(Δ)** when errors are edited
- [ ] Pristine page: no message. Type a bad birthdate (`31-FEB-2000`): a message
      appears; correct it: the message disappears.
- [ ] Set the Reference Date earlier than an insured's birthdate: B-3 appears; fix: gone.
- [ ] Term Life coverage, insured chosen but no Sex: the bar says *Insured "…" has no
      Sex* (and the Rates cells' tooltips say the same); add Sex → the next missing
      prerequisite appears (Rate → Coverage Rate → Birthdate → rate row).
- [ ] A coverage whose Axis Key has no row in the file: the message quotes the full
      Axis Key, the age and the bands affected. A file not loaded: **one** message for
      the file, not one per coverage.
- [ ] Joint Perm with Equiv. Substd. % blank: **one** message "· Joint" (not one per
      insured). `WL to 100` / `Term to 100`: a 33-character key (§11.3).
- [ ] Payment Frequency blank with a complete coverage: **one** message for the page;
      set it: gone. Amount 5,000 (Perm): "below the lowest rate band".
- [ ] Two or more messages: the counter `n / total` and ▲ ▼ appear and wrap; **✕**
      removes the one on show and moves to the next; **Shift+✕** clears all; a cleared
      message stays gone across re-renders and returns only after its cause is fixed and
      re-broken. Click the text: the popup shows the full message; click elsewhere: closes.
- [ ] History: import a non-JSON file, a JSON without `name`, one without `insureds` /
      `coverages` lists — each a message; load a damaged case — a message and the previous
      state is back; stop the server and Save — the case downloads and the message names
      the reason.
- [ ] Rate files: rename one (E-1), feed a non-rate workbook (E-3), one with a
      missing sheet (E-4), an empty one (E-6), one with `#N/A` cells (E-7).
- [ ] A thrown error (console: `setTimeout(function(){throw new Error('x')})`) raises the
      "Unexpected error" message.

### 11.6 Layout measurements (unchanged from the original build)
- [ ] `.fc-row--7` (Insured Input) at ~1250 px with a 30-character Name and the longest
      option text: no clipped cell (margins are ~11 px on Rate — measure with
      `getBoundingClientRect()`, do not eyeball).
- [ ] `.cov-row-all` (six fields on one line) at ~1250 px with the longest Category /
      Coverage / Coverage Type strings and `999,999,999.99`: fits (single-digit margin — do
      not add a 7th field or shrink it without re-measuring).
- [ ] Results' coverage table needs no horizontal scroll at 1250 px
      (`scrollWidth ≤ clientWidth` on `.results-cov-wrap`) with the longest Coverage cell;
      the override did not change Inforce's own `.ins` tables.
- [ ] The message bar's two-line clamp and popup do not overlap the tab bar at 1280 px;
      with a long message the ▲ ▼ ✕ controls stay visible.
- [ ] `--accent` resolves to `#345165` (light) / `#7FA0B8` (dark); `--edit` to `#7E6115` /
      `#D2AE5F` — the same as Inforce. `inforce.*` shows no diff.


---

## 12. Calculation logic — every formula, in the order the data flows

**This section is the authority for what the tool computes.** §2–§2h describe
the screens; this describes the arithmetic behind them. Every rule below is
implemented exactly as written; a line that says *(assumption)* is a reading
the requester confirmed or accepted, not something the source spreadsheet
spelled out, and is tracked in `TO_DO.md`. The tool exists to reproduce a
spreadsheet (an Excel workbook of `LET()`/`LAMBDA` formulas), so **when in
doubt, reproduce the spreadsheet's arithmetic — do not "improve" it**: the
rounding rules (§12.10), the 30-day-month age algorithm (§2) and the
"closest lower band" rule (§12.4) are all deliberate.

### 12.0 The pipeline at a glance

```
Insured (Sex, Rate, Birthdate, Age Calculation) ─┐
Settings (Reference Date, Payment Frequency,     │
          MCD, Prem. Adj. %/$)                   ├─► ages (§12.1)
Coverage (Category, Coverage, Type, slots,       │
          Calc Type, Input, Fee, Extra Prem.)    ┘
      │
      ▼
Axis Key (§12.2) ──► rate files (§12.3) ──► PR / EPR / PEP at the coverage's rate band (§12.4–12.5)
      │                                              │
      │  joint Perm: Equivalent Age (§12.6)          ├─► per-band Totals (Rates tab)
      │  supplies the age                            ▼
      ▼                                        Modal Prem. (§12.8)  ──►  Results table, Summary (§12.11)
Backdate tab (§12.7): eligibility → Backdate Date        ▲
      └─► BD_Final (§12.5) ──► Modal Prem. Backdated (§12.9)
Highest Amt / Prem. Basis Ins. Amt (§12.10) run the Modal Prem. formula backwards.
```

Every stage returns one of five **result states** (never a guessed number):

| State | Look | Meaning |
|---|---|---|
| `{ value }` | the figure | computed |
| `{ pending: true }` | amber `.cell-pending` | no formula exists for this yet (Critical Illness; a few Backdate columns — see `TO_DO.md`) |
| `{ error }` / `{ error: true, why }` | red `.cell-error` "Error" | the formula ran and could not produce a number — the `why` sentence is the cell tooltip **and** the message-bar text (§13) |
| `{ blocked }` | muted `—` (reason in tooltip) | an input it needs is missing; nothing is wrong with the formula |
| `{ blank: true }` | empty cell | the column does not apply (Prem. Basis Ins. Amt on a Coverage Amount coverage, Highest Amt on an Input Premium one) |

A total is **never a partial sum**: an Error anywhere makes the total an Error; else a pending makes it pending; else a blocked makes it blocked.

### 12.1 Ages

- **Age Real / Age Nearest** — the stepwise 30-day-month algorithm of §2
  (`agesAt`). Never re-implement it; never use Inforce's.
- **Age used everywhere ("Age Calculated")** = Age Real if the insured's own
  *Age Calculation* is "Last Birthday", else Age Nearest. This is the age every
  rate lookup, the Equivalent Age (§12.6) and the Insureds tab use.
- **Measured against `settings.refDate`** (the "Illustration Date"), never
  today. A Reference Date day of 29/30/31 is stored as 28 (any month).
- **Backdated age** — today a stand-in: `age − 1` (*assumption — TO_DO C-2*).
  The Backdate tab also computes a "Backdated Age Nearest/Last" at the
  Midpoint date (§12.7); the Rates `_BD` columns do **not** use it yet.

### 12.2 The Axis Key — how it is built

The Axis Key is the string the rate workbooks are indexed by (column D). It is
**32 characters** (**33** for the two 2017 products, below) = a **26-character
prefix** (27 for those two) built from the inputs + a **6-character rate-band code**
(§12.4) appended by the Rates tab. The Insureds
tab shows the prefix; the Rates tab completes it per band. Built by
`axisKeyResult()` in `optimizer.js`; if a key cannot be built it returns the
reason in words (`core.axisKeyWhy`), which is what the Error cell's tooltip and
the message bar quote.

**Term Life** (`axisKeyTermLife`) — 26 characters:

| Chars | Segment | Value |
|---|---|---|
| 2 | `DT` | fixed |
| 1 | type | Coverage Type **Individual → `_`**, **Joint First-to-Die → `C`** (no other Term Life type exists) |
| 3 | coverage | `T10` `T15` `T20` `T25` `T30` `T65` (`COVERAGE_ABBR`) |
| 6 | `______` | fixed (six underscores) |
| 9 | MCD block | `RMC_2509_` when **Has MCD** is ON **and the type is not Joint First-to-Die**, else `____2509_` (four underscores). JFTD has no MCD-rated table, so its block is always blank even with MCD ON |
| 1 | sex | the insured's Sex, `M` / `F` |
| 1 | insured rate | Preferred → `N`, Regular → `S` (`insuredRateCode`) |
| 2 | coverage rate | the **slot's** Coverage Rate: `P1` `P2` `P3` (Preferred) / `R1` `R2` (Regular) |
| 1 | `_` | fixed |

**Permanent Life** (`axisKeyPermLife`) — 26 characters (every product except `VEG100` / `T100`):

| Chars | Segment | Value |
|---|---|---|
| 2 | `DT` | fixed |
| 1 | `_` | fixed |
| 5 | coverage | `VEG10` `VEG15` `VEG20` `VEG65` — **exactly 5 characters** |
| 8 | `________` | fixed (eight underscores) |
| 5 | `2007_` | the Permanent rate-table version stamp + `_` |
| 1 | sex | Individual: the insured's Sex. **Any joint type (JFTD / JLTD / JLTDPU): always `M`** (`JOINT_SEX`) |
| 1 | rate | Individual: `N`/`S`. **Any joint type: always `N`** (`JOINT_RATE`) |
| 3 | `___` | fixed |

Perm Coverage Type only has to be *chosen* (a blank one is not "Individual");
Individual vs joint differs solely through the sex/rate pair (`MN` for joint).

**The full key** = prefix + band code. Worked examples (all verified):

| Case | Full Axis Key |
|---|---|
| Term 10, Individual, F, Preferred, Rate P1, MCD off, band B00100 | `DT_T10__________2509_FNP1_B00100` |
| Term 10, Individual, M, Regular, Rate R2, MCD **on** (prefix only) | `DT_T10______RMC_2509_MSR2_` |
| Term 20, Joint First-to-Die, M, Preferred, P3 (prefix only; MCD irrelevant) | `DTCT20__________2509_MNP3_` |
| WL 10 Pay, Individual, F, Preferred, band B00100 | `DT_VEG10________2007_FN___B00100` |
| WL 10 Pay, any joint type, band B00100 | `DT_VEG10________2007_MN___B00100` |
| …its **Substandard** (EPR) key | `DTSVEG10________2007_MN___B00100` — first 3 characters `DT_` → `DTS` |
| WL to 100, Individual, M, Regular, band B00500 — **2017 layout, 33 characters** | `T_VEG100_______17-01_MS____B00500` |
| …its Substandard (EPR) key | `TSVEG100_______17-01_MS____B00500` — the **2nd** character `_` → `S` |
| Term to 100, Individual, F, Preferred, band B00010 | `T_T100_________17-01_FN____B00010` |
| …its Substandard (EPR) key | `TST100_________17-01_FN____B00010` |

**The 2017 layout** (`VEG100` = *WL to 100*, `T100` = *Term to 100*; older rates in the same
`perm_rates_2007_combined` sheet) — 27-character prefix + 6-character band:

| Chars | Segment | Value |
|---|---|---|
| 2 | `T_` | fixed |
| 13 | coverage | the code padded on the right with `_` to 13 (`VEG100_______`, `T100_________`) |
| 6 | `17-01_` | the 2017 version stamp + `_` |
| 1 + 1 | sex, rate | as the standard layout (Individual: the insured's own; **joint: `M`, `N`** — *assumed the same, TO_DO R-12*) |
| 4 | `____` | fixed |

The lookup itself is identical (Axis Key + age → rate). The Substandard key is built by
`substandardKey` (`optimizer_rates.js`): a key starting `T` swaps its 2nd character for `S`,
any other swaps its 3rd (`DT_` → `DTS`).

**Cases with no key** (each has a message-bar sentence, §13): no insured on
the slot; no Coverage; no Coverage Type; Term Life with a Coverage Type other
than Individual/JFTD; insured without Sex; insured without Rate; Term Life slot
without a Coverage Rate; Critical Illness (no format given).
(`WL to 100` / `Term to 100` have a key — the 2017 layout above.)

> **Changing a rate-table version.** The stamps `2509` (Term) and `2007`
> (Perm) appear in **two** places that must change together: `RATE_VERSION` /
> `PERM_VERSION` at the top of `optimizer_rates.js` (file and sheet names), and
> the literals `'RMC_2509_'` / `'____2509_'` / `'2007_'` in `axisKeyTermLife` /
> `axisKeyPermLife` (`optimizer.js`).

### 12.3 The rate files

Both live in `rates/` and are read on **every launch** (nothing is cached
between launches — the files are the source of truth). Names are fixed by
`RATE_VERSION`/`PERM_VERSION`.

| File | Sheets | Columns used |
|---|---|---|
| `temp_rates_2509_combined.xlsx` (Term Life) | six: `temp_rates_2509_t10` `_t15` `_t20` `_t25` `_t30` `_t65` | D = Axis Key · E = Duration (1–100, **all kept**, only 1 is read today) · G…DB = age 0…99 (100 columns) |
| `perm_rates_2007_combined.xlsx` (Perm Life) | one: `perm_rates_2007_combined` | D = Axis Key · E = **Age + 1** (1–100 → age 0–99; the `-2` sentinel and anything outside 1–100 is skipped) · G = the rate |

Rates are per **$1,000** of insurance. A cell holding text or an error
(`#N/A`) is skipped (and reported, §13 FL-7) — it must never become `NaN`.
The Term Life sheet a coverage reads is chosen by Coverage
(`TERM_LIFE_COVERAGE_SUFFIX`: Term 10 → `t10` … Term to 65 → `t65`).
Lookups: `lookupTermLifeRate(suffix, axisKey, age, 1)` and
`lookupPermLifeRate(axisKey, age)`; both return `null` for "no such row" —
never a default.

### 12.4 Rate bands and the band rule

| Category | Bands (code — face amount) |
|---|---|
| Term Life | B00025 — 25,000 · B00050 — 50,000 · B00100 — 100,000 · B00250 — 250,000 · B00500 — 500,000 · B01000 — 1,000,000 · B02000 — 2,000,000 · B10000 — 10,000,000 |
| Permanent Life | B00010 — 10,000 · B00025 — 25,000 · B00050 — 50,000 · B00100 — 100,000 · B00250 — 250,000 · B00500 — 500,000 |
| **WL to 100** (Permanent, 2017) | B00001 — 1,000 · B00010 · B00025 · B00050 · B00100 · B00500 — **no B00250** |
| **Term to 100** (Permanent, 2017) | B00010 · B00025 · B00050 · B00100 · B00500 — **no B00250** — · B01000 — 1,000,000 |
| Critical Illness | none — the Rates tab says "not built yet" |

(`bandsFor(c)` picks the list per *coverage*, not per category; every band lookup — the Rates tab rows,
the coverage's band, Highest Amt's per-band candidates — goes through it. The absence of B00250 in the
two 2017 lists is taken from the requester's list of bands — *TO_DO R-12*.)

**A coverage's band is the closest LOWER band**: the highest band whose face
amount is ≤ the amount; at or above the top band → the top band; below the
lowest band → *no band* (blocked: "amount is below the lowest rate band").
Term: 30,000 → B00025 · 99,999 → B00050 · 8,974,632 → B02000. Perm: 17,500 →
B00010 · 249,999 → B00100 · 250,001 → B00250.

The amount used: the **Coverage Amount** for Calculation Type *Coverage
Amount*; for *Input Premium* it is the **Prem. Basis Ins. Amt** (§12.10) — the
most that premium buys.

### 12.5 The rate lookups: PR, EPR, PEP, `_BD`, Final, Total

Per (coverage, insured slot, band), `cellResult()` produces six values —
columns `j = 0…5` = **PR, EPR, PEP** at the current age, then the same three
backdated (`_BD`):

| Value | Formula |
|---|---|
| **PR** | Rate at (Axis Key = prefix + band, **age**). Term Life: the *insured's own* age, at **Duration 1** on this tab (the Rates tab always reads elapsed policy year 0; the Backdate Projection's own per-year engine reads other durations the same way — §12.12). Perm Individual: the insured's own age. **Perm joint (JFTD/JLTD/JLTDPU): the Joint Age** (§12.6) on the joint key (`MN`) — every insured on the coverage shows the same figure |
| **EPR** | *Term Life:* identical to PR. *Perm:* the Substandard rate — same key with `DT_` → `DTS`, same age |
| **PEP** | `EPR × pct / 100`, where `pct` is the slot's *Perm Extra Prem. %* — or, on a joint Perm coverage, the Joint container's *Equiv. Substd. %*. A blank `pct` is an Error (type `0` for none) |
| **`_BD`** | the same three at `age − 1` (Joint Age Backdated on a joint coverage, §12.6) |

**Final (BD_Final)** — per insured, for PR/EPR/PEP: the current value `_N`
**unless** the insured is *Backdate Eligible* (§12.7) **and** the backdated
value is **strictly lower** — then the backdated one. The `_BD` value is only
looked up for an eligible insured, so a missing `_BD` row cannot spoil an
insured who keeps `_N`. Eligibility unknown (blank/invalid birthdate) ⇒ Error,
never a guess (*TO_DO R-8*).

**Totals** (Rates tab right-hand block, and the inputs to Modal Prem.):
`PR_Total`, `EPR_Total`, `PEP_Total` and the `BD_Total` / `BD_Final` trios are
the **sum** over the insureds on the coverage — every insured for Term Life and
Perm Individual; **Insured 1 alone for Perm joint** (the joint figure is shared,
so summing both would double it). Raw rates are summed; only the display rounds
(2 decimals).

**Cells shown for all bands**, not only the coverage's own; only the
coverage's own band feeds Modal Prem. (a rate error at another band shows red
on the Rates tab and in the message bar but does not block the premium).

### 12.6 Joint Permanent Life — the Equivalent Single Age

For **Perm JFTD / JLTD / JLTDPU** ("Last-to-Die with Waiver of Premium" =
JLTDPU) the two lives are collapsed to one **Joint Age**, shown read-only in the
teal Joint container and used for every rate lookup on the coverage
(`equivAge(c, backdated)` in `optimizer.js`; the old "Eq. Age / Substd. Prem."
tab was removed — this is its calculation). Perm joint is capped at **2
lives**, so the specification's more-than-two-lives loop (steps 2.4/3B for
JFTD) never applies; that case exists only for Term Life JFTD, which uses each
insured's own age and has no equivalent age.

**Rules.** Ages are each insured's Age Calculated (§12.1). Any **negative
intermediate age becomes 0**. An insured **under 18** is treated as a
**smoker** (status `S`). **JLTDPU requires both lives ≥ 18** (else Error).

**Step 1 — adjusted age = age + adjustment**, by age band and the insured's
*status* (sex + `N`/`S`). Last-to-Die (JLTD and JLTDPU) differs from
First-to-Die **only in `FN`** (−2 instead of −3; both −1 at 73+):

| Age | MN | MS | FN (FTD / LTD) | FS |
|---|---|---|---|---|
| 0–43 | 0 | +7 | −3 / −2 | +3 |
| 44–47 | 0 | +6 | −3 / −2 | +3 |
| 48–54 | 0 | +6 | −3 / −2 | +2 |
| 55–57 | 0 | +5 | −3 / −2 | +2 |
| 58–59 | 0 | +5 | −3 / −2 | +1 |
| 60–63 | 0 | +4 | −3 / −2 | +1 |
| 64–65 | 0 | +3 | −3 / −2 | +1 |
| 66–68 | 0 | +3 | −3 / −2 | 0 |
| 69–72 | 0 | +2 | −3 / −2 | 0 |
| 73+ | 0 | +1 | −1 / −1 | 0 |

**Step 2 — temporary equivalent age.** `d = |adjusted₁ − adjusted₂|`.
JFTD: **oldest adjusted + add(d)**. JLTD / JLTDPU: **youngest adjusted − sub(d)**.

| d | 0 | 1–2 | 3–5 | 6–7 | 8–10 | 11–13 | 14–15 | 16–19 | 20–24 | 25+ |
|---|---|---|---|---|---|---|---|---|---|---|
| JFTD add | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 2 | 2 |
| LTD sub | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 | 0 | 0 |

**Step 3 — final.**

- **JFTD** — add **table 3A** (row = youngest adjusted age, column = oldest
  adjusted age); then **floor 18**; then, **only for WL 10 Pay, WL 15 Pay, WL 20
  Pay and WL to 65**, if the result is 19–55 subtract 1 (`WL to 100` and
  `Term to 100` never get it).

| Youngest \ Oldest | 0–14 | 15–27 | 28–30 | 31–33 | 34+ |
|---|---|---|---|---|---|
| 0–14 | +3 | +3 | +2 | +2 | +1 |
| 15–20 | – | +3 | +2 | +2 | +1 |
| 21 | – | +3 | +2 | +1 | +1 |
| 22 | – | +3 | +2 | +1 | 0 |
| 23 | – | +2 | +2 | +1 | 0 |
| 24 | – | +1 | +1 | 0 | 0 |
| 25+ | – | 0 | 0 | 0 | 0 |

  (a "–" cell cannot occur: the oldest is never younger than the youngest.)
- **JLTD** — the Step 2 result, **floor 18**. Nothing else.
- **JLTDPU** — add **3A′** by the *oldest* adjusted age, then **3B′** by `d`;
  **floor 19**:

| Oldest | 0–49 | 50–59 | 60–69 | 70–71 | 72–73 | 74–75 | 76+ |
|---|---|---|---|---|---|---|---|
| 3A′ add | 0 | 1 | 2 | 3 | 4 | 5 | 6 |

| d | 0–14 | 15–24 | 25–34 | 35–39 | 40–49 | 50+ |
|---|---|---|---|---|---|---|
| 3B′ add | 5 | 6 | 9 | 11 | 14 | 18 |

**Verified reference cases** (M non-smoker 35 + F smoker 50, WL 10 Pay):
**JFTD 53 · JLTD 34 · JLTDPU 41** (worked: adjusted 35 & 52; JFTD `52 + 2 + 0 = 54`, −1 → 53;
JLTD `35 − 1 = 34`; JLTDPU `34 + 1 + 6 = 41`). Also: M-N 60 + F-S 55 JLTDPU → 58;
M-N 40 + F-N 38 JFTD WL 20 Pay → 46.

**Joint Age Backdated** re-runs the whole calculation with each insured who is
**Backdate Eligible** (eligibility only — *not* Confirm Backdate, which reads
rates and would be circular) **one year younger**. The joint age often does
not change. A JLTDPU life who would fall under 18 when backdated has no answer →
Error (*TO_DO R-1*).

The Joint container's other four inputs are **typed** by the operator:
*Equiv. Substd. %* (the "Substd Prem." half of the old sheet — still manual,
*TO_DO C-8*), *Flat Extra Prem. $ Perm*, *$ Term*, *$ Duration* (Perm and
Term/Duration lock each other, like a slot's Extra Premium). While the coverage
is a joint Perm one, the insureds' own Rate / Extra Premium boxes are disabled.

### 12.7 The Backdate tab

Per **insured** (from Insured Input, not per coverage). All dates are UTC
calendar dates.

| Column | Rule |
|---|---|
| Illustration Date | `settings.refDate` |
| Max. Backdate Date | Illustration Date **− 6 months** by plain `Date` normalisation (31-AUG − 6 months lands ≈ 3-MAR, not clamped — *TO_DO R-4*) |
| Past / Next Birthday | most recent birthday **on or before** the Illustration Date (a birthday exactly on it counts as past) / the next one after it. 29-FEB in a non-leap year → 28-FEB |
| Midpoint (Possible Backdate) | the midpoint, in whole days, between Past and Next Birthday, **rounded half up**; a day of 29/30/31 → **28** |
| **Backdate Eligible** | `Midpoint ≥ Max. Backdate Date AND Midpoint ≤ Illustration Date` |
| Backdated Age Nearest/Last | `agesAt(birthdate, Midpoint)` — informational, distinct from the Rates `_BD` columns, which use a flat **age − 1** (confirmed production rule, not derived from this Midpoint age — §12.5) |
| Rate Current (All Cov.) | Σ over every coverage the insured is on of that coverage's **PR_N** at its band (§12.4) |
| Rate Backdated (All Cov.) | the same Σ of **PR_BD_N** |
| **Confirm Backdate** | `Eligible AND (Rate Backdated < Rate Current)` — strict `<`, tolerant of float noise (1e-9). Not eligible ⇒ a real `FALSE` (`AND(FALSE; anything)`); eligible with a rate that could not be resolved ⇒ that rate's own state |
| **Backdate Date** | the Midpoint when Confirm Backdate is TRUE, else blank |
| **Final Backdate Date** (band) | the **earliest** Backdate Date among insureds, blanks ignored (13-JUL-2026 / blank / 24-MAY-2026 → 24-MAY-2026). None ⇒ muted "no insured is backdatable"; an unresolved insured makes the MIN unknowable, so that state wins |

Feeds the Results Summary's *Possible Backdate Date*. The **Backdate
Projection** container (savings dates + 6-column table) is built — §12.12.

### 12.8 Modal Prem. (Coverages tab, mirrored in Results)

The spreadsheet's `LET()`, variable by variable (names are the sheet's own).

| Variable | Definition |
|---|---|
| `modal_factor` | Payment Frequency **Annually → 1**, **Monthly → 0.09** (literal, *not* 1/12). Frequency blank ⇒ blocked |
| `coverage_fee` | the coverage's Coverage Fee (below) |
| `unit_value` | the coverage's Unit Value (Coverages tab; default 1,000) |
| `prem_adj_percentage` | Settings *Prem. Adj. %* **÷ 100** (100 = ×1.00) |
| `prem_adj_dollar` | Settings *Prem. Adj. $* |
| `term_extra_prem` | Term/Perm Individual & Term JFTD: Σ over insureds on the coverage of (*Perm $* + *Term $*). **Perm joint: the Joint container's *Flat Extra Prem. $ Perm* alone** (blank ⇒ blocked). *(The "Extra Prem. Term $" column shows Perm + Term for joint too — TO_DO R-3/R-9.)* |
| `pr`, `pep` | `PR_Total`, `PEP_Total` at the coverage's band |
| `units` | `ROUND(insurance_amount / unit_value, 5)` |
| `cost_of_insurance` | `ROUND( ROUND(TRUNC(pr, 6) × units, 2) × prem_adj_percentage + prem_adj_dollar, 2 )` |
| `pep_value` | `ROUND( ROUND(pep × units, 2) × prem_adj_percentage, 2 )` |
| `tep_value` | `ROUND( term_extra_prem × units, 2 )` |
| **Modal Prem.** | `ROUND( ROUND((cost_of_insurance + pep_value + tep_value) × modal_factor, 2) + ROUND(coverage_fee × modal_factor, 2), 2 )` — the **outer** `ROUND(…, 2)` is *not* in the Excel formula; it normalises binary doubles (163.99 + 1.80 = 165.79000000000002) so a computed premium can be compared with a typed one. **Do not remove it** |

- **Calculation Type "Input Premium"**: Modal Prem. = the premium typed in, as-is (no factor, no fee).
- **Calculation Type "Coverage Amount"**: `insurance_amount` = the amount typed; the band and rates are that amount's band (§12.4).
- **Critical Illness**: no formula ⇒ amber.

**Coverage Fee** (auto, recomputed from scratch on every render): Term Life —
the coverage with the **highest duration** (order Term to 65, 30, 25, 20, 15,
10; ties → the one added first) gets **$40**, every other Term Life coverage
**$20**; Permanent Life **always $40**; Critical Illness blank. Typing a fee
opts that coverage out (`feeManual`) until cleared.

**Excel-faithful rounding** (`optimizer_coverages.js`): `ROUND`/`TRUNC` work
on the *decimal* value — first cut to 15 significant digits, halves round away
from zero — so `2.675 → 2.68` (a plain `Math.round(x·100)` gives 2.67).

### 12.9 Modal Prem. Backdated

The same `LET()` on the **same band** as Modal Prem., but built from
**PR_BD_Final / PEP_BD_Final**. Coverage Amount: the input amount's band and
the input amount. Input Premium: the band **and amount** of Prem. Basis Ins.
Amt (so, unlike Modal Prem., it is *calculated*, not the typed premium — that
is the point of comparing). A coverage with no backdatable insured gives
Backdated = Modal Prem. `bandFinalTotals` is a **separate call** from
`bandTotals` on purpose, so an undecidable BD_Final never breaks Modal Prem.

### 12.10 Prem. Basis Ins. Amt and Highest Amt (the formula run backwards)

Both use one search, `solveAmount()`, differing only in the premium it targets:

- **Prem. Basis Ins. Amt** (Input Premium coverages) — target = the premium
  typed in; lower limit = the lowest band's amount. Result = the most that
  premium buys. Its band feeds §12.4.
- **Highest Amt (Max.)** (Coverage Amount coverages) — target = the Modal
  Prem. at the operator's own amount, lower limit = that amount (the answer can
  never be below what was typed). **Highest Amt (Min.)** = the face amount of
  the answer's band. **Reported only when the answer reaches a HIGHER band than
  the coverage's own** (else a muted "no higher rate band is within this
  premium", which is information, not an error).

The Excel `LET()`:

```
base_prem            = target / modal_factor − coverage_fee − prem_adj_dollar
denominator (band)   = prem_adj_percentage × (PR_Total + PEP_Total)(band) + term_extra_prem
ins_amount_per_band  = IF(base_prem > 0 AND denominator > 0, unit_value × base_prem / denominator, NA())
kept                 = per-band candidates with lower_band ≤ amount < upper_band
                       (upper_band = the next band up; the top band is capped at 25,000,000)
```

The best kept candidate (else a "fallback" = an over-shooting estimate pulled
*down* into its band) is only a **starting guess**. From there the amount
walks **$1 at a time**, pricing the next dollar before taking it — first *down*
while the current amount costs more than the target, then *up* while
`amount + 1` still costs ≤ target — so the answer is the **last amount whose
Modal Prem. is within the target** (each trial is priced at the band *its own*
amount falls in). Notes: `ins_amount_max` is floored to a whole dollar; if even
the lower limit costs more than the target ⇒ blocked ("does not reach the
lowest rate band"); the walk is capped at **100,000 steps** ⇒ Error rather
than a guess (`MAX_STEPS`, measured: a few dozen steps, ≈1 ms for 6 coverages).
Band jumps are found by the per-band candidates, not the walk (*TO_DO R-10*).

**Verified reference cases:** 240,000 costs 66.60 → Max **1,440,109** (which
also costs 66.60; 1,440,110 costs 66.61). Input premium 66.60 → **1,440,109**.
165.79 → **152,669** (not 152,660 — the float bug above). 64.66 → **222,173**.
13.05 → **25,010** (25,011 would cost 13.06).

### 12.11 Results panel and Summary

Results table, one row per coverage: **Prem. Basis Ins. Amt · Highest Amt
(Min.) · Highest Amt (Max.) · Modal Prem · Modal Prem Backdated** — the last two
*mirror* the Coverages tab (`core.modalPrem` / `core.modalPremBackdated`: one
function, so they cannot disagree). Cell states per §12.0.

**Summary** strip: **Modal Premium** = Σ of every coverage's Modal Prem.;
**Modal Premium Backdated** = Σ of their Modal Prem. Backdated (Error anywhere
⇒ Error; pending ⇒ pending; blocked ⇒ blocked — never a partial total);
**Possible Backdate Date** = the Backdate tab's Final Backdate Date;
**Backdate Savings Date** = whichever of the Backdate Projection's Monthly /
Annual Savings Date matches the current Payment Frequency (§12.12). Results
re-renders on any input change, on `ratesstatus` and on `unitvaluechange`.

### 12.12 The Backdate Projection — duration-varying premiums

Everything in §12.5–§12.9 above is a **single point**: today's rate, today's
Modal Prem. The Backdate Projection needs a whole **series** — what each side
would actually charge in policy year 1, 2, 3, … — because Term Life premiums
step up on schedule and Permanent Life products stop charging once their pay
period ends. Confirmed by the requester (2026-09-21): Term Life is fixed for a
level period then steps every 5 years until the rate table runs dry around
real age 85; a limited-pay/age-capped Permanent product simply stops. This
section is the per-year engine that replaces the old two-constant projection.

**The Duration shift.** The rate table's own `Duration` column is the elapsed
policy year **+ 1** (Duration 1 = year 0/issue, Duration 16 = year 15 — where
a T15 steps for the first time). `lookupTermLifeRate` is unchanged; every
caller now passes `(elapsedYears || 0) + 1` instead of a hardcoded `1`.
Permanent Life rates have **no** duration axis — only age matters for the
rate itself; duration only decides whether the coverage is still paying.

**Coverage-ended detection.**

- *Term Life:* a rate lookup failing with "no row for Axis Key" at
  `elapsedYears > 0` means the table ran dry (confirmed shape, not a hole) —
  **unless** the same lookup also fails at `elapsedYears = 0`, which means the
  coverage was never ratable and is a real Error. `isRowGoneAtYear` +
  `endedOrError` (`optimizer_rates.js`) make that distinction; without the
  year-0 check, a genuinely broken Axis Key was briefly misreported as
  "ended" for every year after 0 (fixed during this build).
- *Permanent Life:* `permStillPaying(c, ins, backdated, elapsedYears)` —
  `PERM_PAY_YEARS` (`WL 10/15/20 Pay` → 10/15/20 years) or `PERM_AGE_CAP`
  (`WL to 65` → 65, `WL to 100`/`Term to 100` → 100, checked as
  `issue age + elapsedYears < cap`, using the **Joint Age** for a joint
  coverage — same age `lookupAge` already resolves for the rate itself, so it
  can never disagree with which age the coverage is rated on).
- *JFTD (Joint First-to-Die), multiple different-aged insureds:* "ends when
  the oldest insured reaches 85" falls out for free from `totalResult`'s
  existing behavior — any one insured's row running dry fails the whole sum,
  and the oldest insured's row is naturally the first to run dry.

**`bandTotalsAtYear(c, elapsedYears, backdated)`** (`optimizer_rates.js`) —
the per-year PR_Total/PEP_Total, reusing `bandFor`/`totalResult` so it can
never disagree with the Rates tab's own cells at `elapsedYears = 0`. Returns
`{ pr, pep }`, `{ ended: true }`, `{ blocked }` or `{ error }`.

**`premiumAtYear(c, elapsedYears, backdated)`** (`optimizer_coverages.js`) —
the per-year Modal Prem., the *same* `modalPremAt` LET() §12.8 uses, fed a
per-year rate (above) and a per-year context, `premContextAtYear`. Unlike
`premContext` (§12.8, unchanged — an already-shipped figure), this one gates
the 4 duration-limited inputs by `elapsedYears < …Dur` (0 = never applies,
confirmed): Settings' *Prem. Adj. %/$ Dur.*, a slot's own *Term $ Dur.*
(`termExtraPremAtYear`), and the Joint container's *Flat Term $ Dur.* — see
*TO_DO R-14* for the resulting divergence from `modalPrem()` at year 0 when a
Dur field is in play. An Input Premium coverage's insurance amount is
resolved **once**, at today's rates (`premBasis`, the same figure Coverages/
Results already show), then re-priced at each year's own rate — not re-solved
for a new amount every year (confirmed: "in theory it shouldn't differ").

**`premiumSumAtYear(elapsedYears, backdated)` / `buildYearSeries()`**
(`optimizer_backdate.js`) — sum every coverage's `premiumAtYear` for one year;
a coverage that has ended contributes 0 (not an error) and is flagged via
`allEnded`. `buildYearSeries()` loops from year 0 until **both** sides report
`allEnded`, returning `{ current: [...], backdated: [...] }` (same length,
index = elapsed policy year) or the first `{ error }`/`{ pending }`/
`{ blocked }` — never a partial series. `HORIZON_YEARS = 110` is a runaway
guard only (every real product ends by attained age 100 at the latest); the
loop almost always stops itself first.

The **Backdated** track is a straight, unconditional `age − 1` for every
insured on the coverage (`core.premiumAtYear(c, y, true)`), modelling "what if
this were fully backdated" — **not** the same mix as `modalPremBackdated`
(§12.9), which uses each insured's own BD_Final (current rate for a
non-eligible insured, age − 1 only for an eligible one). The two will not
generally agree even at year 0. See *TO_DO R-15*.

**Placing the series onto the calendar** — `projectionAnnual`/
`projectionMonthly` are unchanged in *shape* from the original port (§12.7's
old two-constant version), just fed a year index instead of a constant:

- **Annual:** at each of *Current's own* anniversaries (year N), **both**
  sides bill at year N's rate. Confirmed correct — by the time Current reaches
  its Nth anniversary, Backdated (which started earlier) has *already* had
  its own Nth anniversary, so it would currently be charging year N's rate
  too; there is no separate Backdated-side clock to track here. Year 0 is
  still split into a prorated piece + a remainder piece (paid on Current's
  first anniversary), both priced at year 0's Backdated rate (*TO_DO R-13*).
- **Monthly:** fully **independent** per-side clocks — each side bills
  monthly on its own schedule, at whatever elapsed-year rate applies to *it*,
  with no cross-side alignment (confirmed via a worked example: Backdated
  renews on its own date regardless of when Current renews).

`annualSavingsDate`/`monthlySavingsDate` (header pills) and `buildProjection`
(the 6-column table) all call `buildYearSeries()` once and reuse it — same
blocked/pending/error states as everywhere else on this page.

### 12.13 Where each piece of logic lives

| Logic | Function | File |
|---|---|---|
| Age algorithm | `agesAt` | `optimizer.js` |
| Axis Key | `axisKeyResult` (`axisKeyTermLife`, `axisKeyPermLife`), `axisKeyPrefix`, `axisKeyWhy` | `optimizer.js` |
| Joint Age | `equivAge`, `jointAge`, `jointFigures` | `optimizer.js` |
| Coverage Fee | `recalcFees` | `optimizer.js` |
| Rate files, lookups | `ingest…Workbook`, `lookupTermLifeRate`, `lookupPermLifeRate` | `optimizer_rates.js` |
| Bands | `BAND_TABLES`, `bandAt`, `bandFor` | `optimizer_rates.js` |
| PR / EPR / PEP / Final / Total | `baseRateResult`, `extraRateResult`, `pepResult`, `cellResult`, `finalResult`, `totalResult` | `optimizer_rates.js` |
| Per-band sums for other tabs | `bandTotals`, `bandFinalTotals`, `bandTotalsAll`, `allCovRate` | `optimizer_rates.js` |
| Modal Prem. (+ Backdated) | `premContext`, `modalPremAt`, `modalPrem`, `modalPremBackdated` | `optimizer_coverages.js` |
| Highest Amt / Prem. Basis | `solveAmount`, `highestAmt`, `premBasis` | `optimizer_coverages.js` |
| Backdate | `eligibility`, `insuredBackdate`, `finalBackdateDate` | `optimizer_backdate.js` |
| Per-year premium (Backdate Projection) | `permStillPaying`, `isRowGoneAtYear`, `endedOrError`, `bandTotalsAtYear` | `optimizer_rates.js` |
| Per-year premium (Backdate Projection) | `termExtraPremAtYear`, `premContextAtYear`, `premiumAtYear` | `optimizer_coverages.js` |
| Backdate Projection | `premiumSumAtYear`, `buildYearSeries`, `projectionAnnual`, `projectionMonthly`, `annualSavingsDate`, `monthlySavingsDate` | `optimizer_backdate.js` |
| Summary totals | `summaryFields`, `premiumTotal` | `optimizer.js` |

---

## 13. The message bar and the error catalogue

**Purpose.** A red "Error" cell says *that* a figure could not be produced; the
message bar says *why*, in words, and where. It lives in the top bar, in the
space between the tool-name block (left) and Test Case Name (right)
(`#issues` in `optimizer.html`; logic in `optimizer.js` § "message bar").

```
┌ CO  Coverage Optimizer ▾ ┐ ┌⚠ Rates — Coverage 1 (Term Life — Term 10) · Insured 1 (Alex):  1 / 3 ▲ ▼ ✕┐ [Test Case Name] …
```

**Behaviour.**
- Empty ⇒ nothing is drawn (the space stays free). One message ⇒ text + ✕.
  Two or more ⇒ also **`n / total`** and **▲ / ▼** (previous / next, wrapping).
- The text clamps to two lines; **click it (or Enter)** to open the full text in
  a popup below the bar (click elsewhere closes it).
- **✕ clears the message on show** (the next one moves in); **Shift+✕ clears
  all.**
- Messages fix themselves: when the cause is corrected the message disappears
  on the next re-render. A message you *cleared* while its cause persisted stays
  hidden; if the cause goes away and later comes back, it returns.
- Text convention: **`<Tab> — <where>: <what is wrong>`**, e.g.
  `Rates — Coverage 2 (Permanent Life — WL 10 Pay) · Insured 1 (Alex): the Permanent Life rate file has no row for Axis Key DT_VEG10________2007_MN___B00010 at age 40 [B00010, B00025].`

### 13.1 Architecture — two sources, one list

| Source | API (on `window.OptimizerCore`) | Lifetime |
|---|---|---|
| **Event messages** — something failed *once* | `raise(key, msg[, fk])`, `resolve(key)`; `badInput(el, msg, where)` / `goodInput(el)` for rejected field commits | until the user clears it, `resolve(key)` is called (the same thing later succeeded), or — when `fk` (the input's `data-fk`) was given — until that input no longer sits on the page flagged `.fi--bad` |
| **Diagnostics** — what is wrong *right now* | `diagnostics(fn)`; `fn()` returns `[{ key, msg }]` | recomputed on **every** `notifyOptimizerCoreChange()`, every `ratesstatus` and `unitvaluechange` event ⇒ they vanish by themselves once fixed |

**Providers registered today:** `inputIssues` (`optimizer.js`), `ratesIssues`
(`optimizer_rates.js`), `coverageIssues` (`optimizer_coverages.js`). Each asks
the **same result functions the tab's cells use** (`cellResult`,
`finalResult`, `modalPrem`, …), so a message can never disagree with the cell it
explains. `refreshIssues()` merges events + providers, drops messages the user
dismissed, de-duplicates by `key`, redraws.

**Keys** — event: `f:termLife` / `f:permLife` / `f:import` (rate files), `h:store`
`h:save` `h:name` `h:import` `h:load` (History), `js:<message>` (unexpected error),
or the input's `data-fk` (a rejected field); diagnostics: `d:refdate`,
`d:bd:<insId>`, `d:age:<insId>`, `d:cap:<covId>`, `d:load:<file>`,
`d:rate:<covId>:<slotId|J>:<reason>`, `d:freq`, `d:cov:<covId>:<reason>`.
A failing provider is caught and reported as `d:internal:…` — a bug in a check
never takes the page down.

**Root causes, not symptoms.** The rate-lookup functions return
`{ error: true, why: '<sentence>' }` (`fail(why)`), and the Axis Key builder and
`equivAge` return `{ why }`, so the sentence travels from the deepest check to
the cell tooltip *and* the bar. Checks run in **dependency order**, so a lookup
reports its *first* missing prerequisite (no Sex → *then* no Birthdate → *then*
missing row); fixing one reveals the next. One cause is one message: a reason
that does not depend on the band collapses to a single line; a "no row" reason
lists the bands it hit; a joint Perm coverage reports once as **· Joint**; a
rate file that is not loaded is one message for the file, not one per coverage.

**What is deliberately *not* a message** (already conveyed elsewhere; a message
would only be noise): an amber pending cell (no formula exists yet — Critical
Illness, Backdate Projection, the two "Joint Extra Prem. Backdated" columns);
a plain blank required input (yellow highlight + cell tooltip); informational
blanks ("no higher rate band is within this premium", "no insured is
backdatable"); anything the operator simply has not filled in *yet* on a
brand-new blank coverage. A pristine page shows **no** messages.

**An unexpected error** (`window` `error` / `unhandledrejection`) raises
`js:…` — `Unexpected error — <text> (<file>:<line>). Reload the page; if it comes
back, note what you did just before it.` That is a bug, not an input problem.

### 13.2 The error catalogue

*Every case the tool can report.* "Fixes itself" = diagnostic (re-evaluated);
"Stays" = event (until cleared/resolved).

**A. Rejected input** — event, keyed by the field; the box turns red
(`.fi--bad`), a toast appears, the record keeps its last valid value.
Text: `<where>: <validator message>`; *where* = `Insured Input — <name>`,
`Settings`, `Coverage Input — Coverage n (<title>)`, `… · Insured k`, `… · Joint`,
`Coverages — Coverage n` (Unit Value).

| # | Field | Rejected when |
|---|---|---|
| A-1 | Insured Name | blank, or > 30 characters |
| A-2 | Insured Sex / Rate / Age Calculation | not one of the options |
| A-3 | Insured Birthdate | not a valid date (`DD-MMM-YYYY`, `YYYY-MM-DD`, `YYYYMMDD`, `YYYY/MM/DD`); or Age Real / Age Calculated would fall outside 0–120 at the Reference Date |
| A-4 | Settings Reference Date | not a valid date |
| A-5 | Settings Prem. Adj. % / $ / Dur. | not a number; not whole (Dur.); more than 2 decimals ($); below min / above max (%: 0–1,000,000; $: 0–999,999,999.99; Dur.: 0–999) |
| A-6 | Coverage Fee / Input | not a number; not whole (Coverage Amount); > 2 decimals (money, Input Premium); out of range (fee ≤ 999,999,999.99; amount ≤ 999,999,999) |
| A-7 | Insured-slot Extra Premium (Perm %, Perm $, Term $, Term $ Dur.) | same numeric rules; a blank is rejected (type `0`) |
| A-8 | Joint container (Equiv. Substd. %, Flat Perm/Term $, Duration) | same numeric rules (Equiv. Substd. % ≤ 10,000; flat $ ≤ 9,999.99; duration ≤ 999); blank is allowed here |
| A-9 | Coverages-tab Unit Value | blank, not a number, not whole, < 1, > 999,999,999 |

**B. State problems** — diagnostics from `inputIssues`; fix themselves.

| # | Condition | Message (abridged) |
|---|---|---|
| B-1 | Reference Date is not a valid date (only possible via a loaded/hand-edited file) | `Settings — Reference Date "…" isn't a valid date …, so no age can be calculated` |
| B-2 | An insured's Birthdate is present but unparseable (loaded file) | `Insured Input — <name>: Birthdate "…" isn't a valid date` |
| B-3 | An insured's age is outside 0–120 **because the Reference Date was changed afterwards** (the field validator only checks at entry) | `… gives an age of n at the Reference Date … — it must be between 0 and 120` |
| B-4 | A coverage holds more insureds than its Coverage Type allows (loaded file) | `Coverage Input — Coverage n: has n insureds but "<type>" allows at most n` |

**C. Rate lookups** — diagnostics from `ratesIssues`; each is a red Error cell
on the Rates tab (tooltip = the same sentence). Only for coverages whose
category has bands **and** that have an insured chosen.

| # | Reason (`why`) |
|---|---|
| C-1 | **The rate file isn't loaded** — `the Term Life / Permanent Life rate file isn't loaded …` (one message per file) |
| C-2 | **No Axis Key can be built:** no Coverage chosen · no Coverage Type chosen · the Coverage Type has no Term Life format · Insured has no Sex · Insured has no Rate · no Coverage Rate chosen for the insured (Term Life) · no Axis Key format for this category · no insured on the slot |
| C-3 | **No age:** the insured has no valid Birthdate (or the Reference Date is invalid) |
| C-4 | **The Joint Age can't be calculated:** fewer than two insureds · a slot has no insured · an insured has no Sex / no Rate / no valid Birthdate · **Last-to-Die with waiver needs both insureds to be 18 or over** (also as backdated) |
| C-5 | **No row:** `the <file> rate file has no row for Axis Key <key> at age <n> [bands]` — or `has no Substandard row for Axis Key DTS…` (Perm EPR) |
| C-6 | **Percentage blank:** joint — `Equiv. Substd. % is blank in the Joint container (type 0 if there is none)`; otherwise `Perm Extra Prem. % is blank on this insured slot` |
| C-7 | **BD_Final undecidable:** `BD_Final needs Backdate Eligible, and Insured "<name>" has no valid Birthdate` |
| C-8 | `"<coverage>" has no Term Life rate sheet` (cannot occur with the shipped coverage list) |

**D. Coverage arithmetic** — diagnostics from `coverageIssues`; only Term/Perm
Life coverages, and only **once everything before them is in place** (the checks
run in dependency order) and **not** for rate failures (those are C) or plain
blanks. The affected figures are named.

| # | Condition | Note |
|---|---|---|
| D-1 | **Payment Frequency isn't set** | one message for the whole page (`d:freq`) — Modal Prem. cannot be calculated without the modal factor |
| D-2 | **Coverage Fee is blank** | the field was cleared and has no auto-default (Critical Illness is skipped) |
| D-3 | **Perm joint: Flat Extra Prem. $ Perm is blank** | Joint container |
| D-4 | **The Coverage Amount is below the lowest rate band** | raise it to at least that band |
| D-5 | **The Input premium is too low to buy even the lowest band** | raise it |
| D-6 | **The amount search did not settle within 100,000 steps** | Error rather than a guess |

**E. Rate files** — events (`f:termLife`, `f:permLife`, `f:import`); cleared when
that file next loads cleanly. The pre-load page also shows the fetch failure text.

| # | Case |
|---|---|
| E-1 | `rates/<file>` could not be fetched (`HTTP 404`, or the page was opened from disk / the server isn't running) |
| E-2 | the file could not be read as an Excel workbook |
| E-3 | the workbook is not a rate file (no sheet starting `temp_rates_` / `perm_rates_`; the sheets it has are listed) |
| E-4 | Term Life workbook is missing sheet(s) (state stays "Not loaded") |
| E-5 | Permanent workbook lacks `perm_rates_2007_combined` |
| E-6 | right sheets, **no usable rows** (expects Axis Key in D, Duration/Age+1 in E, rates from G) — state "Not loaded" |
| E-7 | rate cells that held **text / errors** were skipped (count given) — lookups on them become C-5 |
| E-8 | the file could not be read from disk (FileReader) |

**F. History** — events.

| # | Case |
|---|---|
| F-1 | *Save Test* with no Test Case Name (`h:name`; clears when you type one or save) |
| F-2 | the file could not be written to `history_data/` — the reason is given (server not reachable / HTTP status) and the case was **downloaded instead** (`h:save`) |
| F-3 | this browser would not keep the History list (`localStorage` full/blocked) — or the stored list is unreadable and History starts empty (`h:store`) |
| F-4 | *Import Test Case*: not valid JSON · no `name` · `snapshot` has no `insureds`/`coverages` lists · file unreadable (`h:import`) |
| F-5 | *Load* of a damaged/hand-edited case threw — **the previous state is put back** (`h:load`) |
| F-6 | the `history_data/` folder could not be read at start (server not running / HTTP status) — only this browser's cases are listed; or files there aren't test cases and were skipped (named) (`h:folder`) |
| F-7 | *Delete*: the case left the list but its file could not be moved to `_deleted/` — it will reappear next start (`h:delete`) |

**G. Unexpected** — `js:…` (see above).

### 13.3 Adding a new error case — recipe

1. **A one-off failure** (a file, a save, a parse): call
   `core.raise('<prefix>:<name>', '<Tab> — <where>: <what, and how to fix it>')`
   where it fails, and `core.resolve('<same key>')` where the same action later
   succeeds.
2. **A rejected field:** use `badInput(el, msg, where)` / `goodInput(el)` in the
   commit handler (never bare `classList.add('fi--bad')`), so the message is
   tied to the box.
3. **A condition on the current data:** add it to a provider (or register a new
   one with `core.diagnostics(fn)` in the tab's own `init…Tab()`); return
   `{ key, msg }` with a **stable key** (include the record ids so two records
   don't collide, and the reason so two reasons don't). Compute it from the
   tab's own result functions, not a second copy of the rule.
4. **Give the failing function a `why`.** Return `{ error: true, why: '…' }`
   (rates) or `{ blocked: '…' }` (arithmetic) with a full sentence naming the
   record and the fix; if it is an *actionable* arithmetic reason add it to
   `ACTIONABLE` in `optimizer_coverages.js`.
5. **Keep it quiet when nothing is wrong**: a message on a pristine, blank page
   is a bug (§9 invariant #44).
6. Add the row to the catalogue above and to the §11 checklist.

### 13.4 Testing the bar without the real rate files

Serve the folder (`python backend_files/server.py <port>`), open `optimizer.html`, click
**Skip (dev)**, then in the console: build a workbook with `XLSX.utils` in the
page (`aoa_to_sheet`, one row per Axis Key/age), feed it through the hidden
`#ratesFileInput` with `DataTransfer` + a `change` event, and drive state with
`OptimizerCore.restoreState(snapshot)`. Read the bar with
`#issuesTxt` / `#issuesN`; cycle with `#issuesDown`. The scenarios verified for
this release: missing rows at some bands, missing Sex / Coverage Rate / Birthdate,
joint blank Equiv. Substd. %, blank Payment Frequency and Flat Extra Prem. $
Perm, amount below the lowest band, `WL to 100`, typed-invalid birthdate (and its
self-healing), invalid Unit Value, wrong / garbage / text-cell workbooks, bad
JSON / bad shape / damaged-load / storage-failure in History, and an uncaught
error.

---

## 14. Running, deploying and maintaining the tool

### 14.1 Files, at a glance

| Path | Role |
|---|---|
| `backend_files/optimizer.html` · `.css` · `.js` | shell + the "core" (Settings, Insured/Coverage Input, Results, Axis Key, Joint Age, save/load state, **message bar**, the bridge) |
| `backend_files/optimizer_coverages.*` `_insureds.*` `_rates.*` `_backdate.*` `_history.*` | one file pair per tab (§2d–§2h) — own IIFE, read through `window.OptimizerCore` |
| `backend_files/optimizer_preload.css` / `.js` | the pre-load page (§14.3) |
| `backend_files/xlsx.full.min.js` | vendored SheetJS — the only third-party code |
| `backend_files/server.py` · `_start-coverage-optimizer.bat` (tool root) | the local server and its launcher (§14.2) |
| `rates/` | the two rate workbooks (**confidential — never commit them**; see §14.6) |
| `history_data/` | saved test cases (`.json`), written by `server.py` |
| `markdown_reference/TO_DO.md` | the live backlog: what is parked, what to review, questions waiting on the requester |
| `markdown_reference/OPTIMIZER_REFERENCE.md` (this file) · `OPTIMIZER_INSTRUCTIONS.md` | the spec and the agent instructions |
| `markdown_reference/yagni_principle.md` | the coding-style instruction used with the coding assistant ("smallest correct change") |

Script load order in `optimizer.html` matters: `xlsx` → `optimizer.js` →
**`optimizer_rates.js`** (publishes `core.bandTotals`/`allCovRate`/… that the
next two call) → `_coverages` → `_insureds` → `_backdate` (lends
`core.backdateEligible`) → `_history` → `_preload`.

### 14.2 Starting the tool

**Always start it with `_start-coverage-optimizer.bat`** (double-click). It finds `python`
or `py`, opens the browser in the background after ~2 s and runs
`backend_files/server.py` on **port 8000 in its own console window — the only one**
(closing it stops the server). The page is `http://localhost:8000/backend_files/optimizer.html`:
`server.py` serves the **tool folder** (the parent of `backend_files/`), so the page
reaches `../rates/` and `../history_data/`. It is `http.server` plus:

- **`Cache-Control: no-cache`** on every response — without it a browser reuses
  a stale `.js` after an edit and shows the *old* tool.
- **`GET /history_data/`** — every saved test case, one JSON reply `[{file, entry}]`
  (History reads it at each start; files must be named `[A-Za-z0-9_-]{1,100}.json`, others are ignored).
- **`DELETE /history_data/<name>.json`** — moves a case to `history_data/_deleted/` (never erases).
- **`POST /history_data/<name>.json`** — writes a saved test case into `history_data/`.
  Accepts only `application/json`, a bare file name `[A-Za-z0-9_-]{1,100}.json`
  (nothing can land outside `history_data/`), 1 byte–5 MB, valid JSON; **never
  overwrites** (a taken name gets a `_<timestamp>` suffix; the reply
  `{"name": …}` says what was written); written to a temp file then renamed
  (never half a file). Listens on **127.0.0.1 only**.

Opening `optimizer.html` straight from disk (`file://`) still *runs* the tool
(§0 rule 1) but cannot `fetch()` the rate files or write `history_data/` — the pre-load
page then shows the fetch failure (§13 E-1) and Save Test falls back to a
download (§13 F-2). Manual run: `python backend_files/server.py 8000`. If port 8000 is busy,
`python backend_files/server.py <other port>`.

### 14.3 The pre-load page

An overlay (`#preload`, static markup in `optimizer.html`, wiring in
`optimizer_preload.js`) covers the tool (`app.inert = true`) until **both**:

1. a user is picked — three pills: **Catheryne L. (`cl`) · Rafi K. (`rk`) ·
   Catherine C. (`cc`)** — the name goes to the top-bar chip `#tcUser` (name as
   text, initials in `data-ini`); nothing is remembered between launches; and
2. **both rate files say Loaded** — two status rows (`#plRate_termLife`,
   `#plRate_permLife`): red *Not loaded* · yellow *Loading* · green *Loaded*, a
   real progress bar and label, and **Retry** (offered only when something
   failed). **Under Term Life, one line per sheet** — *Term 10, 15, 20, 25, 30, 65* — goes
   red → yellow → green as `ingestTermLifeWorkbook` reads it (`setSheetState`, `#plSheets`;
   a missing sheet stays red, so you see which one); they are progress detail only, the
   Start gate watches the two file rows. `optimizer_rates.js` drives the rows (`setRateState`) and fires a
   `ratesstatus` event; the page re-checks its **Start** gate on it.

The tool loads `rates/temp_rates_2509_combined.xlsx` and
`rates/perm_rates_2007_combined.xlsx` **on every launch**. **`Skip (dev)`** (a
small button) enters without a name or rates (saves as `dev_…`) — *a
development bypass to delete when coding is finished* (button in
`optimizer.html`, handler in `optimizer_preload.js`, `.pl-skip` in
`optimizer_preload.css`, all marked "DEV BYPASS"; *TO_DO C-9*).

### 14.4 Saving and loading a test case

*Every start* reads all of `history_data/` into the History tab (three people, one folder —
§2h). *Save Test* (top bar) needs a Test Case Name. It does **both**: adds the case to
**History** (this browser's `localStorage`, key `coverage-optimizer-testcases`)
and writes `history_data/<initials>_<name>.json` through `server.py` — e.g.
`rk_MyCase.json` (the saver's initials prefix every file so two people never
collide; the name is stripped to `A-Z a-z 0-9 - _ space`, spaces → `_`, ≤ 60
characters). If `history_data/` cannot be written the file is **downloaded instead** and
the bar says why. A test case = `{ id, name, user, savedAt, insuredCount,
coverageCount, snapshot }`, `snapshot` = Settings + Insureds + Coverages + the
Coverages tab's Unit Values (§2h). **Import Test Case** adds a `.json` that is not in the
folder; **Load** restores it (and puts the previous state back if the file is
damaged, §13 F-5). Rate files are *not* part of a test case: a loaded case
re-resolves against whatever rates are loaded.

### 14.5 Moving the tool to another computer — checklist

1. Copy the **whole folder** (`coverage-optimizer-tool/`) — `backend_files/`, `markdown_reference/`, the launcher,
   `TO_DO.md`, `history_data/` if you want the saved cases. **Do not** copy `rates/*.xlsx`
   through email/cloud if they are confidential: place the real files on the
   destination itself (see 3).
2. Install **Python 3** if `python`/`py` is not on PATH (only the standard
   library is used — no `pip install`).
3. Put the two real workbooks in `rates/` with **exactly** these names:
   `temp_rates_2509_combined.xlsx` and `perm_rates_2007_combined.xlsx`. If a new
   version stamp is issued, follow the two-place rule in §12.2.
4. Double-click `_start-coverage-optimizer.bat`; pick your name; wait for both rows to go
   green; **Start**.
5. **First run with the real files — verify** (nothing was ever run against them
   on the development PC; every calculation was tested on small synthetic
   workbooks): load time and the progress bar with the large Term Life file; a
   handful of PR / EPR / PEP figures against Excel; the previously wrong case
   (Cov 1 / PR_1 / B00050: 25.37 vs 3.37); a Perm joint case (Joint Age, then its
   rates) and a backdatable insured; **watch the message bar** — any red Error
   cell now has a sentence saying why (§13), which is the fastest way to spot a
   mismatch between the real Axis Keys and the ones the tool builds (§12.2).
6. Anything that disagrees with Excel → note the case (Save Test) and see
   `TO_DO.md` §2 "To review" for the assumptions most likely involved (R-1, R-2,
   R-3, R-8, R-9, R-10).

### 14.6 Confidentiality and version control

The rate workbooks are confidential and stay on the work machine. `rates/` is
**not** git-ignored — a stray `.xlsx` could be committed (`TO_DO S-2`: add
`coverage-optimizer-tool/rates/*.xlsx` to a `.gitignore`). Saved test cases in
`history_data/` contain only the operator's own inputs.

### 14.7 Backlog and how work is tracked

`TO_DO.md` is the single backlog, in four parts: **1** things parked to code
later (C-n), **2** assumptions to review (R-n), **3** open questions (Q-n), **4**
suggestions (S-n), then **5 Done**. Every "later / put aside / review later"
goes there in the same change; finished items move to *Done*. Open items at the
time of writing: real backdated age in `_BD` (C-2), Backdate Projection (C-3),
History "Total Modal Premium" (C-4), the two "Joint Extra Prem. Backdated"
columns (C-5), Critical Illness (C-6), Term durations > 1 (C-7), a calculated
Equiv. Substd. % (C-8), removing the dev bypass (C-9); reviews R-1 … R-10; the
review R-12 (the 2017 products' assumptions).

### 14.8 Change log of this document

- **2026-09-20 (this revision).** Brought up to date with everything built after
  the 2026-09-17 text: pre-load page, users, `server.py` and `history_data/`; Rates
  lookups (PR/EPR/PEP, `_BD`, BD_Final, Totals, bands); Backdate calculations
  and Final Backdate Date; Modal Prem. and Modal Prem. Backdated; Prem. Basis
  Ins. Amt and Highest Amt; the Joint container and the **Equivalent Age**
  (the "Eq. Age / Substd. Prem." tab was removed); blank defaults with yellow
  highlight; Results/Summary; the **message bar and error catalogue (§13)**; and
  added the calculation reference (§12) and this section. §11 (checklist) was
  rewritten.
- **2026-09-21.** Folder layout: the tool root holds only `_start-coverage-optimizer.bat`,
  `backend_files/` (all `.html` / `.css` / `.js` and `server.py`), `rates/`, `history_data/`
  (was `data/`) and `markdown_reference/` (all `.md`). `server.py` now serves the tool root
  and the page is at `/backend_files/optimizer.html`; the JS reaches `../rates/` and
  `../history_data/`. The launcher runs the server in its own window (one console, not two).
- 2026-09-17 — the original text (six of seven tabs live).
