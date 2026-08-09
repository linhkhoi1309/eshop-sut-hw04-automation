import { request as playwrightRequest } from '@playwright/test';

export const API = process.env.API_URL ?? 'http://localhost:3000';

export const SEED_USER = { email: 'test@eshop.com', password: 'Test1234!' };
export const SEED_ADMIN = { email: 'admin@eshop.com', password: 'Admin123!' };

/** Log in through the API and return { token, user }. */
export async function apiLogin({ email, password } = SEED_USER) {
  const ctx = await playwrightRequest.newContext({ baseURL: API });
  const res = await ctx.post('/api/login', { data: { email, password } });
  if (!res.ok()) throw new Error(`login failed for ${email}: HTTP ${res.status()}`);
  const body = await res.json();
  await ctx.dispose();
  return { token: body.token, user: body.user };
}

/**
 * Authenticate the browser session the way the app itself does: put the JWT in
 * localStorage before any page script runs, so AuthContext picks it up on boot.
 *
 * Deliberately not driving the login form: it carries its own FR-01/FR-02/FR-22 defects
 * (heading "Đăng Ký", field labelled "Username", password rendered as type="text"), and
 * FR-09 results must not depend on them. See docs/fr09/R1-behaviours.md.
 */
export async function loginViaToken(page, credentials = SEED_USER) {
  const { token, user } = await apiLogin(credentials);
  await page.addInitScript((t) => window.localStorage.setItem('token', t), token);
  return { token, user };
}

/** Record N prior uses of a coupon for the logged-in user (fixture for the C5 limit case). */
export async function seedCouponUsage(token, couponId, times) {
  const ctx = await playwrightRequest.newContext({ baseURL: API });
  for (let i = 0; i < times; i++) {
    const res = await ctx.post('/api/coupon-usage', {
      data: { coupon_id: couponId },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok()) throw new Error(`seeding coupon usage failed: HTTP ${res.status()}`);
  }
  await ctx.dispose();
}

/** Look up a coupon id by code (admin listing). */
export async function couponIdByCode(code) {
  const { token } = await apiLogin(SEED_ADMIN);
  const ctx = await playwrightRequest.newContext({ baseURL: API });
  const res = await ctx.get('/api/coupons', { headers: { Authorization: `Bearer ${token}` } });
  const coupons = await res.json();
  await ctx.dispose();
  const found = coupons.find?.((c) => c.code === code);
  if (!found) throw new Error(`coupon ${code} not found in the seed data`);
  return found.id;
}

/**
 * Put a product in the cart and land on checkout using CLIENT-SIDE navigation only.
 *
 * The cart lives in React state (CartContext has no persistence), so any full page load —
 * including page.goto('/checkout') — empties it. Every cart-dependent journey must click
 * through Home -> Giỏ hàng -> Tiến hành thanh toán.
 */
export async function addToCartAndOpenCheckout(page, productName = 'Bàn phím cơ Keychron Q1') {
  await page.goto('/');
  const card = page
    .locator('div')
    .filter({ has: page.getByRole('heading', { level: 2, name: productName, exact: true }) })
    .last();
  await card.getByRole('button', { name: 'Thêm vào giỏ' }).click();

  await page.getByRole('link', { name: 'Giỏ hàng' }).click();
  await page.getByRole('button', { name: 'Tiến hành thanh toán' }).click();
  await page.getByRole('heading', { name: 'Xác Nhận Đơn Hàng' }).waitFor();
}
