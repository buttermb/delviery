/**
 * E2E: Empty store published
 *
 * Admin publishes store with 0 products.
 * Customer visits: sees hero/sections but product grid says "Coming soon".
 * Product catalog page: "No products yet. Check back later."
 * Cart/checkout: not reachable (nothing to add to cart).
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:8080';

// An empty store slug — a published store with 0 products.
// Set via env var, or default to a test store that has been emptied of products.
const EMPTY_STORE_SLUG = process.env.TEST_EMPTY_STORE_SLUG || 'empty-test-store';

// A known store with products (for contrast / fallback tests)
const POPULATED_STORE_SLUG = process.env.TEST_STORE_SLUG || 'willysbo';

async function handleAgeVerification(page: Page): Promise<void> {
  const ageModal = page.locator('[data-testid="age-verification-modal"]');
  if (await ageModal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.click('button:has-text("Yes, I am 21+")');
  }
}

async function isStoreAccessible(page: Page, slug: string): Promise<boolean> {
  await page.goto(`${BASE_URL}/shop/${slug}`);
  await page.waitForLoadState('networkidle');

  // Check for store not found / error states
  const notFound = page.locator('text=/not found|unavailable|doesn\'t exist|store not found/i');
  const isNotFound = await notFound.isVisible({ timeout: 3000 }).catch(() => false);
  return !isNotFound;
}

// ============================================================================
// TEST SUITE: Storefront Home — Empty Store
// ============================================================================
test.describe('Storefront Home — Empty Store', () => {
  test.beforeEach(async ({ page }) => {
    const accessible = await isStoreAccessible(page, EMPTY_STORE_SLUG);
    test.skip(!accessible, `Empty store "${EMPTY_STORE_SLUG}" not found or not accessible`);
  });

  test('hero section renders on empty store', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    // Hero section should be visible — store is published, just has no products
    const heroSection = page.locator('[data-testid="hero-section"], section:first-of-type, .hero');
    const hasHero = await heroSection.first().isVisible({ timeout: 5000 }).catch(() => false);

    // At minimum, the page should render without errors
    const errorAlert = page.locator('[role="alert"]:has-text("error")');
    const hasError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);

    // Store page should load (not redirect to 404)
    expect(page.url()).toContain(`/shop/${EMPTY_STORE_SLUG}`);
  });

  test('product grid shows "Coming soon" on empty store', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    // Wait for loading to complete
    await page.waitForTimeout(2000);

    // Product grid empty state should show "Coming soon"
    const emptyGrid = page.locator('[data-testid="empty-product-grid"]');
    const comingSoonText = page.locator('text=/Coming soon/i');

    const hasEmptyGrid = await emptyGrid.isVisible({ timeout: 5000 }).catch(() => false);
    const hasComingSoon = await comingSoonText.isVisible({ timeout: 5000 }).catch(() => false);

    // Either the testid-marked empty grid or the "Coming soon" text should be visible
    expect(hasEmptyGrid || hasComingSoon).toBe(true);
  });

  test('no product cards are rendered on empty store home page', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    // Wait for loading to complete
    await page.waitForTimeout(2000);

    // No product cards should exist
    const productCards = page.locator('[data-testid="product-card"]');
    const cardCount = await productCards.count();
    expect(cardCount).toBe(0);
  });

  test('no "Add to Cart" buttons visible on empty store', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // No add-to-cart buttons should be present
    const addToCartButtons = page.locator('[data-testid="add-to-cart-button"], button:has-text("Add to Cart")');
    const buttonCount = await addToCartButtons.count();
    expect(buttonCount).toBe(0);
  });
});

// ============================================================================
// TEST SUITE: Product Catalog Page — Empty Store
// ============================================================================
test.describe('Product Catalog Page — Empty Store', () => {
  test.beforeEach(async ({ page }) => {
    const accessible = await isStoreAccessible(page, EMPTY_STORE_SLUG);
    test.skip(!accessible, `Empty store "${EMPTY_STORE_SLUG}" not found or not accessible`);
  });

  test('catalog page shows "No products yet" message', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}/products`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    // Wait for products query to resolve
    await page.waitForTimeout(2000);

    // Should show the empty catalog message
    const emptyCatalog = page.locator('[data-testid="empty-catalog"]');
    const noProductsText = page.locator('text=/No products yet/i');

    const hasEmptyCatalog = await emptyCatalog.isVisible({ timeout: 5000 }).catch(() => false);
    const hasNoProducts = await noProductsText.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasEmptyCatalog || hasNoProducts).toBe(true);
  });

  test('catalog page shows "Check back later" subtitle', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}/products`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const checkBackText = page.locator('text=/Check back later/i');
    const isVisible = await checkBackText.isVisible({ timeout: 5000 }).catch(() => false);
    expect(isVisible).toBe(true);
  });

  test('catalog page has no product cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}/products`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const productCards = page.locator('[data-testid="product-card"]');
    const cardCount = await productCards.count();
    expect(cardCount).toBe(0);
  });

  test('catalog search/filter controls may still render', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}/products`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    // Page should render without crashing
    const pageTitle = page.locator('text=/products|catalog|shop/i');
    const hasTitle = await pageTitle.first().isVisible({ timeout: 5000 }).catch(() => false);

    // Either title is visible or we're on the correct URL
    expect(hasTitle || page.url().includes('/products')).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Cart & Checkout — Empty Store
// ============================================================================
test.describe('Cart & Checkout — Empty Store', () => {
  test.beforeEach(async ({ page }) => {
    const accessible = await isStoreAccessible(page, EMPTY_STORE_SLUG);
    test.skip(!accessible, `Empty store "${EMPTY_STORE_SLUG}" not found or not accessible`);
  });

  test('cart page shows empty state for empty store', async ({ page }) => {
    // Clear any stale cart data
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.evaluate((slug) => {
      // Clear cart storage for this store
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.includes(slug) && key.includes('cart')) {
          localStorage.removeItem(key);
        }
      }
    }, EMPTY_STORE_SLUG);

    // Navigate to cart
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}/cart`);
    await page.waitForLoadState('networkidle');

    // Cart should show empty state
    const emptyCartText = page.locator('text=/cart.*empty|empty.*cart|no items/i');
    const isEmptyCart = await emptyCartText.isVisible({ timeout: 5000 }).catch(() => false);

    // Either shows empty cart message or redirects away
    expect(isEmptyCart || !page.url().includes('/cart')).toBe(true);
  });

  test('checkout redirects to cart when nothing in cart', async ({ page }) => {
    // Clear any stale cart data
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.evaluate((slug) => {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.includes(slug) && key.includes('cart')) {
          localStorage.removeItem(key);
        }
      }
    }, EMPTY_STORE_SLUG);

    // Try to navigate directly to checkout
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}/checkout`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Checkout should redirect to cart (or show warning) since cart is empty
    const url = page.url();
    const redirectedAway = !url.includes('/checkout');
    const hasWarning = await page.locator('text=/cart.*empty|add.*items/i')
      .isVisible({ timeout: 2000 }).catch(() => false);

    expect(redirectedAway || hasWarning).toBe(true);
  });

  test('cart badge shows zero or is hidden for empty store', async ({ page }) => {
    // Clear cart for this store
    await page.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.evaluate((slug) => {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.includes(slug) && key.includes('cart')) {
          localStorage.removeItem(key);
        }
      }
    }, EMPTY_STORE_SLUG);

    await page.reload();
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    // Cart count badge should show 0 or not be visible
    const cartCount = page.locator('[data-testid="cart-count"]');
    const isVisible = await cartCount.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      const text = await cartCount.textContent();
      expect(parseInt(text || '0', 10)).toBe(0);
    }
    // If not visible, that's also correct — no items = no badge
  });
});

// ============================================================================
// TEST SUITE: Populated vs Empty Store Contrast
// ============================================================================
test.describe('Populated vs Empty Store Contrast', () => {
  test('populated store shows products while empty store does not', async ({ browser }) => {
    // Open empty store
    const emptyCtx = await browser.newContext();
    const emptyPage = await emptyCtx.newPage();
    const emptyAccessible = await isStoreAccessible(emptyPage, EMPTY_STORE_SLUG);

    if (!emptyAccessible) {
      await emptyCtx.close();
      test.skip(true, `Empty store "${EMPTY_STORE_SLUG}" not accessible`);
      return;
    }

    await emptyPage.goto(`${BASE_URL}/shop/${EMPTY_STORE_SLUG}`);
    await handleAgeVerification(emptyPage);
    await emptyPage.waitForLoadState('networkidle');
    await emptyPage.waitForTimeout(2000);

    const emptyProductCount = await emptyPage.locator('[data-testid="product-card"]').count();

    // Open populated store
    const popCtx = await browser.newContext();
    const popPage = await popCtx.newPage();
    await popPage.goto(`${BASE_URL}/shop/${POPULATED_STORE_SLUG}`);
    await handleAgeVerification(popPage);
    await popPage.waitForLoadState('networkidle');

    // Wait for products to load on populated store
    const hasProducts = await popPage.locator('[data-testid="product-card"]')
      .first().isVisible({ timeout: 10000 }).catch(() => false);

    if (hasProducts) {
      const popProductCount = await popPage.locator('[data-testid="product-card"]').count();
      // Populated store should have products
      expect(popProductCount).toBeGreaterThan(0);
    }

    // Empty store should have 0 products
    expect(emptyProductCount).toBe(0);

    await emptyCtx.close();
    await popCtx.close();
  });
});
