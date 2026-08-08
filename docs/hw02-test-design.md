# EShop — Master Test-Design Report

**Course:** CSC13003 Software Testing · **Techniques:** Domain Testing (Equivalence Class
Partitioning) + Boundary Value Analysis · **System Under Test:** EShop (deliberately-buggy
teaching artifact).

This is the consolidated test-design deliverable. It accumulates the domain-testing and BVA
designs for all four selected features into one report. Each feature also has stand-alone source
files under `docs/test-design/` (`FR-xx-domain.md`, `FR-xx-bva.md`) with fuller per-file notes;
this report is the single source of truth for the case tables.

**Selected features:** FR-05 (Product listing & search) · FR-09 (Discount coupons) ·
FR-14 (Category CRUD) · FR-10 (Order cancellation state machine — **Mobile**).

**Oracle discipline (applies to every case below):** the **only** source of correct behavior is
`README.md` (the intended spec) — never the implementation code, never the AI. Behavior the spec
leaves open is marked `spec-undefined` / `spec-ambiguous`. **No PASS/FAIL is assigned in design**;
verdicts are filled in during execution (see §7 results template).

---

## 1. Shared methodology (per lecture CSC13003 — S04)

**Domain Testing — General Approach, 4 steps.** Domain testing is a *stratified sampling*
strategy: there are too many possible inputs to run them all, so we partition each variable's
domain into equivalence classes (two inputs share a class iff the spec expects the **same
result**) and test one **best representative** per class.
1. Identify **Input & Output** variables (success output *and* each distinct error are classes too).
2. Identify **equivalence classes** (valid + invalid) using the range / set / must-be / split guidelines.
3. Pick a **best representative** per class.
4. Ordered/length/date fields → best representatives are **boundary values** → BVA.

**Step-3 coverage rules.** *Valid* classes are **combined** into a few dense positive tests; each
*invalid* class is **isolated** in its own test (one invalid per case, so one rejection can't mask
a second defect). Then add **interaction** cases the spec implies.

**Boundary Value Analysis — Step 4.** *A program is more likely to fail at a boundary.* For each
ordered partition test values straddling every edge: `LB−1/LB/LB+1`, `UB−1/UB/UB+1`, the
smallest/largest allowed values, and a nominal. Boundary tests catch the two edge-defects a
nominal value misses: **inequality mis-specified** (`>` where `>=` was intended) and **boundary
value mistyped** (transposition).

**Strengths / blind spots.** Finds high-probability errors with few tests; intuitive; extends to
multi-variable situations. Blind spots: errors **not** at boundaries/special cases; true domains
are often unknowable — so each feature also carries adversarial/interaction cases.

---

## 2. Environment & seed data (from `backend/database.js`)

- **Backend** API `http://localhost:3000` (`node server.js`). `node database.js` **drops +
  reseeds** the SQLite DB — the reset button between stateful cases.
- **Web** `:5173` (FR-05, FR-14 UI) · **Admin** `:5174` (FR-14). FR-09 is driven at the API layer
  via Postman/cURL. **FR-10 is the Mobile app** (Expo, `App.js` `API_URL` → dev LAN IP): user
  self-cancel is tested at the **UI layer (L1)** on device *and* the **API layer (L2)** with the
  user JWT; order states (`confirmed`/`shipping`/`delivered`) are built as fixtures via the admin API.
- **Accounts:** admin `admin@eshop.com / Admin123!` · user `test@eshop.com / Test1234!` (id 2).
- **Categories:** `1 Điện thoại`, `2 Laptop`, `3 Phụ kiện`.
- **Products (ids 1–5):** iPhone 15 Pro Max (30,000,000), Samsung Galaxy S24 Ultra (28,000,000),
  MacBook Pro M3 (45,000,000), AirPods Pro 2 (6,000,000), Keychron Q1 (4,000,000) ₫.
- **Coupons:**

| code | type | value | min_order | expired_at | max_uses/user |
|------|------|-------|-----------|------------|----------------|
| SAVE10 | percent | 10 | 300,000 | 2099-12-31 | 1 |
| BIGBUY | fixed | 50,000 | 500,000 | 2099-12-31 | 1 |
| VIP100 | fixed | 100,000 | 300,000 | 2099-12-31 | 2 |
| EXPIRED | percent | 20 | 100,000 | 2020-01-01 | 1 |

> **Reset discipline:** any test that writes data (delete category, use a coupon, change order
> status) must start from a clean state — re-run `node database.js` and note it in *Precondition*.

---

## 3. Coverage summary & highest-value cases

| Feature | Endpoint(s) | Domain cases | BVA cases | Highest-value (signature) case |
|---------|-------------|:---:|:---:|--------------------------------|
| **FR-05** | `GET /api/products?search=` | 18 | 15 | **BVA-10** `search=%` must be literal (0 results), not wildcard-all |
| **FR-09** | `POST /api/apply-coupon` | 17 | 22 | **BVA-02/05/08** `total == min_order` must apply (`>=` inclusive) |
| **FR-14** | `POST/PUT/DELETE /api/categories` | 14 | 14 | **DT-05/07** non-admin token must be 403 (SEC-03); **BVA-01** empty name rejected |
| **FR-10 (Mobile)** | `PUT /api/orders/:id/cancel` (+ admin API for fixtures) | 14 | 10 | **DT-07 / BVA-06** server must reject a user cancel of a `shipping` order — the UI hides the button (L1), so the **API (L2)** case catches the masked bug |
| **Total** | | **63** | **61** | 124 designed cases |

**Known hotspots to make sure the suite catches** (verify by execution — do not pre-judge):
`>` vs `>=` coupon threshold · broken percent formula · anonymous-coupon auth gap · empty
category name accepted · missing admin-role check (SEC-03) · SQL/XSS in search & names ·
`canceled→delivered` final-state leak · user-cancel-while-shipping (mobile UI gate can **mask**
the server defect) · even/odd product-id price-type inconsistency · single-`<h1>` and `alt`-text UI rules.

---

# FR-05 — Product Listing & Search

*Source: `docs/test-design/FR-05-domain.md`, `FR-05-bva.md`.*
**Rules (README 73–81):** R1 grid of all products; R2 image(+alt)/name/price; R3 `₫` + thousands
sep; R4 search by name; R5 term rendered safely (SEC-04); R6 loading state; R7 empty state;
R8 exactly one `<h1>`.

## FR-05 · Domain Testing

**Variables:** `search` keyword (in); product-set & network (state); grid / empty-msg / loading /
rendered-term (outputs).

### Equivalence classes

| EC | Variable (In/Out) | Condition | Class (valid/invalid) | Representative |
|----|-------------------|-----------|-----------------------|----------------|
| EC1 | search (in) | matches a name (R4) | valid: exact name | `iPhone 15 Pro Max` |
| EC2 | search (in) | matches a name (R4) | valid: partial substring | `Mac` |
| EC3 | search (in) | matches many (R4) | valid: multi-hit substring | `Pro` |
| EC4 | search (in) | case (R4) | valid: different case | `iphone` |
| EC5 | search (in) | charset (R4) | valid: Vietnamese diacritics | `Bàn phím` |
| EC6 | search (in) | empty ⇒ listing (R1,R4) | valid: empty term | `` |
| EC7 | search (in) | accent-folding | probe | `Ban phim` → **spec-undefined** |
| EC8 | search (in) | whitespace/trim | probe | `"  Mac  "` → **spec-undefined** |
| EC9 | search (in) | no match (R4→R7) | valid: non-matching term | `zzzzz` |
| EC10 | search (in) | safe render (R5) | **invalid**: HTML markup | `<b>hi</b>` |
| EC11 | search (in) | safe render (R5,SEC-04) | **invalid**: script payload | `<script>alert(1)</script>` |
| EC12 | search (in) | safe render (R5) | **invalid**: img onerror | `<img src=x onerror=alert(1)>` |
| EC13 | search (in) | param query (SEC-05) | **invalid**: SQL tautology | `' OR '1'='1` |
| EC14 | search (in) | param query (SEC-05) | **invalid**: SQL comment | `x'--` |
| EC15 | search (in) | param query (SEC-05) | **invalid**: destructive SQL | `'; DROP TABLE products;--` |
| EC16 | search (in) | robustness | **invalid**: oversized (10 000 ch) | huge string |
| EC17 | product set (state) | grid (R1) | valid: all products | 5 seeded |
| EC18 | product set (state) | empty catalog (R1,R7) | **edge**: 0 products | catalog emptied |
| EC19 | network (state) | loading (R6) | valid: slow fetch | throttled |
| EC-O1 | grid (out) | R1,R2 | success: matching rows in grid | rendered grid |
| EC-O2 | empty msg (out) | R7 | success: empty-state shown | friendly message |
| EC-O3 | loading (out) | R6 | success: loading indicator | spinner/skeleton |
| EC-O4 | safe render (out) | R5 | success: term escaped, no JS run | literal text |
| EC-O5 | alt text (out) | R2,FR-24 | success: non-empty `alt` per image | descriptive alt |
| EC-O6 | price format (out) | R3 | success: `₫` + thousands sep | `30.000.000 ₫` |
| EC-O7 | heading (out) | R8 | success: exactly one `<h1>` | single h1 |

### Selected cases

| ID | Classes (EC) | Input / steps | Precondition | Expected (per spec) | Rationale |
|----|--------------|---------------|--------------|---------------------|-----------|
| DT-01 | EC1,EC-O1,EC-O5,EC-O6,EC-O7 | search `iPhone 15 Pro Max`; inspect page | 5 seeded | Product in grid; image has alt; price `30.000.000 ₫`; one `<h1>` (R1,R2,R3,R8) | packs display outputs |
| DT-02 | EC2,EC-O1 | search `Mac` | 5 seeded | Returns `MacBook Pro M3` (R4) | partial-match valid |
| DT-03 | EC3,EC-O1 | search `Pro` | 5 seeded | All names containing "Pro" (R4) | multi-hit valid |
| DT-04 | EC4 | search `iphone` | 5 seeded | Returns iPhone (R4) — else `spec-undefined` on case | case dimension |
| DT-05 | EC5 | search `Bàn phím` | 5 seeded | Returns Keychron (R4) | diacritics valid |
| DT-06 | EC6,EC17,EC-O1 | search `` (blank) | 5 seeded | Returns **all 5** as grid (R1,R4) | empty ⇒ listing |
| DT-07 | EC9,EC-O2 | search `zzzzz` | 5 seeded | 0 results + **empty state** (R7) | no-match output |
| DT-08 | EC19,EC-O3 | search on throttled network | 5 seeded | **Loading** indicator during fetch (R6) | loading output |
| DT-09 | EC10 (only) | search `<b>hi</b>` | 5 seeded | Literal text, not bold; 0 results + empty state (R5,R7) | HTML render isolated |
| DT-10 | EC11 (only) | search `<script>alert(1)</script>` | 5 seeded | **No script executes**; escaped (R5,SEC-04) | XSS isolated |
| DT-11 | EC12 (only) | search `<img src=x onerror=alert(1)>` | 5 seeded | No JS executes; safe (R5) | XSS variant isolated |
| DT-12 | EC13 (only) | search `' OR '1'='1` (capture JSON) | 5 seeded | Literal → **0 results**; must not return all rows (R4,SEC-05) | SQLi tautology isolated |
| DT-13 | EC14 (only) | search `x'--` | 5 seeded | Literal → 0 results; no 500/leak (R4,SEC-05) | SQLi comment isolated |
| DT-14 | EC15 (only) | search `'; DROP TABLE products;--` | fresh DB | Table intact; safe literal (SEC-05) | destructive SQLi isolated |
| DT-15 | EC16 (only) | search 10 000-char string | 5 seeded | Graceful: 0 results/empty state, no crash (R4,R7) | robustness isolated |
| DT-16 | EC18 (only) | listing with catalog emptied | 0 products | Empty-state, not broken grid (R1,R7) | empty-catalog isolated |
| DT-17 | R5 × R7 | search `<script>…</script>`, read "no results" msg | 5 seeded | Empty-state must not echo raw term as HTML (R5,R7) | escaping on empty path |
| DT-18 | EC7 × EC4 | search `ban phim` (no marks, lower) | 5 seeded | `spec-undefined` — accent-fold × case | double-dimension edge |

## FR-05 · Boundary Value Analysis

| # | Variable | Boundary | Operator / inclusivity |
|---|----------|----------|------------------------|
| B1 | keyword **length** | LB=0; UB≈255/256/large | no max ⇒ upper `spec-undefined`; length 0 = show all |
| B2 | **result-set size** | LB=0; UB=5 | 0 results ⇒ empty state; the 0↔1 edge is the trigger |
| B3 | `LIKE` literal-vs-wildcard | `%`, `_` | typed `%`/`_` is **literal**; wildcard meaning **excluded** |

| ID | Variable | Boundary (operator, rule) | Value | Precondition | Expected | Probes |
|----|----------|---------------------------|-------|--------------|----------|--------|
| BVA-01 | keyword length | 0 (empty ⇒ show all) | `` (0) | 5 seeded | Returns all 5 | LB |
| BVA-02 | keyword length | 0→1 | `i` (1) | 5 seeded | Products containing `i` (R4) | LB+1 |
| BVA-03 | keyword length | 1→2 | `iP` (2) | 5 seeded | Narrows toward iPhone (R4) | just inside |
| BVA-04 | keyword length | UB≈255 | 255-char non-match | 5 seeded | 0 results + empty state (R4,R7) | UB−1 |
| BVA-05 | keyword length | UB≈256 | 256-char string | 5 seeded | Graceful; `spec-undefined` on cap | UB/UB+1 |
| BVA-06 | keyword length | largest via UI | 10 000-char | 5 seeded | No crash; empty state (R4,R7) | extreme max |
| BVA-07 | result count | 0 (R7) | `Keychron` after deleting it | 4 remain | 0 results ⇒ empty-state msg (R7) | LB (0) |
| BVA-08 | result count | 0→1 | `Keychron` | 5 seeded | Exactly 1 in grid (R1,R4) | LB+1 |
| BVA-09 | result count | UB=5 | `` or term in every name | 5 seeded | All 5 in grid (R1) | UB |
| BVA-10 | wildcard char | `%` **literal** (R4) | `%` | 5 seeded | **0 results**; must NOT return all products (R4,R7) | literal/wildcard edge |
| BVA-11 | wildcard char | `_` literal (R4) | `Mac_ook` | 5 seeded | **0 results**; must not match `MacBook` (R4) | single-char wildcard |
| BVA-12 | wildcard char | `%` mid-term (R4) | `Mac%Pro` | 5 seeded | 0 results; must not match `MacBook Pro` (R4) | wildcard-in-middle |
| BVA-13 | match position | prefix (R4) | `iPhone` | 5 seeded | Matches at start (R4) | LB of substring |
| BVA-14 | match position | suffix (R4) | `Ultra` | 5 seeded | Matches `…S24 Ultra` (R4) | UB of substring |
| BVA-15 | match position | off-by-one (R4) | `MacBookX` | 5 seeded | 0 results (R4,R7) | off-by-one edge |

> **Signature:** **BVA-10** — a string-interpolated `LIKE` treats `%` as match-everything and
> returns all 5; a correct literal search returns 0. Detectable only at this boundary.

---

# FR-09 — Discount Coupons

*Source: `docs/test-design/FR-09-domain.md`, `FR-09-bva.md`.*
**Rules (README 110–135):** coupon applies **iff all 5 conditions hold** — C1 exists & active;
C2 not expired (`now < expired_at`); **C3 `total >= min_order_amount`**; C4 logged in (valid JWT);
C5 prior uses `< max_uses_per_user`. `percent → total×value/100`; `fixed → value`;
`final = total − discount`.

## FR-09 · Domain Testing

**Variables:** `code`, `total_amount`, login state (in); `type`, usage count, expiry (state);
success payload + 6 distinct error outputs (one per failed condition + empty code).

### Equivalence classes

| EC | Variable (In/Out) | Condition | Class (valid/invalid) | Representative |
|----|-------------------|-----------|-----------------------|----------------|
| EC1 | code (in) | C1 exists & active | valid: active code | `SAVE10` |
| EC2 | code (in) | C1 | invalid: not in DB | `NOPE999` |
| EC3 | code (in) | C1 `is_active=1` | invalid: inactive code | an inactive coupon |
| EC4 | code (in) | required | invalid: empty | `` |
| EC5 | code (in) | case | probe: wrong case | `save10` → **spec-undefined** |
| EC6 | code (in) | SEC-05 | invalid: SQL injection | `' OR '1'='1` |
| EC7 | type (state) | formula | valid: `percent` | SAVE10 |
| EC8 | type (state) | formula | valid: `fixed` | BIGBUY |
| EC9 | total_amount (in) | C3 `>= min` | valid: at/above min | 300,000 (SAVE10) |
| EC10 | total_amount (in) | C3 | invalid: below min | 299,999 (SAVE10) |
| EC11 | total_amount (in) | sign/type | invalid: zero | 0 |
| EC12 | total_amount (in) | sign/type | invalid: negative | −100,000 |
| EC13 | expired_at (state) | C2 | valid: future | SAVE10 (2099) |
| EC14 | expired_at (state) | C2 | invalid: expired | EXPIRED (2020) |
| EC15 | login (in) | C4 | valid: JWT + user_id | user id 2 |
| EC16 | login (in) | C4 | invalid: anonymous | no token / no user_id |
| EC17 | usage (state) | C5 `< max` | valid: uses < max | 0 of 1 (SAVE10) |
| EC18 | usage (state) | C5 | invalid: uses = max | 1 of 1 (SAVE10) |
| EC19 | usage (state) | C5 | invalid: uses > max | 2 of 1 |
| EC-O1 | success (out) | percent | discount = total×value/100 | SAVE10 @300k → 30,000 |
| EC-O2 | success (out) | fixed | discount = value | BIGBUY @500k → 50,000 |
| EC-O3 | final (out) | `final = total − discount` | correct final | 300k−30k = 270,000 |

### Selected cases

| ID | Classes (EC) | Input | Precondition | Expected (per spec) | Rationale |
|----|--------------|-------|--------------|---------------------|-----------|
| DT-01 | EC1,EC7,EC9,EC13,EC15,EC17,EC-O1,EC-O3 | SAVE10, total=300000, user=2 | logged in; 0 uses; reset | Apply; **discount 30,000; final 270,000** (C1-C5) | packs valid percent path |
| DT-02 | EC1,EC8,EC-O2,EC-O3 | BIGBUY, total=500000, user=2 | logged in; 0 uses | Apply; **discount 50,000; final 450,000** | valid fixed path |
| DT-03 | EC8,EC17,EC-O2 | VIP100, total=300000, user=2 | 1 of 2 prior uses | Apply (1<2); discount 100,000; final 200,000 (C5) | usage below max |
| DT-04 | EC2 (only) | NOPE999, total=500000, user=2 | logged in | Reject: code doesn't exist (C1) | C1 not-exist isolated |
| DT-05 | EC3 (only) | inactive code, total=500000, user=2 | inactive seeded | Reject: inactive (C1) | C1 inactive isolated |
| DT-06 | EC4 (only) | code=``, total=500000, user=2 | logged in | Reject: "Vui lòng nhập mã giảm giá" | empty-code isolated |
| DT-07 | EC10 (only) | SAVE10, total=299999, user=2 | logged in | Reject: below min 300,000 (C3) | C3 below-min isolated |
| DT-08 | EC14 (only) | EXPIRED, total=200000, user=2 | total ≥ min so only expiry fails | Reject: expired (C2) | C2 isolated |
| DT-09 | EC16 (only) | SAVE10, total=500000, **no token/user_id** | anonymous | Reject: must be logged in (C4) | C4 auth isolated |
| DT-10 | EC18 (only) | SAVE10, total=500000, user=2 | user has 1 prior use (=max) | Reject: uses exhausted (C5) | C5 at-limit isolated |
| DT-11 | EC11 (only) | SAVE10, total=0, user=2 | logged in | Reject: below min/invalid (C3) | zero-amount isolated |
| DT-12 | EC12 (only) | SAVE10, total=−100000, user=2 | logged in | Reject: invalid/below min — else `spec-undefined` | negative isolated |
| DT-13 | EC6 (only) | code=`' OR '1'='1`, total=500000, user=2 | logged in | Reject safely; no SQL leak (C1,SEC-05) | injection isolated |
| DT-14 | EC5 (only) | code=`save10`, total=500000, user=2 | logged in | `spec-undefined` — probe case-sensitivity | case dimension |
| DT-15 | C2 × C3 | EXPIRED, total=50000 (< min 100k) | logged in | Reject (fails C2 and C3) — verify expiry enforced below min | interaction |
| DT-16 | C4 × C5 | VIP100, total=300000, **no user_id**, repeated | anonymous | Reject at C4; must not allow unlimited use via missing user_id (C4,C5) | auth gates usage cap |
| DT-17 | type × formula | SAVE10, total=1,000,000, user=2 | logged in; 0 uses | discount=100,000; final=900,000 (10%) | verifies percent formula |

## FR-09 · Boundary Value Analysis

| # | Variable | Boundary | Operator / inclusivity |
|---|----------|----------|------------------------|
| B1 | `total` vs `min_order` | 300k/500k/300k per coupon | **C3 `>=` → at min is INCLUSIVE (valid)** |
| B2 | usage vs `max_uses` | 1 / 2 | **C5 `<` → at max is EXCLUSIVE (reject)** |
| B3 | now vs `expired_at` | 2099 / 2020 / today | **C2 `now < expired_at`** |
| B4 | `total` sign/type | 0 | positive order total required |

| ID | Variable | Boundary (operator, rule) | Value | Precondition | Expected | Probes |
|----|----------|---------------------------|-------|--------------|----------|--------|
| BVA-01 | total | 300000 (>=, C3, SAVE10) | 299,999 | SAVE10, user 2, 0 uses | Reject — below min | LB−1 |
| BVA-02 | total | 300000 (>=, C3, SAVE10) | **300,000** | SAVE10, user 2, 0 uses | **APPLY** — discount 30,000; final 270,000 | **LB (key)** |
| BVA-03 | total | 300000 (>=, C3, SAVE10) | 300,001 | SAVE10, user 2, 0 uses | Apply — discount ≈30,000 | LB+1 |
| BVA-04 | total | 500000 (>=, C3, BIGBUY) | 499,999 | BIGBUY, user 2 | Reject — below min | LB−1 |
| BVA-05 | total | 500000 (>=, C3, BIGBUY) | **500,000** | BIGBUY, user 2 | **APPLY** — discount 50,000; final 450,000 | **LB (key)** |
| BVA-06 | total | 500000 (>=, C3, BIGBUY) | 500,001 | BIGBUY, user 2 | Apply — discount 50,000 | LB+1 |
| BVA-07 | total | 300000 (>=, C3, VIP100) | 299,999 | VIP100, user 2 | Reject — below min | LB−1 |
| BVA-08 | total | 300000 (>=, C3, VIP100) | **300,000** | VIP100, user 2 | **APPLY** — discount 100,000; final 200,000 | **LB (key)** |
| BVA-09 | total | 300000 (>=, C3, VIP100) | 300,001 | VIP100, user 2 | Apply — discount 100,000 | LB+1 |
| BVA-10 | usage | 1 (<, C5, SAVE10) | 0 prior | SAVE10, total 300k | Apply (0<1) | LB |
| BVA-11 | usage | 1 (<, C5, SAVE10) | **1 (=max)** | SAVE10, total 300k | **Reject** — limit reached (1<1 false) | b (excl. edge) |
| BVA-12 | usage | 1 (<, C5, SAVE10) | 2 (>max) | SAVE10, total 300k | Reject — over limit | b+1 |
| BVA-13 | usage | 2 (<, C5, VIP100) | 1 prior | VIP100, total 300k | Apply (1<2) | UB−1 |
| BVA-14 | usage | 2 (<, C5, VIP100) | **2 (=max)** | VIP100, total 300k | **Reject** — limit reached (2<2 false) | UB (excl. edge) |
| BVA-15 | usage | 2 (<, C5, VIP100) | 3 | VIP100, total 300k | Reject | UB+1 |
| BVA-16 | expiry | expired_at (<, C2) | expires yesterday (2026-07-03) | seed coupon, total ≥ min | Reject — expired | day-after |
| BVA-17 | expiry | expired_at (<, C2) | expires today (2026-07-04) | seeded, total ≥ min | Edge — reject once `now >= expired_at`; `spec-undefined` on same-day time | day-of |
| BVA-18 | expiry | expired_at (<, C2) | expires tomorrow (2026-07-05) | seeded, total ≥ min | Apply — still valid | day-before |
| BVA-19 | expiry | expired_at (<, C2) | EXPIRED (2020), total 200k | logged in | Reject — expired (isolates C2 above min) | far-past |
| BVA-20 | total | 0 (positive total) | 0 | SAVE10, user 2 | Reject — below min/invalid (C3) | zero |
| BVA-21 | total | negative | −1 | SAVE10, user 2 | Reject — invalid; `spec-undefined` on negatives | below-zero |
| BVA-22 | total | largest allowed | 9,999,999,999 | SAVE10, user 2 | Apply; discount = amount×10/100 (probe overflow) | extreme max |

> **Signature:** **BVA-02/05/08** — C3 is `>=`, so a coupon must apply at exactly the minimum. A
> `>` implementation fails **only** at these values (invisible at 299,999 and 300,001 alike).

---

# FR-14 — Category Management (CRUD)

*Source: `docs/test-design/FR-14-domain.md`, `FR-14-bva.md`.*
**Rules:** FR-14 — Admin can Add / View / Delete; **name required, not empty**. FR-12/SEC-03 —
the write endpoints require a **valid JWT AND `role='admin'`**.

## FR-14 · Domain Testing

**Variables:** `name` (in); category `id` (in, PUT/DELETE); **actor auth** (no token / user token /
admin token); referential state (category has products); outputs: created / deleted / list + 3
errors (name-required / 401 / 403).

### Equivalence classes

| EC | Variable (In/Out) | Condition | Class (valid/invalid) | Representative |
|----|-------------------|-----------|-----------------------|----------------|
| EC1 | name (in) | required (FR-14) | valid: normal name | `Máy tính bảng` |
| EC2 | name (in) | charset | valid: diacritics | `Đồng hồ thông minh` |
| EC3 | name (in) | required (FR-14) | **invalid: empty `""`** | `` |
| EC4 | name (in) | required non-empty | **invalid: whitespace-only** | `"   "` |
| EC5 | name (in) | uniqueness | probe: duplicate | `Laptop` → **spec-undefined** |
| EC6 | name (in) | length (no max) | probe: >255 | 300-char → **spec-undefined** |
| EC7 | name (in) | safe render (SEC-04) | adversarial: HTML/script | `<script>alert(1)</script>` |
| EC8 | name (in) | param query (SEC-05) | adversarial: SQL meta | `'); DROP TABLE categories;--` |
| EC9 | name (in) | type | probe: numeric-only | `12345` → **spec-undefined** |
| EC10 | actor (state) | FR-12/SEC-03 | valid: **admin** token | admin@eshop.com |
| EC11 | actor (state) | FR-12/SEC-03 | **invalid: user (non-admin) token** | test@eshop.com |
| EC12 | actor (state) | SEC-02/FR-12 | **invalid: no token** | (missing Authorization) |
| EC13 | id (in) | exists | valid: existing id | 3 |
| EC14 | id (in) | exists | invalid: non-existent | 9999 |
| EC15 | referential (state) | delete integrity | probe: category has products | id 1 → **spec-undefined** |
| EC-O1 | list (out) | GET | success: returns array | — |

### Selected cases

| ID | Classes (EC) | Input / steps | Precondition | Expected (per spec) | Rationale |
|----|--------------|---------------|--------------|---------------------|-----------|
| DT-01 | EC1,EC2,EC10,EC-O1 | admin POST `Đồng hồ thông minh`; GET list | admin token | Created; appears in list (FR-14 Add+View) | packs valid name+admin+list |
| DT-02 | EC10,EC13 | admin DELETE id=3 | admin token; id 3 exists | Deleted; gone from list (FR-14) | valid delete |
| DT-03 | EC3 (only) | admin POST name=`` | admin token | **Reject** — name required (FR-14) | empty-name isolated |
| DT-04 | EC4 (only) | admin POST name=`"   "` | admin token | Reject — whitespace = empty (FR-14) | whitespace isolated |
| DT-05 | EC11 (only) | **user** token POST name=`Hợp lệ` | non-admin token | **Reject 403** — needs admin (FR-12/SEC-03) | non-admin isolated |
| DT-06 | EC12 (only) | no-token POST name=`Hợp lệ` | no Authorization | Reject 401 (SEC-02/FR-12) | unauthenticated isolated |
| DT-07 | EC11 (only) | **user** token DELETE id=2 | non-admin token | Reject 403 — admin-only (SEC-03) | non-admin write on delete |
| DT-08 | EC14 (only) | admin DELETE id=9999 | admin token | Reject/no-op — not found (FR-14) | non-existent id isolated |
| DT-09 | EC7 (only) | admin POST `<script>alert(1)</script>`; view rendered | admin token | Escaped, not executed (SEC-04) | XSS isolated |
| DT-10 | EC8 (only) | admin POST `'); DROP TABLE categories;--` | admin; fresh DB | Table intact; literal (SEC-05) | SQLi isolated |
| DT-11 | EC5 | admin POST `Laptop` (dup) | `Laptop` exists | `spec-undefined` — probe dup handling | uniqueness probe |
| DT-12 | EC15 | admin DELETE id=1 (has products) | id 1 has products | `spec-undefined` — probe integrity | referential probe |
| DT-13 | EC9 | admin POST `12345` | admin token | `spec-undefined` — numeric-only name | type probe |
| DT-14 | EC3 × EC11 | user token POST name=`` | non-admin token | Reject — **auth checked first (403)**, independent of name | ordering interaction |

## FR-14 · Boundary Value Analysis

| # | Variable | Boundary | Operator / inclusivity |
|---|----------|----------|------------------------|
| B1 | `name` length lower | LB=0 (required) | length **≥1 valid, 0 invalid**; smallest valid = 1 |
| B2 | `name` length upper | no max stated | `spec-undefined` (probe robustness) |
| B3 | category `id` (DELETE) | valid = existing 1..3 | `1..maxId` valid; `<1`, `>maxId`, non-numeric invalid |

| ID | Variable | Boundary (operator, rule) | Value | Precondition | Expected | Probes |
|----|----------|---------------------------|-------|--------------|----------|--------|
| BVA-01 | name length | 0 (required, FR-14) | `""` (0) | admin token | **Reject** — name required | at-0 (invalid) |
| BVA-02 | name length | 0→1 (smallest valid) | `"A"` (1) | admin token | **Accept** — non-empty (FR-14) | LB |
| BVA-03 | name length | 1→2 | `"AB"` (2) | admin token | Accept | LB+1 |
| BVA-04 | name length (ws) | 0-effective | `" "` (trims to 0) | admin token | Reject — whitespace = empty (FR-14) | LB via trim |
| BVA-05 | name length | 255 | 255-char | admin token | Accept or `spec-undefined` (no max) | typical upper |
| BVA-06 | name length | 256 | 256-char | admin token | `spec-undefined` — truncation/reject | UB+1 |
| BVA-07 | name length | largest allowed | 10 000-char | admin token | Graceful, no crash (`spec-undefined`) | extreme max |
| BVA-08 | id | LB=1 (min existing) | id=1 | admin; id 1 exists | Deletes category 1 (FR-14) | LB |
| BVA-09 | id | LB−1=0 | id=0 | admin | Reject/no-op — no such id | LB−1 |
| BVA-10 | id | negative | id=−1 | admin | Reject/no-op — invalid | below range |
| BVA-11 | id | UB=3 (max existing) | id=3 | admin; id 3 exists | Deletes category 3 (FR-14) | UB |
| BVA-12 | id | UB+1=4 | id=4 | admin; only 1–3 exist | Reject/no-op — not found | UB+1 |
| BVA-13 | id | far above | id=9999 | admin | Reject/no-op — not found | extreme |
| BVA-14 | id | non-numeric | id=`abc` | admin | Reject — invalid (`spec-undefined` on code) | type boundary |

> **Signature:** **BVA-01/02/04** — length 0 (and whitespace-that-trims-to-0) must be rejected
> while length 1 is accepted. Skipped validation accepts the empty name — visible at this edge.
> **DT-05/07** expose the missing admin-role check (SEC-03). All BVA cases run under admin so a
> length result isn't masked by an auth rejection.

---

# FR-10 (Mobile) — Order Cancellation State Machine

*Source: `docs/test-design/FR-10-domain.md`, `FR-10-bva.md`.*
**Platform:** React Native app (`frontend-mobile/App.js`) — exposes **only user self-cancel**
(`cancelOrder` → `PUT /api/orders/:id/cancel`, App.js:312); the "Hủy đơn" button renders **only when
`status ∈ {pending, confirmed}`** (App.js:961); `statusLabel` maps the 5 states to Vietnamese
(App.js:331). No admin panel on device → order states are built as **fixtures via the admin API**.
**Rules:** FR-10 (`delivered`/`canceled` final; **user may NOT cancel when `shipping`**) + **FR-20**
(mobile cancel only when `pending`/`confirmed`) + FR-11 (own orders) + FR-21 (VN labels, red danger) + FR-24 (empty state).

**Two-layer principle.** The UI *hides* the cancel button for `shipping`/`delivered`/`canceled`, so a
UI-only test wrongly reads FR-10 as satisfied while the **server** may still accept an illegal cancel.
Every forbidden state gets **L1** (UI button hidden) **and** **L2** (direct `PUT /cancel` rejected)
cases — L1 passing does not imply L2 passes.

## FR-10 · Domain Testing (mobile state-transition testing)

**Variables:** order `status` (state); cancel action (tap "Hủy đơn" / direct API); ownership; outputs
= button visibility, VN status label, success/error Alert, empty state, API result.

### Equivalence classes

| EC | Variable (In/Out) | Condition | Class (valid/invalid) | Representative |
|----|-------------------|-----------|-----------------------|----------------|
| EC1 | status × button (L1) | FR-20 cancelable | valid: `pending` → button **shown** | order pending |
| EC2 | status × button (L1) | FR-20 cancelable | valid: `confirmed` → button **shown** | order confirmed |
| EC3 | status × button (L1) | FR-20/FR-10 not user-cancelable | **invalid**: `shipping` → button **hidden** | order shipping |
| EC4 | status × button (L1) | FR-10 final | **invalid**: `delivered` → button **hidden** | order delivered |
| EC5 | status × button (L1) | FR-10 final | **invalid**: `canceled` → button **hidden** | order canceled |
| EC6 | cancel action (L2) | FR-10 valid | valid: cancel `pending` → `canceled` | user token, pending |
| EC7 | cancel action (L2) | FR-10 valid | valid: cancel `confirmed` → `canceled` | user token, confirmed |
| EC8 | cancel action (L2) | FR-10 forbidden when shipping | **invalid**: force-cancel `shipping` via API | user token, shipping |
| EC9 | cancel action (L2) | FR-10 final | **invalid**: force-cancel `delivered` via API | user token, delivered |
| EC10 | cancel action (L2) | FR-10 final | **invalid**: force-cancel `canceled` via API | user token, canceled |
| EC11 | ownership (L2) | FR-11 own-only | **invalid**: cancel another user's order | 2nd user's order id |
| EC12 | status label (UI) | FR-21 Vietnamese | valid: each state → correct VN label | 5 states |
| EC13 | empty history (UI) | FR-24 empty state | valid: no orders → friendly message | new account |
| EC14 | button style (UI) | FR-21 danger = red | valid: cancel button is red | red button |
| EC15 | action feedback (UI) | robustness | **invalid**: backend unreachable on tap | offline |
| EC-O1 | success (out) | after valid cancel | success Alert; status `Đã hủy`; list refreshed | — |
| EC-O2 | error (out) | after rejected/failed cancel | error Alert with backend/failure message | — |

### Selected cases

| ID | Classes (EC) | Steps | Precondition (fixture) | Expected (per spec) | Rationale |
|----|--------------|-------|------------------------|---------------------|-----------|
| DT-01 | EC1,EC6,EC12,EC14,EC-O1 | history → tap "Hủy đơn" on a **pending** order | login user; 1 order `pending` | Button shown (red); tap → success; status → **"Đã hủy"** (FR-10/20/21) | packs cancelable + label + style + success |
| DT-02 | EC2,EC7,EC-O1 | tap "Hủy đơn" on a **confirmed** order | order → `confirmed` (admin API) | Button shown; tap → success → `canceled` (FR-10/20) | valid cancel from confirmed |
| DT-03 | EC13 | open history with no orders | fresh user, 0 orders | "Bạn chưa có đơn hàng nào." empty state (FR-24) | empty-state output |
| DT-04 | EC3 (only) | open history on a **shipping** order (L1) | order → `shipping` | **No "Hủy đơn" button** (FR-20) | shipping hidden (L1) |
| DT-05 | EC4 (only) | open history on a **delivered** order (L1) | order → `delivered` | No cancel button (final, FR-10) | delivered hidden (L1) |
| DT-06 | EC5 (only) | open history on a **canceled** order (L1) | order `canceled` | No cancel button (final, FR-10) | canceled hidden (L1) |
| DT-07 | EC8 (only) | `PUT /cancel` (user token) on a **shipping** order (L2) | shipping order owned by user | **Reject 4xx** — user can't cancel when shipping (FR-10) | **key: UI gate must not mask server** |
| DT-08 | EC9 (only) | `PUT /cancel` on a **delivered** order (L2) | delivered order | Reject — final (FR-10) | final enforcement (L2) |
| DT-09 | EC10 (only) | `PUT /cancel` on a **canceled** order (L2) | canceled order | Reject — final/already (FR-10) | final enforcement (L2) |
| DT-10 | EC11 (only) | user A `PUT /cancel` on user B's **pending** order (L2) | 2nd user owns the order | Reject — own orders only (FR-11) | ownership (L2) |
| DT-11 | EC3 × EC8 | compare DT-04 (button hidden) vs DT-07 (API reject) | shipping order | **Both** must hold; button hidden **but** API accepts ⇒ UI masking an FR-10 server defect | exposes two-layer gap |
| DT-12 | EC12 | read status label for each of the 5 states | one order per state | Each shows correct VN label (FR-21); no raw enum | statusLabel coverage |
| DT-13 | EC15,EC-O2 | tap "Hủy đơn" with backend unreachable | pending order; backend down | Error Alert; order unchanged; no crash | failure handling |
| DT-14 | spec-ambiguous | any device path to cancel a `shipping` order? | shipping order | `spec-ambiguous` — FR-10 text "admin only" when shipping vs diagram; probe & report | diagram/text conflict |

## FR-10 · Boundary Value Analysis (ordinal edge, two layers)

Progression `pending(0) → confirmed(1) → shipping(2) → delivered(3)`; `canceled` absorbing.
**B1** cancel-permission edge (FR-20: allowed `≤ confirmed`; first forbidden `shipping`) — tested at
**L1** button visibility and **L2** API. **B2** terminal-state edge (`delivered`/`canceled` final).

| ID | Boundary (operator, rule) | State | Layer | Precondition | Expected (per spec) | Probes |
|----|---------------------------|-------|-------|--------------|---------------------|--------|
| BVA-01 | LB−1: `pending` (inside allowed) | pending | L1 | order `pending` | Button **shown** (FR-20) | inside (UI) |
| BVA-02 | LB−1 action | pending | L2 | order `pending`, user token | `PUT /cancel` → **200 → canceled** (FR-10) | inside (server) |
| BVA-03 | **LB: `confirmed` (last cancelable)** | confirmed | L1 | order `confirmed` | Button **shown** (FR-20) | LB (UI) |
| BVA-04 | **LB: `confirmed`** action | confirmed | L2 | order `confirmed`, user token | `PUT /cancel` → **200 → canceled** (FR-10) | LB (server) |
| BVA-05 | **LB+1: `shipping` (first forbidden)** | shipping | L1 | order `shipping` | Button **hidden** (FR-20) | **just over (UI)** |
| BVA-06 | **LB+1: `shipping`** forced action | shipping | L2 | order `shipping`, user token | `PUT /cancel` → **reject 4xx** (FR-10) — if accepted, UI masked a server bug | **just over (server — key)** |
| BVA-07 | LB+2: `delivered` (past+final) | delivered | L1 | order `delivered` | Button **hidden** (final, FR-10) | beyond (UI) |
| BVA-08 | LB+2: `delivered` forced action | delivered | L2 | order `delivered`, user token | `PUT /cancel` → **reject** (final, FR-10) | beyond (server) |
| BVA-09 | B2 on edge: `delivered` final | delivered | L2 | delivered order | `PUT /cancel` → reject — no exit from final (FR-10) | terminal on-edge |
| BVA-10 | B2 on edge: `canceled` final/already | canceled | L2 | canceled order | `PUT /cancel` → reject — already final (FR-10) | terminal on-edge |

> **Signature:** **BVA-05 + BVA-06** — the `confirmed → shipping` permission flip. The app draws the
> button line here (App.js:961), so BVA-05 checks the **UI** hides the button (likely correct) while
> **BVA-06 forces the API and checks the server rejects** — the layer where the planted defect lives.
> Passing BVA-05 alone is a false positive for FR-10; BVA-06 catches the bug. BVA-03/04 (allowed) +
> BVA-05/06 (forbidden) pin the edge exactly.

---

## 4. Traceability — spec rule → cases

| Feature | Spec rule | Covered by |
|---------|-----------|------------|
| FR-05 | R4 search by name | DT-01..06, BVA-13/14/15 |
| FR-05 | R5 safe render (SEC-04) | DT-09/10/11/17 |
| FR-05 | R7 empty state | DT-07/16, BVA-07 |
| FR-05 | R8 single `<h1>` / R2 alt / R3 price | DT-01 (EC-O5/6/7) |
| FR-05 | SEC-05 param query | DT-12/13/14, BVA-10/11/12 |
| FR-09 | C1 exists/active | DT-04/05, DT-13 |
| FR-09 | C2 not expired | DT-08/15, BVA-16..19 |
| FR-09 | **C3 `>= min`** | DT-07/11, **BVA-01..09** |
| FR-09 | C4 logged in | DT-09/16 |
| FR-09 | C5 uses `< max` | DT-10, BVA-10..15 |
| FR-09 | formula percent/fixed | DT-01/02/17, EC-O1..3 |
| FR-14 | name required non-empty | DT-03/04, BVA-01/02/04 |
| FR-14 | FR-12/SEC-03 admin-only | DT-05/06/07/14 |
| FR-14 | id validity | DT-08, BVA-08..14 |
| FR-14 | SEC-04/05 safe name | DT-09/10 |
| FR-10 (Mobile) | FR-20 user cancel pending/confirmed | DT-01/02, BVA-01..04 |
| FR-10 (Mobile) | **user not cancel when shipping** (UI L1 + API L2) | DT-04/07/11, BVA-05/06 |
| FR-10 (Mobile) | **final states** delivered/canceled | DT-05/06/08/09, BVA-07..10 |
| FR-10 (Mobile) | FR-11 own-orders only | DT-10 |
| FR-10 (Mobile) | FR-21 VN labels / FR-24 empty state | DT-12 / DT-03 |

---

## 5. Results-recording template (fill during execution)

For each case, copy the row and record Actual / Status / Evidence. **Expected always cites the
spec rule; Status (PASS/FAIL) is decided here, not in design.**

```markdown
| Case ID | Expected (per spec) | Actual | Status | Evidence |
|---------|---------------------|--------|--------|----------|
| FR09 BVA-02 | Coupon applies; discount 30,000; final 270,000 | … | PASS/FAIL | evidence/fr09-bva-02.png |
```

Execution prerequisites: obtain admin + user JWTs (`POST /api/login`); reset with
`node database.js` before stateful cases; for FR-09 usage cases seed `coupon_usage`; for FR-10
build source states via checkout + admin status updates; capture raw JSON for injection/wildcard
cases where the UI could hide a leak. Failures flow to `docs/bug-report.md` and GitHub Issues;
AI misses flow to `docs/ai-gap-analysis.md` (workflow §7–8).
