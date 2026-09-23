# Inforce Tool — Template Reference

Complete specification of the **Inforce Tool** front end (`inforce.html`,
`inforce.css`, `inforce.js`), written to be handed to a coding agent that
will build the **calculation engine** behind it.

The sibling page, the Coverage Optimizer (`optimizer.*`), has its own
reference: `OPTIMIZER_REFERENCE.md`. The two share a component set and a
header switcher, nothing else; this document describes the Inforce page only.

**Read this first, in full, before writing code.** The GUI is finished and
working. Your job is to fill two stubbed functions and render into containers
that already exist. Almost nothing in the presentation layer should change.

- Version: UI v0.1.0
- Stack: hand-written HTML + CSS + ES5 JavaScript. **Zero dependencies, zero
  build step, no framework, no bundler, no package.json.**
- Files: `inforce.html`, `inforce.css`, `inforce.js`, plus this reference and
  `INFORCE_INSTRUCTIONS.md`.

---

## 0. Ground rules

These are non-negotiable constraints of the project. Violating them is the most
likely way to produce an unusable result.

1. **Do not add dependencies.** No React, Vue, jQuery, lodash, date-fns,
   SheetJS-as-npm-module, bundlers, or transpilers. If you need an XLSX
   reader, load it as a single vendored `<script>` file or write the parse by
   hand. The tool must keep running by opening `inforce.html` directly.
2. **Do not add files** beyond what is strictly required. The whole point of
   the current shape is that a reviewer can read a whole tool in one sitting.
   If the engine is large, one additional file (`engine.js`) is acceptable;
   more than that needs justification.
3. **ES5 syntax only in `inforce.js`.** `var`, `function`, string concatenation.
   No arrow functions, `const`/`let`, template literals, or `class` — the file
   is uniform and should stay uniform. (A separate `engine.js` may use modern
   syntax if you prefer, but keep it dependency-free.)
4. **Everything lives inside one IIFE.** `inforce.js` is
   `(function () { 'use strict'; ... })();`. The only global is `window.__state`.
5. **Do not restyle anything.** Colour, spacing, type scale and layout have all
   been reviewed and signed off. Use the existing CSS classes and design tokens.
6. **Never invent a value.** This is a validation tool: an operator compares
   figures against another platform. A default, a placeholder zero, or a
   silently-coerced number is worse than a blank. Blank means blank.

---

## 1. File map

```
inforce-tool/
├── _start-life-inforce.bat    launcher: runs backend/server.py, opens the browser
├── backend/
│   ├── inforce.html           static shell: top bar, tabs, panes, status bar, toast, pre-load overlay
│   ├── inforce.css            green palette + every component class
│   ├── inforce.js             one IIFE: schema, state, render, events, engine hooks, History/pre-load
│   ├── server.py              local server: static files + ../history_data/ + ../usernames.json routes
│   └── calc_engine*.py        calculation engine modules (§11) — live here too, code goes in backend/
├── markdown_reference/
│   ├── INFORCE_REFERENCE.md   this file
│   └── INFORCE_INSTRUCTIONS.md   custom instructions for the coding platform
├── usernames.json             known users proposed on the pre-load page (server-owned, atomic writes)
├── history_data/               saved test cases, one .json per save; history_data/_deleted/ = soft-deletes
├── calculation_specs/          per-product calculation specs (source screenshots + generated LaTeX)
└── term_catalog.xlsx / .json   the Term product's variable catalog (§11)
```

**`inforce.css` shares every component rule byte-for-byte with the sibling
Coverage Optimizer tool's `optimizer.css`** (a separate project/repo, not a
subfolder here); only the palette tokens differ. They were generated from one
source — if you change a component rule in `inforce.css`, make the identical
change in that other project's `optimizer.css` too, for visual consistency
across the two tools.

### Running it

Opening `backend/inforce.html` directly from disk still works for the core
tool — `inforce.js` is a classic script, not a module — but the pre-load page
then can't `fetch()` `usernames.json`, and Save Test can't write into
`history_data/` (it falls back to a browser download; see §15). **Preferred:**
run `_start-life-inforce.bat` (from the project root), which starts
`backend/server.py` (stdlib-only, no `pip install`) on port 8001 and opens
the tool over `http://localhost:8001/backend/inforce.html`.

For plain static-file development that doesn't touch History, a generic
server still works:

```bash
python -m http.server 8000
```

> **Caching gotcha.** Neither `python -m http.server` nor `server.py` sends
> strong cache headers by default for a stale-`.js` bug like this — `server.py`
> does send `Cache-Control: no-cache` for exactly that reason. If a change
> appears not to take effect with the plain `http.server`, hard-reload or
> restart it on a different port before you start debugging your own code.

---

## 2. The tool switcher

The header block is a dropdown listing both tools. Picking the Coverage
Optimizer **navigates** to `optimizer.html`; picking the current tool just
closes the menu. Each tool is its own page with its own script and stylesheet.

The switcher table is duplicated verbatim in both scripts so the menus agree.
**If you edit it here, edit it in `optimizer.js` too.**

```js
var TOOLS = [
  { id: 'inforce',   href: 'inforce.html',   mark: 'IT', name: 'Inforce Tool',       swatch: '#35663E', note: '...' },
  { id: 'optimizer', href: 'optimizer.html', mark: 'CO', name: 'Coverage Optimizer', swatch: '#345165', note: '...' }
];
var THIS_TOOL = 'inforce';
```

What carries across a switch, and what does not:

- **Theme carries.** The light/dark choice is persisted in `localStorage`
  under the key `life-tool-theme` and re-applied on load. All storage access is
  wrapped in `try/catch`; the tool runs without it.
- **A loaded extract does not carry.** Navigation is a full page load; the
  working copy is gone. An operator switching mid-edit must expect to
  re-import. This is the deliberate cost of two separate pages.

---

## 3. Design tokens

All colour lives in CSS custom properties on `:root`. **Never hard-code a
colour in new code — use a token.**

### Palette structure

`inforce.css` carries the green palette as the `:root` default and a dark
variant under `:root[data-theme="dark"]`. (The Optimizer stylesheet is the
same structure with a slate palette; see `OPTIMIZER_REFERENCE.md`.)

`data-theme="light"` is set in `inforce.html` and then overridden from
`localStorage` on load. **The OS `prefers-color-scheme` is
deliberately not consulted** — two people comparing the same policy on
different machines must see identical colours. Dark mode is opt-in via `#btnTheme`.

### Token reference

| Token | Light | Dark | Role |
|---|---|---|---|
| `--canvas` | `#EDF1EE` | `#0D110E` | page background |
| `--surface` | `#FFFFFF` | `#151B17` | card background |
| `--surface-sunk` | `#F5F8F5` | `#111713` | recessed / read-only |
| `--surface-head` | `#F9FBF9` | `#1A211C` | plain card headers |
| `--line` | `#DCE3DD` | `#262E28` | standard border |
| `--line-strong` | `#C1CDC3` | `#3A453D` | emphasised border |
| `--line-hair` | `#E7EDE8` | `#1E251F` | row separator |
| `--ink` | `#111713` | `#E3EAE5` | primary text |
| `--ink-2` | `#47544A` | `#A6B3A9` | secondary text |
| `--ink-3` | `#5C6B5F` | `#94A297` | labels |
| `--ink-4` | `#697A6D` | `#839185` | muted / micro |
| `--accent` | `#35663E` | `#7FB88F` | brand, primary button |
| `--accent-2` | `#43804F` | `#9ECFAB` | hover |
| `--accent-soft` | `#E9F2EB` | `#18241B` | tint background |
| `--accent-line` | `#B7CFBE` | `#2E4534` | tint border |
| `--on-accent` | `#FFFFFF` | `#0D110E` | text on accent |
| `--focus` | `#43804F` | `#7FB88F` | focus ring |
| `--cov-band` | `#2A5233` | `#1E3A26` | container header band |
| `--cov-band-ink` | `#FFFFFF` | `#DCEBE0` | text on band |
| `--cov-band-sub` | `rgba(255,255,255,.74)` | `rgba(220,235,224,.66)` | muted text on band |
| `--cov-band-line` | `#1F3E27` | `#2C523A` | band underline |
| `--cov-border` | `#2A5233` | `#3D6349` | container outline |
| `--ins-band` | `#74A880` | `#3F6E50` | sub-container band |
| `--ins-band-ink` | `#14261A` | `#E4F0E7` | text on sub-band |
| `--ins-band-line` | `rgba(0,0,0,.18)` | `rgba(0,0,0,.3)` | sub-band underline |
| `--ins-border` | `#5C8E69` | `#48785A` | sub-container outline |

### Semantic tokens

**These are identical in `optimizer.css`.** Brand colour differs between the
two tools; meaning does not. A reader must never have to ask which tool they
were in to interpret a warning.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--edit` | `#7E6115` | `#D2AE5F` | value differs from the imported extract |
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

- **Green (accent)** — brand, interactive, container identity.
- **Gold (`--edit`)** — *only* "differs from the extract". Never use it for
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

One definition serves the Home pane and any future pane needing the same
shape:

```css
.home-grid, .split { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; align-items: start; }
.col-cov,  .split-main { grid-column: span 2; }
.col-pol,  .split-side { grid-column: span 1; position: sticky; top: 0; }
@media (max-width: 1240px) { /* stacks to one column, side becomes static */ }
```

- `.col-cov` / `.col-pol` — the Home pane (coverages / policy sidebar).
- `.split-main` / `.split-side` — generic; use these for new panes.
- The side column is **sticky** — it stays put while the main column scrolls.
- Below 1240px both stack vertically, main above side.

### Coverage field grid

24 coverage fields render as **four columns, one per group**, so related fields
sit adjacent vertically:

| `Plan & Risk` | `Amounts & Premium` | `Dates` | `Loadings & Adjustments` |
|---|---|---|---|
| Plan ID | Face Amount | Issue Date | Perm. Extra % |
| Rate Scale | Sum Insured | Maturity/Exp. | Flat Rate |
| Sex | Modal Prem. | Paid-Up Date | Flat Rate Dur. |
| Smoker | Policy Fee | Rate Date | Prem/COI Adj. % |
| STB 1 | Cash Value | | Prem/COI Dur. |
| STB 2 | GRP Total | | |
| Status | Bus. Alloc. Dur. | | |

`coverageNumber` is **not** in the grid — it is the badge in the card header.

Breakpoints use **container queries against `.col-cov`**, not the viewport:

```css
.col-cov { container-type: inline-size; }
.fgrid { grid-template-columns: repeat(4, minmax(0,1fr)); }
@container (max-width: 780px) { .fgrid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@container (max-width: 400px) { .fgrid { grid-template-columns: minmax(0,1fr); } }
```

> **Why:** below 1240px the page stacks and the coverage column becomes *full
> width*. A viewport media query would collapse the field columns at exactly
> the moment there is more room for them. If you build a field grid inside a
> different wrapper, give that wrapper `container-type: inline-size` too.

---

## 5. Component classes

| Class | Purpose |
|---|---|
| `.card` | generic container: surface, `--line` border, 2px radius |
| `.card--out` | container outlined in `--cov-border` (matches a coverage card) |
| `.card-head` | plain header strip on `--surface-head` |
| `.card-head--band` | **dark banded header** (`--cov-band` + white text) |
| `.card-body` / `.card-foot` | padded body / footer strip |
| `.card-title` / `.card-note` | 12px 650-weight title / 10px muted note |
| `.cov` | a coverage container (card + `--cov-border` outline) |
| `.cov-head` | dark band carrying the coverage number |
| `.cov-no` | number badge, inverts the band (white chip, dark text) |
| `.cov-plan` / `.cov-sum` | plan id / summary line inside the band |
| `.fgrid` / `.fgroup` / `.fgroup-head` | the 4-column field grid, its columns and their headings |
| `.fr` | one label/value row inside a group |
| `.fk` | field label (11px, `--ink-3`) |
| `.fi` | editable input or select |
| `.fi--txt` | left-aligned variant (text fields; numbers are right-aligned) |
| `.fi--ro` | **read-only: sunk, dashed border, muted ink** |
| `.fi--bad` | failed validation |
| `.fi--name` | wide variant for the insured name |
| `.fr.is-chg` | row whose value differs from the extract (gold tint + ● marker) |
| `.ins-wrap` / `.ins` | insured sub-container (inset, `--ins-border` outline) and its table |
| `.kv` | key-value row (policy sidebar), `.kv.is-chg`, `.kv.is-total` |
| `.grouphead` | policy subsection band (`--ins-band`) |
| `.diff` | change-log table; `.tag--mod` / `.tag--add` / `.tag--del` |
| `.split` / `.split-main` / `.split-side` | generic 2/3 + 1/3 layout |
| `.proj-slot` | dashed empty placeholder container with `.t` title and `.s` subtitle |
| `.btn` | `--primary`, `--danger`, `--icon`, `--sm` modifiers |
| `.chip` | pill; `--warn`, `--edit` modifiers |
| `.toast` | bottom-right transient message; add `.show`, optional `.toast--err` |
| `.micro` | 9.5px uppercase letterspaced label |
| `.mono` / `.num` / `.muted` | monospace / tabular figures / muted |
| `.pane` | a tab panel; hidden via the `hidden` attribute |

`font-variant-numeric: tabular-nums` is applied to `.num`, `table`, `input`,
`select` and `.mono`. Keep it — column-by-column visual comparison is the
entire job.

---

## 6. Data model

Three record types. Field names are exact and must not be renamed — the extract
parser, the UI and your engine all key off them.

### Policy — 15 fields

| Key | Type | Constraint | Editable | .xlsx Sheet | .xlsx Cell |
|---|---|---|---|---|---|
| `policyNumber` | text | ≤ 10 alphanumeric | no | Policy | B2 |
| `policyStatus` | text | exactly 1 alphanumeric | no | Policy | B20 |
| `pmtMode` | enum | `'01'` = Monthly, `'12'` = Annual | **yes** | Policy | B18 |
| `premiumDepositAccount` | text | exactly 3 numeric, **blank allowed** | no | Policy | B8 |
| `specialQuoteIdentifier` | text | ≤ 20 alphanumeric + space, format `### YYMMMDDD` | no | Policy | B21 |
| `policyIssueDate` | date | DD-MMM-YYYY | no | Policy | B19 |
| `valueAsOfDate` | date | DD-MMM-YYYY | **yes** | Policy | B5 |
| `premiumsPaidToDate` | date | DD-MMM-YYYY | no | Policy | B7 |
| `policyAcb` | money | 0 … 999,999,999.99, 2 dp | no | Policy | B10 |
| `totalPremiumsPaid` | money | 0 … 999,999,999.99, 2 dp | no | Policy | B11 |
| `policyCumulativeNcpi` | money | 0 … 999,999,999.99, 2 dp | no | Policy | B12 |
| `currentLoanAmount` | money | 0 … 999,999,999.99, 2 dp | no* | Policy | B13 |
| `currentLoanInterest` | money | 0 … 999,999,999.99, 2 dp | no* | Policy | B14 |
| `currentAplAmount` | money | 0 … 999,999,999.99, 2 dp | no* | Policy | B15 |
| `currentAplInterest` | money | 0 … 999,999,999.99, 2 dp | no* | Policy | B16 |

\* The four indebtedness fields are locked as *fields*, but are written by the
**Add Loan on Policy** / **Add APL on Policy** buttons, which open an inline
form. Registering a loan is a deliberate action, not a cell edit.

### Coverage — 24 fields

`E` = editable on an imported coverage. `N` = editable on a newly added
coverage (`newOk`). See §7 for why these differ.

| Key | Type | Constraint | E | N |
|---|---|---|---|---|
| `coverageNumber` | text | ≤ 3 alphanumeric, e.g. `C01` | | |
| `planId` | text | exactly 5 alphanumeric | | ✓ |
| `rateScale` | text | exactly 1 alphanumeric | | ✓ |
| `sex` | enum | `M` / `F` | | ✓ |
| `smokerStatus` | enum | `N` / `S` | ✓ | ✓ |
| `stb1` | text | exactly 2 alphanumeric | | |
| `stb2` | text | exactly 3 alphanumeric | | |
| `coverageStatus` | text | exactly 1 alphanumeric | | |
| `faceAmount` | int | 1 … 999,999,999 CAD | ✓ | ✓ |
| `sumInsured` | int | 1 … 999,999,999 CAD | | |
| `modalPremium` | money | 0 … 999,999,999.99 CAD, 2 dp | | |
| `policyFee` | int | 1 … 999 CAD | | |
| `cashValue` | money | 0 … 999,999,999.99 CAD, 2 dp | | |
| `grpTotalAmount` | money | 0 … 999,999,999.99 CAD, 2 dp | | |
| `businessPremiumAllocationDuration` | int | 1 … 999 yrs | | |
| `coverageIssueDate` | date | DD-MMM-YYYY | | ✓ |
| `coverageExpirationDate` | date | DD-MMM-YYYY | | |
| `paidUpDate` | date | DD-MMM-YYYY | | |
| `rateDate` | date | DD-MMM-YYYY | | |
| `permanentExtraPremiumPct` | pct | 0 … 1,000,000 % | ✓ | ✓ |
| `flatRate` | money | 0 … 999.99 CAD, 2 dp | ✓ | ✓ |
| `flatRateDuration` | int | 1 … 999 yrs | ✓ | ✓ |
| `premiumCoiAdjustmentPct` | pct | 0 … 1,000,000 % | ✓ | ✓ |
| `premiumCoiAdjustmentDuration` | int | 1 … 999 yrs | ✓ | ✓ |

Plus `insureds: Insured[]`.

Totals: **7 editable** on an imported coverage, **11** on a new one.

### Insured — 3 fields

| Key | Type | Constraint |
|---|---|---|
| `fullName` | text | ≤ 60 chars, letters/spaces/hyphens/apostrophes, **stored UPPER CASE** |
| `birthdate` | date | DD-MMM-YYYY |
| `sex` | enum | `M` / `F` |

Insured fields carry **no `lock` flag**. Editability is decided entirely by the
record's `_new` flag: a life that came from the extract is read-only; a life
the operator added is fully editable.

### Engine-private keys

Every coverage and insured record carries these. **Strip them before any
persistence or export.**

| Key | On | Meaning |
|---|---|---|
| `_id` | coverage, insured | stable identity; survives edits to `coverageNumber` |
| `_removed` | coverage, insured | **soft delete** — still in the array, excluded from the projection, shown struck through with a Restore button |
| `_new` | coverage, insured | added by the operator, not present in the extract |

> **Critical for the engine:** `_removed` records are still in `state.data`.
> Filter them out. `runProjection` already does:
> `dataset.coverages.filter(function (c) { return !c._removed; })` and likewise
> for `insureds`. Never project a terminated coverage or a withdrawn life.

Removal semantics differ by origin, deliberately:

| Record | Imported | Added by operator |
|---|---|---|
| Coverage | **Remove Coverage** → `_removed = true`, restorable, logged | **Discard Coverage** → spliced from the array, no log entry |
| Insured | **Withdraw** → `_removed = true`, restorable, logged | **Remove** → spliced from the array, no log entry |

A coverage must always retain at least one non-removed insured; the button
disables at the last life.

---

## 7. Field descriptor schema

Every field is one object in `COVERAGE_FIELDS`, `POLICY_FIELDS` or
`INSURED_FIELDS`. The renderer and validator both read only these descriptors —
**adding a field is a data change, not a code change.**

| Property | Meaning |
|---|---|
| `k` | record key (must match the data model exactly) |
| `l` | short display label |
| `t` | `'txt'` \| `'int'` \| `'money'` \| `'pct'` \| `'date'` \| `'enum'` |
| `g` | group id (`plan` / `amounts` / `dates` / `load`). **A field with no `g` is not rendered in the coverage grid.** In `POLICY_FIELDS`, an entry with only `g` is a subsection heading. |
| `lock: 1` | NON-EDITABLE on an imported record |
| `newOk: 1` | editable on a record the operator added |
| `min` / `max` | numeric bounds |
| `dec` | max decimal places for `money` (default 2) |
| `len` | exact character length |
| `maxLen` | maximum character length |
| `cs` | permitted-character regex |
| `csl` | human description of `cs`, used in the error message |
| `opt: 1` | blank permitted |
| `up: 1` | fold to UPPER CASE on commit |
| `opts` | `[[value, label], …]` for `enum` |
| `u` | unit shown beside the label (`'%'`, `'yrs'`; `'CAD'` is suppressed as noise) |
| `ph` | input placeholder |
| `hint` | tooltip text |

### The editability rule

```js
var locked = isNew ? !f.newOk : Boolean(f.lock);
```

Two genuinely different rules, and the reason matters:

- **Imported record** — `lock` protects the value the extract supplied.
- **New record** — there is no source value to protect, so an explicit
  allowlist (`newOk`) decides. Everything outside it stays **blank and inert**
  rather than inviting an invented figure.

A newly added coverage starts with **every field empty** except `sex` (`'M'`)
and `smokerStatus` (`'N'`), which need a seed value for their `<select>` to
render.

---

## 8. Validation

`validate(f, raw)` returns `{ ok: true, v: coercedValue }` or
`{ ok: false, msg: 'human message' }`.

Order of checks:

1. **Blank** → `ok` with `v: ''` if `f.opt`, otherwise `"<label> is required"`.
2. **`txt`** → upper-case if `up`, then charset, then exact `len`, then `maxLen`.
3. **`enum`** → case-insensitive match against `opts[i][0]`.
4. **`date`** → `parseDate`, normalised to `DD-MMM-YYYY`.
5. **numeric** → `toNum`, integer check for `int`, decimal-places check for
   `money`, then `min` / `max`.

**An invalid value never reaches the model.** `commit()` marks the input
`.fi--bad`, sets its `title` to the message, raises an error toast, and
returns. The operator's text stays on screen so they can fix it.

### Number parsing

`toNum` strips spaces, commas, `$` and a trailing `%` before parsing. This is
what lets an operator paste `$1,234.50` straight out of the source terminal,
and what lets inputs display grouped numbers.

### Number display

Numbers keep their thousands separators **inside inputs**, not just in
read-only text — the job is eyeball comparison, and `250000` does not read
against `250,000`. Focus selects the whole field so typing replaces rather than
splices.

### Dates

| Function | Behaviour |
|---|---|
| `parseDate(s)` | accepts `DD-MMM-YYYY`, `DDMMMYYYY`, `YYYY-MM-DD`, `YYYYMMDD`, `YYYY/MM/DD` → `Date` (UTC) or `null` |
| `fmtDate(dt)` | → canonical `DD-MMM-YYYY` |
| `agesAt(birth, asOf)` | → `{ real, nearest }` |

Canonical storage and display format is always **`DD-MMM-YYYY`**; the other
formats are entry conveniences, normalised on commit.

`buildDate` round-trip-checks day, month **and year**, which rejects
`31-FEB-2026` and catches `Date`'s silent remapping of years 0–99 into the
1900s. Day-first slash formats (`15/03/2026`) are **rejected as ambiguous**
against `YYYY/MM/DD`.

`agesAt` returns both ages the illustration needs:

- `real` — age last birthday.
- `nearest` — age nearest birthday, computed against the **actual midpoint**
  between the previous and next birthday, not a six-month rule of thumb, so
  leap years land correctly.

---

## 9. State and the render cycle

```js
var state = {
  loaded: false,   // has an extract been imported
  meta:   null,    // { fileName, importedAt: Date, mocked: bool }
  base:   null,    // pristine parsed dataset — NEVER mutated
  data:   null,    // working copy — every edit lands here
  form:   null,    // transient: 'loan' | 'apl' | null (inline form)
  seq:    100      // counter for generating _id values
};
```

Exposed for debugging as `window.__state()`.

**`base` vs `data` is the core idea.** `base` is the extract exactly as parsed;
`data` is the working copy. `diff()` compares them to produce the change log,
and every "was X" tooltip and gold highlight derives from that comparison.
Never write to `state.base`.

Both are set from independent deep copies:

```js
state.base = result.data;
state.data = JSON.parse(JSON.stringify(result.data));
```

### Render model

Rendering is **full innerHTML replacement** of three regions:
`renderCoverages()` → `#coverageList`, `renderPolicy()` → `#policyCol`,
`renderStatus()` → the status bar. There is no virtual DOM and no diffing.

> **The single most important gotcha in this file.**
>
> A field commit arrives on the `change` event, which the browser dispatches
> **before** focus reaches the next control. Rendering synchronously there
> captures `document.body` as the active element and drops focus on the floor —
> Tab stops working after every successful edit.
>
> `commit()` therefore calls **`deferRender()`**, not `render()`. It schedules
> the rebuild on a `setTimeout(…, 0)` so focus settles first. `render()` then
> carries the focused element's key, its in-progress text and its selection
> range across the rebuild.
>
> **If you add any code path that mutates the model from a `change` handler,
> use `deferRender()`.** Structural actions triggered by `click` (buttons) may
> call `render()` directly — focus is not in flight there.

**Only the DOM is deferred; the model is not.** `commit()` writes
`rec[f.k] = res.v` synchronously and *then* schedules the rebuild. So:

- Reading `state.data` immediately after a change event gives the **new** value.
- Reading the **DOM** immediately after gives the **old** markup — the gold
  highlight, header totals, change log and status bar all lag by one tick.

This matters in two places. If you call the engine from a change handler, the
dataset is already current. If you write automated tests, `await` a tick
(`setTimeout(…, 0)` or ~20 ms) before asserting against the DOM, or you will
chase a phantom failure.

### Tab order

Tab follows DOM order, which is **column-major**: down the first field group,
then to the top of the next. Read-only fields carry `tabindex="-1"` and are
skipped, so the keyboard runs straight between editable fields. Insured rows
tab Name → DOB → Sex.

---

## 10. DOM contracts

### `data-fk` — field key grammar

Every editable control carries `data-fk`. `resolve(fk)` parses it back to a
descriptor and a record.

| Scope | Format | Example |
|---|---|---|
| Coverage | `cov\|<coverageId>\|<fieldKey>` | `cov\|c1\|faceAmount` |
| Policy | `pol\|\|<fieldKey>` | `pol\|\|valueAsOfDate` |
| Insured | `ins\|<coverageId>~<insuredId>\|<fieldKey>` | `ins\|c1~i2\|birthdate` |

Read-only controls (`.fi--ro`) deliberately have **no** `data-fk`, so the
commit path cannot reach them even if a change event is dispatched at one.

### `data-act` — button actions

Handled by `onClick` via delegation on `#coverageList` and `#policyCol`.

| Action | Extra attrs | Effect |
|---|---|---|
| `rmcov` | `data-id` | soft-terminate a coverage |
| `rscov` | `data-id` | restore it |
| `dropcov` | `data-id` | hard-delete a new coverage |
| `addins` | `data-id` (coverage) | append a `_new` insured |
| `rmins` | `data-cov`, `data-id` | soft-withdraw an insured |
| `rsins` | `data-cov`, `data-id` | restore |
| `dropins` | `data-cov`, `data-id` | hard-delete a new insured |
| `loan` / `apl` | — | open the inline indebtedness form |
| `loancancel` / `loanapply` | — | dismiss / commit it |
| `reset` | — | `state.data = deep copy of state.base` |

### Element IDs

| Region | IDs |
|---|---|
| Tool switcher | `brandBlock`, `toolSelect`, `toolMark`, `toolName`, `toolMenu` |
| Top bar | `hdrPolicy`, `hdrFile`, `hdrMock`, `btnTheme`, `btnSample`, `btnImport`, `btnClear`, `fileInput` |
| Top bar — Save Test | `tcName`, `tcUser`, `btnSaveTest` |
| Tabs | `tabList`, `hdrStamp` |
| Empty state | `paneEmpty`, `dropZone`, `btnSelect`, `btnSample2` |
| Home | `paneHome`, `coverageList`, `covCount`, `btnAddCoverage`, `policyCol` |
| Projection | `paneProjection`, `btnRun`, `projectionSlot` |
| History | `paneHistory`, `historyTabHost`, `historyTabBody`, `historyTabCount`, `hfUser` |
| Inline loan form | `loanAmt`, `loanInt` |
| Pre-load page | `preload`, `plUsers`, `plNewName`, `plAddUser`, `plStart`, `plHint`, `plDropZone`, `plSelectExtract`, `plSampleExtract`, `plImportHint` |
| Status / toast | `stDot`, `stText`, `stFile`, `stChanges`, `toast` |

### Event wiring

| Target | Event | Handler |
|---|---|---|
| `#coverageList`, `#policyCol` | `change` | `commit` — validate and write |
| `#coverageList`, `#policyCol` | `input` | `live` — toggle `.fi--bad` only, no state write |
| `#coverageList`, `#policyCol` | `click` | `onClick` — `data-act` delegation |
| `document` | `focusin` | select-all on an input with `data-fk` |
| `document` | `keydown` | Enter blurs (so `change` fires with focus gone); Escape closes the tool menu |
| `#tabList` | `click` | `showTab` delegation |

---

## 11. Integration points for the calculation engine

**This is the part that matters.** Two functions are stubbed. Replace their
bodies. Nothing above them in the file needs to change.

### A. `parseWorkbook(bytes, fileName)` — extract → dataset

Currently returns a hard-coded `FIXTURE` and ignores `bytes`.

```js
function parseWorkbook(bytes, fileName) { /* ... */ }
```

**Input:** `bytes` is an `ArrayBuffer` from `FileReader.readAsArrayBuffer`.
`fileName` is the original name.

**Required return shape:**

```js
{
  data: {
    policy:    { /* the 15 Policy keys */ },
    coverages: [ {
      /* the 24 Coverage keys */
      _id: 'c1', _removed: false, _new: false,
      insureds: [ { fullName, birthdate, sex, _id: 'i2', _removed: false, _new: false } ]
    } ]
  },
  meta: { fileName: String, importedAt: Date, mocked: Boolean }
}
```

Requirements:

- **Assign `_id`, `_removed: false`, `_new: false`** to every coverage and
  insured. The UI cannot function without `_id`.
- Ids must be unique across the dataset (the current mock uses one counter for
  both, giving `c1, i2, c3, …`).
- Dates must be emitted as `DD-MMM-YYYY` strings, or as anything `parseDate`
  accepts and then normalised.
- Numeric fields must be **numbers**, not strings.
- Set `meta.mocked = false` once real parsing works — that flag drives the
  amber "Mock parser" chip in the header.
- The expected sheet is named `POLICY_EXTRACT`: one policy header row, one row
  per coverage, insured lives in trailing columns.
- On a malformed file, `throw` — `ingest()` catches and shows an error toast.
- Accepted extensions are gated in `ingest()`: `.xlsx .xls .xlsm .csv`.
- **Only in-force coverages are imported.** A `Coverages` row is skipped
  entirely unless its `CS` column is `1`, `2`, `3` or `4`. Skipped rows are
  never rendered and never counted. `coverageNumber` always comes straight
  from the row's own `C#` cell — a gap left by a skipped coverage (e.g.
  importing only C05–C08 out of 18) is never closed by renumbering the
  survivors.

### B. `runProjection(dataset)` — the engine

```js
function runProjection(dataset) { /* ... */ }
```

**Input:** `state.data`, the full working copy — engine keys still attached,
soft-deleted records still present. **You must filter them:**

```js
var live = dataset.coverages.filter(function (c) { return !c._removed; });
// and per coverage:
var lives = c.insureds.filter(function (i) { return !i._removed; });
```

**Current return shape** (extend as needed, keep `status`):

```js
{ status: 'not-implemented' | 'ok' | 'error', rows: [], note: String }
```

**Where results render:** `#btnRun`'s click handler writes into
`#projectionSlot`. Replace that handler's body with your table/chart rendering.

Suggested per-year row shape, agreed during design:

| Field | Type | Definition |
|---|---|---|
| `policyYear` | int | 1-based from policy issue date |
| `attainedAge` | int | attained age of the primary insured at year end |
| `annualPremium` | decimal | premium payable in the year |
| `costOfInsurance` | decimal | COI net of the premium/COI adjustment |
| `interestCredited` | decimal | interest credited to the fund |
| `cashValue` | decimal | cash value at year end |
| `deathBenefit` | decimal | total death benefit at year end |
| `adjustedCostBasis` | decimal | ACB at year end, for tax reporting |
| `loanBalance` | decimal | policy loan + APL including accrued interest |

### C. Pre-flight checks worth adding

Field-level constraints are already enforced at edit time. Structural checks
are not, and belong in the engine:

- at least one non-removed coverage exists;
- every live coverage retains at least one live insured;
- no duplicate `coverageNumber` among live coverages;
- required-but-blank fields on a newly added coverage (a new coverage starts
  almost entirely blank by design — see §7).

Render blockers as an `.alert.alert--err` above the results container and
disable the Run button.

---

## 12. Invariants — do not break these

1. `state.base` is never mutated.
2. An invalid value is never written to `state.data`.
3. `_removed` records are excluded from every calculation and total.
4. A coverage always retains ≥ 1 non-removed insured.
5. Locked fields have no `data-fk` and cannot be committed.
6. Blank stays blank — never substitute a default. `group()` explicitly guards
   `''` because `Number('') === 0` and `isFinite('') === true` would otherwise
   render an empty field as a real `0`.
7. Semantic colours (`--edit`, `--neg`, `--warn`, `--pos`) stay identical to
   `optimizer.css`.
8. Model mutations from a `change` handler use `deferRender()`, never `render()`.
9. Field metadata lives in the descriptor tables, not in rendering code.
10. Editing one coverage never touches another (verified behaviour — preserve it).

---

## 13. Extension recipes

**Add a coverage field** — append one descriptor to `COVERAGE_FIELDS` with a
`g` group id, and add the key to the parser output. Nothing else.

**Make a field editable** — remove `lock: 1` (imported) or add `newOk: 1` (new).

**Add a tab** — a `<button class="tab">` in `#tabList` and a
`<section class="pane">` in `inforce.html`, plus its id in `PANES` in
`inforce.js`. Use `.split` / `.split-main` / `.split-side` for a 2/3 + 1/3
pane.

**Add a third tool** — a new `.html/.css/.js` triple, and one entry added to
the `TOOLS` table in **every** page's script so all menus list it.

**Wire the engine** — replace the bodies of `parseWorkbook` and
`runProjection`, and the `#btnRun` click handler's rendering. Set
`meta.mocked = false`. Update the `PARSER MOCKED · ENGINE STUBBED` text in the
status bar footer of `inforce.html`.

---

## 14. Verification checklist

Every item below was confirmed against the running app at the time this file
was written; they are regression checks, not aspirations. Remember to let a
tick elapse before asserting on the DOM (§9).

After any change, confirm:

- [ ] Import the sample; 3 coverages render, each with 23 grid rows.
- [ ] Exactly 7 editable fields per imported coverage; 11 on a new one.
- [ ] Exactly 2 editable fields in the policy sidebar.
- [ ] Locked fields are dashed, grey, `readonly`, skipped by Tab.
- [ ] Edit a face amount: row goes gold, "was …" appears in the tooltip, the
      card header total updates, the change log gains a row.
- [ ] Tab through a whole coverage card typing values — focus must never drop.
- [ ] Dates accept all five formats and normalise to `DD-MMM-YYYY`.
- [ ] Out-of-range values are rejected and not committed.
- [ ] Terminate a coverage: struck through, restorable, excluded from totals.
- [ ] Add and remove an insured: no strikethrough, no log entry.
- [ ] Pick Coverage Optimizer in the menu: `optimizer.html` loads; the theme
      choice carries over; the extract does **not**.
- [ ] Toggle dark mode.
- [ ] No horizontal page scroll at 1280px and 1920px.
- [ ] Console is free of errors.
- [ ] Pre-load page: only `_start-life-inforce.bat` reaches `usernames.json`;
      opening the file directly shows the "could not reach the server" hint
      but Add still works via download-free retry once the server is up.
      Adding a name posts it to `usernames.json` and auto-selects the new pill.
- [ ] Pre-load page: clicking Select Extract / Load Sample Extract / dropping
      a file with no name picked does nothing but flag `#plImportHint` —
      nothing loads, the overlay stays up.
- [ ] Pre-load page: pick a name, then Load Sample Extract *on that page* —
      dismisses the overlay and lands straight on Home with data, no
      intermediate empty-state screen.
- [ ] Pre-load page: "Start with a blank tool" still reaches the ordinary
      empty state, and History from there.
- [ ] Save Test with no extract loaded: blocked with a toast, nothing written.
- [ ] Save Test with a blank name: `tcName` goes `.fi--bad`, nothing written.
- [ ] Save Test: entry appears in the History tab immediately, and a matching
      `<initials>_<name>.json` lands in `history_data/`.
- [ ] History tab is reachable (and `paneEmpty` steps aside for it) even
      before any extract is imported.
- [ ] Load a saved test case: switches to Home, restores the gold "changed"
      highlights and Change Log exactly as they were at save time (both
      `state.base` and `state.data` come back, not just the working copy).
- [ ] Delete a saved test case: removed from the list; its file moves to
      `history_data/_deleted/` (never erased).
- [ ] Reopen the tool: every case anyone saved into `history_data/` is listed,
      merged with this browser's own `localStorage` copy.

---

## 15. History, Save Test and the pre-load page

Added on top of the base spec above, following the same pattern as the
Coverage Optimizer's History tab (`OPTIMIZER_REFERENCE.md` §2h) — read that
first if extending this section; the two are meant to stay recognisably the
same feature.

### The pre-load page

A full-screen overlay (`#preload`) covers the tool (`.app.inert = true`)
until a user is picked. Unlike the Optimizer's three hardcoded pills, this
tool's roster is **dynamic**: `initPreload()` fetches `usernames.json` from
`server.py` and renders one `.pl-user` pill per entry. "Not listed? Add your
name…" + **Add** (or Enter) `POST`s `{name}` to `usernames.json`; the server
de-dupes case-insensitively, derives initials from the name's word-initial
letters (disambiguating a collision with a trailing digit), atomically
rewrites the file, and replies with the full updated list — which the client
re-renders and auto-selects. **Nothing is remembered between launches** — it
asks every time, on purpose (§14.3 of the Optimizer reference has the same
rule and the same reasoning).

**The page also carries its own "Import a policy extract" section** — the
same controls as `#paneEmpty` (`#plDropZone`, `#plSelectExtract`,
`#plSampleExtract`), so picking a name and getting a policy loaded is one
screen, not two. `plProceed()` is the shared gate every one of those controls
calls first: if no name is picked yet it flags `#plImportHint` and bails;
otherwise it calls `plEnter(...)` immediately (dismissing the overlay,
writing the `#tcUser` chip) and *then* the click handler proceeds exactly as
the top-bar's own Select/Sample controls would — `ingest()` or
`parseWorkbook(null, …).then(load)`. The overlay disappears on click, not on
the (async) result, so a cancelled file-picker dialog just leaves the
operator on the ordinary empty state (`#paneEmpty`), not stuck anywhere.

**`#plStart` ("Start with a blank tool") still exists** as the explicit
skip-import path — same gate (disabled until a name is picked), same
`plEnter(...)` call, but no load. This is also how an operator reaches
History without importing anything: Start, then the History tab (reachable
pre-load per the `showTab()` note above).

### Test Case Name / Save Test

`#tcName` + `#tcUser` + `#btnSaveTest` live in the static top bar, not inside
the History pane — same split as the Optimizer. `doSaveTest()`:

1. Refuses with a toast if `!state.loaded` (there is nothing to save) or the
   name is blank (`.fi--bad` + toast + focus).
2. Builds an entry via `histBuildEntry`, which snapshots **both**
   `state.base` and `state.data` (deep-cloned), plus `state.meta`,
   `policyNumber`, `coverageCount`, and `changeCount` (`diff().length` —
   reusing the existing Change Log diff, not a separate count).
3. Pushes the entry into `histCatalog`, persisted to `localStorage` under
   `life-inforce-testcases` (instant list, survives a reload even offline).
4. `POST`s the entry to `history_data/<initials>_<sanitised name>.json`
   through `server.py`, which never overwrites (a collision gets a
   timestamp-suffixed name back). If the server can't be reached, falls back
   to a browser download of the same JSON — same fallback contract as the
   Optimizer's `saveToDataFolder`.

### Load — the one place this diverges from the Optimizer

The Optimizer's `restoreState` only replaces its working state; this tool's
whole UI is built around diffing `state.base` (pristine) against `state.data`
(working copy) — see §9. So `doHistLoad` restores **both** from the
snapshot, not just `data`: the gold "changed" rows, the tooltip "was …"
values, and the Change Log all come back exactly as they were the moment the
case was saved, so the operator can keep analysing a case rather than getting
a clean slate. `state.loaded` is set, the header/status bar are refreshed as
in `load()`, and the tab switches to Home.

### History tab

`paneHistory` → `#historyTabHost`, filled by `initHistoryTab()` with a
`.card.card--out` + filtered `.ins` table (`historyTabShell()` /
`renderHistoryTab()` / `historyRow()`), mirroring the Optimizer's
`optimizer_history.js` shell almost verbatim. Columns are this tool's own:
**Test Case Name, Username, Date Saved, Policy Number, Coverages, Changes,
Load, Delete** (no Insureds/Modal-Premium columns — those are the Optimizer's
domain, not this one's). Filter row: Test Case Name and Date Saved are
"contains" (case-insensitive); Username is an exact-match `<select>` built
from whatever users have actually saved something.

**Unlike the other tabs, History is reachable before an extract is loaded** —
see the `showTab()` change in §9: `paneEmpty` steps aside for `paneHistory`
specifically, since Load is a legitimate alternative entry point to a working
session, not just something you do after importing.

`histLoadFromFolder()` runs once at startup (independent of the pre-load
gate — it's a harmless background fetch): `GET history_data/` returns every
saved case from every user's machine, merged into `histCatalog` by `id` so a
case saved by a colleague is there the next time anyone opens the tool.

### Everything lives in `inforce.js`

Ground rule §0 says one IIFE, and this feature does not get a pass: unlike
the Optimizer (whose tabs are split into files talking through a
`window.OptimizerCore` bridge, justified by that tool's larger size), History
and the pre-load page are implemented as more functions inside `inforce.js`'s
existing closure — same file, same conventions, no new global, no bridge.
`server.py`, `_start-life-inforce.bat` and `usernames.json` are the only new
files, and they are infrastructure (a local HTTP server and its data), not
UI code.

---

## 16. The Term Life calculation engine (`backend/calc_engine/term_life/`)

Unlike the rest of this tool, **the calculation engine is Python, not
JavaScript** — the goal is for a future team unfamiliar with this codebase to
be able to maintain the calculations without also knowing browser-side
front-end conventions. It is not wired into the real projection tab yet
(§11's `runProjection` is still a stub); it exists today so each formula can
be built and checked section by section against `term_catalog.json` before
anything depends on it.

### Structure: a declarative registry, called by a shared Context

Every catalog variable (`term_catalog.json`) is one small Python function,
named after its `python_name`, registered under that name with `@variable(...)`.
Functions are grouped one file per catalog section, numbered so they sort in
reading order — `s1_duration.py`, `s2_input_policy.py`, `s3_input_coverage.py`
(not `1_duration.py`: Python identifiers, and therefore module names, can't
start with a digit, so `import 1_duration` is a syntax error). A formula never
calls another module's function directly; it always goes through
`Context.get(python_name, iCov=..., iDur=..., iInsured=...)`, which looks up
the function in the registry, calls it, and caches the result. That
indirection is what lets a policy-level scalar (`value_as_of_date`), a
per-coverage variable (`coverage_1st_duration`), and — once Report-section
formulas arrive — a per-duration or per-insured one all share one lookup
mechanism, and it's what will let a later formula like "cumulative NCPI at
duration 5" pull duration 4, 3, 2… underneath it without knowing the call
chain in advance.

`iCov` and `iInsured` are **1-based** in `Context`, matching the spec's own
notation (`sum_{iCov=1}^{NbCov}`) rather than Python's 0-based lists, so the
code reads next to the LaTeX spec without an off-by-one translation.

A variable that cannot be computed yet (see below) raises `calc_engine.term_life.context.Blocked`,
not `NotImplementedError` — that distinction lets a caller (the dev endpoint,
a future test) tell "this formula is written but missing an input" apart
from "this is a bug".

### Extract field renames

Six extract field names were renamed to match their `term_catalog.json`
`python_name` exactly, for maintainability — a future reader cross-referencing
the catalog against the code should find the identical name, not a synonym:

| old name | new name | catalog `python_name` |
|---|---|---|
| `policy.projectionDate` | `policy.valueAsOfDate` | `value_as_of_date` |
| `policy.paidToDate` | `policy.premiumsPaidToDate` | `premiums_paid_to_date` |
| `policy.netCostOfPureInsurance` | `policy.policyCumulativeNcpi` | `policy_cumulative_ncpi` |
| `policy.adjustedCostBasis` | `policy.policyAcb` | `policy_acb` |
| `policy.paymentMode` | `policy.pmtMode` | `pmt_mode` |
| `coverage.maturityExpiryDate` | `coverage.coverageExpirationDate` | `coverage_expiration_date` |

Display labels (`l:` in the field descriptors) are unchanged — only the `k:`
key and every reference to it moved. Every other field already matched its
catalog name closely enough to leave alone.

### What's implemented, and what's blocked on Product Characteristics

Sections 2 (Input Setup - Policy, 13/13) and 3 (Input Setup - Coverage,
11/13) are fully implemented — everything computable from the extract alone.
Section 1 (Duration) has 4/16 implemented (DUR-01 through DUR-04); the rest,
plus `coverage_type` (COV-12) and `product_type` (COV-13), raise `Blocked`
because they need a **Product Characteristics reference** (a per-plan lookup
— e.g. "plan LT10I: premiums end after 10 years, coverage ends at age 100")
that does not exist yet. `term_catalog.json`'s `source` column marks these
`product_char`. `DUR-16` (`age`) is blocked for a different reason: the
catalog lists it as a direct CAPSIL read with no dependencies, but the
extract has no raw age field, only birthdate — whether/how it should be
computed is still an open question, not yet answered.

Day-counts in `dates.days_between_365` (used by `POL-09` and `COV-08`'s
Annual-mode branch) deliberately assume a 365-day year with February always
28 days, per the catalog's own note on those two variables — not a real
calendar day-count, and leap years are never special-cased anywhere in the
engine.

### Dev Validations tab — not part of the shipped tool

A `POST /calc/term_life` route on `server.py` (`run_term_life_calc`) takes
the working dataset (`state.data`), walks every `term_catalog.json` entry in
the three sections above, calls `Context.get(...)` for each — once for a
policy-level variable, once per coverage for an `iCov` one, once per
(coverage, insured) for an `iCov, iInsured` one — and replies with the
results grouped by section, each carrying either a value or an error string
(`Blocked`'s reason, or another exception's message so a bug in a formula
surfaces instead of crashing the whole tab).

The **Dev Validations** tab (`inforce.js` `renderDevCalc()` /
`devCalcSection()` / `devCalcRow()`, `#devCalcHost`) POSTs to that route
whenever it's opened and renders one `.card.card--out` per section, one row
per (variable, scope) — mirroring the History tab's own card/table idiom.
Like History, it needs its own server (`_start-life-inforce.bat`); unlike
History, it needs a loaded extract (there is nothing to compute against
otherwise), so it is **not** exempted from the `showTab()` "nothing shows
until loaded" rule the way History is.

This tab is scaffolding for building the engine, not a feature for the
tool's actual users — remove it (and the `/calc/term_life` route) once the
engine is wired into the real Projection tab, or keep it around as a
developer aid; that's a call for whoever finishes the engine.
