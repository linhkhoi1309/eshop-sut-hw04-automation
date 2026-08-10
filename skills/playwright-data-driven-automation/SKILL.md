---
name: playwright-data-driven-automation
description: >-
  Turn a written feature specification into a data-driven Playwright suite that runs on
  Chromium, Firefox and WebKit and produces HTML reports stamped with a student/run ID.
  Use when someone says "automate this feature", "write Playwright tests for FR-xx",
  "make these test cases data-driven", or "run the suite on multiple browsers with a report".
  Drives the AI through six rungs (behaviours → cases → data file → page object → spec →
  failure triage) instead of one generic prompt, and treats a failing assertion as a candidate
  defect to report rather than a test to weaken.
---

# Data-driven Playwright automation from a specification

Produces: a data file (CSV/JSON), a Page Object, a `.spec.js` that loops the data, N×3 stamped
HTML reports, and a triaged defect list.

## Guardrails (read before generating anything)

1. **The specification is the oracle — never the implementation, never the app's current output.**
   On a deliberately-buggy SUT a red test is a *candidate defect*. Never soften an assertion, never
   "fix" the app, and never take an expected value from a test run.
2. **No expectations inside the spec file.** Inputs *and* expected results live in the data file;
   the spec supplies mechanics only. Adding a case must mean adding a row.
3. **No styling selectors.** No Tailwind/utility classes, no `nth-child` chains. Roles, labels,
   placeholders and text. Structure is acceptable only when it *is* the contract (a row identified
   by the cell it contains).
4. **No `waitForTimeout`.** Use web-first assertions and `waitForResponse`.
5. **Ask of every assertion: if the feature were broken, would this notice?** See the anti-patterns
   below — this is where AI-generated suites fail silently.

## Step 1 — R1: behaviours from the spec

Read only the specification section (plus the cross-cutting security/GUI requirements it cites).
Emit a rule table `R1…Rn`: rule → spec sentence → what it looks like in a browser. Every later case
cites a rule ID. Delete anything not traceable to a spec sentence.

## Step 2 — R2: cases

≥12 per feature, mixing positive / negative / boundary / security / GUI-contract. Mandatory sweeps:

- **Every threshold gets `min−1`, `min`, `min+1`** — inclusive-vs-exclusive is the classic defect.
- **Every free-text input gets the literal-character set** relevant to its backend (`%`, `_`, `'`
  for SQL `LIKE`), justified by "search by name" + the parameterised-query requirement.
- **Every echoed input gets an execution probe**, not just a markup probe (see anti-pattern A1).
- Behaviour the spec does not define becomes a **probe**: run it, record the outcome, assert
  nothing. Inventing a requirement is worse than reporting an unknown.

Write the expected values by computing them from the spec, and record the reasoning (rounding,
inclusivity) so a reviewer can challenge it.

## Step 3 — R3: the data file

CSV for flat input→outcome tables; JSON when cases carry nested expectations or setup. Columns
that carry their weight: `id, type, input…, expected…, assertion, spec_ref, hw02_ref, description`.
`spec_ref` on every row is what makes the report's traceability table generate itself.

## Step 4 — R4: the Page Object

Locators as above. Encapsulate any journey with a **hidden state rule** (e.g. an in-memory cart
that a full page load destroys — the journey must click, never `goto`). Where a test depends on a
control that is itself defective, make its absence throw a descriptive error rather than degrade
into a vacuous pass.

## Step 5 — R5: the spec file

```js
const cases = readCsv('data/<feature>.csv');           // or JSON.parse(readFileSync(...))
test.describe('@FR-XX <feature>', () => {
  for (const row of cases) {
    test(`${row.id} [${row.type}] ${row.description} (${row.spec_ref})`, async ({ page }, testInfo) => {
      testInfo.annotations.push({ type: 'Run by', description: RUN_BY });
      testInfo.annotations.push({ type: 'Spec', description: row.spec_ref });
      switch (row.expected_behavior) { /* one branch per assertion shape */ }
    });
  }
});
```

Use at least three assertion patterns and name them per row:

| | Pattern | Example |
|--|---------|---------|
| P1 | text / content | `expect(card).toContainText(name)` |
| P2 | count | `expect(page.locator('h1')).toHaveCount(1)` |
| P3 | visibility / state | `expect(emptyState).toBeVisible()` |
| P4 | attribute | `expect(img).not.toHaveAttribute('alt', '')` |
| P5 | network / API | `expect((await page.waitForResponse(/apply/)).status()).toBe(400)` |
| P6 | soft assertions | `expect.soft(price).toMatch(/₫/)` — report every defect in one run |
| P7 | page/JS state | `expect(await page.evaluate(() => window.__xss)).toBe(false)` |

## Step 6 — R6: triage every red result

```
FAIL → is the expected value copied from the spec?  ── no → test defect → fix the test, log the gap
                     │ yes
                     ▼
      does the actual behaviour violate the spec?   ── no → probe → record, no verdict
                     │ yes
                     ▼
               defect → bug report + issue + screenshot
```

Verify each failure independently (API call, DOM inspection) **before** writing it up. Then
re-examine the *passing* cases for the anti-patterns below.

## Anti-patterns that produce green tests over real defects

- **A1 — markup-only XSS probe.** `<b>x</b>` proves injection, not execution. Use
  `<img src=x onerror=window.__x=1>` and assert the flag. Never `alert()` — a dialog blocks the run.
- **A2 — `getByRole('img')` for alt-text checks.** `alt=""` makes an image presentational, so the
  role locator matches nothing, the loop body never runs, and the test passes while every image is
  in breach. Use the tag plus an explicit `toHaveCount`.
- **A3 — asserting "nothing changed" with a retrying assertion.** `expect(rows).toHaveCount(before)`
  matches on the first poll, before the UI refreshes, so it cannot see a row being added. Await the
  request and verify state through the API instead.
- **A4 — racing a transient state.** Asserting a loading indicator against a fast local API proves
  nothing either way. Throttle the request with `page.route`, then assert inside that window.
- **A5 — expectations harvested from the app.** If a value was obtained by running the code, it is
  not an expectation; it is a description of current behaviour, bug included.

## Step 7 — multi-browser runs with stamped reports

```js
// playwright.config.js
reporter: [['list'],
           ['html', { outputFolder: process.env.HTML_OUT, open: 'never',
                      title: `Run by: ${RUN_BY} — ${FEATURE} — ${new Date().toISOString()}` }],
           ['json', { outputFile: `${process.env.HTML_OUT}/results.json` }]],
metadata: { 'Run by': RUN_BY, 'Run at (ISO)': new Date().toISOString() },
projects: ['chromium', 'firefox', 'webkit'].map(name => ({ name, use: devices[…] })),
```

`scripts/run-all.mjs` loops feature × browser: reseed → run → verify the stamp → collect counts →
write `reports/summary.json`. Two traps worth hard-coding into the runner:

- **Never pass `--reporter` on the CLI** — it *replaces* the config's reporter list and silently
  discards the HTML report and `results.json` the run exists to produce.
- **Verify the stamp by rendering the report**, not by grepping `index.html`: the report data is
  embedded/encoded, so a text search finds nothing even when the header is correct.

## Output checklist

- [ ] ≥12 cases per feature, every row carrying `spec_ref`; probes for spec-undefined behaviour.
- [ ] Zero inline test data; zero styling selectors; zero `waitForTimeout`.
- [ ] ≥3 assertion patterns, named per row.
- [ ] Anti-patterns A1–A5 checked against every passing test.
- [ ] N×3 HTML reports, each visibly stamped, plus `reports/summary.json`.
- [ ] Every failure verified independently, then filed with steps, expected/actual and a screenshot.
