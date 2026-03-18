/**
 * E2E: Multiple stores — complete data isolation test
 *
 * Verifies that two separate tenant stores have complete data isolation:
 * 1. Product catalogs are separate — Store A shows only Store A products
 * 2. Admin orders are isolated — Tenant A admin cannot see Tenant B orders
 * 3. Customer data is isolated — Tenant A admin cannot see Tenant B customers
 * 4. Cart state is store-scoped — adding to Store A cart doesn't affect Store B
 * 5. Admin route access is blocked — Tenant A cannot access Tenant B admin
 * 6. API responses are filtered — network responses only contain tenant-specific data
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration — env-overridable for CI
// ---------------------------------------------------------------------------

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:8080';

const STORE_A_SLUG = process.env.TEST_STORE_A_SLUG || 'willysbo';
const TENANT_A_SLUG = process.env.TEST_TENANT_A_SLUG || 'willysbo';
const TENANT_A_EMAIL = process.env.TEST_TENANT_A_EMAIL || 'alex@gmail.com';
const TENANT_A_PASSWORD = process.env.TEST_TENANT_A_PASSWORD || 'Test123!';

const STORE_B_SLUG = process.env.TEST_STORE_B_SLUG || 'greenleaf';
const TENANT_B_SLUG = process.env.TEST_TENANT_B_SLUG || 'greenleaf';
const TENANT_B_EMAIL = process.env.TEST_TENANT_B_EMAIL || 'demo@greenleaf.com';
const TENANT_B_PASSWORD = process.env.TEST_TENANT_B_PASSWORD || 'Test123!';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearBrowserStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}

async function loginAsAdmin(
  page: Page,
  tenantSlug: string,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(`${BASE_URL}/${tenantSlug}/admin/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/${tenantSlug}/admin/**`, { timeout: 15000 });
}

async function handleAgeVerification(page: Page): Promise<void> {
  const ageModal = page.locator('[data-testid="age-verification-modal"]');
  if (await ageModal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.click('button:has-text("Yes, I am 21+")');
  }
}

async function getProductNames(page: Page): Promise<string[]> {
  await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });
  const cards = page.locator('[data-testid="product-card"]');
  const count = await cards.count();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    // Extract the product name from each card's text content
    const text = await cards.nth(i).textContent();
    if (text) names.push(text.trim());
  }
  return names.filter(Boolean);
}

/** Navigate to a store's product catalog and return visible product names */
async function visitStoreAndGetProducts(page: Page, storeSlug: string): Promise<string[]> {
  await page.goto(`${BASE_URL}/shop/${storeSlug}`);
  await handleAgeVerification(page);

  // Navigate to products page if not on it
  const productsLink = page.locator('a[href*="/products"]').first();
  if (await productsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await productsLink.click();
    await page.waitForLoadState('networkidle');
  }

  return getProductNames(page);
}

// ---------------------------------------------------------------------------
// TEST SUITE: Product Catalog Isolation
// ---------------------------------------------------------------------------
test.describe('Product Catalog Isolation', () => {
  test('Store A and Store B have distinct, non-overlapping product catalogs', async ({
    browser,
  }) => {
    // Open both stores in separate browser contexts (clean sessions)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const storeAProducts = await visitStoreAndGetProducts(pageA, STORE_A_SLUG);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    const storeBProducts = await visitStoreAndGetProducts(pageB, STORE_B_SLUG);

    // Both stores must have products for this test to be meaningful
    expect(storeAProducts.length).toBeGreaterThan(0);
    expect(storeBProducts.length).toBeGreaterThan(0);

    // Catalogs must not be identical
    const catalogsIdentical =
      storeAProducts.length === storeBProducts.length &&
      storeAProducts.every((p, i) => p === storeBProducts[i]);
    expect(catalogsIdentical).toBe(false);

    await contextA.close();
    await contextB.close();
  });

  test('Switching between stores in the same browser shows correct catalog', async ({
    page,
  }) => {
    // Visit Store A
    await page.goto(`${BASE_URL}/shop/${STORE_A_SLUG}`);
    await handleAgeVerification(page);
    const storeAProducts = await getProductNames(page);
    expect(storeAProducts.length).toBeGreaterThan(0);

    // Navigate to Store B in the same tab
    await page.goto(`${BASE_URL}/shop/${STORE_B_SLUG}`);
    await handleAgeVerification(page);
    const storeBProducts = await getProductNames(page);
    expect(storeBProducts.length).toBeGreaterThan(0);

    // Products should be different — Store B didn't inherit Store A's catalog
    const catalogsIdentical =
      storeAProducts.length === storeBProducts.length &&
      storeAProducts.every((p, i) => p === storeBProducts[i]);
    expect(catalogsIdentical).toBe(false);

    // Navigate back to Store A — catalog should be the same as original
    await page.goto(`${BASE_URL}/shop/${STORE_A_SLUG}`);
    await handleAgeVerification(page);
    const storeAProductsAgain = await getProductNames(page);
    expect(storeAProductsAgain).toEqual(storeAProducts);
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE: Cart State Isolation
// ---------------------------------------------------------------------------
test.describe('Cart State Isolation', () => {
  test('Adding items to Store A cart does not affect Store B cart', async ({ page }) => {
    // Visit Store A and add a product to cart
    await page.goto(`${BASE_URL}/shop/${STORE_A_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Click first product to go to detail page
    await page.locator('[data-testid="product-card"]').first().click();
    await page.waitForSelector('[data-testid="add-to-cart-button"]', { timeout: 5000 });
    await page.click('[data-testid="add-to-cart-button"]');

    // Verify Store A cart has at least 1 item
    const cartCountA = page.locator('[data-testid="cart-count"]');
    await expect(cartCountA).toHaveText(/[1-9]/);

    // Navigate to Store B — cart should be empty
    await page.goto(`${BASE_URL}/shop/${STORE_B_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    // Store B cart count should show 0 or not be visible
    const cartCountB = page.locator('[data-testid="cart-count"]');
    const isVisible = await cartCountB.isVisible({ timeout: 2000 }).catch(() => false);
    if (isVisible) {
      const text = await cartCountB.textContent();
      expect(parseInt(text || '0', 10)).toBe(0);
    }

    // Navigate back to Store A — cart should still have the item
    await page.goto(`${BASE_URL}/shop/${STORE_A_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');
    const cartCountAAfter = page.locator('[data-testid="cart-count"]');
    await expect(cartCountAAfter).toHaveText(/[1-9]/);
  });

  test('Cart localStorage keys are scoped per store slug', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${STORE_A_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    // Check that localStorage cart key contains the store slug
    const cartKeys = await page.evaluate((slug: string) => {
      return Object.keys(localStorage).filter(
        (key) => key.includes('cart') && key.includes(slug),
      );
    }, STORE_A_SLUG);

    // After visiting Store A, any cart key should include Store A's slug
    // (this verifies the app is using store-scoped keys, not a global cart)
    const allCartKeys = await page.evaluate(() => {
      return Object.keys(localStorage).filter((key) => key.includes('cart'));
    });

    // If there are cart keys, they must be scoped (contain a store identifier)
    for (const key of allCartKeys) {
      const isScopedToA = key.includes(STORE_A_SLUG);
      const isScopedToB = key.includes(STORE_B_SLUG);
      const isGlobal = !isScopedToA && !isScopedToB;
      // Cart keys should not be global — they must be store-scoped
      expect(isGlobal).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE: Admin Route Access Isolation
// ---------------------------------------------------------------------------
test.describe('Admin Route Access Isolation', () => {
  test('Tenant A admin cannot access Tenant B admin dashboard', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page, TENANT_A_SLUG, TENANT_A_EMAIL, TENANT_A_PASSWORD);

    // Try to access Tenant B's admin panel
    await page.goto(`${BASE_URL}/${TENANT_B_SLUG}/admin/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should be redirected to login, own admin, or unauthorized
    const url = page.url();
    const isBlocked =
      url.includes('/login') ||
      url.includes(`/${TENANT_A_SLUG}/admin`) ||
      url.includes('/unauthorized');
    expect(isBlocked).toBe(true);
  });

  test('Tenant B admin cannot access Tenant A admin dashboard', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page, TENANT_B_SLUG, TENANT_B_EMAIL, TENANT_B_PASSWORD);

    // Try to access Tenant A's admin panel
    await page.goto(`${BASE_URL}/${TENANT_A_SLUG}/admin/dashboard`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const isBlocked =
      url.includes('/login') ||
      url.includes(`/${TENANT_B_SLUG}/admin`) ||
      url.includes('/unauthorized');
    expect(isBlocked).toBe(true);
  });

  test('Tenant A cannot access Tenant B admin orders page', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page, TENANT_A_SLUG, TENANT_A_EMAIL, TENANT_A_PASSWORD);

    await page.goto(`${BASE_URL}/${TENANT_B_SLUG}/admin/storefront/orders`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const isBlocked =
      url.includes('/login') ||
      url.includes(`/${TENANT_A_SLUG}/admin`) ||
      url.includes('/unauthorized');
    expect(isBlocked).toBe(true);
  });

  test('Tenant A cannot access Tenant B admin customers page', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page, TENANT_A_SLUG, TENANT_A_EMAIL, TENANT_A_PASSWORD);

    await page.goto(`${BASE_URL}/${TENANT_B_SLUG}/admin/storefront/customers`);
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const isBlocked =
      url.includes('/login') ||
      url.includes(`/${TENANT_A_SLUG}/admin`) ||
      url.includes('/unauthorized');
    expect(isBlocked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE: Admin Order Data Isolation
// ---------------------------------------------------------------------------
test.describe('Admin Order Data Isolation', () => {
  test('Tenant A admin orders page does not reference Store B', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page, TENANT_A_SLUG, TENANT_A_EMAIL, TENANT_A_PASSWORD);

    await page.goto(`${BASE_URL}/${TENANT_A_SLUG}/admin/storefront/orders`);
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    const errorAlert = page.locator('[role="alert"]:has-text("error")');
    const hasError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // Store B slug should not appear anywhere on the page
    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).not.toContain(STORE_B_SLUG);
  });

  test('Tenant B admin orders page does not reference Store A', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page, TENANT_B_SLUG, TENANT_B_EMAIL, TENANT_B_PASSWORD);

    await page.goto(`${BASE_URL}/${TENANT_B_SLUG}/admin/storefront/orders`);
    await page.waitForLoadState('networkidle');

    const errorAlert = page.locator('[role="alert"]:has-text("error")');
    const hasError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).not.toContain(STORE_A_SLUG);
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE: Admin Customer Data Isolation
// ---------------------------------------------------------------------------
test.describe('Admin Customer Data Isolation', () => {
  test('Tenant A admin customers page does not reference Store B', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page, TENANT_A_SLUG, TENANT_A_EMAIL, TENANT_A_PASSWORD);

    await page.goto(`${BASE_URL}/${TENANT_A_SLUG}/admin/storefront/customers`);
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    const errorAlert = page.locator('[role="alert"]:has-text("error")');
    const hasError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // Verify customers page loaded
    const pageTitle = page.locator('text=/customers/i');
    await expect(pageTitle.first()).toBeVisible();

    // Store B data should not leak into Store A's customer list
    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).not.toContain(STORE_B_SLUG);
  });

  test('Tenant B admin customers page does not reference Store A', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page, TENANT_B_SLUG, TENANT_B_EMAIL, TENANT_B_PASSWORD);

    await page.goto(`${BASE_URL}/${TENANT_B_SLUG}/admin/storefront/customers`);
    await page.waitForLoadState('networkidle');

    const errorAlert = page.locator('[role="alert"]:has-text("error")');
    const hasError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const pageTitle = page.locator('text=/customers/i');
    await expect(pageTitle.first()).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).not.toContain(STORE_A_SLUG);
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE: Storefront Navigation Isolation
// ---------------------------------------------------------------------------
test.describe('Storefront Navigation Isolation', () => {
  test('Store A header and navigation contain no Store B references', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${STORE_A_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    // Check header, nav, and footer for cross-store data leaks
    const navElements = page.locator('header, nav, footer, [data-testid="store-header"]');
    const navTexts = await navElements.allTextContents();
    const containsBSlug = navTexts.some((t) => t.toLowerCase().includes(STORE_B_SLUG));
    expect(containsBSlug).toBe(false);
  });

  test('Store B header and navigation contain no Store A references', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${STORE_B_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    const navElements = page.locator('header, nav, footer, [data-testid="store-header"]');
    const navTexts = await navElements.allTextContents();
    const containsASlug = navTexts.some((t) => t.toLowerCase().includes(STORE_A_SLUG));
    expect(containsASlug).toBe(false);
  });

  test('Invalid store slug shows store not found', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/nonexistent-store-slug-99999`);
    await page.waitForLoadState('networkidle');

    const notFound = page.locator('text=/not found|unavailable|doesn\'t exist/i');
    const isNotFound = await notFound.isVisible({ timeout: 5000 }).catch(() => false);

    // Either shows a not-found message or redirects away
    const url = page.url();
    expect(isNotFound || !url.includes('/shop/nonexistent-store-slug-99999')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE: API-Level Data Isolation
// ---------------------------------------------------------------------------
test.describe('API-Level Data Isolation', () => {
  test('Store A product API responses do not contain Store B product data', async ({
    page,
  }) => {
    const apiResponses: Array<{ url: string; body: string }> = [];

    // Intercept Supabase API responses
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('supabase') && (url.includes('rpc') || url.includes('rest'))) {
        try {
          const body = await response.text();
          apiResponses.push({ url, body });
        } catch {
          // Response body may not be available
        }
      }
    });

    await page.goto(`${BASE_URL}/shop/${STORE_A_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

    // Verify that API responses were captured
    expect(apiResponses.length).toBeGreaterThan(0);

    // Get Store B's products for cross-reference
    const contextB = await page.context().browser()!.newContext();
    const pageB = await contextB.newPage();
    const storeBProducts = await visitStoreAndGetProducts(pageB, STORE_B_SLUG);
    await contextB.close();

    // Store A's API responses should not contain Store B product names
    // (check only if Store B has products to compare against)
    if (storeBProducts.length > 0) {
      for (const response of apiResponses) {
        const lowerBody = response.body.toLowerCase();
        // This is a heuristic — not all product names will be unique across stores,
        // but at least one Store B product should NOT appear in Store A responses
        const storeBExclusiveCount = storeBProducts.filter(
          (name) => lowerBody.includes(name.toLowerCase()) && name.length > 3,
        ).length;
        // If ALL Store B products appear in Store A's API response, that's a leak
        expect(storeBExclusiveCount).toBeLessThan(storeBProducts.length);
      }
    }
  });

  test('Admin API responses are filtered by tenant when logged in', async ({ page }) => {
    await clearBrowserStorage(page);

    const apiResponses: Array<{ url: string; body: string }> = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('supabase') && (url.includes('rpc') || url.includes('rest'))) {
        try {
          const body = await response.text();
          apiResponses.push({ url, body });
        } catch {
          // Response body may not be available
        }
      }
    });

    await loginAsAdmin(page, TENANT_A_SLUG, TENANT_A_EMAIL, TENANT_A_PASSWORD);
    await page.goto(`${BASE_URL}/${TENANT_A_SLUG}/admin/storefront/orders`);
    await page.waitForLoadState('networkidle');

    // Any API responses containing order data should not reference Tenant B's ID
    // We verify by checking that responses don't contain the other tenant's slug
    // in contexts where it shouldn't appear (order data, customer data)
    for (const response of apiResponses) {
      // Skip auth and metadata endpoints — they may legitimately reference tenant info
      if (response.url.includes('/auth/') || response.url.includes('token')) continue;

      const lowerBody = response.body.toLowerCase();
      // Tenant B's slug should not appear in order/customer data responses
      if (lowerBody.includes('order') || lowerBody.includes('customer')) {
        expect(lowerBody).not.toContain(`"${TENANT_B_SLUG}"`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE: Admin Products Isolation
// ---------------------------------------------------------------------------
test.describe('Admin Products Isolation', () => {
  test('Tenant A admin products page shows only Tenant A products', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page, TENANT_A_SLUG, TENANT_A_EMAIL, TENANT_A_PASSWORD);

    await page.goto(`${BASE_URL}/${TENANT_A_SLUG}/admin/products`);
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    const errorAlert = page.locator('[role="alert"]:has-text("error")');
    const hasError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // Store B slug should not appear on this page
    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).not.toContain(STORE_B_SLUG);
  });

  test('Tenant B admin products page shows only Tenant B products', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page, TENANT_B_SLUG, TENANT_B_EMAIL, TENANT_B_PASSWORD);

    await page.goto(`${BASE_URL}/${TENANT_B_SLUG}/admin/products`);
    await page.waitForLoadState('networkidle');

    const errorAlert = page.locator('[role="alert"]:has-text("error")');
    const hasError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    const bodyText = await page.textContent('body');
    expect(bodyText?.toLowerCase()).not.toContain(STORE_A_SLUG);
  });
});

// ---------------------------------------------------------------------------
// TEST SUITE: Full Cross-Tenant Verification
// ---------------------------------------------------------------------------
test.describe('Full Cross-Tenant Verification', () => {
  test('Two admins logged in simultaneously see only their own data', async ({
    browser,
  }) => {
    // Create two isolated browser contexts — one per tenant admin
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await clearBrowserStorage(pageA);
    await loginAsAdmin(pageA, TENANT_A_SLUG, TENANT_A_EMAIL, TENANT_A_PASSWORD);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await clearBrowserStorage(pageB);
    await loginAsAdmin(pageB, TENANT_B_SLUG, TENANT_B_EMAIL, TENANT_B_PASSWORD);

    // Both admins navigate to their orders pages simultaneously
    await Promise.all([
      pageA.goto(`${BASE_URL}/${TENANT_A_SLUG}/admin/storefront/orders`),
      pageB.goto(`${BASE_URL}/${TENANT_B_SLUG}/admin/storefront/orders`),
    ]);

    await Promise.all([
      pageA.waitForLoadState('networkidle'),
      pageB.waitForLoadState('networkidle'),
    ]);

    // Tenant A should not see Tenant B data
    const bodyA = await pageA.textContent('body');
    expect(bodyA?.toLowerCase()).not.toContain(STORE_B_SLUG);

    // Tenant B should not see Tenant A data
    const bodyB = await pageB.textContent('body');
    expect(bodyB?.toLowerCase()).not.toContain(STORE_A_SLUG);

    // Both pages should not have error states
    for (const pg of [pageA, pageB]) {
      const errorAlert = pg.locator('[role="alert"]:has-text("error")');
      const hasError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasError).toBe(false);
    }

    await contextA.close();
    await contextB.close();
  });

  test('Two storefronts accessed simultaneously show correct products', async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Navigate to both storefronts simultaneously
    await Promise.all([
      pageA.goto(`${BASE_URL}/shop/${STORE_A_SLUG}`),
      pageB.goto(`${BASE_URL}/shop/${STORE_B_SLUG}`),
    ]);

    await handleAgeVerification(pageA);
    await handleAgeVerification(pageB);

    const storeAProducts = await getProductNames(pageA);
    const storeBProducts = await getProductNames(pageB);

    // Both stores must have products
    expect(storeAProducts.length).toBeGreaterThan(0);
    expect(storeBProducts.length).toBeGreaterThan(0);

    // Products should be different between stores
    const catalogsIdentical =
      storeAProducts.length === storeBProducts.length &&
      storeAProducts.every((p, i) => p === storeBProducts[i]);
    expect(catalogsIdentical).toBe(false);

    // Verify each store's URL is correct
    expect(pageA.url()).toContain(`/shop/${STORE_A_SLUG}`);
    expect(pageB.url()).toContain(`/shop/${STORE_B_SLUG}`);

    await contextA.close();
    await contextB.close();
  });
});
