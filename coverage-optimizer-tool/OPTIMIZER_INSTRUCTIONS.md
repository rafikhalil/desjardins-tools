# Custom instructions — Coverage Optimizer

Paste the block below into the coding platform's custom-instructions /
system-prompt field when working on the **Coverage Optimizer**. Keep
`OPTIMIZER_REFERENCE.md`, `TO_DO.md` (and `INFORCE_REFERENCE.md`, which the
reference points into) in the project folder so the agent can open them.
*Last revised 2026-09-20.*

---

## Project: Coverage Optimizer — inputs, rate lookups and premium calculations

`OPTIMIZER_REFERENCE.md` in the project folder is the authoritative spec for the
Coverage Optimizer (`optimizer.html`, `optimizer.css`, `optimizer.js` and the
per-tab file pairs). **Read it before writing any code**, and re-read the part you
are touching:

- **Changing a calculation, an Axis Key, a rate lookup, the joint equivalent age,
  backdating, Modal Prem., Highest Amt → §12.** It documents every formula, how the
  Axis Key is built character by character, the rate bands, and numeric cases that
  must keep reproducing. §11.3 lists them.
- **Adding or changing any failure, error cell or message → §13** (the message bar
  and the complete error catalogue).
- **Running, deploying, or moving the tool to another machine → §14.**
- UI, data model, validation, styling → §2–§8; rules that must not be broken → §9.

If your plan conflicts with the reference, the reference wins — say so rather than
silently diverging. If the reference does not cover something (an ambiguous
formula, an undefined term, a format a real value doesn't fit), **ask; do not guess**
— the Axis Key gap for `WL to 100` / `Term to 100` (§12.2) was flagged, never padded.

Scope: the Coverage Optimizer only. `inforce.*` is a sibling page with its own
reference; do not modify it unless asked, except to mirror a shared CSS rule.

**What the tool is.** All six tabs are live: Input & Results (Settings, Insured
Input, Coverage Input, Results), Coverages, Insureds, Rates, Backdate, History. It
loads two rate workbooks from `rates/` at launch, builds the Axis Key, looks up
PR/EPR/PEP per insured, coverage and rate band, computes the joint-life Equivalent
Age (§12.6), Modal Prem. and Modal Prem. Backdated, Highest Amt / Prem. Basis Ins.
Amt, and the backdate decision — and reproduces a spreadsheet, so **reproduce its
arithmetic exactly** (Excel-style rounding, the 30-day-month age algorithm, the
"closest lower band" rule); never "improve" it. The former "Eq. Age / Substd. Prem."
tab no longer exists: its calculation runs in the background and its output is the
read-only Joint Age in the Joint container.

**Non-negotiable constraints**

- No dependencies, no build step, no framework or bundler. The page must keep
  running from `optimizer.html`. **One exception has been exercised**:
  `xlsx.full.min.js` (SheetJS), vendored as a single `<script>` for the rate files
  (§0 rule 1). `server.py` is Python 3 **standard library only** (no `pip install`).
- Keep to the existing files unless a new one earns its keep the way the per-tab
  pairs did (`optimizer_coverages`, `_insureds`, `_rates`, `_backdate`, `_history`,
  `_preload`) — one file pair per live tab, own IIFE, reading shared state through
  `window.OptimizerCore` only, and **lending** what other tabs need onto the bridge
  (§2d). Script order in `optimizer.html` matters (§14.1).
- `optimizer.js` and every hand-written page-logic file is **ES5 inside one IIFE** —
  `var`, `function`, string concatenation; no arrow functions, `let`/`const`,
  template literals or classes. Match the surrounding style (comment density,
  naming) exactly.
- Do not restyle anything. Use the existing classes and CSS custom properties
  (§3, §5); never hard-code a colour. `optimizer.css` and `inforce.css` share every
  component rule — Optimizer-only rules are fine (the message bar's `.issues*`
  is one); changing a shared rule means changing both identically.
- **Never invent a value.** Blank stays blank — no default figures, no placeholder
  zeros, no silent coercion (`Number('#N/A')` is `NaN` — §9 #50), no padded or
  truncated string to force a fixed-width format to fit. A calculation that cannot
  run returns *pending* / *blocked* / *error with a reason*, never a plausible number.
- **Never leave a failure silent.** Every rejected input, failed load or save,
  and unresolvable lookup must (a) show in its cell/box **and** (b) reach the
  top-bar message bar with a sentence saying what is wrong and how to fix it
  (§13). New failing function ⇒ return `{ error: true, why: '…' }` / `{ why }` /
  `{ blocked: '…' }` in words naming the record. Rejected field commits use
  `badInput` / `goodInput`, never a bare `fi--bad` + toast (§9 #45–#47). And keep
  the bar **quiet on a blank page** (§9 #44).
- **Port, don't reinvent — with exceptions.** Validated inputs, date parsing,
  number formatting and the field-descriptor schema already exist in `inforce.js`;
  copy them (§8), never write a second version. **Do NOT port `agesAt`** (this
  page's own is a specific exact algorithm) and **do NOT port `parseWorkbook` /
  `ingest` / `FIXTURE`** for the rates workbook (mocked in `inforce.js`; that is why
  Rates vendors SheetJS). Reuse this page's own `agesAt` for any age math.
- **Confidential data.** The rate workbooks in `rates/` are confidential and stay on
  the work machine: never commit, upload, paste or quote their contents; test with
  small synthetic workbooks (§13.4). Test cases in `data/` hold only operator inputs.

**Always honour**

- Generate markup as strings, escape every value with `esc()`, set `innerHTML`, and
  delegate events on a stable ancestor (a tab's own host, or `#panes`) — never on
  generated elements.
- Mutating a model from a `change` handler → defer the re-render one tick
  (`deferRender…`). Rendering synchronously drops focus and breaks Tab after every
  edit. A chunked rate import (§2f) is the one deliberate multi-tick exception.
- Read-only fields keep their box: `.fi--ro`, `readonly`, `tabindex="-1"`, no
  `data-fk`.
- The `TOOLS` table stays identical to `inforce.js`'s.
- The bridge (`window.OptimizerCore`) is read-only from every tab file except
  `restoreState`, called only from History (§2d, §2h, §9 #30); message-bar
  functions (`raise`, `resolve`, `badInput`, `goodInput`, `diagnostics`) are the
  other deliberate exports, and they write only the message list.
- A dependency runs one way (§9 #39): Backdate reads Rates; Rates and the Joint Age
  read Backdate's **eligibility only** — never Confirm Backdate (circular).
- Changing a rate-table version stamp is a **two-place edit** (§12.2, §9 #43).
- Keep `TO_DO.md` current **in the same change**: anything the requester parks
  ("later", "put aside", "review later") is added to it; finished items move to
  *Done*; an assumption you had to make becomes a review item (R-n).

**How to work**

- **Smallest correct change** (`yagni_principle.md`): read the code and trace the
  real flow first; reuse what exists (a helper, a bridge member, a pattern) before
  writing anything; fix the root cause once, where every caller routes through; a
  small change in the wrong place is a second bug. Leave one runnable check behind
  for non-trivial logic.
- **Verify by running it.** Serve the folder (`python server.py <port>`), use
  **Skip (dev)** on the pre-load page, drive state with
  `OptimizerCore.restoreState(snapshot)`, and feed synthetic rate workbooks through
  `#ratesFileInput` (§13.4). Do not report a calculation as working from reading the
  code alone.
- **When working from screenshots or pasted diffs** (e.g. code carried between
  machines): verify against the local file first, show the exact code, and confirm
  before applying; keep edits additive.

**Before declaring done**, work through the §11 checklist (at minimum §11.3
regression cases if you touched a formula, §11.5 if you touched an error path) and
report the result honestly, including anything that fails or was not run. Cite the
section number when a decision comes from the reference; if something the
reference does not cover comes up, ask rather than guess.
