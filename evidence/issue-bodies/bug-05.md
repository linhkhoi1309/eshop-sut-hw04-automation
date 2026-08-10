**Feature:** FR-09 · **Severity:** High · **Spec:** README §FR-09 condition C4 ("người dùng phải đăng nhập") and C5 (per-user `max_uses_per_user`)

**Preconditions:** a browser with no session at all.

**Steps to reproduce**

1. Without logging in, open `http://localhost:5173/checkout`.
2. Set the total to 400 000 and apply `SAVE10`.
3. Repeat step 2 any number of times.

**Expected (FR-09 C4):** the request is rejected — **401** — because a coupon can only be applied by
an authenticated user.

**Actual:** **HTTP 200** with a discount applied, every time. There is no session, so there is no
`user_id`, so the `coupon_usage` check is skipped entirely: `SAVE10` has `max_uses_per_user = 1` and
can nevertheless be replayed without limit.

**Independent confirmation**

```
$ curl -s -X POST localhost:3000/api/apply-coupon -H 'Content-Type: application/json' \
       -d '{"code":"SAVE10","total_amount":400000}'          # note: no Authorization header
{"success":true,"coupon_id":1,"discount_amount":-3600000,"final_amount":4000000, ...}
```

**Root cause** — `backend/server.js:363`:

```js
app.post("/api/apply-coupon", (req, res) => {      // no authenticateToken middleware
```

and `server.js:386`, `if (user_id) { …usage check… } else { …apply anyway… }` — the usage limit lives
inside the authenticated branch only, so being anonymous is *more* permissive than being logged in.
That inversion is what makes this High rather than Medium.

**Evidence:** ![BUG-05](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-05.png)

**Traceability:** FR-09 `B14` — failed on all three engines. HW02 ref: FR-09 DT-09 — condition C4.

---
