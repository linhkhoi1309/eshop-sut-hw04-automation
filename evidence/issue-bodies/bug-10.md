**Feature:** FR-05 · **Severity:** Low · **Spec:** README §FR-05 ("Giá (đơn vị: **₫**, định dạng phân cách hàng nghìn)") + §FR-21 ("Luôn dùng ký hiệu `₫`")

**Steps to reproduce:** open the storefront and read any product card.

**Expected:** e.g. `45,000,000 ₫`.
**Actual:** `45,000,000 VND` on all five cards. The thousand separators are correct; the currency
symbol is not — and the checkout screens *do* use `₫`, so the application contradicts itself between
pages, which is exactly the inconsistency FR-21 exists to prevent.

**Root cause** — `frontend-web/src/pages/Home.jsx:87`:
`{Number(p.price).toLocaleString()} VND`.

**Evidence:** ![BUG-10](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-10.png)

**Traceability:** FR-05 `A13` — failed on all three engines. The case uses **soft** assertions so one
run reports the symbol and the separator verdict for every card instead of stopping at the first.
HW02 ref: FR-05 DT-01 — FR-21.

---
