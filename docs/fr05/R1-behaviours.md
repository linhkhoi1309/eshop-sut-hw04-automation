# FR-05 — R1: Observable behaviours derived from the specification

**Rung R1 of the AI-first ladder.** Source: `README.md` §3 FR-05 (+ the GUI contracts FR-21,
FR-22, FR-24 and the security requirements SEC-04/SEC-05 that FR-05 explicitly leans on).
The implementation was **not** consulted at this rung — the spec is the oracle, so a behaviour
listed here is what *must* be true, regardless of what the app currently does.

## Rule IDs used throughout the suite

| Rule | Spec text (README §FR-05) | Observable in a browser as |
|------|---------------------------|-----------------------------|
| **R1** | "Trang chủ hiển thị danh sách tất cả sản phẩm dạng lưới" | Landing on `/` shows one card per seeded product (5), laid out as a grid |
| **R2** | "Mỗi sản phẩm hiển thị: Ảnh (tỷ lệ chuẩn, có alt text mô tả), Tên sản phẩm, Giá (đơn vị ₫, định dạng phân cách hàng nghìn)" | Every card carries: an `<img>` with a **non-empty, descriptive `alt`**; the product name; a price rendered with the **`₫` symbol** and thousand separators |
| **R3** | "Thanh tìm kiếm tìm theo tên sản phẩm" | Submitting a term filters the grid to products **whose name contains that term, literally** |
| **R4** | "Từ khóa tìm kiếm phải được hiển thị an toàn (không render HTML)" | The echoed term appears as **literal text**; markup in the term must not become DOM elements and must not execute |
| **R5** | "Khi đang tải dữ liệu phải hiển thị trạng thái loading" | While the products request is in flight, a loading indicator is visible |
| **R6** | "Khi không có kết quả tìm kiếm phải hiển thị thông báo empty state phù hợp" | A search with no matches shows an explanatory empty-state message (FR-24 adds: with an icon/illustration and a friendly message) |
| **R7** | "Trang chủ chỉ có đúng một thẻ `<h1>`" / "Mỗi trang chỉ có 1 `<h1>` duy nhất" | `document.querySelectorAll('h1').length === 1` in every state of the page |

Supporting requirements that FR-05 cases assert against:

- **SEC-04** — user input rendered on the UI must be escaped; no direct `innerHTML`.
- **SEC-05** — DB queries must be parameterised, so `%`, `_` and `'` in a search term are
  **literal characters**, never SQL syntax. This is what makes the wildcard cases spec-anchored
  rather than a matter of taste.
- **FR-21** — currency is always `₫` with thousand separators; exactly one `<h1>` per page.
- **FR-24** — every product image has a descriptive (non-empty) `alt`.

## What this buys the test design

Each rule above yields at least one directly assertable statement, which is what R2 turns into
cases. Three observations shaped the case list:

1. **R3 + SEC-05 together** make `%`, `_`, and `' OR '1'='1` *ordinary literal searches* whose
   correct result is **0 products** — not "security extras", but the plain reading of "search by
   name". Any other result is both a functional and a security defect.
2. **R4 is not satisfied by "no alert appeared."** Injected markup must not become DOM nodes at
   all, so the assertion is on the rendered text/DOM, plus a separate active-payload probe that
   proves no attacker JS ran.
3. **R5 needs a controlled delay** to be observable at all: against a fast local API the loading
   state may exist yet never be seen. The test therefore throttles the products request itself
   rather than racing it — otherwise a passing result would prove nothing.
