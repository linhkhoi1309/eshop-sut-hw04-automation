**Feature:** FR-09 · **Severity:** High · **Spec:** README §FR-09 condition C3 ("đơn hàng phải đạt giá trị **tối thiểu**")

**Preconditions:** user logged in; `SAVE10` minimum 300 000 ₫; `BIGBUY` minimum 500 000 ₫.

**Steps to reproduce**

1. On checkout, set the total to exactly **300 000** and apply `SAVE10`.
2. Set the total to exactly **500 000** and apply `BIGBUY`.

**Expected (FR-09 C3):** "tối thiểu" is an inclusive floor — an order *at* the minimum **qualifies**.
Both coupons apply.

**Actual:** both are refused with *"Đơn hàng chưa đủ giá trị tối thiểu … để áp dụng mã này"*. The
neighbouring values behave as expected (299 999 refused, 300 001 accepted), which pins the fault to
the boundary itself rather than to the comparison's direction.

**Independent confirmation**

```
$ ... -d '{"code":"SAVE10","total_amount":300000}'
{"error":"Đơn hàng chưa đủ giá trị tối thiểu 300,000 ₫ để áp dụng mã này"}
$ ... -d '{"code":"BIGBUY","total_amount":500000}'
{"error":"Đơn hàng chưa đủ giá trị tối thiểu 500,000 ₫ để áp dụng mã này"}
```

**Root cause** — `backend/server.js:379`: `if (total_amount > coupon.min_order_amount)` should be
`>=`. A one-character off-by-one that is invisible to any test that does not probe the exact
boundary — which is precisely why the case list carries min−1 / min / min+1 for both thresholds.

**Impact:** the customers most likely to hit it are the ones who deliberately topped their basket up
to the advertised threshold, so the failure lands on exactly the promotion the coupon was meant to
drive.

**Evidence:** ![BUG-06](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-06.png)

**Traceability:** FR-09 `B02` (SAVE10 at 300 000) and `B05` (BIGBUY at 500 000) — failed on all three
engines; `B03`/`B06` (min−1, correctly refused) and `B07` (min+1, accepted) passed. HW02 ref: FR-09 BVA-02 (B02),
BVA-05 (B05).

---
