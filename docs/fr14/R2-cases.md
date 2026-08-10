# FR-14 — R2: Test cases (14)

**Rung R2.** Expected results come from FR-14 / FR-12 / SEC-03 / SEC-04, not from the app.

| ID | Type | Input / trigger | Expected (spec) | Rule |
|----|------|-----------------|-----------------|------|
| C01 | positive | open the Danh mục tab as admin | table lists the 3 seeded categories with ID / Tên / Hành động columns | R1 |
| C02 | positive | create `Máy tính bảng` | row appears in the table | R1 |
| C03 | positive | create a 255-character Vietnamese name | accepted and rendered intact | R1 |
| C04 | negative | create with an **empty** name | refused; category count unchanged | **R2** |
| C05 | negative | create with **whitespace only** (`"   "`) | refused; count unchanged | **R2** |
| C06 | probe | create a duplicate of an existing name | *spec-undefined* — record the outcome, assert nothing | — |
| C07 | negative | create `<b>Danh mục</b>` | stored/rendered as literal text, no `<b>` element in the table | R5 |
| C08 | positive | delete a category created by the test | row disappears from the table | R1 |
| C09 | edge | delete seeded category **1** (has products) | products must not be left pointing at a deleted category | **R6** |
| C10 | positive | create, then reload the page | the row persists (server-side, not local state) | R1 |
| C11 | positive | create, then open the product form | the new category is selectable in the dropdown | R1 |
| C12 | negative | `POST /api/categories` with a **user** JWT | **403** | **R4 / SEC-03** |
| C13 | negative | `DELETE /api/categories/:id` with **no** token | **401** | **R4** |
| C14 | negative | admin login with a wrong password | stays on the login form; the panel is not reachable | R3 |

## Coverage self-check

Positive 6 · negative 6 · edge 1 · probe 1 = **14** (≥12 required). Every rule R1–R6 has at least
one case; R2 (the mandatory-name rule that FR-14 states explicitly) has two, split by equivalence
class.

## Ordering and isolation

Category tests mutate shared state, so each case creates the rows it needs with a unique suffix
(`__t<timestamp>`), asserts, then removes them. C09 is the exception — it deliberately destroys a
seeded row, so it runs against a freshly reseeded database and is marked as such. The suite runs
serially (`workers: 1`), which the shared SQLite file requires anyway.

## Deviations from the first draft — for the gap analysis

1. **C06 was drafted as "duplicate name → expect an error".** FR-14 never mentions uniqueness, so
   that expectation would have been invented. Downgraded to a probe that records the outcome.
2. **C03 was drafted as "very long name → expect rejection".** FR-14 sets no length limit for
   categories (FR-15 sets 255 for *products*). Re-aimed at the defensible half: a long Vietnamese
   name must be **accepted and rendered intact**.
3. **C09's original wording, "deleting a category should be blocked", is not in the spec either.**
   What FR-15 does require is that a product's category comes from the available list, so the case
   asserts the *consequence* (no orphaned products), leaving the SUT free to block the delete or
   cascade it.

## Not automated (documented per §6)

- Renaming a category: `PUT /api/categories/:id` exists in the API, but the admin UI offers no
  edit control, so there is no UI path to drive and FR-14 lists only Thêm / Xem / Xóa.
- The visual "Hành động" column layout and button colouring (FR-21) — a styling contract that
  would require asserting CSS classes, which this suite deliberately avoids.
