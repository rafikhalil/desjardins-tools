# Project Overview
You are an expert software developer. I need you to build a frontend application for an internal Life Insurance Illustration Tool. It will be used by our team to validate values against another platform. 

**Design System:** Professional, corporate, clean, and intuitive. Use a minimal aesthetic similar to standard financial/DCF modeling tools. No overly fancy animations.

**Tech Stack:** 
1. Architecture decision model — the core principle (separation of concerns: headless engine + web UI, not monolithic)
2. Frontend — As simple as possible. VanillaJS, Hand-built charts/tables, state management.
3. Use the HTML in the attachment as reference for the style. For the colours use colours around and complementary to HEX #35663e

---

# Core Workflow & State
1. **Data Ingestion:** The tool will eventually ingest an Excel file scraped from an internal terminal. For this initial build, create a file upload component and mock the parsing logic to populate the global state.
2. **Scenarios:** The state management must support modifying the base data through 8 specific scenarios:
   1 Current situation (Default)
   2 Coverage termination
   3 Coverage amount reduction
   4 Change of smoker status
   5 Extra premium revision
   6 Adding a new coverage
   7 Withdrawal of an insured
   8 Loan on a policy

---

# Data Models (TypeScript Interfaces)
Please use these exact data structures and enforce the noted constraints in the UI/Types:

```typescript
interface Insured {
  fullName: string; // First Last, ALL CAPS //NON-EDITABLE
  birthdate: string; // DD-MMM-YYYY //NON-EDITABLE
  sex: 'M' | 'F'; //NON-EDITABLE
}

interface Coverage {
  coverageNumber: string; // < 3 chars, e.g., C01 //NON-EDITABLE
  planId: string; // 5 chars alphanumeric //NON-EDITABLE
  rateScale: string; // 1 char alphanumeric //NON-EDITABLE
  sex: 'M' | 'F'; //NON-EDITABLE
  smokerStatus: 'N' | 'S'; //EDITABLE - For scenario "4 Change of smoker status"
  stb1: string; // 2 char alphanumeric
  stb2: string; // 3 char alphanumeric
  faceAmount: number; // 1 to 999,999,999 (Integer CAD) //EDITABLE - For scenario "3 Coverage amount reduction"
  sumInsured: number; // 1 to 999,999,999 (Integer CAD) //NON-EDITABLE
  permanentExtraPremiumPct: number; // 0 to 1,000,000 (%) //EDITABLE - For scenario "5 Extra premium revision"
  flatRate: number; // 0.00 to 999.99 (Decimal CAD) //EDITABLE - For scenario "5 Extra premium revision"
  flatRateDuration: number; // 1 to 999 (Integer) //EDITABLE - For scenario "5 Extra premium revision"
  policyFee: number; // 1 to 999 (Integer CAD)
  coverageIssueDate: string; // DD-MMM-YYYY
  maturityExpiryDate: string; // DD-MMM-YYYY
  paidUpDate: string; // DD-MMM-YYYY
  coverageStatus: string; // 1 char alphanumeric
  modalPremium: number; // 0.00 to 999,999,999.99 (Decimal CAD)
  rateDate: string; // DD-MMM-YYYY
  premiumCoiAdjustmentPct: number; // 0 to 1,000,000 (%)
  premiumCoiAdjustmentDuration: number; // 1 to 999 (Integer)
  grpTotalAmount: number; // 0.00 to 999,999,999.99 (Decimal CAD)
  businessPremiumAllocationDuration: number; // 1 to 999 (Integer)
  cashValue: number; // 0.00 to 999,999,999.99 (Decimal CAD)
  insureds: Insured[]; // EDITABLE - For scenario "7 Withdrawal of an insured"
}

interface Policy {
  policyNumber: string; // Up to 10 chars alphanumeric
  policyIssueDate: string; // DD-MMM-YYYY
  projectionDate: string; // DD-MMM-YYYY
  paidToDate: string; // DD-MMM-YYYY
  premiumDepositAccount: string; // 3 chars numeric, can be blank
  adjustedCostBasis: number; // 0.00 to 999,999,999.99 (Decimal CAD)
  totalPremiumsPaid: number; // 0.00 to 999,999,999.99 (Decimal CAD)
  netCostOfPureInsurance: number; // 0.00 to 999,999,999.99 (Decimal CAD)
  currentLoanAmount: number; // 0.00 to 999,999,999.99 (Decimal CAD)
  currentLoanInterest: number; // 0.00 to 999,999,999.99 (Decimal CAD)
  currentAplAmount: number; // 0.00 to 999,999,999.99 (Decimal CAD)
  currentAplInterest: number; // 0.00 to 999,999,999.99 (Decimal CAD)
  paymentMode: '01' | '12';
  policyStatus: string; // 1 char alphanumeric
  specialQuoteIdentifier: string; // 20 chars alphanumeric (### YYMMMDDD)
}
```

# UI Architecture

The app will consist of a main Tab navigation with two tabs: **Home** and **Projection**.

## Tab 1: Home (Data View & Edit)

Create a responsive grid layout. On desktop, it should be a 3-column grid.

**Left Container (2/3 width, col-span-2): Coverages & Insureds**

* Render a list of `Coverage` cards/containers.
* Inside each Coverage container, display the 24 coverage fields in a dense, readable grid (like a financial data table).
* Inside the SAME Coverage container, map through and display the associated `Insured` records.
* **Actions:** Add a "Remove Coverage" button inside each Coverage container. Add an "Add Coverage" button at the very bottom of the entire coverage list.

**Right Container (1/3 width, col-span-1): Policy Information**

* Render a sticky or static sidebar containing the `Policy` fields.
* Use a clean key-value pair layout for easy reading.
* **Actions** Add a "Add Loan on Policy" and "Add APL on Policy" at the bottom of the policy infos.

## Tab 2: Projection (Results)

* *[Placeholder]* For now, render a blank page with a header "Projection Results". Create an empty UI container where the calculated projection tables and charts will eventually live. Include a dropdown to select between the 8 different Scenarios.

---

# Implementation Steps

1. Initialize the project with the specified tech stack.
2. Define the TypeScript types globally.
3. Set up the global state store with mock data representing a standard policy with 2 coverages and 2 insureds.
4. Build the layout container and Tab navigation.
5. Build the `PolicySummary` component (Right column).
6. Build the `CoverageList`, `CoverageItem`, and `InsuredItem` components (Left column).
7. Implement the "Add Coverage" and "Remove Coverage" state mutations.
8. Stub out the functions/actions for the 8 specific scenarios.

