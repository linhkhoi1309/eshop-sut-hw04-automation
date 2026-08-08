# FR-05 — R2: Test cases (16)

**Rung R2.** Every case states its **expected result from the spec**, not from the running app.
On this deliberately-buggy SUT a red result is therefore a *candidate defect*, and the correct
response is to file a bug — never to soften the assertion.

Seed data assumed (`backend/database.js`): 5 products — iPhone 15 Pro Max (30 000 000),
Samsung Galaxy S24 Ultra (28 000 000), MacBook Pro M3 (45 000 000), Tai nghe AirPods Pro 2
(6 000 000), Bàn phím cơ Keychron Q1 (4 000 000).

| ID | Type | Input / trigger | Expected (spec) | Rule | HW02 |
|----|------|-----------------|-----------------|------|------|
| A01 | positive | open `/` | grid shows all **5** products | R1 | DT-01 |
| A02 | positive | open `/` | each card shows image + name + price | R2 | DT-01 |
| A03 | positive | search `iPhone 15 Pro Max` | exactly **1** result, that product | R3 | DT-01 |
| A04 | positive | search `Mac` | exactly **1** result: MacBook Pro M3 | R3 | DT-02 |
| A05 | positive | search `macbook` | case-insensitive → **1** result | R3 | DT-02 |
| A06 | positive | search `Bàn phím` | **1** result: Bàn phím cơ Keychron Q1 (diacritics preserved) | R3 | DT-03 |
| A07 | negative | search `zzzz-khong-ton-tai` | **0** results **and** an empty-state message | R6 | DT-06 |
| A08 | edge | search `%` | `%` is a literal character → **0** results (must not leak the catalogue) | R3+SEC-05 | BVA-10 |
| A09 | edge | search `Mac_ook` | `_` is literal → **0** results | R3+SEC-05 | BVA-11 |
| A10 | edge | search `' OR '1'='1` | literal string → **0** results | R3+SEC-05 | DT-12 |
| A11 | negative | search `<script>alert(1)</script>` | term echoed as **literal text**; no `<script>` element created | R4+SEC-04 | DT-10 |
| A12 | negative | search `<img src=x onerror=window.__xssExecuted=true>` | no attacker JS executes; term echoed literally | R4+SEC-04 | DT-10 |
| A13 | gui | open `/` | prices use `₫` with thousand separators | R2+FR-21 | DT-01 |
| A14 | gui | open `/`, then search | exactly **1** `<h1>` in both states | R7+FR-21 | DT-01 |
| A15 | gui | open `/` | every product image has a non-empty `alt` | R2+FR-24 | DT-01 |
| A16 | edge | search `Mac` with the API throttled | loading state visible while the request is in flight | R5 | DT-07 |

## Coverage self-check (my review of the case list, not the AI's)

- **Positive** 6 (A01–A06) · **negative** 4 (A07, A10–A12) · **edge/boundary** 4 (A08, A09, A16, A14 second state) · **GUI contract** 3 (A13–A15) → 16 total, all types represented (§6 requires ≥12 in any mix).
- Each of R1–R7 has at least one case; R3 has five (plain, partial, case, diacritics, plus the three literal-character cases).

## Deviations I made from the first draft — recorded for the gap analysis

1. **A12 was originally `<b>Mac</b>`.** A bold tag proves markup injection but not *execution*,
   and R4/SEC-04 are about both. Replaced with an `onerror` payload that sets a JS flag, so the
   test proves attacker-controlled JS either ran or did not. The flag is used instead of
   `alert()` on purpose: a native dialog would block the run.
2. **A16 originally asserted the loading state on a normal search** — against a local API that
   answers in ~20 ms, such a test can pass or fail by luck and proves nothing either way. It now
   throttles `**/api/products*` deliberately and asserts within that window.
3. **A05 (case-insensitivity) is spec-supported, not spec-explicit.** FR-05 says "search by name"
   without stating case handling. I kept it as a positive case because SQLite `LIKE` is
   case-insensitive for ASCII and the seeded UI implies it; if it ever fails it is a *probe*
   result for human judgement, not an automatic bug.

## Not automated at this rung (documented per §6)

- "Ảnh tỷ lệ chuẩn" (correct aspect ratio) and "thông báo empty state **phù hợp**" (friendliness
  of the wording / illustration) are subjective; A15 asserts the objective half (`alt` present)
  and A07 the objective half (a message exists at all).
- Grid *layout* (columns per breakpoint) is a visual property; asserting Tailwind classes would
  test the implementation, not the spec.
