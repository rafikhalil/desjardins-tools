# TO-DO — Coverage Optimizer

Things parked for later, and things to review. **One item = one short block** (what · where it stands · waiting on · where in the code). Ask Claude to "add it to the TO-DO" whenever you park something; it also gets added when you say "later" / "come back to it".

*Last updated: 2026-09-20*

## At a glance

| ID | Area | Item | Waiting on |
|---|---|---|---|
| C-2 | Rates ↔ Backdate | Real backdated age in the Rates `_BD` columns (age − 1 today) | Your rule |
| C-4 | History tab | "Total Modal Premium" column could now sum the per-coverage Modal Prem. | Your go-ahead |
| C-5 | Insureds + Coverages tabs | "Perm Joint Extra Prem. % / $ Backdated" columns | Your formulas |
| C-6 | Critical Illness | Coverage Type, Fee, Axis Key, rates (all 3 categories) | Your spec |
| C-7 | Rates | Term Life: use durations beyond Duration 1 | A feature that needs it |
| C-8 | Joint container | Equiv. Substd. % (the "Substd Prem." half of the old Eq. Age sheet) stays a typed input | Your formula |
| C-9 | Pre-load page | Remove the "Skip (dev)" bypass | End of coding |
| R-1 | Review | Joint Age Backdated = equivalent age re-run on backdated ages (age − 1 stand-in) | Real backdated age (C-2) |
| R-2 | Review | Joint Perm lookups (EPR reading, JLTDPU change) vs Excel | Real rate files |
| R-3 | Review | "Extra Prem. Term $" adds Perm $ + Term $ | Your OK |
| R-4 | Review | Backdate date edge cases (month-end, midpoint rounding) | Your OK |
| R-5 | Review | Everything tested only on synthetic rate files | Work laptop |
| R-7 | Review | **Insureds on Perm Life JFTD / JLTD / JLTDPU coverages** ("a review is due") | You: what to check |
| R-8 | Review | BD_Final when an insured's eligibility is unknown (blank birthdate) → Error | Your OK |
| R-9 | Review | **Modal Prem. formula**: Prem. Adj. % as %/100, joint uses Flat Perm only, Input Premium as-is | Your OK |
| R-10 | Review | Highest Amt: the $1 walk stops at the first amount over the premium (local) | Your OK |
| R-12 | Review | **WL to 100 / Term to 100** (2017 keys): assumptions I made | Your OK |
| R-11 | Review | **Message bar scope**: what raises a message and what deliberately doesn't | Your OK |
| S-2…S-5 | Suggestions | .gitignore for rates/, lock Remove on joint, brighter yellow, one source for the rate-version stamps | Your yes/no |

---

## 1 · To code later (you parked these)

### C-2 · Real backdated age in the Rates `_BD` columns
- **What:** PR_BD / EPR_BD / PEP_BD (and so the Backdate tab's Rate Backdated) should use the insured's real backdated age from the Backdate tab.
- **Now:** age − 1 stand-in (on joint coverages: the equivalent age re-run with each Backdate-Eligible insured a year younger — R-1). The Backdate tab already computes "Backdated Age Nearest/Last".
- **Waiting on:** your rule for how the two tabs connect.
- **Where:** `optimizer_rates.js` → `cellResult` / `lookupAge`; `optimizer.js` → `equivAge` (its `backdated` branch).

### C-4 · History's "Total Modal Premium"
- **What:** the History tab lists each saved test case with a "Total Modal Premium" column, still a muted dash. It could now be the same sum the Results Summary shows — except that a saved case stores the inputs, not the figures, so it would have to be computed at save time and stored with the snapshot.
- **Now:** muted dash. Both Modal Prem. columns and both Summary totals are done.
- **Waiting on:** your go-ahead — no new formula needed, just the decision to store it.
- **Where:** `optimizer_history.js` → `buildEntry` / `historyRow`.
- **Unrelated leftover:** the durations of Prem. Adj. % / $ still aren't used by any calculation (the Modal Prem. formula doesn't use them).

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

### C-7 · Term Life rates · durations beyond Duration 1
- **What:** look up other policy-year durations.
- **Now:** every duration is imported, only Duration 1 is read ("for now we only need the first duration… later we will need all").
- **Waiting on:** the feature that needs it.
- **Where:** `optimizer_rates.js` → `lookupTermLifeRate` (`duration` argument).

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

### R-1 · Joint Age Backdated  *(your rule, one stand-in and one edge of mine)*
- **Rule (yours):** re-run the whole equivalent-age calculation with each insured who is Backdate Eligible (the Backdate tab's eligibility, not Confirm Backdate — that one reads the rates, which read this) one year younger. The joint age can stay the same.
- **Stand-in:** "one year younger" is age − 1 for now, like the insured `_BD` columns (C-2).
- **My edge:** a JLTDPU whose backdated age would fall under 18 has no answer in the spec → Error (so its BD_Final is an Error too).
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

### R-4 · Backdate date edge cases  *(flagged in the code, never specified)*
- **Why:** 31-AUG minus 6 months rolls over to about 3-MAR instead of clamping to the month's last day; the midpoint uses round-half-up; a birthday exactly on the Illustration Date counts as "past".
- **Check:** confirm or give the rule.
- **Where:** `optimizer_backdate.js` → `subtractMonths`, `midpointDate`, `surroundingBirthdays`.

### R-5 · Real rate files never tested
- **Why:** all my tests use small synthetic workbooks (the real ones are confidential and stay on the work laptop).
- **Check on the work laptop:** the top-bar message bar (a red Error now says *why* — the full Axis Key that missed, the age, the bands — the quickest way to spot a real-key mismatch); load time and progress bar with the 22 MB Term Life file; a handful of PR / EPR / PEP figures against Excel; the wrong-rate case that motivated the tab (Cov1 / PR_1 / B00050: 25.37 vs 3.37).
- **Where:** pre-load page, Rates tab.

### R-7 · Insureds on Perm Life JFTD / JLTD / JLTDPU coverages
- **What:** you flagged that "a review is due" for these insureds; what to check isn't spelled out yet.
- **Where it may bite** (my list, not yours): each of the two insureds gets the *same* joint PR added into their own Backdate "Rate Current / Backdated (All Cov.)"; their Backdate eligibility and ages come from their own birthdates while the joint lookups use the Joint Age; the Rates Totals count Insured 1 only; their own Rate / Extra Premium boxes are disabled and read "—" in the Insureds tab.
- **Check:** tell me what you want reviewed (or walk through a joint test case together).
- **Where:** `optimizer_rates.js` → `allCovRate`, `lookupAge`, `totalResult`; `optimizer_backdate.js` → `backdateRow`; `optimizer_insureds.js`.

### R-8 · BD_Final with unknown eligibility  *(my choice)*
- **Why:** BD_Final needs each insured's Backdate Eligible. With a blank birthdate the Backdate tab shows "—" (unknown), so I made the BD_Final cell an Error rather than guess FALSE. It bites joint Perm coverages in particular, where the rates themselves don't need the insured's birthdate.
- **Check:** keep the Error, or treat unknown as FALSE (take the current rate)?
- **Where:** `optimizer_rates.js` → `finalResult`.

### R-9 · Modal Prem. formula  *(points I had to read)*
- **Prem. Adj. %:** Settings holds it as 100 = "unchanged", so `prem_adj_percentage` = Prem. Adj. % ÷ 100.
- **Joint Permanent Life:** `term_extra_prem` = Flat Extra Prem. $ Perm alone, as written — so Flat Term $ / Duration never reach the Modal Prem., while the "Extra Prem. Term $" column adds Flat Perm + Flat Term. A blank Flat Perm blocks the cell ("—").
- **Input Premium:** Modal Prem. = the premium typed in, as-is (no modal factor, no fee), for any category.
- **Rounding:** ROUND / TRUNC follow Excel on the decimal value (2.675 → 2.68). Checked against an independent decimal calculation on 5 cases.
- **Check:** compare a few coverages (Term, Perm Individual, a joint) with the Excel tool.
- **Where:** `optimizer_coverages.js` → `modalPremCell`; `optimizer_rates.js` → `bandTotals`.

### R-10 · Highest Amt — how far the $1 walk looks  *(a detail of your scan)*
- **Why:** the walk prices the next dollar before taking it, so the answer is always the LAST amount still at the target premium (example: 240,000 costs 66.60, Max 1,440,109 also costs 66.60, and 1,440,110 costs 66.61 and is discarded). It then halts there rather than carrying on to check whether some larger amount drops back to 66.60 past that bump. Band jumps are found by the per-band candidate array, not by the walk, so the walk only does local refinement.
- **Also (Prem. Basis Ins. Amt):** a typed premium rarely lands exactly on a whole-dollar amount, so the answer is the largest amount costing AT MOST that premium (13.05 buys 25,010, which costs exactly 13.05; 25,011 would cost 13.06). A premium too small for the lowest band shows a muted dash, not a figure.
- **Also:** the last band's upper bound is the 25,000,000 cap from your `upper_bands`; `ins_amount_max` is floored to a whole dollar; the walk is capped at 100,000 steps (measured: a few dozen steps, ~1 ms for 6 coverages) and shows Error rather than a guess if it ever hit the cap.
- **Also:** when the best amount stays inside the Coverage Amount's own band, both cells show a muted "—" with "no higher rate band is within this premium (still B00100)" on hover — not a blank cell, which on this page means "this column does not apply to this Calculation Type". Say if you would rather have them blank.
- **Check:** compare a couple of coverages against the Excel tool.
- **Where:** `optimizer_coverages.js` → `highestAmt`.

### R-12 · WL to 100 / Term to 100 — what I assumed
- **Built from your examples:** key = `T_` + code padded to 13 with `_` + `17-01_` + sex + rate + `____` (+ band) = 33; Substandard = 2nd character `_` → `S`.
- **Assumed:** (1) **no B00250** in either band list — I took your two "in total" lists literally (WL to 100: B00001, B00010, B00025, B00050, B00100, B00500; Term to 100: B00010, B00025, B00050, B00100, B00500, B01000); if the real tables do have B00250, it is one line in `LEGACY_BANDS`. (2) B00001 = 1,000 and B01000 = 1,000,000 (the file's naming: thousands). (3) **joint** WL/Term to 100 use `M` + `N` like the other Permanent products. (4) Term to 100 as JFTD/JLTD/JLTDPU is possible in the UI — check it is a real product.
- **Check:** one WL to 100 and one Term to 100 case against Excel, incl. a coverage amount between 250,000 and 499,999 (falls to B00100 with these lists).
- **Where:** `optimizer.js` → `axisKeyPermLife`; `optimizer_rates.js` → `LEGACY_BANDS`, `bandsFor`, `substandardKey`.

### R-11 · Message bar scope  *(my design choices — first version)*
- **Raised:** rejected inputs; state problems (Reference Date, out-of-range age after a Reference Date change, too many insureds); every rate-lookup failure with its cause; the actionable Modal Prem. blockers (Payment Frequency, Coverage Fee, joint Flat Perm $ blank, amount / premium below the lowest band, search that never settles); rate-file load problems; History save / import / load / storage problems; any uncaught error.
- **Deliberately NOT raised:** amber "no formula yet" cells (Critical Illness, Backdate Projection, the two Joint Extra Prem. Backdated columns); plain blank required inputs (already yellow); "no higher rate band is within this premium" and "no insured is backdatable" (information); anything on a brand-new blank coverage.
- **Judgement calls to confirm:** (1) a rate Error at a band the coverage does not use (e.g. B00010 when the amount sits in B00100) still produces a message — it shows red on the Rates tab too; (2) one reason per lookup, in dependency order, so fixing one reveals the next; (3) a rate file with text / `#N/A` cells loads but warns (E-7); a file with the right sheets but no usable rows now stays "Not loaded" (E-6, it used to show Loaded).
- **Check:** use it for a day; tell me any message that was noise, or any Error cell that had no message.
- **Where:** `optimizer.js` § message bar / `inputIssues`; `optimizer_rates.js` → `ratesIssues`; `optimizer_coverages.js` → `coverageIssues` (`ACTIONABLE`); catalogue in `OPTIMIZER_REFERENCE.md` §13.

---

## 3 · Questions waiting on you

*(nothing waiting — Q-1, the WL to 100 / Term to 100 key format, is answered; see Done and R-12.)*

---

## 4 · Suggestions from Claude (not requested — say yes / no)

- **S-2 · Keep rate files out of git.** `rates/` is not ignored, so a real `.xlsx` could be committed by accident. Add `coverage-optimizer-tool/rates/*.xlsx` to a `.gitignore`.
- **S-3 · Lock "Remove" on joint Permanent Life slots.** JLTD / JLTDPU need exactly 2 insureds, but a slot can still be removed.
- **S-4 · Brighter "Loading" yellow** on the pre-load page (light theme uses the tool's brownish amber).
- **S-5 · One source for the rate-version stamps.** `2509` / `2007` are written in `optimizer_rates.js` (`RATE_VERSION`, `PERM_VERSION`) **and** as literals in the Axis Key builder in `optimizer.js` (§12.2). A new rate version means editing both; putting the two constants on the bridge would make it one edit. Not done — it only matters when a new version is issued.

---

## 5 · Done (moved here from the lists above)

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
