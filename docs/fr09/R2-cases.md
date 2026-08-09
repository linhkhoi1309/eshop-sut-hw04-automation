# FR-09 — R2: Test cases (16)

**Rung R2.** Expected values are computed from the spec's formulas, never from the app's output.

## Batch 1 — the C3 boundaries and the discount formulas (B01–B08)

| ID | Type | Code / total | Expected (spec) | Cond |
|----|------|--------------|-----------------|------|
| B01 | positive | SAVE10 / 500 000 | applies · discount **50 000** · final **450 000** | formula (percent) |
| B02 | edge | SAVE10 / **300 000** | applies (`≥` is inclusive) · discount 30 000 · final 270 000 | **C3 boundary** |
| B03 | negative | SAVE10 / 299 999 | rejected — below the 300 000 minimum | C3 (min−1) |
| B04 | edge | SAVE10 / 300 001 | applies · discount 30 000 (floor) · final 270 001 | C3 (min+1) |
| B05 | edge | BIGBUY / **500 000** | applies · discount 50 000 · final 450 000 | **C3 boundary** |
| B06 | negative | BIGBUY / 499 999 | rejected — below the 500 000 minimum | C3 (min−1) |
| B07 | positive | BIGBUY / 500 001 | applies · discount 50 000 · final 450 001 | C3 (min+1) |
| B08 | positive | VIP100 / 400 000 | applies · discount 100 000 · final 300 000 | fixed formula |

Percent expectations use the spec formula `total × value / 100`: B02 → 300 000 × 10 / 100 = 30 000;
B04 → 300 001 × 10 / 100 = 30 000.1, floored to **30 000** (money is integral đồng here, and the
seeded data has no sub-đồng case, so flooring is the only sane reading).

## Batch 2 — C1, C2, C4, C5 and UI consistency (B09–B16)

| ID | Type | Input | Expected (spec) | Cond |
|----|------|-------|-----------------|------|
| B09 | negative | EXPIRED / 200 000 | rejected **as expired** | C2 |
| B10 | negative | `KHONGTONTAI` / 400 000 | rejected — code does not exist | C1 |
| B11 | negative | empty code | Apply does nothing; no `/api/apply-coupon` request is sent | C1 |
| B12 | edge | `save10` (lower-case) / 400 000 | applies — the UI upper-cases before sending | C1 |
| B13 | edge | VIP100 / 400 000 with 2 prior uses seeded | rejected — per-user limit reached | **C5** |
| B14 | negative | SAVE10 / 400 000 **logged out** | rejected — a valid JWT is required | **C4** |
| B15 | positive | apply SAVE10, then change the total | the stale discount is cleared, headline total recomputed | consistency |
| B16 | positive | SAVE10 / 500 000 | the headline "Tổng thanh toán" equals the API's `final_amount` | consistency |

## Coverage self-check

Positive 5 · negative 6 · edge 5 = **16** (≥12 required). Every condition C1–C5 has at least one
case; C3 has six (three per threshold), which matches its status as the boundary rule.

## Deviations from the first draft — for the gap analysis

1. **B04's expected discount was initially 30 000.1.** Wrong: the UI renders integers and the API
   floors. Recomputed to 30 000 with the reasoning written down, rather than letting the app's
   answer define the expectation after the fact.
2. **B11 was originally "expect an error message".** The Apply button is disabled while the field
   is blank, so there is nothing to assert on-screen; the meaningful assertion is that **no
   network request is made**. Switched to a network assertion (P5).
3. **B13 needs state, not just input.** Two prior usages are seeded through the API in the fixture
   (`POST /api/coupon-usage` ×2 with the user's JWT) so the case is repeatable from a fresh DB.

## Not automated (documented per §6)

- An `is_active = 0` coupon (the disabled half of C1): there is no API to create one and no seeded
  example, so it would need direct SQLite manipulation. Same gap HW02 recorded as `FR09-DT-05`.
- Coupon *stacking* and coupon-after-checkout invalidation: not specified in FR-09, so there is no
  oracle to assert against.
