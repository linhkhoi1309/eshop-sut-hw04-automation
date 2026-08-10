import { test } from '@playwright/test';
import { RUN_BY } from '../playwright.config.js';

/**
 * The per-test half of the §12 anti-AI-cheat stamp.
 *
 * The report header and the metadata block both come from `playwright.config.js`, but both are
 * reporter-level: swap the reporter and the student ID disappears from the artifact. Annotating
 * every test attaches the ID and an ISO timestamp to the *results* instead, so the stamp survives
 * in results.json and in any reporter that renders annotations.
 *
 * `playwright.config.js` documents this file as the third stamping mechanism; keeping it here —
 * rather than repeating the same beforeEach in each spec — is what makes that comment true and
 * stops the three copies from drifting apart.
 *
 * Usage: `import { stampRunBy } from './_hooks.js';` then call `stampRunBy()` once per spec file,
 * above its `test.describe`.
 *
 * @param {Record<string, string>} [extra] additional annotations to attach to every test.
 */
export function stampRunBy(extra = {}) {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.annotations.push({ type: 'Run by', description: RUN_BY });
    testInfo.annotations.push({ type: 'Run at (ISO)', description: new Date().toISOString() });
    for (const [type, description] of Object.entries(extra)) {
      testInfo.annotations.push({ type, description });
    }
  });
}

/**
 * The per-case traceability annotations every data-driven row carries: which spec sentence the
 * expected value came from, which HW02 case it descends from, and which assertion pattern it uses.
 * Centralised so all three suites annotate identically and the report's traceability table can be
 * generated from the results rather than typed.
 */
export function annotateCase(testInfo, row) {
  testInfo.annotations.push({ type: 'Spec', description: row.spec_ref });
  testInfo.annotations.push({ type: 'HW02 case', description: row.hw02_ref });
  testInfo.annotations.push({ type: 'Assertion pattern', description: row.assertion });
}
