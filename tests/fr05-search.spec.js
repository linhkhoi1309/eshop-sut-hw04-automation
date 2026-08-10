import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/home.page.js';
import { readCsv, splitList } from '../utils/csv.js';
import { stampRunBy, annotateCase } from './_hooks.js';

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

stampRunBy();

test.describe('Product listing & search', { tag: '@FR-05' }, () => {
  for (const row of cases) {
    test(`${row.id} [${row.type}] ${row.description} (${row.spec_ref})`, async ({ page }, testInfo) => {
      annotateCase(testInfo, row);

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

        /** P1 + P6 — an injected tag must be echoed as literal text, not parsed into the DOM (R4). */
        case 'literal_echo': {
          await home.searchAndWait(row.input);
          await expect(home.searchEcho).toBeVisible();

          // Both facts are asserted softly so ONE run reports both halves of the defect:
          // what the user sees, and what actually landed in the DOM. With hard assertions the
          // first failure aborts the test and the bug report loses its strongest evidence.
          const echoText = (await home.searchEcho.innerText()).trim();
          const echoHtml = await home.searchEcho.innerHTML();
          await testInfo.attach(`${row.id}-search-echo.html`, {
            body: echoHtml,
            contentType: 'text/html',
          });

          expect
            .soft(echoText, 'FR-05 R4 / SEC-04: the term must be displayed as literal text')
            .toContain(row.input);

          const injected = await home.searchEcho.locator('script, img, b, i, svg').count();
          expect
            .soft(injected, `payload markup was parsed into DOM elements: ${echoHtml}`)
            .toBe(0);
          break;
        }

        /** P7 — page/JS state: an active payload must never execute (R4, SEC-04). */
        case 'no_script_exec': {
          await home.searchAndWait(row.input);
          await expect(home.searchEcho).toBeVisible();

          // The payload sets window.__xssExecuted from an onerror handler. A flag is used
          // instead of alert() on purpose: a native dialog would block the whole run.
          const executed = await page.evaluate(() => Boolean(window.__xssExecuted));
          expect(executed, 'attacker-controlled JS executed from the search term').toBe(false);
          break;
        }

        /** P6 — soft assertions: report every currency defect in one go (R2, FR-21). */
        case 'price_format': {
          const names = await home.visibleProductNames();
          expect(names.length).toBe(Number(row.expected_count));

          for (const name of names) {
            const priceText = (await home.priceOf(name).innerText()).trim();
            expect.soft(priceText, `FR-21: "${name}" price must use the ₫ symbol`).toMatch(/₫/);
            expect
              .soft(priceText, `FR-05 R2: "${name}" price must use thousand separators`)
              .toMatch(/\d{1,3}([.,]\d{3})+/);
          }
          break;
        }

        /** P2 — exactly one <h1>, in the listing state and after searching (R7). */
        case 'single_h1': {
          await expect(home.allH1, 'FR-05 R7: home page must have exactly one <h1>').toHaveCount(1);
          await home.searchAndWait(row.input);
          await expect(
            home.allH1,
            'FR-05 R7: still exactly one <h1> after a search',
          ).toHaveCount(1);
          break;
        }

        /** P4 — attribute assertion: every product image needs a descriptive alt (R2, FR-24). */
        case 'alt_text': {
          const images = home.images();
          await expect(images).toHaveCount(Number(row.expected_count));

          for (let i = 0; i < Number(row.expected_count); i++) {
            const alt = await images.nth(i).getAttribute('alt');
            expect.soft(alt, `FR-24: image #${i + 1} must have a non-empty alt`).toBeTruthy();
          }
          break;
        }

        /** P3 — visibility of a transient state, made observable by throttling the API (R5). */
        case 'loading_state': {
          await home.throttleProductsApi(1500);
          await home.search(row.input);
          await expect(
            home.loadingState,
            'FR-05 R5: a loading state must be shown while products are being fetched',
          ).toBeVisible();
          break;
        }

        default:
          throw new Error(`Unhandled expected_behavior "${row.expected_behavior}" for ${row.id}`);
      }
    });
  }
});
