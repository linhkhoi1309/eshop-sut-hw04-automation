**Feature:** FR-05 · **Severity:** Low · **Spec:** README §FR-21 (heading hierarchy) / §FR-24 (accessibility)

**Steps to reproduce:** open the storefront and evaluate `document.querySelectorAll('h1').length`.

**Expected:** exactly **1**.
**Actual:** **2** — `Danh sách sản phẩm` (`Home.jsx:43`) and a small grey footer line
(`Home.jsx:110`) that is styled as fine print but marked up as a top-level heading. Screen-reader
users get two competing page titles, and the second is not a title at all.

The case checks the count both on load **and** after a search, since the search state re-renders the
page region that contains them.

**Evidence:** ![BUG-11](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-11.png)

**Traceability:** FR-05 `A14` — failed on all three engines. HW02 ref: FR-05 DT-01 — FR-21.

---
