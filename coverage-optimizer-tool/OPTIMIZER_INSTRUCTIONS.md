# Custom instructions — Coverage Optimizer

Paste the block below into the coding platform's custom-instructions /
system-prompt field when working on the **Coverage Optimizer**. Keep
`OPTIMIZER_REFERENCE.md` (and `INFORCE_REFERENCE.md`, which it points into)
in the project root so the agent can open them.

---

## Project: Coverage Optimizer — views and calculations

`OPTIMIZER_REFERENCE.md` in the project root is the authoritative spec for the
Coverage Optimizer front end (`optimizer.html`, `optimizer.css`,
`optimizer.js`). **Read it before writing any code, and re-check it whenever
you touch the UI, the data model, validation, or styling.** If your plan
conflicts with it, the reference wins — say so rather than silently diverging.

Scope: the Coverage Optimizer only. `inforce.*` is a sibling page with its own
reference; do not modify it unless asked, except to mirror a shared CSS rule.

**Non-negotiable constraints**

- No dependencies, no build step, no framework or bundler. The tool must keep
  running by opening `optimizer.html` directly. **One exception has been
  exercised**: `xlsx.full.min.js` (SheetJS), vendored as a single `<script>`
  for the Rates tab's real `.xlsx` reading (§0 rule 1, §2f) — a real workbook
  parser isn't something anyone hand-writes. Any further external code needs
  the same "single vendored script" treatment, not a package manager.
- Keep to the existing files unless a new one earns its keep the same way the
  five split-off tab pairs already have (`optimizer_coverages.*`,
  `optimizer_insureds.*`, `optimizer_rates.*`, `optimizer_backdate.*`,
  `optimizer_history.*`, §1/§2d–§2h) — one file pair per live tab, own IIFE,
  reading shared state through `window.OptimizerCore` only. **`optEqAge` is
  the one tab still waiting for this treatment** — build it the same way.
- `optimizer.js` (and any file that splits off from it the same way) is ES5
  inside a single IIFE — `var`, `function`, string concatenation. Match the
  surrounding style exactly. (A vendored library or a dedicated CALCULATION
  engine file may use modern syntax; every hand-written page-logic file may not.)
- Do not restyle anything. Use the existing classes and CSS custom properties
  (§3, §5). Never hard-code a colour. `optimizer.css` and `inforce.css` share
  every component rule — new Optimizer-only rules are fine; if you change a
  shared one, change both identically.
- Never invent a value. Blank stays blank — no default figures, no placeholder
  zeros, no silent coercion, no padded/truncated string to force a fixed-width
  format to fit (Rates' own `axisKeyPrefix`, §2e/§2f, is the worked example of
  refusing to do this — flag the gap instead).
- **Port, don't reinvent — with two exceptions.** Validated inputs, date
  parsing (`parseDate`/`fmtDate`/`buildDate`), number formatting and the
  field-descriptor schema already exist in `inforce.js`. Copy them (§8 lists
  exactly what and where); never write a second version. **You must NOT port
  `agesAt`** — this page's own `agesAt` implements a specific, exact stepwise
  age algorithm (§ "Insured Input") that this tool is required to match;
  Inforce's version uses a different (midpoint) heuristic. **You must NOT
  port `parseWorkbook`/`ingest`/`FIXTURE` for reading the rates workbook,
  either** — they turned out to be mocked/stubbed in `inforce.js` itself, no
  real `.xlsx` reader ever existed there to copy (§8); that's why Rates
  vendors SheetJS instead (above). Reuse this page's own `agesAt` for any new
  age math; never copy Inforce's over it, and don't go looking in
  `inforce.js` for a real extract parser that isn't there.

**Your task**: six of seven tabs are live — Input & Results (Coverage Input,
Insured Input, Settings, Results), Coverages, Insureds, Rates, Backdate and
History all add/remove/edit, validate, and compute for real. **`optEqAge` is
the one tab still an empty container.** Read the live tabs before building
anything new — Insured Input/Coverage Input/Settings (§2, §2a, §2b) are the
original reference implementation for this page's own conventions (§7), and
Rates/Backdate/History (§2f–§2h) are the current template for how a whole
split-off tab is structured. Build what's left into its container (§2, §10
"Fill a tab"). Keep the `<section class="pane">` wrappers; `showTab` depends
on them.

**Always honour**

- Generate markup as strings, escape every value with `esc()`, set
  `innerHTML`, and delegate events on a stable ancestor (a tab's own host,
  or `#panes`) — never on generated elements.
- Mutating a model from a `change` handler → defer the re-render one tick
  (port `deferRender` / `render` from `inforce.js`). Rendering synchronously
  there drops focus and breaks Tab after every edit. A CHUNKED import that
  legitimately spans multiple ticks (Rates' own progress-bar-driven parse,
  §2f/§7) is the one deliberate exception to "one tick", not a precedent for
  everyday field commits to also take longer than that.
- Read-only fields keep their box: `.fi--ro`, `readonly`, `tabindex="-1"`, no
  `data-fk`.
- The `TOOLS` table must stay identical to the one in `inforce.js`.
- The bridge (`window.OptimizerCore`) is read-only from every split-off tab
  file EXCEPT `restoreState`, called only from History (§2d, §2h) — don't add
  a second write path without the same bulk-overwrite justification it had.

**Resolved — no longer an open decision**: the Optimizer works purely from
manual input; it does NOT import a policy extract. **Insurance rates are the
only thing this page imports** (§2f, §8). If a still-open question comes up
that the reference doesn't cover — an ambiguous formula, an undefined term,
a fixed-width format a real value doesn't fit — ask rather than guess, the
same way the Axis Key's `VEG100`/`T100` gap (§2e/§9) was flagged instead of
silently padded.

**Before declaring done**, work through the §11 checklist and report the
result honestly, including anything that fails. Cite the section number when a
decision comes from the reference. If something the reference does not cover
comes up, ask rather than guess.
