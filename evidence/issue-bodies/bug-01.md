**Feature:** FR-09 · **Severity:** Critical · **Spec:** README §FR-09 ("Giảm giá theo %: `total × discount_value / 100`")

**Preconditions:** database freshly seeded; user `test@eshop.com / Test1234!`; coupon `SAVE10`
(percent, `discount_value = 10`, minimum 300 000 ₫).

**Steps to reproduce**

1. Log in as `test@eshop.com`.
2. Add any product to the cart and click through to `Xác Nhận Đơn Hàng`.
3. Set the order total to **500 000**.
4. Enter `SAVE10` and press **Áp dụng**.

**Expected (FR-09):** discount = 500 000 × 10 / 100 = **50 000 ₫**; final amount = **450 000 ₫**.

**Actual:** discount = **−4 500 000 ₫**; final amount = **5 000 000 ₫** — the page shows a *negative*
saving and asks the customer to pay **ten times** the order value.

**Independent confirmation**

```
$ curl -s -X POST localhost:3000/api/apply-coupon -H 'Authorization: Bearer <user JWT>' \
       -H 'Content-Type: application/json' -d '{"code":"SAVE10","total_amount":500000}'
{"success":true,"coupon_id":1,"discount_amount":-4500000,"final_amount":5000000,
 "message":"Áp dụng thành công! Giảm 10%"}
```

**Root cause** — `backend/server.js:398`:

```js
discount_amount = Math.floor(total_amount * (1 - coupon.discount_value));
```

The formula multiplies by `(1 − discount_value)` with `discount_value = 10`, i.e. by `−9`, instead of
dividing by 100. `final_amount = total − discount` then *adds* the magnitude back. The same wrong
expression is duplicated in the unauthenticated branch (`server.js:418`), so it cannot be fixed in
one place only.

**Evidence:** ![BUG-01](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-01.png)

**Traceability:** FR-09 `B01` (500 000) and `B04` (300 001) — failed on chromium, firefox and webkit
in all three of the FR-09 runs. HW02 ref: FR-09 DT-01 (B01), FR-09 BVA-03 (B04).

---
