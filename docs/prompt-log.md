# AI collaboration log — the prompt ladder

Per §2 of the brief, the AI is driven **step by step through the technique**, not with one generic
"write all the automation" prompt. This file records the rungs, what came back, and my review
verdict at each gate. Machine-verifiable timestamps for every interaction are produced separately
by `/ai-log` from the session JSONL (`ai-audit-report.md`) — this file is the human-readable
narrative that shows *how* the technique was applied.

**Tool:** Claude Code (Claude Opus 5) · **Dates:** 2026-08-08 → 2026-08-11 · **Student:** 23127396

## The ladder (applied per feature)

| Rung | What the AI is asked for | Review gate I apply before moving on |
|------|--------------------------|---------------------------------------|
| R1 | Observable behaviours, **from the SRS only** — implementation not in context | Delete anything not traceable to a spec line; name every rule (R1…Rn) so cases can cite it |
| R2 | ≥12 cases with spec-anchored expected results | Check positive/negative/edge mix, boundary triples, security payloads; add what is missing myself and log the gap |
| R3 | Data-file schema; inputs **and** expectations externalised | Reject any schema that leaves expectations inline in the script |
| R4 | Page Object with role/text locators | Grep the result for Tailwind classes / `nth-child`; reject on sight |
| R5 | The `.spec.js` that loops the data file | Run it; triage every red result as defect-vs-test-defect; never soften an assertion to get green |
| R6 | Diagnosis of a specific failure, with the failure output supplied | I decide the verdict; any proposal to weaken an expectation is recorded in the critique |

**Standing rule given to the AI at every rung:** the oracle is `README.md` (the SRS). The SUT is
deliberately buggy, so a failing assertion is a *candidate defect to report*, never a licence to
change the expectation.

---

## FR-05 — Product listing & search (2026-08-08)

| Rung | Output | Verdict |
|------|--------|---------|
| R1 | `docs/fr05/R1-behaviours.md` — rules R1–R7 extracted from FR-05 plus the SEC-04/SEC-05/FR-21/FR-24 contracts it leans on | **Accepted.** The mapping of "search by name" + SEC-05 onto *"`%` and `_` are literal characters"* is the insight that makes the wildcard cases spec-anchored rather than opinion. |
| R2 | `docs/fr05/R2-cases.md` — 16 cases (6 positive / 4 negative / 4 edge / 3 GUI-contract) | **Accepted with two corrections** (both recorded in `ai-gap-analysis.md`): the XSS payload was upgraded from markup-only to an execution probe, and the loading-state case was rewritten to throttle the API instead of racing it. |
| R3 | `data/fr05-search.csv` + `utils/csv.js` (dependency-free RFC 4180 reader) | **Accepted.** Inputs *and* expected outcomes live in the CSV; the spec file only supplies mechanics per `expected_behavior`. |
| R4 | `pages/home.page.js` | **Accepted after one fix**: `getByRole('img')` silently matches nothing when `alt=""` (the image becomes presentational), which would have made the alt-text check pass vacuously. Switched to a tag locator. |
| R5 | `tests/fr05-search.spec.js`, run on chromium | **Accepted.** 6 passed / 10 failed; each failure verified against the SUT (API responses, DOM inspection) before being accepted as a defect. No assertion was weakened. |

## FR-09 — Discount coupons (2026-08-09)

| Rung | Output | Verdict |
|------|--------|---------|
| R1 | `docs/fr09/R1-behaviours.md` — conditions C1–C5, both discount formulas, and the two structural problems (reaching an exact total; authenticating without touching the buggy login form) | **Accepted.** |
| R2 | `docs/fr09/R2-cases.md` — 16 cases; C3 gets six (min−1 / min / min+1 on both thresholds) | **Accepted with three corrections** (see gap analysis): B04's expected discount recomputed by hand; B11 changed from "expect an error" to "expect no network request"; B13 given an explicit usage-seeding fixture. |
| R3 | `data/fr09-coupons.json` | **Accepted.** JSON here (CSV for FR-05) so the report can discuss both data formats. |
| R4 | `pages/checkout.page.js` + `fixtures/eshop.fixtures.js` | **Accepted.** The cart fixture navigates by clicking, never `goto`, because the cart is in-memory React state. |
| R5 | `tests/fr09-coupon.spec.js` | See the run results recorded in the commit message and `docs/ai-gap-analysis.md`. |
| R6 | Diagnosis of B01/B02/B05 (wrong discount, boundary refused) with the failure output supplied | **Verdicts kept.** The amounts asserted are the ones FR-09's formulas produce; the app disagreeing with them is the finding. Nothing was relaxed. |

## FR-14 — Category management, admin panel (2026-08-10)

| Rung | Output | Verdict |
|------|--------|---------|
| R1 | `docs/fr14/R1-behaviours.md` — rules R1–R6 from FR-14 plus the FR-12 / SEC-03 write-authorisation rules FR-14 is explicitly subject to, and FR-15's integrity rule | **Accepted.** The useful move at this rung was separating "CRUD works" (R1–R2) from "CRUD is *authorised*" (R3–R4) and "CRUD is *consistent*" (R6) — the last two are where the SUT actually breaks. |
| R2 | `docs/fr14/R2-cases.md` — 14 cases (6 positive / 6 negative / 1 edge / 1 probe) | **Accepted after three corrections**, all recorded in `R2-cases.md` §Deviations: the duplicate-name case was downgraded to a probe (FR-14 says nothing about uniqueness, so any verdict would be invented), the long-name case was re-aimed from "expect rejection" to "expect acceptance rendered intact" (the 255-char limit is FR-15's, for products), and C09 was re-aimed from "the delete must be blocked" to its spec-supported consequence, "no product may be left orphaned". |
| R3 | `data/fr14-categories.json` | **Accepted.** Nested `expect` objects and a `nameRepeat` generator keep the 255-character case in the data file instead of hard-coding a wall of text in the spec. |
| R4 | `pages/admin.page.js` | **Accepted.** Placeholder- and text-based locators throughout; rows are located by the cell text they contain, which is the contract, not the styling. |
| R5 | `tests/fr14-category.spec.js`, run on chromium | **Accepted only after the review caught a false pass** — see `ai-gap-analysis.md` **G-08**: C04/C05 were green because a retrying `toHaveCount(before)` matches before the list refreshes. Re-aimed at the API response and the server-side count; both now correctly fail against a SUT that accepts an empty name with HTTP 200. |
| R6 | Diagnosis of C09 (orphaned products) and C12 (user token accepted) | **Verdicts kept.** Both were re-verified directly through the API before being written up, not taken from the test output alone. |

## What the ladder cost, and what it bought

Six rungs × three features is slower than one "write the tests" prompt, and the difference is
entirely in rungs R1 and R2: naming the spec rules first is what makes every later artefact
auditable, because each case cites a rule and each rule cites a spec sentence. The two most
valuable review gates in the whole project (G-03 and G-08) were both caught at R4/R5 by asking one
question of AI output that looked perfectly good — *if the feature were broken, would this notice?*
