/**
 * Page Object — EShop web storefront home / product listing (FR-05).
 *
 * Locator policy: role-, label- and text-based locators only. Tailwind utility classes
 * (`.border`, `.bg-blue-600`, `.grid`) are styling, not contract — binding tests to them
 * makes a restyle look like a regression. Where structure is unavoidable (a card is a plain
 * <div>), the card is identified by the product heading it CONTAINS, which is contract.
 */
export class HomePage {
  constructor(page) {
    this.page = page;

    this.pageHeading = page.getByRole('heading', { name: 'Danh sách sản phẩm' });
    this.searchInput = page.getByPlaceholder('Tìm kiếm...');
    this.searchButton = page.getByRole('button', { name: 'Tìm' });

    // One <h2> per product card == the product name.
    this.productNames = page.getByRole('heading', { level: 2 });

    // The echo region: "Kết quả tìm kiếm cho: <term>".
    this.searchEcho = page.getByText('Kết quả tìm kiếm cho:');

    // Spec-required states (FR-05 R5 / R6). Matched by meaning, not by implementation:
    // any reasonable wording is accepted, so a genuine implementation would pass.
    this.loadingState = page.getByText(/đang tải|loading|vui lòng chờ/i);
    this.emptyState = page.getByText(
      /không tìm thấy|không có kết quả|không có sản phẩm|no results|trống/i,
    );

    this.allH1 = page.locator('h1');
  }

  async open() {
    await this.page.goto('/');
    await this.pageHeading.waitFor();
  }

  /** Type a term and submit the search form. */
  async search(term) {
    await this.searchInput.fill(term);
    await this.searchButton.click();
  }

  /**
   * Submit a search and wait for the products request it triggers, so assertions run
   * against settled results instead of a timing guess (no waitForTimeout anywhere).
   */
  async searchAndWait(term) {
    const response = this.page.waitForResponse(
      (r) => r.url().includes('/api/products') && r.request().method() === 'GET',
    );
    await this.search(term);
    return response;
  }

  /** The card element for a product = the innermost <div> containing that product's heading. */
  card(name) {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByRole('heading', { level: 2, name, exact: true }) })
      .last();
  }

  /** Visible product names, in DOM order. */
  async visibleProductNames() {
    return (await this.productNames.allTextContents()).map((t) => t.trim());
  }

  /** The price text inside a card (currency symbol included, whatever it happens to be). */
  priceOf(name) {
    return this.card(name).getByText(/(₫|VND|đ)/);
  }

  /**
   * Product images. `<img alt="">` is treated as decorative and is NOT exposed with role="img",
   * so this must use the tag — using getByRole('img') here would silently find nothing and make
   * the alt-text check pass vacuously.
   */
  images() {
    return this.page.locator('img');
  }

  /** Delay the products API so a transient loading state becomes observable (FR-05 R5). */
  async throttleProductsApi(ms = 1500) {
    await this.page.route('**/api/products*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      await route.continue();
    });
  }
}
