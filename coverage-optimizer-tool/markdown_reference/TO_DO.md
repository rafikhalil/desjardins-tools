# TO-DO — Coverage Optimizer

Things parked for later, and things to review. **One item = one short block** (what · where it stands · waiting on · where in the code). Ask Claude to "add it to the TO-DO" whenever you park something; it also gets added when you say "later" / "come back to it".

*Last updated: 2026-09-24*

## At a glance

| ID | Area | Item | Waiting on |
|---|---|---|---|
| C-5 | Insureds + Coverages tabs | "Perm Joint Extra Prem. % / $ Backdated" columns | On hold (2026-09-24) |
| C-6 | Critical Illness | Coverage Type, Fee, Axis Key, rates (all 3 categories) | On hold (2026-09-24) |
| C-8 | Joint container | Equiv. Substd. % (the "Substd Prem." half of the old Eq. Age sheet) stays a typed input | On hold (2026-09-24) |
| C-9 | Pre-load page | Remove the "Skip (dev)" bypass | On hold (2026-09-24) |
| R-1 | Review | Joint Age Backdated = equivalent age re-run on backdated ages (age − 1, confirmed) | On hold (2026-09-24) |
| R-2 | Review | Joint Perm lookups (EPR reading, JLTDPU change) vs Excel | On hold (2026-09-24) |
| R-3 | Review | "Extra Prem. Term $" adds Perm $ + Term $ | On hold (2026-09-24) |
| R-7 | Review | **Insureds on Perm Life JFTD / JLTD / JLTDPU coverages** ("a review is due") | On hold (2026-09-24) |
| R-12 | Review | **WL to 100 / Term to 100** (2017 keys): assumptions I made | On hold (2026-09-24) |
| R-17 | Review | **Joint BD_Final** only checks Insured 1's eligibility — slot order changes Modal Prem. Backdated | On hold (2026-09-24) |
| S-5, S-6 | Suggestions | One source for the rate-version stamps; faster re-render | On hold |

---

## 1 · To code later (you parked these)

### C-5 · Insureds + Coverages tabs · Perm Joint Backdated columns
- **What:** "Perm Joint Extra Prem. % Backdated" and "Perm Joint Extra Prem. $ Backdated" (both tabs).
- **Now:** amber. (Perm Joint Age Backdated is done — see R-1.)
- **Waiting on:** your formulas.
- **Where:** `optimizer_insureds.js` → `rowHtml`; `optimizer_coverages.js` → `coverageRow`.

### C-6 · Critical Illness (3 categories)
- **What:** Coverage Type, Coverage Fee, Axis Key format, rate bands / lookup, "Extra Prem. Term $" rule.
- **Now:** left blank ("leave blank for now"); the Rates tab says "not built yet".
- **Waiting on:** your spec.
- **Where:** `optimizer.js` (`covTypeOptions`, `recalcFees`, axis key), `optimizer_rates.js` (`BAND_TABLES`), `optimizer_coverages.js` (`extraTermCell`).

### C-8 · Equiv. Substd. % stays a typed input
- **What:** the old "Eq. Age / Substd. Prem." sheet also derived a substandard equivalent for the joint coverage; the Equivalent Age half is built (see Done), this half is not.
- **Now:** the Joint container's "Equiv. Substd. %" is typed by the operator ("leave Substd. Prem. as an input for now").
- **Waiting on:** your formula, if you want it calculated.
- **Where:** `optimizer.js` → `JOINT_FIELDS` (`extraPct`); read by `optimizer_rates.js` → `pepResult`.

### C-9 · Remove the pre-load "Skip (dev)" bypass
- **What:** delete the bypass once coding is done ("since we are still coding").
- **Now:** button on the pre-load page enters the tool without a name or rates (saves as `dev_…`).
- **Where:** the `plSkip` button in `optimizer.html`, its handler in `optimizer_preload.js`, `.pl-skip` in `optimizer_preload.css` (all marked "DEV BYPASS").

---

## 2 · To review / validate

### R-1 · Joint Age Backdated  *(your rule, confirmed; one edge of mine still open)*
- **Rule (yours, confirmed 2026-09-21):** re-run the whole equivalent-age calculation with each insured who is Backdate Eligible (the Backdate tab's eligibility, not Confirm Backdate — that one reads the rates, which read this) one year younger — a flat age − 1, permanent production logic, not a stand-in. Same rule the insured `_BD` columns use (was C-2, now closed — see Done).
- **My edge (still open):** a JLTDPU whose backdated age would fall under 18 has no answer in the spec → Error (so its BD_Final is an Error too).
- **Check:** confirm the edge, or tell me what a backdate under 18 should do.
- **Where:** `optimizer.js` → `equivAge` / `jointAge`.

### R-2 · Joint Permanent Life lookups  *(my reading of your spec)*
- **Why:** "EPR_N: same logic as PR_N" was read as: substandard key (`DT_`→`DTS`) + joint Axis Key + Joint Age. JLTDPU PR now uses Joint Age instead of the insured's own age. Blank Equiv. Substd. % or blank Joint Age shows Error.
- **Check:** compare a few JFTD / JLTD / JLTDPU rows against Excel.
- **Where:** `optimizer_rates.js` → `lookupAge`, `baseRateResult`, `extraRateResult`, `pepResult`.

### R-3 · "Extra Prem. Term $" adds Perm $ + Term $  *(my reading)*
- **Why:** your rule says the column (named "Term") sums both the Term and Perm dollar amounts across insureds (joint: Flat Perm + Flat Term).
- **Check:** is the name / sum what you intend? Durations are not included.
- **Where:** `optimizer_coverages.js` → `extraTermCell`.

### R-7 · Insureds on Perm Life JFTD / JLTD / JLTDPU coverages
- **What:** you flagged that "a review is due" for these insureds; what to check isn't spelled out yet.
- **Where it may bite** (my list, not yours): each of the two insureds gets the *same* joint PR added into their own Backdate "Rate Current / Backdated (All Cov.)"; their Backdate eligibility and ages come from their own birthdates while the joint lookups use the Joint Age; the Rates Totals count Insured 1 only; their own Rate / Extra Premium boxes are disabled and read "—" in the Insureds tab.
- **Check:** tell me what you want reviewed (or walk through a joint test case together).
- **Where:** `optimizer_rates.js` → `allCovRate`, `lookupAge`, `totalResult`; `optimizer_backdate.js` → `backdateRow`; `optimizer_insureds.js`.

### R-12 · WL to 100 / Term to 100 — what I assumed
- **Built from your examples:** key = `T_` + code padded to 13 with `_` + `17-01_` + sex + rate + `____` (+ band) = 33; Substandard = 2nd character `_` → `S`.
- **Assumed:** (1) **no B00250** in either band list — I took your two "in total" lists literally (WL to 100: B00001, B00010, B00025, B00050, B00100, B00500; Term to 100: B00010, B00025, B00050, B00100, B00500, B01000); if the real tables do have B00250, it is one line in `LEGACY_BANDS`. (2) B00001 = 1,000 and B01000 = 1,000,000 (the file's naming: thousands). (3) **joint** WL/Term to 100 use `M` + `N` like the other Permanent products. (4) Term to 100 as JFTD/JLTD/JLTDPU is possible in the UI — check it is a real product.
- **Check:** one WL to 100 and one Term to 100 case against Excel, incl. a coverage amount between 250,000 and 499,999 (falls to B00100 with these lists).
- **Where:** `optimizer.js` → `axisKeyPermLife`; `optimizer_rates.js` → `LEGACY_BANDS`, `bandsFor`, `substandardKey`.

### R-17 · Joint BD_Final uses Insured 1's eligibility only  *(found in the 2026-09-23 review)*
- **What happens:** on a JFTD / JLTD / JLTDPU, Joint Age Backdated already lowers the age for whichever insured is eligible (R-1), but BD_Final then asks only Insured 1 whether to use it. Verified: Insured 1 not eligible + Insured 2 eligible → Joint Age 35 / Backdated 34, cheaper rate, yet Modal Prem. Backdated = Modal Prem. (1,342.00); swap the two slots and the saving appears.
- **Suggested:** on a joint coverage, eligible = *any* of its insureds is eligible (the Joint Age Backdated value already carries who). One line.
- **Where:** `optimizer_rates.js` → `finalResult`.

---

## 3 · Questions waiting on you

*(nothing waiting — Q-1, the WL to 100 / Term to 100 key format, is answered; see Done and R-12.)*

---

## 4 · Suggestions from Claude (not requested — say yes / no)

- **S-6 · Faster re-render.** Every edit rebuilds the Backdate Projection's year series ~4 times, and each year re-solves Prem. Basis Ins. Amt for Input Premium coverages: measured ~130 ms per edit with 4 coverages (3 on Input Premium), ~8 ms with 1. Fine today; if it lags on the work laptop, memoise `premBasis` per render or build the series once and share it.
- **S-5 · One source for the rate-version stamps.** `2509` / `2007` are written in `optimizer_rates.js` (`RATE_VERSION`, `PERM_VERSION`) **and** as literals in the Axis Key builder in `optimizer.js` (§12.2). A new rate version means editing both; putting the two constants on the bridge would make it one edit. Not done — it only matters when a new version is issued.

---

## 5 · Done (moved here from the lists above)

- 2026-09-24 · **TO_DO review with you** — built and verified: **R-14** Prem. Adj. %/$ with Dur. 0 ⇒ 100% / 0.00, also in Modal Prem. (Modal Prem. now *is* the projection's year 0 — Prem. Adj. 110% Dur. 0 → 1,620.00; Dur. 2 → 1,778.00 in years 0–1, 1,620.00 after); **R-16** joint Flat Extra Prem. $ Term priced while year < its Duration, a blank Flat Perm $ = 0 (2 $/1000 × 3 years on 100,000 → 1,820.00 then 1,620.00; both blank still blocks); **R-18** Age Real borrows the year back (your examples: DoB 24-SEP-2007 → 19/19 on 24-SEP-2026, 18/19 on 23-SEP-2026); **R-4** −6 months clamps day 29–31 to the 28th (31-AUG → 28-FEB), birthday on the Illustration Date = passed (as production); **C-4** History's Total Modal Premium stored at save time; **S-3** Remove locked on joint Perm slots; **S-4** brighter Loading dot. Closed as confirmed / validated: R-5, R-8 (keep the Error), R-9, R-10, R-11, R-13. S-2 closed (rates/ is always empty on this computer). A slot's Term $ with Term $ Dur. 0 no longer counts in Modal Prem. either (same Dur. 0 rule). On hold: C-5, C-6, C-8, C-9, R-1, R-2, R-3, R-7, R-12, R-17, S-5, S-6.

- 2026-09-24 · **Backdate Projection's Backdated side follows BD_Final** (closes R-15 — your term_highest-amt_15_annual_rates case). It priced every insured at age − 1 (BD_Total: 4.76 × 25,000 + 40 = 119,040) instead of each insured's own BD_Final (Insured-1 eligible, Insured-2 not: 5.04 → 126,040, = Modal Prem. Backdated). Each insured's pick is made once, at issue (year 0, same test as BD_Final), then kept every year; a Permanent pay period follows the same age. Verified with rates matched to your file: prorated 4,489.10 on 11-SEP-2026, remainder 121,550.90, then 126,040.00 every year; Backdate Savings Date 24-SEP-2027 (was 24-SEP-2026).

- 2026-09-24 · **Test case name in the status bar + rates saved with the test case.** The bottom-right of the status bar shows the test case last saved or loaded (cleared by Clear). Save Test now also writes a `rates` block into the .json: the rate files' names and, per coverage and band, PR_n / EPR_n / PEP_n / PR_BD_n / EPR_BD_n / PEP_BD_n per insured, then PR / EPR / PEP _TOTAL, _BD_TOTAL and _BD_FINAL (a number, `"Error: <why>"`, or null), plus the coverage's own band. Reference only — Load never reads it. Verified: your term_highest-amt_1 case saved PR_1 40.79 / PR_BD_1 35.85 / PR_BD_FINAL 35.85 at B00050; reloading it restored the case unchanged.

- 2026-09-24 · **Your bug list + new rules** (each verified live): Payment Frequency highlighted yellow while blank (also after Clear). Clear names the new insured Insured-1 (it was named against the old list → Insured-3). Midpoint = Past Birthday + exactly 6 months, day 29–31 → 28 (DOB 24-JAN-2007 → 24-JUL-2026; your case 22-FEB-1952 → 22-AUG-2026, was 24-AUG). Monthly Savings Date shows again: my 09-21 change had made it check the Difference over the whole lifetime, where it always ends negative (Backdated pays one extra age-85 year) — your `monthly.md` search window is back (your case, rates matched to PR 40.79 / PR_BD 35.85: 24-NOV-2027 — the first positive row is 24-APR-2027, but with Backdated now paying on the 22nd the Difference dips each 22nd until 22-NOV-2027). Age Nearest < 18 ⇒ Rate forced to Regular / Smoker, box locked. Term Life Extra Premium only on P3 / R2 (P1 / P2 / R1 / blank: locked and reset to 0). Term Life P1 / P2 / R1 minimum amounts by Age Nearest (61+ 250,000; 51–60 500,000; 18–50 2,000,001; under 18 never): Coverage Amount — only qualifying codes offered, a stored one cleared when it stops qualifying; Input Premium — any code, message bar says when the amount the premium buys doesn't qualify. `syncCoverageInsuredRefs` now runs on every Coverage Input render.

- 2026-09-23 · **Whole-project review — bugs fixed** (each reproduced first, then re-verified): (1) Backdate Projection, Annual: when the Backdate Date equals the Illustration Date, the Backdated side's year-0 premium was never billed (0.00 instead of 571.25 in the test), inflating every Difference by a full year — now both pieces bill on that day. (2) An eligible insured who is on no coverage blanked the Final Backdate Date, both Savings Dates, the projection and the Summary ("not on any coverage yet") — they're now left out (nothing to backdate). (3) A birthdate up to a month AFTER the Reference Date was accepted as age 0 (the Backdate tab then showed a Past Birthday before the birth) — now rejected at input, and flagged in the message bar if the Reference Date later moves before it. (4) `_start-coverage-optimizer.bat`: the `py` fallback could never run (`%errorlevel%` is expanded before `where py` inside the block) — now `if not errorlevel 1`. (5) Stale comments / docs (C-2 / C-3 / "Duration 1 only" / "ENGINE STUBBED"), and a wrong claim that the joint Flat Term $ Duration is used by the projection (it isn't — R-16). Open decisions from the same review: R-16, R-17, R-18, S-6.

- 2026-09-23 · **Clear button** (top bar, right of Save Test) — resets the whole test case in one click: default Settings (Reference Date back to today), one blank Insured, one blank Coverage, Unit Values (back to the 1,000 default), the Test Case Name and any pending name error; lands on Input & Results. Reuses `restoreState` (new `clearState()` = restoreState with `defaultSettings()` — the Settings literal became that function so Clear and startup share one set of defaults); handler `doClear` in `optimizer_history.js` next to Save Test. No confirmation and no undo (consistent with Remove / History delete) — say if you want a confirm prompt. Verified live: 2 coverages + Annually + Prem. Adj. 150 + a name → 1 / 1 / blank / 100 / today / empty, no new console errors.

- 2026-09-21 · **Backdate Projection: Annual row highlighting fixed to match Annual Savings Date.** The table's `.cell-pos` row highlight used a flat `diff > 0` for both Annual and Monthly, but Annual's own Savings Date (`annualSavingsDate`) is actually `diff ≥ the prorated Backdated premium at year 0` — the two could disagree on which row is first "saved". `projectionAnnual`/`projectionMonthly` now tag each row with `r.saved` using each branch's own real test (Annual reuses its own local `proratedBackdated`, the same formula `annualSavingsDate` computes independently, so they can't drift apart); `projectionRow` just reads `r.saved`. Monthly unchanged (`diff > 0`, already matched `monthlySavingsDate`).
- 2026-09-21 · **Backdate Projection: duration-varying premiums** (also closes old C-7) — both the Current and Backdated tracks now use a real per-policy-year premium instead of two constants. New engine: `optimizer_rates.js`'s `bandTotalsAtYear(c, elapsedYears, backdated)` (Term Life duration = `elapsedYears + 1`, confirmed §-shift; Permanent Life has no duration axis, only `permStillPaying` gates it) → `optimizer_coverages.js`'s `premiumAtYear(c, elapsedYears, backdated)` (same `modalPremAt` LET(), a per-year `premContextAtYear` that now gates Prem. Adj. %/$ Dur., and a slot's Term $ Dur. by `elapsedYears` (the Joint's Flat Term $ / Duration are NOT used — R-16) — see R-14 for the resulting divergence from today's Modal Prem.) → `optimizer_backdate.js`'s `premiumSumAtYear`/`buildYearSeries` (sums every coverage per year, stops once both sides report `allEnded`, `HORIZON_YEARS=110` is a runaway guard only). `projectionAnnual`/`projectionMonthly` rewritten to place that series onto the calendar: Annual bills both sides at the SAME year-index at every Current anniversary (confirmed — Backdated, starting earlier, has already had its own Nth anniversary by then); Monthly runs fully independent per-side clocks. Permanent pay-period rules (WL 10/15/20 Pay stop at 10/15/20 years; WL to 65 / WL to 100 / Term to 100 stop at issue age + elapsed = 65/100/100, using the Joint Age for joint coverages) and the JFTD "ends when the oldest insured reaches 85" rule (free via `totalResult`'s existing sum-short-circuit) both confirmed by the requester. Bug found and fixed along the way: a coverage whose rate row was missing even at year 0 (a real Error, e.g. a bad Axis Key) was briefly misclassified as "ended" for every year after 0 — fixed by `endedOrError`, which only declares "ended" once a year-0 lookup is confirmed to have actually succeeded. Verified against hand-calculated values built from every confirmed rule and worked example (T15 block schedule, WL 10 Pay cutoff, JFTD oldest-insured-ends-it, Annual same-year alignment, Monthly independent clocks). Today's single-point Modal Prem. / Modal Prem. Backdated are unchanged. See R-13, R-14, R-15 for the three assumptions still open for confirmation. Real backdated age in the Rates `_BD` columns (old C-2) is confirmed final as part of this work: age − 1 is deliberate production logic, not a stand-in (R-1 updated accordingly).
- 2026-09-21 · **WL to 100 / Term to 100 Axis Key + rates** (old Q-1) — the 2017-style 33-character key (`T_VEG100_______17-01_MS____B00500`, `T_T100_________17-01_FN____B00010`), its Substandard key (`TS…`), and their own band lists (WL to 100 adds B00001, Term to 100 adds B01000, neither has B00250). Lookup unchanged (Axis Key + age → rate). Every band lookup now goes through `bandsFor(coverage)`. Verified with synthetic rows built from your example keys (PR/EPR at age 40, keys 33 characters, bands, 250,000 → B00100). Assumptions in R-12.
- 2026-09-20 · **Backdate Projection: Monthly/Annual Savings Date** (completes old C-3) — two independent calculations, ported from your `annual.md`/`monthly.md` scripts, always computed regardless of `settings.freq`: Annual is the first date the cumulative Difference reaches or passes the prorated first-year Backdated premium; Monthly is the first date after which the cumulative Difference stays positive through the rest of the search window (blocked with a reason if the Backdated premium isn't actually lower, or if it never stabilizes). Fill the two header pills (`bdMonthlySavingsDate`/`bdAnnualSavingsDate`) and the Results Summary's "Backdate Savings Date" (whichever one matches the current Payment Frequency). Verified live: Monthly gave 20-JUN-2028, Annual gave 20-SEP-2027 on the same scenario; switching Payment Frequency correctly swapped which one the Summary mirrors.
- 2026-09-20 · **Backdate Projection table** (part of old C-3) — the 6-column table (Date, Premium Current, Cumul. Prem. Current, Premium Backdated, Cumul. Prem. Backdated, Difference), ported line-for-line from the operator's own Excel Python-in-Excel script: Annual branch (prorated first Backdated payment, remainder on the first Current anniversary, full Backdated premium on every later Current anniversary, later Backdated anniversaries are 0-payment checkpoints) and Monthly branch (full premium on each side's own anniversaries), both driven by `settings.freq`. Needs a Final Backdate Date and both Modal Premium totals resolved — reuses the exact same blocked/pending/error states as everywhere else (`core.premiumTotal`, newly lent onto the bridge). Verified live: Monthly gave 102 rows, Annual gave 122, both with cumulative sums and the prorated/remainder/checkpoint split matching the script exactly; a coverage with no rate resolved correctly propagates "not on any coverage yet" into the table instead of crashing.
- 2026-09-20 · **Message bar + error catalogue** — a top-bar message area between the tool name and Test Case Name that says why a figure is an Error (or why an action failed): count with ▲ ▼ when there are several, ✕ to clear (Shift+✕ = all), click to read in full, messages fix themselves when the cause is fixed. Covers rejected inputs, Reference Date / age problems, every rate-lookup failure with its root cause (Axis Key can't be built and why, no age, Joint Age can't be calculated, no rate row — with the key, age and bands —, blank %, BD_Final undecidable), the Modal Prem. blockers, rate-file load problems (fetch / unreadable / not a rate workbook / missing sheets / no usable rows / text cells), History save / import / load / storage problems, and uncaught errors. The Rates cells' Error tooltips now carry the same sentence. See R-11 for the judgement calls.
- 2026-09-20 · **Docs refreshed (old S-1)** — `OPTIMIZER_REFERENCE.md` brought up to date and extended with §12 (every formula, the Axis Key character by character, bands, joint equivalent age, backdate, Modal Prem., Highest Amt, verified cases), §13 (message bar + catalogue) and §14 (running, pre-load page, `server.py`, moving to another computer); §11 checklist rewritten; `OPTIMIZER_INSTRUCTIONS.md` rewritten.
- 2026-09-20 · **Equivalent Age for joint Perm Life (JFTD / JLTD / JLTDPU)** — the old "Eq. Age / Substd. Prem." tab is gone; the Joint container's Joint Age is now calculated from the two insureds (Step 1 adjusted ages, Step 2 temporary age, Step 3 final: 3A/3B tables, 18/19 floors, the −1 for WL 10/15/20 Pay and WL to 65 on JFTD, negatives → 0, under 18 = smoker). Your three examples (MN35 / FS50 / WL 10 Pay: JFTD 53, JLTD 34, JLTDPU 41) reproduce; Joint Age Backdated follows R-1. Not-yet-known inputs show a dash; a JLTDPU life under 18 shows a red Error. Old saves carrying a typed `joint.age` still load (it is ignored). See C-8 for the substandard half.
- 2026-09-20 · **Modal Prem. Backdated** — the same LET() as Modal Prem. on the SAME rate band, built from PR_BD_Final / PEP_BD_Final. Coverage Amount uses the input amount's band (not the Highest Amt optimum's — verified: a coverage whose optimum jumps to B01000 still prices its backdated premium on B00100); Input Premium uses Prem. Basis Ins. Amt for both the band and the amount. Fills the Coverages column, the Results column and the Summary's "Modal Premium Backdated". A non-backdatable insured gives Backdated == Modal Prem., which is the point.
- 2026-09-20 · **Final Backdate Date** (Backdate tab band) = MIN of the per-insured Backdate Dates, blanks ignored — your example (13-JUL-2026 / BLANK / 24-MAY-2026 → 24-MAY-2026) verified. It also feeds the Summary's "Possible Backdate Date". Nobody backdatable shows a muted dash; an insured whose own date can't be resolved makes the MIN unknowable, so that state shows rather than a possibly-wrong date.
- 2026-09-20 · **Rounding bug in Prem. Basis Ins. Amt** — a 165.79 premium returned 152,660 (the answer for 165.78) instead of 152,669. The Modal Prem. was assembled as ROUND(…)+ROUND(…) with no final round, so 163.99 + 1.80 came out as 165.79000000000002 and compared `>` the typed 165.79, rejecting every amount that cost exactly the premium. Fixed with one outer ROUND in `modalPremAt` (changes no value — both halves are already 2-decimal figures). Your second case, 64.66 → 222,173, also matches now.
- 2026-09-20 · **Results: Modal Prem column** mirrors the Coverages tab (one `core.modalPrem`, so they cannot disagree), and **Summary: Modal Premium** = the sum of every coverage's. "Possible Backdate Date" added to the Summary. Results now also re-renders on Settings changes (Payment Frequency, Prem. Adj. %/$, MCD) and on a Unit Value edit — none of those reached it before.
- 2026-09-20 · **Highest Amt only when it reaches a higher rate band** — an optimum inside the Coverage Amount's own band is no longer shown (see R-10).
- 2026-09-20 · **Prem. Basis Ins. Amt** in Results (old C-10) — the same search as Highest Amt (Max.), with base_prem built from the premium typed in. Blank for Coverage Amount coverages. Knock-on: an Input Premium coverage now HAS a rate band (the closest lower band of this amount), so the Backdate tab's rate sums resolve for them too. Verified: a 66.60 premium buys 1,440,109 (which costs 66.60; 1,440,110 costs 66.61).
- 2026-09-20 · **Highest Amt (Max.) / (Min.)** in Results — your Excel LET() (base_prem → per-band denominator → filtered candidates) plus the $1 walk, anchored on the premium at the operator's own Coverage Amount (your call). Blank for Input Premium coverages. Verified end-to-end: 240,000 costs 66.60 → Max 1,440,109 also costs 66.60, and 1,440,110 costs 66.61. See R-10.
- 2026-09-20 · **Modal Prem.** (Coverages tab) — your Excel LET() for Input Premium and Coverage Amount coverages (part of the old C-4). Critical Illness stays amber. See R-9.
- 2026-09-20 · **BD_Final columns** (PR / EPR / PEP) in Rates (old C-1, was amber) — per insured: the current value, unless Backdate Eligible AND the backdated value is strictly lower; then summed like Total (Insured 1 only on joint Perm). See R-8.
- 2026-09-20 · **Backdate tab: Rate Current / Rate Backdated (All Cov.), Confirm Backdate, Backdate Date** — the first half of the old C-2. Rate = sum of the insured's PR_N / PR_BD_N over their coverages; Confirm = Eligible AND Rate Backdated < Rate Current; Backdate Date = Midpoint when Confirm is TRUE, else blank. Uses the band rule below.
- 2026-09-20 · **Rate band per coverage** (was my assumption, R-6) — confirmed by you: the closest *lower* band (Term 30,000 → B00025, 99,999 → B00050, 8,974,632 → B02000; Perm 17,500 → B00010, 249,999 → B00100, 250,001 → B00250). Input Premium coverages follow their Prem. Basis Ins. Amt (done below).
- 2026-09-20 · Joint Permanent Life **PR / EPR / PEP** (was: "come back to it later", needed a joint age) — wired to Joint Age / Equiv. Substd. %; Joint Age Backdated filled (see R-1, R-2).
- 2026-09-18 · **Total / BD_Total** columns in Rates (were showing "—").
- 2026-09-18 · **Temp Extra Premium** formula (Coverages tab) — now "Extra Prem. Term $" (see R-3).
