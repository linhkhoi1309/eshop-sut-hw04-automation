import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { CheckoutPage } from '../pages/checkout.page.js';
import {
  loginViaToken,
  addToCartAndOpenCheckout,
  seedCouponUsage,
  couponIdByCode,
} from '../fixtures/eshop.fixtures.js';
import { stampRunBy, annotateCase } from './_hooks.js';

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

stampRunBy();

test.describe('Discount coupons', { tag: '@FR-09' }, () => {
  for (const row of cases) {
    test(`${row.id} [${row.type}] ${row.description} (${row.spec_ref})`, async ({ page }, testInfo) => {
      annotateCase(testInfo, row);

      let token;
      if (row.loggedIn) ({ token } = await loginViaToken(page));

      // C5 needs prior state, seeded through the API so the case is repeatable from a fresh DB.
      if (row.seedUsage) {
        const couponId = await couponIdByCode(row.seedUsage.code);
        await seedCouponUsage(token, couponId, row.seedUsage.times);
      }

      const checkout = new CheckoutPage(page);

      if (row.loggedIn) {
        await addToCartAndOpenCheckout(page);
      } else {
        // A guest cannot reach checkout through the cart (it alerts and redirects to login),
        // so C4 is exercised by opening the page directly. The cart is empty either way; the
        // total is set explicitly below, which is what the coupon check consumes.
        await checkout.open();
      }

      await checkout.setTotal(row.total);

      /** B11 — the observable fact is that NO request is made, so watch the network. */
      if (row.mode === 'no_request') {
        let requests = 0;
        page.on('request', (r) => {
          if (r.url().includes('/api/apply-coupon')) requests++;
        });

        await checkout.couponInput.fill(row.code);
        await expect(
          checkout.applyButton,
          'FR-09: Apply must stay disabled while the coupon field is empty',
        ).toBeDisabled();
        expect(requests, 'no /api/apply-coupon request may be sent for an empty code').toBe(0);
        return;
      }

      /** B15 — changing the total must not leave a stale discount on screen (FR-08). */
      if (row.mode === 'clear_on_total_change') {
        await checkout.applyCoupon(row.code);
        await expect(checkout.successMessage).toBeVisible();

        await checkout.setTotal(row.newTotal);
        await expect(
          checkout.successMessage,
          'FR-08: a stale discount must not survive a change of the order total',
        ).toBeHidden();
        expect(await checkout.headlineValue()).toBe(row.newTotal);
        return;
      }

      /** B16 — the page must render exactly what the API computed. */
      if (row.mode === 'ui_matches_api') {
        const apiResponse = await checkout.applyCoupon(row.code);
        const body = await apiResponse.json();
        await expect(checkout.successMessage).toBeVisible();
        expect(
          await checkout.finalValue(),
          'the displayed total must equal the API final_amount',
        ).toBe(body.final_amount);
        expect(await checkout.headlineValue()).toBe(body.final_amount);
        return;
      }

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
        // Amounts are asserted only when the case states them: B12 exists to check that a
        // lower-case code is accepted at all, and asserting the (separately broken) formula
        // there would blur which defect the case is reporting.
        if (row.expect.discount !== undefined) {
          expect(
            await checkout.savedValue(),
            `discount for ${row.code} on ${row.total} (spec: ${row.expect.discount})`,
          ).toBe(row.expect.discount);
        }

        if (row.expect.final !== undefined) {
          expect(
            await checkout.finalValue(),
            `final amount for ${row.code} on ${row.total} (spec: ${row.expect.final})`,
          ).toBe(row.expect.final);

          // The headline the customer pays must agree with the panel.
          expect(await checkout.headlineValue()).toBe(row.expect.final);
        }
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
