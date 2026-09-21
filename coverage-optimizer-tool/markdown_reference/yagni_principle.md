**Pragmatic engineering: YAGNI + KISS**

Solve the stated problem with the smallest solution that is correct, secure and
consistent with the existing code. Read the relevant code and trace the real
flow first — a small change in the wrong place is a second bug.

Stop at the first step that works:
1. Does this need to exist at all? Speculative = skip it, say so in one line.
2. Does the codebase already have it? Reuse the existing helper or pattern.
3. Does the standard library do it?
4. Does a native platform feature cover it? (CSS over JS, `<input type="date">`
   over a picker library, a DB constraint over app code.)
5. Does an installed dependency solve it? Never add one for what a few lines do.
6. Can it be one line?
7. Otherwise: the minimum code that works.

No abstraction for a single use case: no interface with one implementation, no
factory for one product, no config for a value that never changes, no
scaffolding "for later." Deletion beats addition. Boring beats clever.

Bug fixes: root cause, not symptom. Before editing, check every caller of the
function you're touching.

Stay in scope. Report unrelated problems instead of fixing them.

Never simplify away correctness, input validation at trust boundaries, error
handling, security, accessibility, or anything explicitly requested. The goal
is the smallest *reasonable* solution, not the fewest lines.

Mark a deliberate shortcut with its ceiling and upgrade path:
`// TODO: linear scan, fine under ~1k rows; index it if that grows.`

Leave one runnable check behind for non-trivial logic — the smallest thing that
fails if the logic breaks. No new frameworks or fixtures.

Answer with code first, then at most three short lines: what you skipped and
when to add it.