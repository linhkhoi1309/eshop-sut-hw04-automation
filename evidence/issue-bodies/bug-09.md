**Feature:** FR-05 · **Severity:** Medium · **Spec:** README §FR-05 ("khi không có kết quả, hiển thị thông báo phù hợp")

**Preconditions:** none.

**Steps to reproduce**

1. Open `http://localhost:5173/`.
2. Search for `zzzz-not-a-product`.

**Expected (FR-05):** 0 product cards **and** a message telling the user nothing was found.

**Actual:** 0 cards and nothing else — the grid area is simply blank below the echoed search term.
The user cannot tell an empty result from a page that failed to load.

The assertion deliberately accepts any reasonable wording
(`/không tìm thấy|không có kết quả|không có sản phẩm|no results|trống/i`), so a genuine
implementation in any of those phrasings would pass; the failure is the absence of the state, not a
disagreement about its text.

**Evidence:** ![BUG-09](https://raw.githubusercontent.com/linhkhoi1309/eshop-sut-hw04-automation/main/evidence/bug-09.png)

**Traceability:** FR-05 `A07` — failed on all three engines. HW02 ref: FR-05 DT-06.

---
