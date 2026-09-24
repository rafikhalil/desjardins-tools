# To-Do

Running list of outstanding items. Add to this file whenever asked; don't
remove an item until it's actually done.

## Term Life — `age` (DUR-16)

- [ ] Fix the CAPSIL parser to include `age_1` in the `Coverages` sheet.
- [ ] Fix the insured layout in the GUI for each coverage.
- [ ] Reference this new field in the calc engine, then continue with the
      remaining sections (this is what's blocking DUR-05, DUR-06, DUR-13,
      DUR-14, DUR-16 today — see INFORCE_REFERENCE.md §16).
- [ ] Parse the second insured's columns on `Coverages` (`P2-SEX`, `P2-SMK`,
      `P2-AGE`, `P2-STB1`, `P2-STB2`) — none are read today. `P2-AGE` is
      insured 2's CAPSIL age, the counterpart of `age_1`. Also, every insured's
      sex is currently copied from the coverage's `S` column, which is `J` on a
      joint coverage (LT10F: both insureds show `J`).

## Term Life — spec questions (answer before implementing)

The code matches the spec exactly in each case; these are spots where the
spec itself looks wrong on an edge case.

- [ ] **Feb 29 anniversaries.** POL-07 (`next_policy_anniversary`) and COV-09
      (`adjusted_coverage_issue_date`) build a Feb 29 date in the anniversary
      year, which crashes in non-leap years. Should it fall on Feb 28 or
      Mar 1? The same choice decides whether 28-FEB counts as the anniversary
      in POL-08/10/11/12 and COV-04/05/06/07.
- [ ] **COV-10 compares months only.** Policy issued 15-JAN-2018, coverage
      issued 10-JAN-2020 → adjusted issue date 10-JAN-2018 → Annual
      COV-08 offset = **−5 days**, while COV-11 does compare days. Should COV-10
      compare (month, day) like COV-11?
- [ ] **POL-09 Monthly ignores the year.** Paid-to date 15-JUN-2025 with next
      anniversary 15-JUN-2026 (a premium a few days late) gives **0**, not 12.
      Separately, the Annual branch goes negative if premiums are paid past the
      next anniversary — floor it at 0?
- [ ] **Payment modes other than `01` / `12`.** Anything that isn't `12`
      (e.g. `03`, `06`, or blank) silently takes the Monthly branch in POL-09
      and COV-08. Raise a clear error instead?
- [ ] **DUR-06 vs DUR-14.** With `end_of_premium_type` C: expiration type B
      computes `end_of_premium_value − maximum_age`, where the value is a
      number of years, so the result is negative. Type A returns an age where a
      duration is expected, while DUR-14 treats A as age-based. The A/B branches
      look swapped. No current plan is A or B, so nothing is wrong today.

## Tool

- [ ] The "Coverage Optimizer" entry in the tool menu is a 404: `optimizer.html`
      doesn't exist under `backend/`. The Optimizer runs on its own server at
      `http://localhost:8000/backend_files/optimizer.html`.
- [ ] `markdown_reference/INFORCE_INSTRUCTIONS.md` is out of date. It says the
      tool must run by opening `inforce.html` directly and that
      `INFORCE_REFERENCE.md` is at the project root.
- [ ] An `Insureds` row whose `C#` doesn't exactly match a coverage (e.g. `1`
      vs `01`, if Excel converts one sheet's value to a number) is dropped
      with no warning.
- [ ] Re-import and re-save `history_data/rk_12345678_save_test.json`. It was
      saved before the field renames and the `+040.00` fix, so it loads with
      Projection Date, Paid-To, Payment Mode, ACB, NCPI, Maturity, Policy Fee
      and Flat Rate blank.
