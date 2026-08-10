**Feature:** FR-05 · **Severity:** Low · **Spec:** README §FR-05 ("hiển thị trạng thái đang tải khi lấy dữ liệu")

**Steps to reproduce**

1. Throttle `GET /api/products` (the test uses `page.route` with a 1.5 s delay; the evidence shot
   uses 3 s).
2. Load the storefront and observe the region where the product grid will appear.

**Expected:** a loading state — spinner, skeleton or text — is visible for the duration of the fetch.
**Actual:** the area stays empty until the products appear; no indicator is rendered at any point.

**Why the delay is injected:** against a local API answering in ~20 ms the state would be
unobservable either way, so a test without throttling would pass or fail on timing luck and prove
nothing. Throttling makes the window long enough that a real implementation would certainly be seen
— written up as **G-02** in `docs/ai-gap-analysis.md`.

**Evidence:** ![BUG-13](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-13.png)

**Traceability:** FR-05 `A16` — failed on all three engines. HW02 ref: FR-05 DT-07.

---

## Recorded but **not** reported as defects

| Case | Observation | Why it is not a bug |
|------|-------------|---------------------|
| FR-14 `C06` | A duplicate category name is accepted; the table then shows two identical rows | FR-14 says nothing about uniqueness. Asserting either outcome would invent a requirement, so the case runs as a **probe**: it records what happened and asserts nothing. Flagged for human adjudication. |
| FR-09 `B12` | `save10` in lower case is accepted through the UI | The checkout uppercases the code before sending it (`Checkout.jsx:29`), so the UI behaviour matches the spec. The API *is* case-sensitive (HW02 BUG-12), but that is an API-contract issue outside FR-09's UI scope and is not re-filed here. |
| FR-09 `B09` | `EXPIRED` is correctly refused | Behaves per spec. Worth noting that the expiry check sits *inside* the minimum-order branch (`server.js:380`), so an expired coupon on a small order reports the wrong reason — below the threshold for a separate report, but recorded here for completeness. |
| — | The checkout exposes an **editable order total** | A genuine defect, but it belongs to **FR-08**, which is outside the three features this assignment covers. It is used here as the only available handle for driving exact FR-09 boundary totals, and is documented as such in `docs/fr09/R1-behaviours.md` rather than re-filed. |
