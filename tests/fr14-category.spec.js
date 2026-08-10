import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { AdminPage } from '../pages/admin.page.js';
import {
  API,
  SEED_USER,
  apiLogin,
  listCategories,
  listProducts,
  deleteCategoryByName,
} from '../fixtures/eshop.fixtures.js';
import { stampRunBy, annotateCase } from './_hooks.js';

/**
 * FR-14 — Category management (CRUD) in the Web Admin.
 *
 * Data-driven from data/fr14-categories.json. Oracle = README.md §FR-14, plus FR-12/SEC-03
 * for the write-authorisation rules and SEC-04 for safe rendering.
 * See docs/fr14/R1-behaviours.md and R2-cases.md.
 */
const cases = JSON.parse(readFileSync('data/fr14-categories.json', 'utf8'));

/** Names created by a run are suffixed so repeated runs never collide. */
const SUFFIX = ` __t${Date.now()}`;
const created = new Set();

function buildName(row) {
  if (row.nameRepeat) {
    const { text, length } = row.nameRepeat;
    return text.repeat(Math.ceil(length / text.length)).slice(0, length);
  }
  // Empty / whitespace-only names must stay exactly as specified — suffixing them
  // would destroy the very property under test.
  if (row.name === '' || row.name.trim() === '') return row.name;
  if (row.mode === 'create_duplicate') return row.name;
  return row.name + SUFFIX;
}

stampRunBy();

test.afterAll(async () => {
  for (const name of created) await deleteCategoryByName(name).catch(() => {});
});

test.describe('Category management (admin)', { tag: '@FR-14' }, () => {
  for (const row of cases) {
    test(`${row.id} [${row.type}] ${row.description} (${row.spec_ref})`, async ({ page, request }, testInfo) => {
      annotateCase(testInfo, row);

      const admin = new AdminPage(page);
      const name = row.name !== undefined || row.nameRepeat ? buildName(row) : undefined;

      switch (row.mode) {
        /** P1 + P2 — the seeded categories are listed with the specified columns. */
        case 'list_seeded': {
          await admin.login();
          await admin.openCategories();
          for (const expected of row.expectedNames) {
            await expect(admin.row(expected)).toHaveCount(1);
          }
          await expect(admin.categoryTable).toContainText('Tên Danh Mục');
          await expect(admin.categoryTable).toContainText('Hành động');
          break;
        }

        /** P1 + P2 — valid names are created; invalid ones must be refused (R1, R2). */
        case 'create': {
          await admin.login();
          await admin.openCategories();
          const countBefore = (await listCategories()).length;

          const post = await admin.addCategory(name);

          if (row.expect.outcome === 'created') {
            created.add(name);
            await expect(
              admin.row(name),
              `FR-14 R1: "${name.slice(0, 40)}…" should appear in the table`,
            ).toHaveCount(1);
          } else {
            /**
             * "Nothing happened" must NOT be asserted against the DOM alone: a web-first
             * assertion on an unchanged count matches immediately, before the list refreshes,
             * so it passes even when the row is being created. The server is the source of
             * truth here, checked after the request has settled.
             */
            if (post) {
              await testInfo.attach(`${row.id}-response.txt`, {
                body: `HTTP ${post.status()}\n${await post.text()}`,
                contentType: 'text/plain',
              });
              expect
                .soft(
                  post.status(),
                  `FR-14 R2: the API must reject a blank name (sent ${JSON.stringify(name)})`,
                )
                .toBeGreaterThanOrEqual(400);
              if (post.ok()) created.add(name); // clean up what the SUT wrongly created
            }

            const countAfter = (await listCategories()).length;
            expect(
              countAfter,
              `FR-14 R2: a refused create must not add a category (name=${JSON.stringify(name)})`,
            ).toBe(countBefore);
          }
          break;
        }

        /** Spec-undefined — run it, record the outcome, assert nothing. */
        case 'create_duplicate': {
          await admin.login();
          await admin.openCategories();
          const before = await admin.categoryNames();
          await admin.addCategory(name);
          await expect(admin.categoryTable).toBeVisible();
          const after = await admin.categoryNames();

          const duplicates = after.filter((n) => n === name).length;
          await testInfo.attach(`${row.id}-duplicate-probe.txt`, {
            body:
              `FR-14 says nothing about name uniqueness, so no verdict is asserted.\n` +
              `before: ${before.length} rows, after: ${after.length} rows, ` +
              `rows named "${name}": ${duplicates}\n` +
              `Observed: the duplicate was ${duplicates > 1 ? 'ACCEPTED' : 'not created'}.`,
            contentType: 'text/plain',
          });
          if (duplicates > 1) created.add(name); // clean up what the probe created
          break;
        }

        /** SEC-04 — markup in a name must render as literal text. */
        case 'create_markup': {
          await admin.login();
          await admin.openCategories();
          await admin.addCategory(name);
          created.add(name);

          const rowLocator = admin.row(name);
          await expect(rowLocator, 'the name must be shown verbatim').toHaveCount(1);
          await expect(
            rowLocator.locator('b, i, script, img'),
            'SEC-04: markup in a category name must not become DOM elements',
          ).toHaveCount(0);
          break;
        }

        /** P2 — a created category can be deleted again. */
        case 'delete_created': {
          await admin.login();
          await admin.openCategories();
          await admin.addCategory(name);
          await expect(admin.row(name)).toHaveCount(1);

          await admin.deleteCategory(name);
          await expect(
            admin.row(name),
            'FR-14 R1: the deleted category must disappear from the table',
          ).toHaveCount(0);
          break;
        }

        /**
         * P5 — deleting a populated category must not orphan its products (FR-15 integrity).
         * The victim is chosen from live data rather than hard-coded, so the case still works
         * on a database where earlier runs already removed a category.
         */
        case 'delete_seeded_with_products': {
          const productsBefore = await listProducts();
          const categoriesBefore = await listCategories();
          const victim = categoriesBefore.find((c) =>
            productsBefore.some((p) => p.category_id === c.id),
          );
          test.skip(!victim, 'no seeded category currently has products');

          await admin.login();
          await admin.openCategories();
          await admin.deleteCategory(victim.name);
          await expect(admin.row(victim.name)).toHaveCount(0);

          const categoriesAfter = await listCategories();
          const validIds = new Set(categoriesAfter.map((c) => c.id));
          const productsAfter = await listProducts();
          const orphans = productsAfter.filter(
            (p) => p.category_id !== null && !validIds.has(p.category_id),
          );

          await testInfo.attach(`${row.id}-orphans.json`, {
            body: JSON.stringify(
              { deleted: victim, orphanCount: orphans.length, orphans },
              null,
              2,
            ),
            contentType: 'application/json',
          });

          expect(
            orphans,
            `FR-15: ${orphans.length} product(s) now reference the deleted category ${victim?.id}`,
          ).toHaveLength(0);
          break;
        }

        /** P1 — the row is stored server-side, not just in local component state. */
        case 'create_then_reload': {
          await admin.login();
          await admin.openCategories();
          await admin.addCategory(name);
          created.add(name);
          await expect(admin.row(name)).toHaveCount(1);

          await page.reload();
          await admin.openCategories();
          await expect(
            admin.row(name),
            'FR-14 R1: the category must persist across a reload',
          ).toHaveCount(1);
          break;
        }

        /** P1 — a new category must be selectable when creating a product (FR-15). */
        case 'create_then_check_product_form': {
          await admin.login();
          await admin.openCategories();
          await admin.addCategory(name);
          created.add(name);
          await expect(admin.row(name)).toHaveCount(1);

          await admin.productsTab.click();
          await expect(
            page.locator('select option', { hasText: name }),
            'FR-15: the new category must be offered in the product form',
          ).toHaveCount(1);
          break;
        }

        /** P5 — SEC-03: a non-admin token must not be able to write categories. */
        case 'api_write_as_user': {
          const { token } = await apiLogin(SEED_USER);
          const res = await request.post(`${API}/api/categories`, {
            data: { name },
            headers: { Authorization: `Bearer ${token}` },
          });
          await testInfo.attach(`${row.id}-response.txt`, {
            body: `HTTP ${res.status()}\n${await res.text()}`,
            contentType: 'text/plain',
          });

          // Clean up if the SUT wrongly accepted it, so the table stays predictable.
          if (res.ok()) created.add(name);

          expect(
            res.status(),
            'FR-12 / SEC-03: a user token must not be allowed to create a category',
          ).toBe(row.expect.status);
          break;
        }

        /** P5 — an unauthenticated delete must be rejected. */
        case 'api_delete_anonymous': {
          const categories = await listCategories();
          const target = categories[categories.length - 1];
          test.skip(!target, 'no category available to attempt an anonymous delete on');

          const res = await request.delete(`${API}/api/categories/${target.id}`);
          await testInfo.attach(`${row.id}-response.txt`, {
            body: `HTTP ${res.status()}\n${await res.text()}`,
            contentType: 'text/plain',
          });
          expect(
            res.status(),
            'FR-12 / SEC-02: deleting a category without a token must be rejected',
          ).toBe(row.expect.status);
          break;
        }

        /** P3 — wrong credentials must not open the admin panel. */
        case 'login_wrong_password': {
          await admin.login('admin@eshop.com', 'SaiMatKhau123!');
          await expect(
            admin.loginHeading,
            'FR-12: a failed login must keep the user on the login form',
          ).toBeVisible();
          await expect(admin.categoriesHeading).toBeHidden();
          break;
        }

        default:
          throw new Error(`Unhandled mode "${row.mode}" for ${row.id}`);
      }
    });
  }
});
