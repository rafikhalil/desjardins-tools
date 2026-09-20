# TO-DO — Coverage Optimizer

Things parked for later, and things to review. **One item = one short block** (what · where it stands · waiting on · where in the code). Ask Claude to "add it to the TO-DO" whenever you park something; it also gets added when you say "later" / "come back to it".

*Last updated: 2026-09-20*

## At a glance

| ID | Area | Item | Waiting on |
|---|---|---|---|
| C-2 | Rates ↔ Backdate | Real backdated age in the Rates `_BD` columns (age − 1 today) | Your rule |
| C-3 | Backdate tab | Final Backdate Date + whole Backdate Projection container | Your formulas |
| C-4 | Premiums | Modal Prem. Backdated, rest of Results panel, History "Total Modal Premium" | Your formulas |
| C-5 | Insureds + Coverages tabs | "Perm Joint Extra Prem. % / $ Backdated" columns | Your formulas |
| C-6 | Critical Illness | Coverage Type, Fee, Axis Key, rates (all 3 categories) | Your spec |
| C-7 | Rates | Term Life: use durations beyond Duration 1 | A feature that needs it |
| C-8 | Eq. Age tab | "Eq. Age / Substd. Prem." tab is an empty placeholder | Your spec |
| C-9 | Pre-load page | Remove the "Skip (dev)" bypass | End of coding |
| R-1 | Review | Perm Joint Age Backdated = Joint Age − 1 | Your OK |
| R-2 | Review | Joint Perm lookups (EPR reading, JLTDPU change) vs Excel | Real rate files |
| R-3 | Review | "Extra Prem. Term $" adds Perm $ + Term $ | Your OK |
| R-4 | Review | Backdate date edge cases (month-end, midpoint rounding) | Your OK |
| R-5 | Review | Everything tested only on synthetic rate files | Work laptop |
| R-7 | Review | **Insureds on Perm Life JFTD / JLTD / JLTDPU coverages** ("a review is due") | You: what to check |
| R-8 | Review | BD_Final when an insured's eligibility is unknown (blank birthdate) → Error | Your OK |
| R-9 | Review | **Modal Prem. formula**: Prem. Adj. % as %/100, joint uses Flat Perm only, Input Premium as-is | Your OK |
| R-10 | Review | Highest Amt: the $1 walk stops at the first amount over the premium (local) | Your OK |
| Q-1 | Question | "WL to 100" / "Term to 100" Axis Key format | Your answer |
| S-1…S-4 | Suggestions | Docs update, .gitignore for rates/, lock Remove on joint, brighter yellow | Your yes/no |

---

## 1 · To code later (you parked these)

### C-2 · Real backdated age in the Rates `_BD` columns
- **What:** PR_BD / EPR_BD / PEP_BD (and so the Backdate tab's Rate Backdated) should use the insured's real backdated age from the Backdate tab.
- **Now:** age − 1 stand-in (Joint Age − 1 on joint coverages). The Backdate tab already computes "Backdated Age Nearest/Last".
- **Waiting on:** your rule for how the two tabs connect.
- **Where:** `optimizer_rates.js` → `cellResult` / `lookupAge`; `optimizer.js` → `jointAge`.

### C-3 · Backdate tab · Final Backdate Date + Backdate Projection
- **What:** Final Backdate Date (top container — it will likely build on the per-insured Backdate Dates); Monthly Savings Date, Annual Savings Date and the 6-column table (Date, Premium Current, Cumul. Prem. Current, Premium Backdated, Cumul. Prem. Backdated, Difference).
- **Now:** all amber ("yellow, formula later"). The table has no rows because no row rule (period / date range) was given.
- **Waiting on:** your formulas and the projection's row rule.
- **Where:** `optimizer_backdate.js`.

### C-4 · Premium figures (Modal Prem. Backdated & Results)
- **What:** Modal Prem. Backdated (Coverages tab); the rest of the Results panel (its own Modal Prem / Modal Prem Backdated columns, plus the Summary: Modal Premium, Modal Premium Backdated, Backdate Savings Date); History's "Total Modal Premium" (it could now sum the per-coverage Modal Prem.).
- **Now:** amber / "—". The durations of Prem. Adj. % / $ aren't used by any calculation yet (the Modal Prem. formula doesn't use them).
- **Waiting on:** your formulas.
- **Where:** `optimizer_coverages.js`, `optimizer.js` (Results), `optimizer_history.js`.

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

### C-8 · "Eq. Age / Substd. Prem." tab
- **What:** the whole tab.
- **Now:** empty "Not built yet" placeholder.
- **Waiting on:** your spec.
- **Where:** `optimizer.js` → `TABS` / `buildPanes`.

### C-9 · Remove the pre-load "Skip (dev)" bypass
- **What:** delete the bypass once coding is done ("since we are still coding").
- **Now:** button on the pre-load page enters the tool without a name or rates (saves as `dev_…`).
- **Where:** the `plSkip` button in `optimizer.html`, its handler in `optimizer_preload.js`, `.pl-skip` in `optimizer_preload.css` (all marked "DEV BYPASS").

---

## 2 · To review / validate

### R-1 · Perm Joint Age Backdated = Joint Age − 1  *(my assumption)*
- **Why:** the column had no formula; I used the same age − 1 stand-in the insured `_BD` lookups use.
- **Check:** is that the rule you want, or should it come from the Backdate tab?
- **Where:** `optimizer.js` → `jointAge` (one function to change).

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
- **Check on the work laptop:** load time and progress bar with the 22 MB Term Life file; a handful of PR / EPR / PEP figures against Excel; the wrong-rate case that motivated the tab (Cov1 / PR_1 / B00050: 25.37 vs 3.37).
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
- **Check:** compare a couple of coverages against the Excel tool.
- **Where:** `optimizer_coverages.js` → `highestAmt`.

---

## 3 · Questions waiting on you

### Q-1 · "WL to 100" (VEG100) and "Term to 100" (T100) Axis Key
- **Why:** the codes are 6 and 4 characters; the Permanent Life Axis Key slot is 5. No key can be built, so their rate cells show Error.
- **Need:** the intended 5-character code (or format).
- **Where:** `optimizer.js` → `axisKeyPrefixPermLife`.

---

## 4 · Suggestions from Claude (not requested — say yes / no)

- **S-1 · Refresh the docs.** `OPTIMIZER_REFERENCE.md` / `OPTIMIZER_INSTRUCTIONS.md` predate the Joint container, blank defaults + highlight, totals, PR/EPR/PEP wiring, the pre-load page, `server.py`, and the removal of the rates cache.
- **S-2 · Keep rate files out of git.** `rates/` is not ignored, so a real `.xlsx` could be committed by accident. Add `coverage-optimizer-tool/rates/*.xlsx` to a `.gitignore`.
- **S-3 · Lock "Remove" on joint Permanent Life slots.** JLTD / JLTDPU need exactly 2 insureds, but a slot can still be removed.
- **S-4 · Brighter "Loading" yellow** on the pre-load page (light theme uses the tool's brownish amber).

---

## 5 · Done (moved here from the lists above)

- 2026-09-20 · **Prem. Basis Ins. Amt** in Results (old C-10) — the same search as Highest Amt (Max.), with base_prem built from the premium typed in. Blank for Coverage Amount coverages. Knock-on: an Input Premium coverage now HAS a rate band (the closest lower band of this amount), so the Backdate tab's rate sums resolve for them too. Verified: a 66.60 premium buys 1,440,109 (which costs 66.60; 1,440,110 costs 66.61).
- 2026-09-20 · **Highest Amt (Max.) / (Min.)** in Results — your Excel LET() (base_prem → per-band denominator → filtered candidates) plus the $1 walk, anchored on the premium at the operator's own Coverage Amount (your call). Blank for Input Premium coverages. Verified end-to-end: 240,000 costs 66.60 → Max 1,440,109 also costs 66.60, and 1,440,110 costs 66.61. See R-10.
- 2026-09-20 · **Modal Prem.** (Coverages tab) — your Excel LET() for Input Premium and Coverage Amount coverages (part of the old C-4). Critical Illness stays amber. See R-9.
- 2026-09-20 · **BD_Final columns** (PR / EPR / PEP) in Rates (old C-1, was amber) — per insured: the current value, unless Backdate Eligible AND the backdated value is strictly lower; then summed like Total (Insured 1 only on joint Perm). See R-8.
- 2026-09-20 · **Backdate tab: Rate Current / Rate Backdated (All Cov.), Confirm Backdate, Backdate Date** — the first half of the old C-2. Rate = sum of the insured's PR_N / PR_BD_N over their coverages; Confirm = Eligible AND Rate Backdated < Rate Current; Backdate Date = Midpoint when Confirm is TRUE, else blank. Uses the band rule below.
- 2026-09-20 · **Rate band per coverage** (was my assumption, R-6) — confirmed by you: the closest *lower* band (Term 30,000 → B00025, 99,999 → B00050, 8,974,632 → B02000; Perm 17,500 → B00010, 249,999 → B00100, 250,001 → B00250). Input Premium coverages follow their Prem. Basis Ins. Amt (done below).
- 2026-09-20 · Joint Permanent Life **PR / EPR / PEP** (was: "come back to it later", needed a joint age) — wired to Joint Age / Equiv. Substd. %; Joint Age Backdated filled (see R-1, R-2).
- 2026-09-18 · **Total / BD_Total** columns in Rates (were showing "—").
- 2026-09-18 · **Temp Extra Premium** formula (Coverages tab) — now "Extra Prem. Term $" (see R-3).
