# Custom instructions — Inforce Tool

Paste the block below into the coding platform's custom-instructions /
system-prompt field when working on the **Inforce Tool**. Keep
`INFORCE_REFERENCE.md` in the project root so the agent can open it.

---

## Project: Inforce Tool — calculation engine

`INFORCE_REFERENCE.md` in the project root is the authoritative spec for the
Inforce Tool front end (`inforce.html`, `inforce.css`, `inforce.js`). **Read
it before writing any code, and re-check it whenever you touch the UI, the
data model, validation, or styling.** If your plan conflicts with it, the
reference wins — say so rather than silently diverging.

Scope: the Inforce Tool only. `optimizer.*` is a sibling page with its own
reference; do not modify it unless asked, except to mirror a shared CSS rule.

**Non-negotiable constraints**

- No dependencies, no build step, no framework or bundler. The tool must keep
  running by opening `inforce.html` directly.
- Keep to the existing files. One extra `engine.js` is acceptable if the
  engine is large; more needs justification.
- `inforce.js` is ES5 inside a single IIFE — `var`, `function`, string
  concatenation. Match the surrounding style exactly.
- Do not restyle anything. Use the existing classes and CSS custom properties
  (§3, §5). Never hard-code a colour. `inforce.css` and `optimizer.css` share
  every component rule — if you must change one, change both identically.
- Never invent a value. Blank stays blank — no default figures, no placeholder
  zeros, no silent coercion. This is a validation tool.

**Your task** is §11: replace the bodies of `parseWorkbook` and
`runProjection`, and the `#btnRun` rendering. Everything above them stays
as-is.

**Always honour**

- `state.base` is never mutated. `state.data` is the working copy.
- Filter out `_removed` records before every calculation and total.
- Assign `_id`, `_removed: false`, `_new: false` to every coverage and insured
  you parse. The UI cannot function without `_id`.
- Mutating the model from a `change` handler → call `deferRender()`, never
  `render()`. The model updates synchronously; the DOM lags one tick.
- Field metadata belongs in the descriptor tables (§7), not in rendering code.

**Before declaring done**, work through the §14 checklist and report the
result honestly, including anything that fails. Cite the section number when a
decision comes from the reference. If something the reference does not cover
comes up, ask rather than guess.
