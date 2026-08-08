import { test, expect } from '@playwright/test';
import { RUN_BY } from '../playwright.config.js';

/**
 * Phase-0 smoke test — proves the toolchain end to end before any real feature work:
 * all three browser engines launch, the SUT is reachable, and the HTML report is stamped.
 * Deleted once the FR-05/FR-09/FR-14 suites exist.
 */
test.beforeEach(async ({}, testInfo) => {
  testInfo.annotations.push({ type: 'Run by', description: RUN_BY });
  testInfo.annotations.push({ type: 'Run at (ISO)', description: new Date().toISOString() });
});

test.describe('@SMOKE Phase 0 environment', () => {
  test('web frontend serves the product listing', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Danh sách sản phẩm' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5);
  });

  test('admin frontend serves the login form', async ({ page }) => {
    await page.goto('http://localhost:5174/');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  test('backend API returns the seeded catalogue', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/products');
    expect(res.status()).toBe(200);
    expect(await res.json()).toHaveLength(5);
  });
});
