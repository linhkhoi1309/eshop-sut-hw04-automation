/**
 * Page Object — EShop Web Admin (FR-12 access control, FR-14 category CRUD).
 *
 * The admin app is a single SPA with tab navigation and no routing, so "navigation" means
 * clicking a sidebar item. Locators are role/text/placeholder based; the login form has no
 * labels wired to its inputs, so placeholders are the contract available.
 */
export class AdminPage {
  constructor(page) {
    this.page = page;

    this.loginHeading = page.getByRole('heading', { name: 'Admin Login' });
    this.emailInput = page.getByPlaceholder('Email');
    this.passwordInput = page.getByPlaceholder('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });

    this.categoriesTab = page.getByText('Danh mục', { exact: true });
    this.productsTab = page.getByText('Sản phẩm', { exact: true });
    this.categoriesHeading = page.getByRole('heading', { name: 'Quản lý Danh mục' });

    this.newCategoryInput = page.getByPlaceholder('Tên danh mục mới');
    this.addCategoryButton = page.getByRole('button', { name: 'Thêm mới' });

    this.categoryTable = page.getByRole('table');
    this.categoryRows = this.categoryTable.locator('tbody tr');
  }

  /**
   * The admin SPA is on its own origin, so it cannot use the config's `baseURL`
   * (which points at the storefront). ADMIN_URL keeps the port configurable in one place.
   */
  async open(baseUrl = process.env.ADMIN_URL ?? 'http://localhost:5174/') {
    await this.page.goto(baseUrl);
  }

  async login(email = 'admin@eshop.com', password = 'Admin123!') {
    await this.open();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async openCategories() {
    await this.categoriesTab.click();
    await this.categoriesHeading.waitFor();
  }

  /** Submit the "add category" form and wait for the resulting list refresh. */
  async addCategory(name) {
    const post = this.page.waitForResponse(
      (r) => r.url().includes('/api/categories') && r.request().method() === 'POST',
      { timeout: 10_000 },
    ).catch(() => null); // an empty name may legitimately never reach the network

    await this.newCategoryInput.fill(name);
    await this.addCategoryButton.click();
    return post;
  }

  /** The table row whose name cell matches exactly. */
  row(name) {
    return this.categoryRows.filter({ has: this.page.getByRole('cell', { name, exact: true }) });
  }

  async deleteCategory(name) {
    const del = this.page.waitForResponse(
      (r) => r.url().includes('/api/categories') && r.request().method() === 'DELETE',
      { timeout: 10_000 },
    );
    await this.row(name).getByRole('button', { name: 'Xóa' }).click();
    return del;
  }

  async categoryNames() {
    const cells = await this.categoryRows.locator('td:nth-child(2)').allTextContents();
    return cells.map((c) => c.trim());
  }
}
