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
