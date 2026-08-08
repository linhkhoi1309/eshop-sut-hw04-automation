import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/home.page.js';
import { readCsv, splitList } from '../utils/csv.js';
import { RUN_BY } from '../playwright.config.js';

/**
 * FR-05 — Product listing & search (web storefront).
 *
 * Data-driven: every case, its input AND its expected result live in
 * `data/fr05-search.csv`. This file only supplies the mechanics for each
 * `expected_behavior`, so adding a case means adding a CSV row.
 *
 * Oracle = README.md (the SRS). A failing assertion is a candidate defect in the SUT,
 * never a licence to weaken the assertion. See docs/fr05/R1-behaviours.md and R2-cases.md.
 */
const cases = readCsv('data/fr05-search.csv');

test.beforeEach(async ({}, testInfo) => {
  testInfo.annotations.push({ type: 'Run by', description: RUN_BY });
  testInfo.annotations.push({ type: 'Run at (ISO)', description: new Date().toISOString() });
});

test.describe('@FR-05 Product listing & search', () => {
  for (const row of cases) {
    test(`${row.id} [${row.type}] ${row.description} (${row.spec_ref})`, async ({ page }, testInfo) => {
      testInfo.annotations.push({ type: 'Spec', description: row.spec_ref });
      testInfo.annotations.push({ type: 'HW02 case', description: row.hw02_ref });
      testInfo.annotations.push({ type: 'Assertion pattern', description: row.assertion });

      const home = new HomePage(page);
      await home.open();

      switch (row.expected_behavior) {
        /** P2 — count assertion: the full catalogue is listed on load (R1). */
        case 'grid_all': {
          await expect(home.productNames).toHaveCount(Number(row.expected_count));
          break;
        }

        /** P1 + P4 + P6 — a card carries image, name and price (R2). */
        case 'card_fields': {
          const name = splitList(row.expected_names)[0];
          const card = home.card(name);
          await expect(card).toBeVisible();
          await expect(card).toContainText(name);
          await expect(card.locator('img')).toHaveCount(1);
          await expect(home.priceOf(name)).toBeVisible();
          break;
        }

        /** P2 — searching filters the grid to the literally matching names (R3, SEC-05). */
        case 'result_count': {
          await home.searchAndWait(row.input);
          await expect(home.productNames).toHaveCount(Number(row.expected_count));

          const expectedNames = splitList(row.expected_names);
          if (expectedNames.length) {
            expect(await home.visibleProductNames()).toEqual(expectedNames);
          }
          break;
        }

        /** P2 + P3 — no matches must yield 0 cards AND an empty-state message (R6). */
        case 'empty_state': {
          await home.searchAndWait(row.input);
          await expect(home.productNames).toHaveCount(Number(row.expected_count));
          await expect(
            home.emptyState,
            'FR-05 R6: a no-result search must show an empty-state message',
          ).toBeVisible();
          break;
        }

        default:
          throw new Error(`Unhandled expected_behavior "${row.expected_behavior}" for ${row.id}`);
      }
    });
  }
});
