# FR-09 — R1: Observable behaviours derived from the specification

**Rung R1.** Source: `README.md` §4 FR-09 (+ FR-08 for the checkout context). The implementation
was not consulted at this rung.

## The five conditions (all must hold before a discount applies)

| Cond | Spec | Observable as |
|------|------|----------------|
| **C1** | code exists in the DB and `is_active = 1` | an unknown/disabled code is rejected with a "does not exist" message |
| **C2** | today is before `expired_at` | an expired code is rejected as expired — **independently of the order total** |
| **C3** | `total >= min_order_amount` — **greater than or equal** | at a total exactly equal to the minimum the coupon **applies**; one đồng below it is rejected |
| **C4** | the user holds a valid JWT | applying while logged out is rejected |
| **C5** | that user's prior uses `< max_uses_per_user` | the (N+1)-th attempt is rejected as limit-reached |

## The discount formulas

- `percent`: `discount_amount = total × discount_value / 100` → SAVE10 on 500 000 = **50 000**
- `fixed`: `discount_amount = discount_value` → BIGBUY = **50 000**, VIP100 = **100 000**
- `final_amount = total − discount_amount`, and the UI's headline total must equal `final_amount`.

Seeded coupons: `SAVE10` percent 10 / min 300 000 / 1 use · `BIGBUY` fixed 50 000 / min 500 000 /
1 use · `VIP100` fixed 100 000 / min 300 000 / 2 uses · `EXPIRED` percent 20 / min 100 000 /
expired 2020-01-01.

## Two design consequences

**1. C3 is a boundary, so it needs boundary values.** "≥" is the whole content of the rule, and the
classic implementation slip is `>`. Every threshold therefore gets `min−1 / min / min+1`. This is
the single most valuable case group in the feature.

**2. Reaching a given total through the UI.** Seeded prices are 4 000 000 … 45 000 000 ₫, so no
combination of cart items lands on 300 000 or 500 000. The checkout page exposes an editable
"Tổng tiền thanh toán" field, which is the only UI handle that can drive the C3 boundaries.

> **Recorded risk:** that editable field is *itself* a defect (FR-08 says the total is computed by
> the system and must not be user-editable). These tests therefore ride on a bug to reach the
> boundary. That is a deliberate, documented choice — the alternative is not testing FR-09's most
> important rule at all through the UI. The page object asserts the field exists first, so if the
> FR-08 defect is ever fixed the FR-09 cases fail loudly with a clear message instead of silently
> passing against a total of 0.

## Authentication handling

C4 requires a logged-in user, but the login page carries its own FR-01/FR-02/FR-22 defects
(heading reads "Đăng Ký", the field is labelled "Username", the password box is `type="text"`).
Driving FR-09 through that form would make coupon results depend on unrelated defects, so the
suite authenticates through `POST /api/login` and injects the returned JWT the way the app itself
stores it (`localStorage.token`). The logged-out cases simply skip that step — which is the honest
way to test C4.
