# FR-14 — R1: Observable behaviours derived from the specification

**Rung R1.** Source: `README.md` §6 FR-14, plus FR-12 (admin access control) and SEC-03, which
FR-14's write operations are explicitly subject to. Implementation not consulted at this rung.

## Rules

| Rule | Spec | Observable as |
|------|------|----------------|
| **R1** | "Admin có thể Thêm / Xem / Xóa danh mục" | the admin panel lists categories and can add and delete them |
| **R2** | "Tên danh mục là bắt buộc, không được để trống" | an empty name is refused and no row is created |
| **R3** | FR-12: the admin subsystem is for `role = 'admin'` only | a non-admin cannot reach the panel or perform its actions |
| **R4** | FR-12 + SEC-03: `POST/PUT/DELETE /api/categories` require a valid JWT **and** `role = 'admin'` in that token | a request carrying a *user* token is rejected with 403; an unauthenticated one with 401 |
| **R5** | SEC-04: user-supplied data must be escaped when displayed | a category name containing markup renders as literal text |
| **R6** | FR-15 integrity: products must belong to a category from the list | deleting a category must not leave products pointing at a category that no longer exists |

Seed data: three categories — Điện thoại (1), Laptop (2), Phụ kiện (3) — with products attached
to all three.

## Design consequences

1. **"Không được để trống" covers more than `""`.** A name of spaces only is empty in every sense
   that matters to a user, so whitespace gets its own case; `""` and `"   "` are separate
   equivalence classes for a validator that trims and one that does not.
2. **R4 is asserted at the API level, from inside the FR-14 suite.** The admin UI never offers a
   non-admin path, so the only way to test SEC-03 is to send a request with a user token. This is
   still an FR-14 case — the rule being verified is FR-14's own write-authorisation — so it lives
   with the feature rather than in a separate security file.
3. **R6 is an interaction rule, not a CRUD rule.** It only shows up when a *populated* category is
   deleted, so the case must target a seeded category with products, not a freshly created empty one.
4. **Deletion has no confirmation dialog in this SUT**, which removes the usual modal hazard from
   the automation; FR-24 requires confirmation for cart deletions but says nothing about admin
   category deletion, so the absence is **not** asserted as a defect here.

## Uniqueness is deliberately left as a probe

FR-14 does not say whether category names must be unique. Creating a duplicate therefore has no
oracle: asserting either outcome would invent a requirement. The case runs, records what happened,
and asserts nothing — flagged for human adjudication, the same discipline HW02 used for
spec-undefined behaviour.
