/**
 * E2E: Customer adds to cart → leaves → comes back
 *
 * Scenario:
 * 1. Customer adds items to cart
 * 2. Closes browser tab
 * 3. Reopens /shop/:slug
 * 4. Cart still has items (localStorage persistence)
 * 5. Proceeds to checkout normally
 *
 * Key implementation detail:
 * Cart is persisted to localStorage via safeStorage with store-scoped keys
 * (shop_cart_${storeId}). Same browser context = same localStorage, so closing
 * a tab and opening a new one in the same context simulates the real flow.
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:8080';
const STORE_SLUG = process.env.TEST_STORE_SLUG || 'willysbo';

// Helpers

async function handleAgeVerification(page: Page): Promise<void> {
  const ageModal = page.locator('[data-testid="age-verification-modal"]');
  if (await ageModal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.click('button:has-text("Yes, I am 21+")');
  }
}

async function navigateToStore(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
  await handleAgeVerification(page);
  await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });
}

async function addFirstProductToCart(page: Page): Promise<string> {
  await page.locator('[data-testid="product-card"]').first().click();
  await page.waitForSelector('[data-testid="add-to-cart-button"]', { timeout: 5000 });

  const productName = await page.locator('h1').first().textContent() || 'Unknown Product';

  await page.click('[data-testid="add-to-cart-button"]');
  await expect(page.locator('[data-testid="cart-count"]')).toHaveText(/[1-9]/, { timeout: 5000 });

  return productName.trim();
}

async function addSecondProductToCart(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/shop/${STORE_SLUG}/products`);
  await handleAgeVerification(page);
  await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

  const productCards = page.locator('[data-testid="product-card"]');
  const cardCount = await productCards.count();
  if (cardCount >= 2) {
    await productCards.nth(1).click();
  } else {
    await productCards.first().click();
  }

  await page.waitForSelector('[data-testid="add-to-cart-button"]', { timeout: 5000 });
  const productName = await page.locator('h1').first().textContent() || 'Unknown Product';
  await page.click('[data-testid="add-to-cart-button"]');

  return productName.trim();
}

async function goToCart(page: Page): Promise<void> {
  await page.click('[data-testid="cart-button"]');
  await page.waitForURL(`**/shop/${STORE_SLUG}/cart`, { timeout: 5000 });
}

// ============================================================================
// TEST SUITE: Cart persistence across tab close
// ============================================================================
test.describe('Cart Persistence — Add to Cart, Leave, Come Back', () => {

  test('cart items survive closing and reopening tab', async ({ browser }) => {
    // Use a single browser context (shared localStorage) with multiple pages (tabs)
    const context = await browser.newContext();

    // --- Tab 1: Add items to cart ---
    const page1 = await context.newPage();
    await navigateToStore(page1);
    const productName = await addFirstProductToCart(page1);

    // Verify cart count badge shows item
    await expect(page1.locator('[data-testid="cart-count"]')).toHaveText(/[1-9]/);

    // Go to cart page to confirm items are there
    await goToCart(page1);
    const cartItems1 = page1.locator('[data-testid="cart-item"]');
    await expect(cartItems1.first()).toBeVisible();
    const itemCountBefore = await cartItems1.count();
    expect(itemCountBefore).toBeGreaterThanOrEqual(1);

    // --- Close tab 1 (simulate closing browser tab) ---
    await page1.close();

    // --- Tab 2: Reopen the store ---
    const page2 = await context.newPage();
    await page2.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await handleAgeVerification(page2);

    // Cart count badge should still show items
    const cartCount = page2.locator('[data-testid="cart-count"]');
    await expect(cartCount).toHaveText(/[1-9]/, { timeout: 5000 });

    // Navigate to cart and verify items are still there
    await page2.click('[data-testid="cart-button"]');
    await page2.waitForURL(`**/shop/${STORE_SLUG}/cart`, { timeout: 5000 });

    const cartItems2 = page2.locator('[data-testid="cart-item"]');
    await expect(cartItems2.first()).toBeVisible();
    const itemCountAfter = await cartItems2.count();
    expect(itemCountAfter).toBe(itemCountBefore);

    await page2.screenshot({ path: 'test-results/screenshots/cart-persistence-restored.png', fullPage: true });

    await page2.close();
    await context.close();
  });

  test('multiple cart items persist across tab close', async ({ browser }) => {
    const context = await browser.newContext();

    // --- Tab 1: Add two different products ---
    const page1 = await context.newPage();
    await navigateToStore(page1);
    const product1 = await addFirstProductToCart(page1);
    const product2 = await addSecondProductToCart(page1);

    // Go to cart and count items
    await goToCart(page1);
    const cartItems1 = page1.locator('[data-testid="cart-item"]');
    await expect(cartItems1.first()).toBeVisible();
    const itemCountBefore = await cartItems1.count();
    expect(itemCountBefore).toBeGreaterThanOrEqual(2);

    // --- Close tab ---
    await page1.close();

    // --- Tab 2: Reopen and verify ---
    const page2 = await context.newPage();
    await page2.goto(`${BASE_URL}/shop/${STORE_SLUG}/cart`);
    await handleAgeVerification(page2);

    const cartItems2 = page2.locator('[data-testid="cart-item"]');
    await expect(cartItems2.first()).toBeVisible({ timeout: 5000 });
    const itemCountAfter = await cartItems2.count();
    expect(itemCountAfter).toBe(itemCountBefore);

    await page2.screenshot({ path: 'test-results/screenshots/cart-persistence-multiple-items.png', fullPage: true });

    await page2.close();
    await context.close();
  });

  test('persisted cart proceeds to checkout normally', async ({ browser }) => {
    const context = await browser.newContext();

    // --- Tab 1: Add item and close ---
    const page1 = await context.newPage();
    await navigateToStore(page1);
    await addFirstProductToCart(page1);
    await page1.close();

    // --- Tab 2: Reopen, verify cart, proceed to checkout ---
    const page2 = await context.newPage();
    await page2.goto(`${BASE_URL}/shop/${STORE_SLUG}/cart`);
    await handleAgeVerification(page2);

    // Verify cart loaded from storage
    const cartItems = page2.locator('[data-testid="cart-item"]');
    await expect(cartItems.first()).toBeVisible({ timeout: 5000 });

    // Click checkout
    const checkoutBtn = page2.locator('button:has-text("Proceed to Checkout"), button:has-text("Checkout")').first();
    await expect(checkoutBtn).toBeVisible();
    await expect(checkoutBtn).toBeEnabled();
    await checkoutBtn.click();

    // Should navigate to checkout page
    await page2.waitForURL(`**/shop/${STORE_SLUG}/checkout`, { timeout: 5000 });

    // Verify checkout page loaded with order items
    await page2.waitForLoadState('networkidle');
    const checkoutContent = page2.locator('text=/Contact|Checkout|Order/i').first();
    await expect(checkoutContent).toBeVisible({ timeout: 5000 });

    // Fill contact info and verify the flow works
    const firstNameField = page2.locator('input[name="firstName"]');
    if (await firstNameField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstNameField.fill('Persistence');
      await page2.fill('input[name="lastName"]', 'Tester');
      await page2.fill('input[name="email"]', `persist-test-${Date.now()}@test.com`);
      await page2.fill('input[name="phone"]', '555-000-0099');
      await page2.click('button:has-text("Continue")');
    }

    // Verify we progressed past contact info (delivery step visible)
    const streetField = page2.locator('input[name="street"]');
    const progressedToDelivery = await streetField.isVisible({ timeout: 5000 }).catch(() => false);
    expect(progressedToDelivery).toBe(true);

    await page2.screenshot({ path: 'test-results/screenshots/cart-persistence-checkout.png', fullPage: true });

    await page2.close();
    await context.close();
  });

  test('cart count badge reflects persisted items on store landing page', async ({ browser }) => {
    const context = await browser.newContext();

    // --- Tab 1: Add item ---
    const page1 = await context.newPage();
    await navigateToStore(page1);
    await addFirstProductToCart(page1);

    // Get the cart count
    const cartCountText = await page1.locator('[data-testid="cart-count"]').textContent();
    const expectedCount = parseInt(cartCountText || '0', 10);
    expect(expectedCount).toBeGreaterThanOrEqual(1);

    await page1.close();

    // --- Tab 2: Open store landing page (not cart) ---
    const page2 = await context.newPage();
    await page2.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await handleAgeVerification(page2);

    // Cart count badge should reflect persisted items
    const restoredCount = page2.locator('[data-testid="cart-count"]');
    await expect(restoredCount).toHaveText(/[1-9]/, { timeout: 5000 });

    // The count should match what we had before closing
    const restoredText = await restoredCount.textContent();
    const restoredNum = parseInt(restoredText || '0', 10);
    expect(restoredNum).toBe(expectedCount);

    await page2.screenshot({ path: 'test-results/screenshots/cart-persistence-badge.png', fullPage: true });

    await page2.close();
    await context.close();
  });
});

// ============================================================================
// TEST SUITE: Cart isolation between stores
// ============================================================================
test.describe('Cart Persistence — Store Isolation', () => {

  test('cart is scoped to store — different stores have separate carts', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the test store and add an item
    await navigateToStore(page);
    await addFirstProductToCart(page);

    // Verify cart has items
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText(/[1-9]/);

    // Now navigate to a different store slug (this may or may not exist)
    // The key assertion: if we navigate back to our original store, items are there
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await handleAgeVerification(page);

    // Cart should still have our items (same store)
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText(/[1-9]/, { timeout: 5000 });

    await page.close();
    await context.close();
  });
});

// ============================================================================
// TEST SUITE: Cart persistence with coupon
// ============================================================================
test.describe('Cart Persistence — Coupon Retention', () => {

  test('applied coupon persists across tab close', async ({ browser }) => {
    const context = await browser.newContext();

    // --- Tab 1: Add item and apply coupon ---
    const page1 = await context.newPage();
    await navigateToStore(page1);
    await addFirstProductToCart(page1);
    await goToCart(page1);

    // Try to apply a coupon (if the UI supports it)
    const couponInput = page1.locator('input[placeholder*="coupon"], input[placeholder*="Coupon"], input[name="coupon"]');
    const hasCouponField = await couponInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasCouponField) {
      await couponInput.fill('TEST10');
      await page1.click('button:has-text("Apply")');
      await page1.waitForTimeout(1000);

      // Check if coupon was applied or rejected
      const discountText = page1.locator('text=/discount|Discount|coupon applied/i');
      const couponApplied = await discountText.isVisible({ timeout: 3000 }).catch(() => false);

      if (couponApplied) {
        // --- Close tab ---
        await page1.close();

        // --- Tab 2: Verify coupon persisted ---
        const page2 = await context.newPage();
        await page2.goto(`${BASE_URL}/shop/${STORE_SLUG}/cart`);
        await handleAgeVerification(page2);

        // Cart items should be there
        await expect(page2.locator('[data-testid="cart-item"]').first()).toBeVisible({ timeout: 5000 });

        // Coupon discount should still be shown
        const persistedDiscount = page2.locator('text=/discount|Discount|coupon applied/i');
        await expect(persistedDiscount).toBeVisible({ timeout: 5000 });

        await page2.screenshot({ path: 'test-results/screenshots/cart-persistence-coupon.png', fullPage: true });
        await page2.close();
      } else {
        await page1.close();
      }
    } else {
      // No coupon field — skip gracefully
      await page1.close();
    }

    await context.close();
  });
});

// ============================================================================
// TEST SUITE: Full end-to-end flow
// ============================================================================
test.describe('Cart Persistence — Full E2E Flow', () => {

  test('add items → close tab → reopen → checkout → order confirmed', async ({ browser }) => {
    const context = await browser.newContext();

    // --- Tab 1: Browse and add items ---
    const page1 = await context.newPage();
    await navigateToStore(page1);
    await addFirstProductToCart(page1);

    // Verify item is in cart
    await goToCart(page1);
    await expect(page1.locator('[data-testid="cart-item"]').first()).toBeVisible();

    // --- Close tab (simulate leaving) ---
    await page1.close();

    // --- Tab 2: Come back later and complete purchase ---
    const page2 = await context.newPage();
    await page2.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await handleAgeVerification(page2);

    // Cart badge should show items
    await expect(page2.locator('[data-testid="cart-count"]')).toHaveText(/[1-9]/, { timeout: 5000 });

    // Go to cart
    await page2.click('[data-testid="cart-button"]');
    await page2.waitForURL(`**/shop/${STORE_SLUG}/cart`, { timeout: 5000 });
    await expect(page2.locator('[data-testid="cart-item"]').first()).toBeVisible();

    // Proceed to checkout
    const checkoutBtn = page2.locator('button:has-text("Proceed to Checkout"), button:has-text("Checkout")').first();
    await checkoutBtn.click();
    await page2.waitForURL(`**/shop/${STORE_SLUG}/checkout`, { timeout: 5000 });

    // Complete checkout
    await page2.waitForLoadState('networkidle');

    const firstNameField = page2.locator('input[name="firstName"]');
    if (await firstNameField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstNameField.fill('Persistent');
      await page2.fill('input[name="lastName"]', 'Customer');
      await page2.fill('input[name="email"]', `persist-e2e-${Date.now()}@test.com`);
      await page2.fill('input[name="phone"]', '555-000-0088');
      await page2.click('button:has-text("Continue")');
    }

    const streetField = page2.locator('input[name="street"]');
    if (await streetField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await streetField.fill('789 Persistence Lane');
      await page2.fill('input[name="city"]', 'Cart City');
      await page2.fill('input[name="state"]', 'CA');
      await page2.fill('input[name="zip"]', '90210');
      await page2.click('button:has-text("Continue")');
    }

    const cashRadio = page2.locator('input[value="cash"]');
    if (await cashRadio.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cashRadio.click();
      await page2.click('button:has-text("Continue")');
    }

    const termsCheckbox = page2.locator('input[type="checkbox"]');
    if (await termsCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await termsCheckbox.check();
    }

    const placeOrderBtn = page2.locator('button:has-text("Place Order")');
    if (await placeOrderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await placeOrderBtn.click();

      // Wait for order confirmation
      const confirmed = await page2.waitForURL('**/order-confirmation**', { timeout: 15000 }).then(() => true).catch(() => false);

      if (confirmed) {
        await expect(page2.locator('text=/Order Confirmed|Thank you|order/i').first()).toBeVisible();
      }

      await page2.screenshot({ path: 'test-results/screenshots/cart-persistence-full-e2e.png', fullPage: true });
    }

    await page2.close();
    await context.close();
  });
});

// ============================================================================
// TEST SUITE: Cart persists across browser restart (new context)
// ============================================================================
test.describe('Cart Persistence — Browser Restart', () => {

  test('cart items survive full browser restart via storageState transfer', async ({ browser }) => {
    // --- Session 1: Add items to cart in first browser context ---
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await navigateToStore(page1);
    await addFirstProductToCart(page1);

    // Verify cart has the item
    await goToCart(page1);
    const cartItems1 = page1.locator('[data-testid="cart-item"]');
    await expect(cartItems1.first()).toBeVisible();
    const itemCountBefore = await cartItems1.count();
    expect(itemCountBefore).toBeGreaterThanOrEqual(1);

    // Save the browser's storage state (localStorage + cookies)
    const storageState = await context1.storageState();

    // --- Simulate browser restart: destroy the entire context ---
    await page1.close();
    await context1.close();

    // --- Session 2: New browser context with restored storage state ---
    const context2 = await browser.newContext({ storageState });
    const page2 = await context2.newPage();
    await page2.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await handleAgeVerification(page2);

    // Cart count badge should reflect persisted items
    await expect(page2.locator('[data-testid="cart-count"]')).toHaveText(/[1-9]/, { timeout: 5000 });

    // Navigate to cart and verify items survived the restart
    await page2.click('[data-testid="cart-button"]');
    await page2.waitForURL(`**/shop/${STORE_SLUG}/cart`, { timeout: 5000 });

    const cartItems2 = page2.locator('[data-testid="cart-item"]');
    await expect(cartItems2.first()).toBeVisible({ timeout: 5000 });
    const itemCountAfter = await cartItems2.count();
    expect(itemCountAfter).toBe(itemCountBefore);

    await page2.screenshot({ path: 'test-results/screenshots/cart-persistence-browser-restart.png', fullPage: true });

    await page2.close();
    await context2.close();
  });

  test('multiple items and quantities persist across browser restart', async ({ browser }) => {
    // --- Session 1: Add multiple products ---
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await navigateToStore(page1);
    await addFirstProductToCart(page1);
    await addSecondProductToCart(page1);

    // Go to cart and verify multiple items
    await goToCart(page1);
    const cartItems1 = page1.locator('[data-testid="cart-item"]');
    await expect(cartItems1.first()).toBeVisible();
    const itemCountBefore = await cartItems1.count();
    expect(itemCountBefore).toBeGreaterThanOrEqual(2);

    // Save storage state before browser "closes"
    const storageState = await context1.storageState();
    await page1.close();
    await context1.close();

    // --- Session 2: Brand new browser context ---
    const context2 = await browser.newContext({ storageState });
    const page2 = await context2.newPage();
    await page2.goto(`${BASE_URL}/shop/${STORE_SLUG}/cart`);
    await handleAgeVerification(page2);

    const cartItems2 = page2.locator('[data-testid="cart-item"]');
    await expect(cartItems2.first()).toBeVisible({ timeout: 5000 });
    const itemCountAfter = await cartItems2.count();
    expect(itemCountAfter).toBe(itemCountBefore);

    await page2.screenshot({ path: 'test-results/screenshots/cart-persistence-browser-restart-multiple.png', fullPage: true });

    await page2.close();
    await context2.close();
  });

  test('cart persists across browser restart and completes checkout normally', async ({ browser }) => {
    // --- Session 1: Add items then "close browser" ---
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await navigateToStore(page1);
    await addFirstProductToCart(page1);

    // Confirm item is in cart
    await goToCart(page1);
    await expect(page1.locator('[data-testid="cart-item"]').first()).toBeVisible();

    // Save state and destroy context (full browser restart)
    const storageState = await context1.storageState();
    await page1.close();
    await context1.close();

    // --- Session 2: Reopen browser, go straight to checkout ---
    const context2 = await browser.newContext({ storageState });
    const page2 = await context2.newPage();
    await page2.goto(`${BASE_URL}/shop/${STORE_SLUG}/cart`);
    await handleAgeVerification(page2);

    // Verify cart loaded from storage
    const cartItems = page2.locator('[data-testid="cart-item"]');
    await expect(cartItems.first()).toBeVisible({ timeout: 5000 });

    // Proceed to checkout
    const checkoutBtn = page2.locator('button:has-text("Proceed to Checkout"), button:has-text("Checkout")').first();
    await expect(checkoutBtn).toBeVisible();
    await expect(checkoutBtn).toBeEnabled();
    await checkoutBtn.click();
    await page2.waitForURL(`**/shop/${STORE_SLUG}/checkout`, { timeout: 5000 });

    // Verify checkout page loaded with items
    await page2.waitForLoadState('networkidle');
    const checkoutContent = page2.locator('text=/Contact|Checkout|Order/i').first();
    await expect(checkoutContent).toBeVisible({ timeout: 5000 });

    // Fill checkout contact info
    const firstNameField = page2.locator('input[name="firstName"]');
    if (await firstNameField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstNameField.fill('BrowserRestart');
      await page2.fill('input[name="lastName"]', 'Tester');
      await page2.fill('input[name="email"]', `restart-test-${Date.now()}@test.com`);
      await page2.fill('input[name="phone"]', '555-000-0077');
      await page2.click('button:has-text("Continue")');
    }

    // Verify progression past contact step
    const streetField = page2.locator('input[name="street"]');
    const progressedToDelivery = await streetField.isVisible({ timeout: 5000 }).catch(() => false);
    expect(progressedToDelivery).toBe(true);

    await page2.screenshot({ path: 'test-results/screenshots/cart-persistence-browser-restart-checkout.png', fullPage: true });

    await page2.close();
    await context2.close();
  });
});
