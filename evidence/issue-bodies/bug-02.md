**Feature:** FR-05 · **Severity:** Critical · **Spec:** README §FR-05 ("tìm kiếm theo **tên sản phẩm**") + §SEC-05 (parameterised queries required)

**Preconditions:** database freshly seeded (5 products).

**Steps to reproduce**

1. Open the storefront `http://localhost:5173/`.
2. Type `%` into **Tìm kiếm...** and press **Tìm**.
3. Repeat with `_`, then with `zzz' OR name LIKE 'MacBook%`.

**Expected (FR-05 + SEC-05):** the term is matched **literally** against product names. `%` and `_`
are ordinary characters that appear in no product name, so both searches return **0 products** and
the empty state. An SQL fragment is likewise just text → **0 products**.

**Actual:** `%` → **all 5 products**. `_` → **all 5 products**. The injected fragment returns
**exactly `MacBook Pro M3`**, proving the input is being executed as SQL rather than compared as data.

**Independent confirmation**

```
$ curl -sG localhost:3000/api/products --data-urlencode "search=zzz"                        # 0 results
$ curl -sG localhost:3000/api/products --data-urlencode "search=zzz' OR name LIKE 'MacBook%"
[{"id":3,"name":"MacBook Pro M3", ...}]                                                     # 1 result
```

`zzz` alone matches nothing; appending an SQL fragment makes a row appear. Only injection explains
that difference.

**Root cause** — `backend/server.js:144`:

```js
const query = `SELECT * FROM products WHERE name LIKE '%${searchQuery}%'`;
```

The term is concatenated into the statement, so it is parsed as SQL and its `LIKE` metacharacters
keep their special meaning. A parameterised query with the metacharacters escaped fixes both
symptoms at once, which is why they are reported as one defect rather than three.

**Impact:** an unauthenticated visitor can read and — with a stacked statement — modify arbitrary
rows. The wildcard leak is the same bug seen by an ordinary user: searching for `%` silently returns
the whole catalogue as though it were a match.

**Evidence:** ![BUG-02](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-02.png)

**Traceability:** FR-05 `A08` (`%`), `A09` (`_`), `A10` (SQL fragment) — failed on all three engines.
HW02 ref: FR-05 BVA-10 (A08), BVA-11 (A09), DT-12 (A10) — SEC-05.

---
