import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { CheckoutPage } from '../pages/checkout.page.js';
import { loginViaToken, addToCartAndOpenCheckout } from '../fixtures/eshop.fixtures.js';
import { RUN_BY } from '../playwright.config.js';

/**
 * FR-09 — Discount coupons at checkout.
 *
 * Data-driven from data/fr09-coupons.json: code, order total, login state and the
 * spec-derived expected discount/final all come from the file.
 *
 * Oracle = README.md §FR-09 (five conditions + the two discount formulas). Expected values are
 * computed from the spec, never read back from the app. See docs/fr09/R1-behaviours.md.
 */
const cases = JSON.parse(readFileSync('data/fr09-coupons.json', 'utf8'));

test.beforeEach(async ({}, testInfo) => {
  testInfo.annotations.push({ type: 'Run by', description: RUN_BY });
  testInfo.annotations.push({ type: 'Run at (ISO)', description: new Date().toISOString() });
});

test.describe('@FR-09 Discount coupons', () => {
  for (const row of cases) {
    test(`${row.id} [${row.type}] ${row.description} (${row.spec_ref})`, async ({ page }, testInfo) => {
      testInfo.annotations.push({ type: 'Spec', description: row.spec_ref });
      testInfo.annotations.push({ type: 'HW02 case', description: row.hw02_ref });
      testInfo.annotations.push({ type: 'Assertion pattern', description: row.assertion });

      if (row.loggedIn) await loginViaToken(page);
      await addToCartAndOpenCheckout(page);

      const checkout = new CheckoutPage(page);
      await checkout.setTotal(row.total);

      // P5 — network assertion: the API answer is captured alongside the UI result, so a
      // discrepancy between what the server computed and what the page shows is visible.
      const response = await checkout.applyCoupon(row.code);
      const apiBody = await response.json().catch(() => null);
      await testInfo.attach(`${row.id}-apply-coupon-response.json`, {
        body: JSON.stringify({ status: response.status(), body: apiBody }, null, 2),
        contentType: 'application/json',
      });

      if (row.expect.outcome === 'applied') {
        // P3 — the success block must be shown at all.
        await expect(
          checkout.successMessage,
          `FR-09: ${row.code} at total ${row.total} must be accepted (${row.spec_ref})`,
        ).toBeVisible();

        // P1 — the discount and final amounts must equal the spec formula's result.
        expect(
          await checkout.savedValue(),
          `discount for ${row.code} on ${row.total} (spec: ${row.expect.discount})`,
        ).toBe(row.expect.discount);

        expect(
          await checkout.finalValue(),
          `final amount for ${row.code} on ${row.total} (spec: ${row.expect.final})`,
        ).toBe(row.expect.final);

        // The headline the customer pays must agree with the panel.
        expect(await checkout.headlineValue()).toBe(row.expect.final);
      } else {
        // P3 + P1 — refusal must be visible and must say why.
        await expect(
          checkout.errorMessage,
          `FR-09: ${row.code} at total ${row.total} must be refused (${row.spec_ref})`,
        ).toBeVisible();

        if (row.expect.messagePattern) {
          await expect(checkout.errorMessage).toHaveText(new RegExp(row.expect.messagePattern, 'i'));
        }

        // ...and no discount may be displayed.
        await expect(checkout.successMessage).toBeHidden();
      }
    });
  }
});
