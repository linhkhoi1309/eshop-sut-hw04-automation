/**
 * Page Object — checkout / coupon panel (FR-09, FR-08 context).
 *
 * Locator policy as in home.page.js: roles, labels and placeholders only.
 */
export class CheckoutPage {
  constructor(page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Xác Nhận Đơn Hàng' });

    // <input type="number"> exposes role="spinbutton".
    this.totalInput = page.getByRole('spinbutton');

    this.couponInput = page.getByPlaceholder('Nhập mã giảm giá...');
    this.applyButton = page.getByRole('button', { name: 'Áp dụng' });
    this.confirmButton = page.getByRole('button', { name: 'Xác Nhận Thanh Toán' });

    this.successMessage = page.getByText('✅');
    this.savedAmount = page.getByText(/Tiết kiệm:/);
    this.finalAmount = page.getByText(/Thành tiền:/);
    this.headlineTotal = page.getByText(/Tổng thanh toán:/);
  }

  async open() {
    await this.page.goto('/checkout');
    await this.heading.waitFor();
  }

  /**
   * Drive the order total. FR-08 says this field should not exist (the total must be computed);
   * it is the only UI handle that can reach the FR-09 C3 boundaries, so its absence is treated
   * as a hard failure rather than silently testing against a total of 0.
   * See docs/fr09/R1-behaviours.md.
   */
  async setTotal(amount) {
    const count = await this.totalInput.count();
    if (count === 0) {
      throw new Error(
        'Checkout no longer exposes an editable total. The FR-09 boundary cases need a new way ' +
          'to reach an exact order total (seed a product priced at the threshold).',
      );
    }
    await this.totalInput.fill(String(amount));
  }

  /** Apply a coupon and return the API response, so the UI and the API can be cross-checked. */
  async applyCoupon(code) {
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/api/apply-coupon'),
      { timeout: 10_000 },
    );
    await this.couponInput.fill(code);
    await this.applyButton.click();
    return responsePromise;
  }

  /** Error text shown when a coupon is refused. */
  get errorMessage() {
    return this.page.getByText(
      /không tồn tại|hết hạn|tối thiểu|ngưỡng|chưa đủ|giới hạn|đăng nhập|không thể áp dụng/i,
    );
  }

  /** Digits out of a money string: "50,000 ₫" -> 50000, "-4,500,000 ₫" -> -4500000. */
  static parseMoney(text) {
    const match = String(text).match(/-?\s?\d[\d.,\s]*/);
    if (!match) return NaN;
    return Number(match[0].replace(/[.,\s]/g, ''));
  }

  async savedValue() {
    return CheckoutPage.parseMoney(await this.savedAmount.innerText());
  }

  async finalValue() {
    return CheckoutPage.parseMoney(await this.finalAmount.innerText());
  }

  async headlineValue() {
    return CheckoutPage.parseMoney(await this.headlineTotal.innerText());
  }
}
