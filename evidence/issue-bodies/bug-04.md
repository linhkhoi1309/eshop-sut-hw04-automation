**Feature:** FR-14 · **Severity:** Critical · **Spec:** README §FR-12 + §SEC-03 (`POST/PUT/DELETE /api/categories` require `role = 'admin'`)

**Preconditions:** database freshly seeded; ordinary user `test@eshop.com / Test1234!` (`role = 'user'`).

**Steps to reproduce**

1. Log in through `POST /api/login` as `test@eshop.com` and keep the JWT.
2. `POST /api/categories` with `{"name":"TAO-BOI-USER-THUONG"}` and that user token.
3. Open the admin panel as an admin → **Danh mục**.

**Expected (FR-12 / SEC-03):** **HTTP 403** and no new category.

**Actual:** **HTTP 200** `{"message":"Category created","id":5}`, and the row is listed in the admin
panel. A non-admin can create — and by the same route rename and delete — the store's categories.

**Independent confirmation**

```
$ curl -s -X POST localhost:3000/api/categories -H 'Authorization: Bearer <USER jwt>' \
       -H 'Content-Type: application/json' -d '{"name":"__probe_user_token"}'
{"message":"Category created","id":5}
```

**Root cause** — `backend/server.js:249/257/269`: all three writers are guarded by
`authenticateToken` only, which verifies that the JWT is *valid*, never that its `role` is `admin`.
An admin-only guard is missing from every category write.

**Note:** the anonymous case is handled correctly — `DELETE /api/categories/:id` with no token
returns **401** (case `C13` passes), which shows the gap is specifically the missing *authorisation*
layer, not authentication.

**Evidence:** ![BUG-04](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-04.png)

**Traceability:** FR-14 `C12` — failed on all three engines. HW02 ref: FR-14 DT-05 — SEC-03.

---
