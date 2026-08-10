# AI gap analysis — what the AI got wrong, and why

Required by §6 Task 1 ("report what the AI got wrong or missed, and explain *why*"). Every entry
below is something that actually happened while building this suite, with the correction I made
and a cause classified as **prompt quality**, **model limitation**, or **feature complexity**.

Entries are added as they occur, not reconstructed at the end.

---

## G-01 · XSS case proved injection but not execution — FR-05 A12

**Produced:** the first case list tested HTML injection with `<b>Mac</b>` and asserted the bold tag
did not appear.
**Wrong because:** FR-05 R4 + SEC-04 are about *unsafe rendering*, whose worst consequence is
script execution. A markup-only payload can pass while an `onerror` payload still runs attacker
code, so the case could go green over a live vulnerability.
**Correction:** replaced with `<img src=x onerror=window.__xssExecuted=true>` and a page-state
assertion (`window.__xssExecuted` must stay falsy). A JS flag is used rather than `alert()` because
a native dialog blocks the whole run.
**Result:** the flag came back **true** — proven code execution, which is materially stronger
evidence than HW02's "markup is injected" finding.
**Cause: model limitation.** The AI reached for the most common textbook payload rather than the
one that discriminates between "escaped" and "executed".

## G-02 · Loading-state case would have proved nothing — FR-05 A16

**Produced:** search, then assert a loading indicator is visible.
**Wrong because:** against a local API answering in ~20 ms the indicator (if implemented) may never
be observed. The test would pass or fail on timing luck, and a green result would be meaningless.
**Correction:** the test now throttles `**/api/products*` by 1.5 s via `page.route`, then asserts
within that window — so the state is genuinely observable if it exists.
**Cause: feature complexity.** Transient states need controlled conditions; the AI wrote the
"obvious" test without asking whether the state could be seen at all.

## G-03 · `getByRole('img')` would have made the alt-text check vacuous — FR-05 A15

**Produced:** a Page Object exposing product images as `page.getByRole('img')`, following the
role-locator guidance applied everywhere else.
**Wrong because:** an `<img alt="">` is *presentational* — the accessibility tree drops it, so the
role locator matches **zero** elements. The loop over images would then iterate nothing and the
test would pass while every image was in breach of FR-24. A green test proving the opposite of the
truth is the worst possible outcome.
**Correction:** used `page.locator('img')` (a semantic tag, not a styling class) and added an
explicit `toHaveCount(5)` so a wrong element count fails loudly.
**Cause: model limitation.** A style rule ("prefer role locators") was applied without reasoning
about the accessibility semantics that make the rule work — and precisely the defect under test is
what breaks it.

## G-04 · My own ad-hoc verification raced the app and produced a false reading

**Produced:** a throwaway script to double-check the alt attributes reported `img count: 0`,
which looked like "the page renders no images at all".
**Wrong because:** the script navigated and queried immediately, while products are fetched
asynchronously. The real test uses a retrying web-first assertion and correctly sees 5 images.
**Correction:** treated the ad-hoc result as unreliable and re-verified through the suite before
writing anything down. Had it gone unchecked, the bug report would have contained a fabricated
claim.
**Cause: model limitation.** The waiting discipline the AI applies inside the test suite was not
applied to its own scratch script — the rigour was attached to the format, not to the reasoning.

## G-05 · Cart state is destroyed by direct navigation — FR-09 fixture

**Produced:** the natural first draft of a checkout journey is `page.goto('/checkout')`.
**Wrong because:** `CartContext` keeps the cart in React state with no persistence, so any full
page load empties it. Tests would then run against a total of 0 and coupon assertions would be
meaningless.
**Correction:** `addToCartAndOpenCheckout()` clicks Home → Giỏ hàng → Tiến hành thanh toán, using
client-side navigation only. This was caught by reading `CartContext.jsx` **before** writing the
fixture, not after a red run.
**Cause: feature complexity.** The trap is invisible from the UI and from the URL structure; only
the source reveals it.

## G-06 · Expected value nearly taken from the app instead of the spec — FR-09 B04

**Produced:** for SAVE10 on 300 001, an expected discount of `30 000.1`.
**Wrong because:** money here is integral đồng and the value must be reasoned about (floor →
30 000) *before* running the app. Leaving it unresolved invites the classic failure mode: run the
test, see what the app says, call that the expectation — which would encode whatever the app does,
bug included.
**Correction:** computed 300 001 × 10 / 100 = 30 000.1 → floored to 30 000, with the reasoning
written into `docs/fr09/R2-cases.md` so a reviewer can challenge it.
**Cause: prompt quality.** My R2 prompt asked for expected values without stating the rounding
convention, so the AI produced an un-runnable fraction rather than flagging the ambiguity.

## G-07 · A case with nothing to assert — FR-09 B11

**Produced:** "empty coupon code → expect an error message".
**Wrong because:** the Apply button is disabled while the field is blank, so no message ever
appears; the test would fail for a reason unrelated to what it claims to check.
**Correction:** re-aimed at the observable fact — **no `/api/apply-coupon` request is sent** — a
network assertion (pattern P5).
**Cause: model limitation.** The AI pattern-matched "negative case → expect an error" instead of
asking what is observable in that state.

## G-08 · A test that PASSED while the defect it targets was happening — FR-14 C04/C05

**Produced:** for "an empty category name must be refused", the natural assertion
`await expect(categoryRows).toHaveCount(before)` — *the table must not grow*.
**Wrong because:** Playwright's web-first assertions retry **until they match**, and this one
matches on the very first poll, before the app has refreshed the list. It therefore cannot observe
a row being added a moment later. Both cases went green — against a SUT that accepts `""` with
HTTP 200 — and the run even left a category literally named `"   "` in the database, which is what
gave the false pass away.
**Correction:** the refused branch now awaits the POST, attaches the response, asserts the status
is ≥ 400, and re-checks the category count **through the API** rather than the DOM. Re-run:
`Expected: >= 400, Received: 200` and `Expected: 3, Received: 4` — the defect is now caught with
evidence, and the rows the SUT wrongly creates are cleaned up.
**Cause: model limitation**, and the most instructive entry in this file. Asserting *absence of
change* against an auto-retrying assertion is a false-negative generator: the assertion is
"correct" in isolation, reads well in review, and silently inverts the meaning of the test. Every
"nothing should happen" case in this suite was re-checked for the same shape afterwards.

## G-09 · A `catch` written to tolerate failing tests hid the fact that no test ever ran

**Produced:** the multi-browser runner spawned Playwright with
`execFileSync('npx.cmd', ['playwright', 'test', …])`, wrapped in

```js
} catch {
  // A non-zero exit just means some tests failed — expected on a deliberately-buggy SUT.
}
```

**Wrong because:** since Node 18.20 / 20.12, `execFile` **refuses** to spawn a `.cmd` shim without
`shell: true` (the fix for CVE-2024-27980). On Windows the call therefore threw instantly, every
time — and the `catch`, written for an entirely reasonable purpose, swallowed it. The first official
run produced no tests at all and failed several steps later with
`ENOENT: … reports\FR-05-chromium\results.json`, which points at the *reporting* code rather than at
the spawn that never happened.

**Correction:** run the Playwright CLI module with the current `node` binary
(`createRequire(import.meta.url).resolve('@playwright/test/cli')`) — no shell, no `PATH` lookup —
and narrow the catch: a thrown error **without** a numeric `.status` means the process never started
and is now fatal, while a non-zero exit stays tolerated. A missing `results.json` is also reported
explicitly instead of surfacing as a stack trace.

**Cause: model limitation.** Two failures compounding. The AI wrote the spawn idiom that was correct
for older Node versions, and it wrote a `catch` whose *comment* states a narrow intent
("some tests failed") while its *code* catches everything. That gap between the stated intent and
the implemented behaviour is exactly the kind of thing that reads well in review — the comment
explains itself convincingly — and it turned a loud, immediate failure into a silent one.

**Worth noting:** the same shape appears in `scripts/capture-evidence.mjs`, where the first draft
registered `waitForResponse` **after** the click that triggers it and timed out against a ~20 ms
local API. That is G-04 recurring: the waiting discipline the AI applies rigorously inside the test
suite was not carried into the scripts around it.

---

## Cross-cutting observation

Six of the nine entries (G-01, G-03, G-04, G-07, G-08, G-09) share one shape: the AI produced something
**structurally correct and plausible-looking** — a payload, a locator, a script, a negative case,
an assertion — whose defect only shows up when you ask *"if the feature were broken, would this
test actually notice?"*. Reviewing AI output for **discriminating power**, not for plausibility, is
the habit this assignment has forced.

G-03 and G-08 are the sharpest version of it: both were tests that would have reported **green
while the very defect they were written to catch was occurring**. A suite full of such tests looks
like evidence of quality and is in fact evidence of nothing. This is why every failing case in this
project was verified against the API or the DOM before being written up, and why the passing ones
were re-examined too.

G-09 extends the same question from tests to the tooling around them. *If this step silently did
nothing, would anything notice?* An over-broad `catch` answers "no" — and an over-broad `catch`
carrying a narrowly-worded comment answers "no" while looking, in review, like it answers "yes".
