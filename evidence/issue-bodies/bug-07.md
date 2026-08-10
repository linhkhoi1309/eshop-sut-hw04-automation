**Feature:** FR-14 · **Severity:** High · **Spec:** README §FR-14 ("Tên danh mục là **bắt buộc**, không được để trống")

**Preconditions:** logged in to the admin panel as `admin@eshop.com`.

**Steps to reproduce**

1. Open **Danh mục**.
2. Leave **Tên danh mục mới** empty and press **Thêm mới**.
3. Repeat with three spaces `"   "`.
4. Reload the page and reopen the tab.

**Expected (FR-14):** both attempts are refused with a validation message; the category count is
unchanged.

**Actual:** both are accepted — **HTTP 200** `{"message":"Category created"}` — and both rows
**persist across a reload**, so the table permanently contains one blank row and one row of spaces.
Neither has a usable name in the product form's category dropdown.

**Independent confirmation**

```
$ curl -s -X POST localhost:3000/api/categories -H 'Authorization: Bearer <ADMIN jwt>' \
       -H 'Content-Type: application/json' -d '{"name":""}'
{"message":"Category created","id":4}
```

**Root cause** — `backend/server.js:249-254`: the handler destructures `name` and inserts it with no
presence check and no trim. There is no client-side guard either.

**Testing note (this one nearly went unreported).** The first version of these two cases asserted
*"the table must not grow"* with `expect(rows).toHaveCount(before)`. Playwright's web-first
assertions retry **until they match**, and that one matches on the first poll — before the list
refreshes — so both cases passed while the defect was happening. What gave it away was the seeded
database being left with a category literally named `"   "`. The cases now await the POST, assert
its status is ≥ 400, and re-count through the API. Written up as **G-08** in
`docs/ai-gap-analysis.md`.

**Evidence:** ![BUG-07](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-07.png)

**Traceability:** FR-14 `C04` (empty) and `C05` (whitespace) — failed on all three engines.
HW02 ref: FR-14 DT-04 (C04), BVA-02 (C05).

---
