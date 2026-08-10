**Feature:** FR-05 · **Severity:** Low · **Spec:** README §FR-05 ("Ảnh … có **alt text mô tả**") + §FR-24

**Steps to reproduce:** open the storefront and audit `document.querySelectorAll('img')`.

**Expected:** each product image carries a non-empty, descriptive `alt` (the product name would do).
**Actual:** all five are `alt=""` (`Home.jsx:82`). A screen reader announces nothing for any product
image, and nothing is shown if an image fails to load.

**Testing note.** The first version of this check used `getByRole('img')`. An `<img alt="">` is
*presentational*, so the accessibility tree drops it: the role locator matched **zero** elements, the
loop body never ran, and the test passed while every image was in breach. Using the tag locator plus
an explicit `toHaveCount(5)` is what turned the check honest — written up as **G-03** in
`docs/ai-gap-analysis.md`.

**Evidence:** ![BUG-12](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-12.png)

**Traceability:** FR-05 `A15` — failed on all three engines. HW02 ref: FR-05 DT-01 — FR-24.

---
