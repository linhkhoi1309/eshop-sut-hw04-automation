/**
 * Capture one curated screenshot per reported defect -> evidence/bug-NN.png.
 *
 * Playwright already saves a failure screenshot per red test, but those are whole-viewport
 * shots taken at the moment of the assertion, which is not always where the defect is legible.
 * §6 makes a screenshot mandatory per bug, so each one is staged deliberately here: reach the
 * defective state, then shoot the element that shows it.
 *
 * Every shot is taken against a freshly reseeded database.
 *
 * Usage: node scripts/capture-evidence.mjs   (run from the repo root, services up)
 */
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { API, apiLogin, SEED_USER } from '../fixtures/eshop.fixtures.js';
import { AdminPage } from '../pages/admin.page.js';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:5174';
const OUT = 'evidence';

mkdirSync(OUT, { recursive: true });
execSync('node backend/database.js', { stdio: 'ignore' });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const done = [];

/** Shoot `locator` if given, else the viewport. */
async function shot(page, id, locator) {
  const path = `${OUT}/${id}.png`;
  await (locator ?? page).screenshot({ path });
  done.push(path);
  console.log(`captured ${path}`);
}

/**
 * A logged-in admin page in its OWN context.
 *
 * The admin SPA keeps its JWT in localStorage, so a second scenario reusing the shared context
 * lands straight on the dashboard and the login form is never rendered — `getByPlaceholder('Email')`
 * then waits forever. One context per admin scenario keeps each shot independent.
 */
async function newAdminPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const admin = new AdminPage(page);
  await admin.login();
  await admin.openCategories();
  return { context, page, admin };
}

async function searchPage(term) {
  const page = await ctx.newPage();
  await page.goto(WEB);
  await page.getByRole('heading', { name: 'Danh sách sản phẩm' }).waitFor();
  // Arm the wait BEFORE the click: the local API answers in ~20 ms, so registering the
  // listener afterwards races the response and times out.
  const settled = page.waitForResponse(
    (r) => r.url().includes('/api/products') && r.request().method() === 'GET',
  );
  await page.getByPlaceholder('Tìm kiếm...').fill(term);
  await page.getByRole('button', { name: 'Tìm' }).click();
  await settled;
  return page;
}

// ---------------------------------------------------------------- FR-09

/** BUG-01 — percent coupon inverts the formula: 500 000 becomes 5 000 000. */
{
  const page = await ctx.newPage();
  const { token } = await apiLogin(SEED_USER);
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  await page.goto(WEB);
  await page
    .locator('div')
    .filter({
      has: page.getByRole('heading', { level: 2, name: 'Bàn phím cơ Keychron Q1', exact: true }),
    })
    .last()
    .getByRole('button', { name: 'Thêm vào giỏ' })
    .click();
  await page.getByRole('link', { name: 'Giỏ hàng' }).click();
  await page.getByRole('button', { name: 'Tiến hành thanh toán' }).click();
  await page.getByRole('heading', { name: 'Xác Nhận Đơn Hàng' }).waitFor();
  await page.getByRole('spinbutton').fill('500000');
  await page.getByPlaceholder('Nhập mã giảm giá...').fill('SAVE10');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await page.getByText('✅').waitFor();
  await shot(page, 'bug-01');
  await page.close();
}

/** BUG-06 — a total exactly equal to min_order_amount is refused. */
{
  const page = await ctx.newPage();
  const { token } = await apiLogin(SEED_USER);
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  await page.goto(`${WEB}/checkout`);
  await page.getByRole('heading', { name: 'Xác Nhận Đơn Hàng' }).waitFor();
  await page.getByRole('spinbutton').fill('300000');
  await page.getByPlaceholder('Nhập mã giảm giá...').fill('SAVE10');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await page.getByText(/tối thiểu/i).waitFor();
  await shot(page, 'bug-06');
  await page.close();
}

/** BUG-05 — the same coupon applies with no token at all (fresh, unauthenticated context). */
{
  const anon = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await anon.newPage();
  await page.goto(`${WEB}/checkout`);
  await page.getByRole('heading', { name: 'Xác Nhận Đơn Hàng' }).waitFor();
  await page.getByRole('spinbutton').fill('400000');
  await page.getByPlaceholder('Nhập mã giảm giá...').fill('SAVE10');
  await page.getByRole('button', { name: 'Áp dụng' }).click();
  await page.getByText('✅').waitFor();
  await shot(page, 'bug-05');
  await anon.close();
}

// ---------------------------------------------------------------- FR-05

/** BUG-02 — `%` is treated as a LIKE wildcard: a search for "%" returns the whole catalogue. */
{
  const page = await searchPage('%');
  await shot(page, 'bug-02');
  await page.close();
}

/** BUG-03 — an injected <img onerror> executes; the flag proves execution, not just injection. */
{
  const page = await searchPage('<img src=x onerror="window.__xssExecuted=true">');
  const executed = await page.evaluate(() => Boolean(window.__xssExecuted));
  console.log(`  BUG-03 window.__xssExecuted = ${executed}`);
  await page.evaluate((v) => {
    const banner = document.createElement('div');
    banner.textContent = `window.__xssExecuted === ${v}  (attacker JS ran)`;
    banner.style.cssText =
      'background:#b3261e;color:#fff;font:16px/1.6 monospace;padding:8px 12px;';
    document.body.prepend(banner);
  }, executed);
  await shot(page, 'bug-03');
  await page.close();
}

/** BUG-09 — a search with no matches shows no empty-state message at all. */
{
  const page = await searchPage('zzzz-not-a-product');
  await shot(page, 'bug-09');
  await page.close();
}

/** BUG-10 / BUG-12 — "VND" instead of ₫, and alt="" on every product image. */
{
  const page = await ctx.newPage();
  await page.goto(WEB);
  await page.getByRole('heading', { name: 'Danh sách sản phẩm' }).waitFor();
  const card = page
    .locator('div')
    .filter({ has: page.getByRole('heading', { level: 2, name: 'MacBook Pro M3', exact: true }) })
    .last();
  await shot(page, 'bug-10', card);

  const alts = await page.locator('img').evaluateAll((imgs) =>
    imgs.map((i) => `${i.getAttribute('src')?.slice(0, 40)} -> alt=${JSON.stringify(i.getAttribute('alt'))}`),
  );
  await page.evaluate((rows) => {
    const box = document.createElement('pre');
    box.textContent = `document.querySelectorAll('img') alt audit:\n${rows.join('\n')}`;
    box.style.cssText =
      'background:#10243f;color:#fff;font:13px/1.5 monospace;padding:10px 14px;margin:0;';
    document.body.prepend(box);
  }, alts);
  await shot(page, 'bug-12');

  /** BUG-11 — two <h1> elements on one page. */
  const h1s = await page.locator('h1').allTextContents();
  await page.evaluate((texts) => {
    document.querySelectorAll('h1').forEach((h) => {
      h.style.outline = '3px solid #b3261e';
      h.style.outlineOffset = '2px';
    });
    const box = document.createElement('pre');
    box.textContent = `document.querySelectorAll('h1').length === ${texts.length}\n${texts
      .map((t, i) => `  [${i + 1}] ${t}`)
      .join('\n')}`;
    box.style.cssText =
      'background:#10243f;color:#fff;font:13px/1.5 monospace;padding:10px 14px;margin:0;';
    document.body.prepend(box);
  }, h1s);
  await shot(page, 'bug-11', undefined);
  await page.close();
}

/** BUG-13 — no loading indicator, shown with the products API throttled by 3 s. */
{
  const page = await ctx.newPage();
  await page.route('**/api/products*', async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  await page.goto(WEB);
  await page.getByRole('heading', { name: 'Danh sách sản phẩm' }).waitFor();
  await page.evaluate(() => {
    const box = document.createElement('div');
    box.textContent =
      'GET /api/products throttled to 3 s — no loading indicator is rendered during the wait';
    box.style.cssText = 'background:#b3261e;color:#fff;font:15px/1.6 monospace;padding:8px 12px;';
    document.body.prepend(box);
  });
  await shot(page, 'bug-13');
  await page.close();
}

// ---------------------------------------------------------------- FR-14

/** BUG-07 — an empty name and a whitespace-only name are both stored. */
{
  const { context, page, admin } = await newAdminPage();

  for (const name of ['', '   ']) await admin.addCategory(name);

  // Reload so the table is read back from the server, not from local component state:
  // the point of the shot is that these rows were *persisted*.
  await page.reload();
  await admin.openCategories();
  await shot(page, 'bug-07', admin.categoryTable);
  await context.close();
}

/** BUG-08 — deleting a populated category orphans its products. */
{
  execSync('node backend/database.js', { stdio: 'ignore' });
  const before = await (await fetch(`${API}/api/products`)).json();
  const victim = 2; // Laptop — has products in the seed data

  const { context, page, admin } = await newAdminPage();
  await admin.deleteCategory('Laptop');

  const categories = await (await fetch(`${API}/api/categories`)).json();
  const after = await (await fetch(`${API}/api/products`)).json();
  const validIds = new Set(categories.map((c) => c.id));
  const orphans = after.filter((p) => p.category_id !== null && !validIds.has(p.category_id));

  await page.evaluate(
    ({ victimId, orphanRows, catIds }) => {
      const box = document.createElement('pre');
      box.textContent =
        `DELETE /api/categories/${victimId} -> 200\n` +
        `categories now: [${catIds.join(', ')}]\n` +
        `products still pointing at a category that no longer exists: ${orphanRows.length}\n` +
        orphanRows.map((p) => `  #${p.id} ${p.name} -> category_id=${p.category_id}`).join('\n');
      box.style.cssText =
        'background:#b3261e;color:#fff;font:13px/1.5 monospace;padding:10px 14px;margin:0;';
      document.body.prepend(box);
    },
    {
      victimId: victim,
      orphanRows: orphans.map((p) => ({ id: p.id, name: p.name, category_id: p.category_id })),
      catIds: categories.map((c) => c.id),
    },
  );
  console.log(`  BUG-08 orphaned products: ${orphans.length} of ${before.length}`);
  await shot(page, 'bug-08');
  await context.close();
}

/** BUG-04 — a plain user's token creates a category; the row then shows in the admin panel. */
{
  execSync('node backend/database.js', { stdio: 'ignore' });
  const { token, user } = await apiLogin(SEED_USER);
  const res = await fetch(`${API}/api/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'TAO-BOI-USER-THUONG' }),
  });
  const body = await res.json();

  const { context, page } = await newAdminPage();
  await page.evaluate(
    ({ status, json, role, email }) => {
      const box = document.createElement('pre');
      box.textContent =
        `POST /api/categories with the token of ${email} (role=${role})\n` +
        `HTTP ${status} ${JSON.stringify(json)}\n` +
        `expected 403 per FR-12 / SEC-03`;
      box.style.cssText =
        'background:#b3261e;color:#fff;font:13px/1.5 monospace;padding:10px 14px;margin:0;';
      document.body.prepend(box);
    },
    { status: res.status, json: body, role: user?.role, email: SEED_USER.email },
  );
  await shot(page, 'bug-04');
  await context.close();
}

await browser.close();
execSync('node backend/database.js', { stdio: 'ignore' }); // leave the DB clean
console.log(`\n${done.length} evidence screenshots written to ${OUT}/`);
