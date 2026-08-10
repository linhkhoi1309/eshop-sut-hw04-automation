**Feature:** FR-05 · **Severity:** Critical · **Spec:** README §SEC-04 ("dữ liệu người dùng phải được escape khi hiển thị")

**Preconditions:** none — no login required.

**Steps to reproduce**

1. Open `http://localhost:5173/`.
2. Search for `<img src=x onerror="window.__xssExecuted=true">`.
3. Read `window.__xssExecuted` in the browser console.

**Expected (SEC-04):** the term is echoed back as **literal text** in *"Kết quả tìm kiếm cho: …"*.
No element is created from it and no script runs — `window.__xssExecuted` stays `undefined`.

**Actual:** the payload is parsed into a real `<img>` element, its `onerror` handler fires, and
`window.__xssExecuted === true`. Attacker-supplied JavaScript executes in the victim's session.

**Root cause** — `frontend-web/src/pages/Home.jsx:64`:

```jsx
<span dangerouslySetInnerHTML={{ __html: search }} />
```

The raw search string is injected as HTML. The same pattern appears again at `Home.jsx:71` for the
error banner.

**Why the payload is an `onerror` probe and not `<b>`:** a markup-only payload proves *injection*;
this one proves *execution*, which is the consequence SEC-04 exists to prevent. `alert()` is
deliberately avoided — a native dialog blocks the whole automation run.

**Impact:** the search term travels in the URL, so a crafted link is enough — session theft, silent
requests as the victim, or defacement. This is the most serious FR-05 defect.

**Evidence:** ![BUG-03](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-03.png)

**Traceability:** FR-05 `A11` (markup must stay literal) and `A12` (payload must not execute) — both
failed on all three engines. `A11` attaches the rendered `innerHTML` and `A12` the execution flag.
HW02 ref: FR-05 DT-10 (A11, A12) — SEC-04.

---
