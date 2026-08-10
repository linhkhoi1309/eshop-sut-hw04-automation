**Feature:** FR-14 · **Severity:** High · **Spec:** README §FR-14 (delete) + §FR-15 ("sản phẩm phải thuộc một danh mục **có sẵn**")

**Preconditions:** freshly seeded database — category `Laptop` (id 2) has products attached.

**Steps to reproduce**

1. Log in to the admin panel → **Danh mục**.
2. Press **Xóa** on the `Laptop` row.
3. `GET /api/products` and compare each `category_id` against `GET /api/categories`.

**Expected (FR-15):** after the delete, **no product** may reference a category that is not in the
list. The SUT is free to satisfy this by blocking the delete, cascading it, or reassigning the
products — the specification constrains the *outcome*, not the mechanism, so the case asserts only
the outcome.

**Actual:** the delete succeeds unconditionally and the products keep `category_id = 2`, which now
matches no row. The admin product form cannot display a category for them, and FR-15's integrity
rule is broken with no warning.

**Root cause** — `backend/server.js:269-278`: a bare `DELETE FROM categories WHERE id = ?` with no
dependency check, no cascade, and no foreign-key enforcement enabled on the SQLite connection.

**Evidence:** ![BUG-08](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-08.png)

**Traceability:** FR-14 `C09` — failed on all three engines. The case picks its victim from live data
rather than hard-coding id 2, so it still works on a database where an earlier run removed a
category. HW02 ref: FR-14 INTEG-01 — FR-15.

---
