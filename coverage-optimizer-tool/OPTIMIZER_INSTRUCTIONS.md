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
  running by opening `optimizer.html` directly.
- Keep to the existing files. One extra `optimizer-engine.js` is acceptable if
  the engine is large; more needs justification.
- `optimizer.js` is ES5 inside a single IIFE — `var`, `function`, string
  concatenation. Match the surrounding style exactly.
- Do not restyle anything. Use the existing classes and CSS custom properties
  (§3, §5). Never hard-code a colour. `optimizer.css` and `inforce.css` share
  every component rule — new Optimizer-only rules are fine; if you change a
  shared one, change both identically.
- Never invent a value. Blank stays blank — no default figures, no placeholder
  zeros, no silent coercion.
- **Port, don't reinvent — with one exception.** Validated inputs, date
  parsing (`parseDate`/`fmtDate`/`buildDate`), number formatting and the
  field-descriptor schema already exist in `inforce.js`. Copy them (§8 lists
  exactly what and where); never write a second version. **The one thing you
  must NOT port from `inforce.js` is `agesAt`** — this page's own `agesAt`
  implements a specific, exact stepwise age algorithm (§ "Insured Input") that
  this tool is required to match; Inforce's version uses a different
  (midpoint) heuristic. Reuse this page's own `agesAt` for any new age math;
  never copy Inforce's over it.

**Your task**: most of the page is still a scaffold — five of six tabs are
empty containers. The entire Input & Results tab — Coverage Input, Insured
Input and Settings — is already live and working — read all three before
building anything new; they are the reference implementation for this page's
own conventions (§7). Build the remaining views and calculations into their
containers (§2, §10 "Fill a tab"). Keep the `<section class="pane">`
wrappers; `showTab` depends on them.

**Always honour**

- Generate markup as strings, escape every value with `esc()`, set
  `innerHTML`, and delegate events on `#panes` — never on generated elements.
- Mutating a model from a `change` handler → defer the re-render one tick
  (port `deferRender` / `render` from `inforce.js`). Rendering synchronously
  there drops focus and breaks Tab after every edit.
- Read-only fields keep their box: `.fi--ro`, `readonly`, `tabindex="-1"`, no
  `data-fk`.
- The `TOOLS` table must stay identical to the one in `inforce.js`.

**Open decision — ask before assuming**: whether the Optimizer imports the
same policy extract as the Inforce Tool or works from manual inputs. The tab
names point both ways. Do not pick one silently.

**Before declaring done**, work through the §11 checklist and report the
result honestly, including anything that fails. Cite the section number when a
decision comes from the reference. If something the reference does not cover
comes up, ask rather than guess.
