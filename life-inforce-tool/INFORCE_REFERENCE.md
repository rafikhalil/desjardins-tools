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
├── inforce.html               static shell: top bar, tabs, panes, status bar, toast
├── inforce.css                green palette + every component class
├── inforce.js                 one IIFE: schema, state, render, events, engine hooks
├── INFORCE_REFERENCE.md       this file
├── INFORCE_INSTRUCTIONS.md    custom instructions for the coding platform
│
├── optimizer.html / .css / .js   the sibling tool — out of scope here
└── OPTIMIZER_REFERENCE.md / OPTIMIZER_INSTRUCTIONS.md
```

**`inforce.css` and `optimizer.css` share every component rule byte-for-byte;
only the palette tokens differ.** They were generated from one source. If you
change a component rule in `inforce.css`, make the identical change in
`optimizer.css` — visual consistency across the two tools depends on it.

### Running it

Opening `inforce.html` directly from disk works — `inforce.js` is a classic
script, not a module. For development, prefer a local server so the browser does not
serve stale files:

```bash
python -m http.server 8000
```

> **Caching gotcha.** `python -m http.server` sends no cache headers, and
> browsers will happily hold on to an old `inforce.js` after you edit it. If a
> change appears not to take effect, hard-reload or restart the server on a
> different port before you start debugging your own code. This wasted real
> time during development.

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

| Key | Type | Constraint | Editable |
|---|---|---|---|
| `policyNumber` | text | ≤ 10 alphanumeric | no |
| `policyStatus` | text | exactly 1 alphanumeric | no |
| `paymentMode` | enum | `'01'` = Monthly, `'12'` = Annual | **yes** |
| `premiumDepositAccount` | text | exactly 3 numeric, **blank allowed** | no |
| `specialQuoteIdentifier` | text | ≤ 20 alphanumeric + space, format `### YYMMMDDD` | no |
| `policyIssueDate` | date | DD-MMM-YYYY | no |
| `projectionDate` | date | DD-MMM-YYYY | **yes** |
| `paidToDate` | date | DD-MMM-YYYY | no |
| `adjustedCostBasis` | money | 0 … 999,999,999.99, 2 dp | no |
| `totalPremiumsPaid` | money | 0 … 999,999,999.99, 2 dp | no |
| `netCostOfPureInsurance` | money | 0 … 999,999,999.99, 2 dp | no |
| `currentLoanAmount` | money | 0 … 999,999,999.99, 2 dp | no* |
| `currentLoanInterest` | money | 0 … 999,999,999.99, 2 dp | no* |
| `currentAplAmount` | money | 0 … 999,999,999.99, 2 dp | no* |
| `currentAplInterest` | money | 0 … 999,999,999.99, 2 dp | no* |

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
| `maturityExpiryDate` | date | DD-MMM-YYYY | | |
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
| `parseDate(s)` | accepts `DD-MMM-YYYY`, `YYYY-MM-DD`, `YYYYMMDD`, `YYYY/MM/DD` → `Date` (UTC) or `null` |
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
| Policy | `pol\|\|<fieldKey>` | `pol\|\|projectionDate` |
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
| Tabs | `tabList`, `hdrStamp` |
| Empty state | `paneEmpty`, `dropZone`, `btnSelect`, `btnSample2` |
| Home | `paneHome`, `coverageList`, `covCount`, `btnAddCoverage`, `policyCol` |
| Projection | `paneProjection`, `btnRun`, `projectionSlot` |
| Inline loan form | `loanAmt`, `loanInt` |
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
- [ ] Dates accept all four formats and normalise to `DD-MMM-YYYY`.
- [ ] Out-of-range values are rejected and not committed.
- [ ] Terminate a coverage: struck through, restorable, excluded from totals.
- [ ] Add and remove an insured: no strikethrough, no log entry.
- [ ] Pick Coverage Optimizer in the menu: `optimizer.html` loads; the theme
      choice carries over; the extract does **not**.
- [ ] Toggle dark mode.
- [ ] No horizontal page scroll at 1280px and 1920px.
- [ ] Console is free of errors.
