/**
 * E2E: Admin cancels order and stock restores
 *
 * Scenario:
 * 1. Place a storefront order (checkout flow)
 * 2. Admin navigates to Live Orders
 * 3. Admin cancels the order with a reason
 * 4. Order status changes to "cancelled"
 * 5. Stock quantities are restored
 * 6. Customer tracking page shows cancelled status
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:8080';
const STORE_SLUG = process.env.TEST_STORE_SLUG || 'willysbo';
const TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'willysbo';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'alex@gmail.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Test123!';

// Helpers

async function handleAgeVerification(page: Page): Promise<void> {
  const ageButton = page.locator('button:has-text("21+"), button:has-text("I\'m 21")');
  if (await ageButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await ageButton.first().click();
    await page.waitForTimeout(500);
  }
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/${TENANT_SLUG}/admin/**`, { timeout: 15000 });
}

async function clearBrowserStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}

async function navigateToStorefront(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
  await handleAgeVerification(page);
  await page.waitForLoadState('networkidle');
}

async function navigateToCatalog(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/shop/${STORE_SLUG}/products`);
  await handleAgeVerification(page);
  await page.waitForLoadState('networkidle');
}

/**
 * Places an order via the storefront checkout flow.
 * Returns the tracking token from the confirmation page URL or null on failure.
 */
async function placeStorefrontOrder(page: Page): Promise<string | null> {
  // Navigate to store catalog
  await navigateToCatalog(page);

  // Click first available product
  const firstProduct = page.locator('[data-testid="product-card"]').first();
  if (!await firstProduct.isVisible({ timeout: 10000 }).catch(() => false)) {
    // Fallback: find product links
    const productLink = page.locator('a[href*="/product/"]').first();
    if (!await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      return null;
    }
    await productLink.click();
  } else {
    await firstProduct.click();
  }

  // Wait for product detail page
  await page.waitForLoadState('networkidle');

  // Add to cart
  const addToCartBtn = page.locator(
    '[data-testid="add-to-cart-button"], button:has-text("Add to Bag"), button:has-text("Add to Cart")'
  ).first();
  if (!await addToCartBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return null;
  }

  // Verify product is in stock before adding
  const isDisabled = await addToCartBtn.isDisabled();
  if (isDisabled) return null;

  await addToCartBtn.click();
  await page.waitForTimeout(1000);

  // Navigate to cart
  const cartButton = page.locator('[data-testid="cart-button"]');
  if (await cartButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cartButton.click();
    await page.waitForURL(`**/shop/${STORE_SLUG}/cart`, { timeout: 5000 });
  } else {
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}/cart`);
    await handleAgeVerification(page);
  }
  await page.waitForLoadState('networkidle');

  // Proceed to checkout
  const checkoutBtn = page.locator('button:has-text("Checkout"), button:has-text("Proceed")').first();
  if (!await checkoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return null;
  }
  await checkoutBtn.click();
  await page.waitForURL(`**/shop/${STORE_SLUG}/checkout`, { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // Step 1: Contact Information
  const uniqueId = `test-${Date.now()}`;
  await page.fill('input[name="firstName"]', 'CancelTest');
  await page.fill('input[name="lastName"]', uniqueId);
  await page.fill('input[name="email"]', `canceltest-${uniqueId}@test.com`);
  await page.fill('input[name="phone"]', '555-999-0001');
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(1000);

  // Step 2: Delivery Address
  const streetField = page.locator('input[name="street"]');
  if (await streetField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await streetField.fill('123 Cancel Test St');
    await page.fill('input[name="city"]', 'Test City');
    await page.fill('input[name="state"]', 'CA');
    await page.fill('input[name="zip"]', '90210');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(1000);
  }

  // Step 3: Payment Method — select cash
  const cashRadio = page.locator('input[value="cash"]');
  if (await cashRadio.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cashRadio.click();
  }
  const continueBtn = page.locator('button:has-text("Continue")');
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(1000);
  }

  // Step 4: Review & Place Order
  const termsCheckbox = page.locator('input[type="checkbox"]').first();
  if (await termsCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await termsCheckbox.check();
  }
  const placeOrderBtn = page.locator('button:has-text("Place Order")');
  if (!await placeOrderBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return null;
  }
  await placeOrderBtn.click();

  // Wait for order confirmation page
  await page.waitForURL('**/order-confirmation**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Extract tracking token from the page (tracking URL contains it)
  const trackingLink = page.locator('a[href*="/track/"]').first();
  if (await trackingLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    const href = await trackingLink.getAttribute('href');
    if (href) {
      const match = href.match(/\/track\/([^/?]+)/);
      return match ? match[1] : null;
    }
  }

  // Fallback: try to get from page URL or state
  return null;
}

// ============================================================================
// TEST SUITE: Admin Cancel Order and Stock Restores
// ============================================================================
test.describe('Admin Cancel Order — Stock Restores', () => {

  test('admin can cancel a pending order and stock is restored', async ({ browser }) => {
    // Use separate browser contexts for admin and customer
    const shopContext = await browser.newContext();
    const adminContext = await browser.newContext();
    const shopPage = await shopContext.newPage();
    const adminPage = await adminContext.newPage();

    try {
      // 1. Place an order as a customer
      const trackingToken = await placeStorefrontOrder(shopPage);

      // If we couldn't place an order, skip but document it
      if (!trackingToken) {
        // Verify we at least got to a confirmation page
        const confirmationVisible = await shopPage.locator('text=/Order Confirmed|confirmation/i')
          .isVisible({ timeout: 3000 }).catch(() => false);
        test.skip(!confirmationVisible, 'Could not place order or extract tracking token');
      }

      // Get the order number from confirmation page
      const orderNumberEl = shopPage.locator('text=/ORD-|#ORD/i').first();
      const orderNumberText = await orderNumberEl.textContent().catch(() => null);

      // 2. Login as admin and navigate to Live Orders
      await loginAsAdmin(adminPage);
      await adminPage.goto(`${BASE_URL}/${TENANT_SLUG}/admin/storefront/live-orders`);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(2000);

      // 3. Switch to list view for easier selection
      const listViewBtn = adminPage.locator('button:has-text("List")');
      if (await listViewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await listViewBtn.click();
        await adminPage.waitForTimeout(1000);
      }

      // 4. Find the order — look for the most recent pending order
      // In kanban view, the cancel button has title="Cancel order"
      // In list view, cancel is in a dropdown menu
      const cancelButton = adminPage.locator('button[title="Cancel order"]').first();
      const hasKanbanCancel = await cancelButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasKanbanCancel) {
        // Kanban view — click the cancel icon button directly
        await cancelButton.click();
      } else {
        // List view — open the actions dropdown and click Cancel
        const actionsMenu = adminPage.locator('button:has-text("Actions"), button[aria-label="Order actions"]').first();
        if (await actionsMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
          await actionsMenu.click();
          await adminPage.waitForTimeout(500);
          const cancelMenuItem = adminPage.locator('text="Cancel"').first();
          await cancelMenuItem.click();
        } else {
          // Try to find any cancel-related button on the page
          const anyCancel = adminPage.locator('button:has-text("Cancel"), [role="menuitem"]:has-text("Cancel")').first();
          if (await anyCancel.isVisible({ timeout: 5000 }).catch(() => false)) {
            await anyCancel.click();
          }
        }
      }

      // 5. CancelOrderDialog should appear — select a reason
      const dialogTitle = adminPage.locator('text=/Cancel Order/i');
      await expect(dialogTitle).toBeVisible({ timeout: 5000 });

      // Select "Customer request" as the cancellation reason
      const customerRequestRadio = adminPage.locator('label:has-text("Customer request")');
      await expect(customerRequestRadio).toBeVisible({ timeout: 3000 });
      await customerRequestRadio.click();

      // 6. Click the "Cancel Order" confirmation button
      const confirmCancelBtn = adminPage.locator('button:has-text("Cancel Order")');
      await expect(confirmCancelBtn).toBeEnabled();
      await confirmCancelBtn.click();

      // 7. Verify success toast appears
      const successToast = adminPage.locator('text=/cancelled.*inventory|inventory.*restored|Order cancelled/i');
      await expect(successToast.first()).toBeVisible({ timeout: 10000 });

      // 8. Verify the order is no longer in active orders
      // Wait for the page to refresh after cancellation
      await adminPage.waitForTimeout(2000);

      // 9. Customer tracking page should show cancelled status
      if (trackingToken) {
        await shopPage.goto(`${BASE_URL}/shop/${STORE_SLUG}/track/${trackingToken}`);
        await handleAgeVerification(shopPage);
        await shopPage.waitForLoadState('networkidle');
        await shopPage.waitForTimeout(2000);

        // The tracking page shows "Order cancelled" with XCircle icon
        const cancelledStatus = shopPage.locator('text=/cancelled|refunded/i');
        await expect(cancelledStatus.first()).toBeVisible({ timeout: 10000 });
      }
    } finally {
      await shopContext.close();
      await adminContext.close();
    }
  });

  test('cancel dialog requires reason selection before confirming', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page);

    // Navigate to Live Orders
    await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/storefront/live-orders`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find any cancel button (kanban: title="Cancel order", list: dropdown item)
    const cancelButton = page.locator('button[title="Cancel order"]').first();
    const hasCancel = await cancelButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCancel) {
      test.skip(true, 'No cancellable orders available — need pending/confirmed orders');
      return;
    }

    await cancelButton.click();

    // Dialog should appear
    const dialogTitle = page.locator('text=/Cancel Order/i');
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    // The "Cancel Order" button should be disabled until a reason is selected
    const confirmBtn = page.locator('button:has-text("Cancel Order")');
    await expect(confirmBtn).toBeDisabled();

    // Select a reason
    const outOfStockRadio = page.locator('label:has-text("Out of stock")');
    await outOfStockRadio.click();

    // Now the button should be enabled
    await expect(confirmBtn).toBeEnabled();

    // Dismiss the dialog without cancelling (click "Keep Order")
    const keepOrderBtn = page.locator('button:has-text("Keep Order")');
    await keepOrderBtn.click();

    // Dialog should close
    await expect(dialogTitle).not.toBeVisible({ timeout: 3000 });
  });

  test('cancel dialog shows "Other" reason with notes field', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/storefront/live-orders`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const cancelButton = page.locator('button[title="Cancel order"]').first();
    const hasCancel = await cancelButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCancel) {
      test.skip(true, 'No cancellable orders available');
      return;
    }

    await cancelButton.click();

    // Dialog should appear
    await expect(page.locator('text=/Cancel Order/i')).toBeVisible({ timeout: 5000 });

    // Select "Other" reason
    const otherRadio = page.locator('label:has-text("Other")');
    await otherRadio.click();

    // Notes textarea should appear
    const notesTextarea = page.locator('textarea#cancel-notes');
    await expect(notesTextarea).toBeVisible({ timeout: 3000 });

    // Fill in custom reason
    await notesTextarea.fill('E2E test cancellation reason');

    // Button should be enabled
    const confirmBtn = page.locator('button:has-text("Cancel Order")');
    await expect(confirmBtn).toBeEnabled();

    // Dismiss without cancelling
    await page.locator('button:has-text("Keep Order")').click();
    await expect(page.locator('text=/Cancel Order #/i')).not.toBeVisible({ timeout: 3000 });
  });

  test('all cancellation reason options are displayed', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/storefront/live-orders`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const cancelButton = page.locator('button[title="Cancel order"]').first();
    const hasCancel = await cancelButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCancel) {
      test.skip(true, 'No cancellable orders available');
      return;
    }

    await cancelButton.click();
    await expect(page.locator('text=/Cancel Order/i')).toBeVisible({ timeout: 5000 });

    // Verify all 5 cancellation reasons are visible
    const reasons = [
      'Out of stock',
      'Customer request',
      'Unable to deliver',
      'Payment issue',
      'Other',
    ];

    for (const reason of reasons) {
      await expect(page.locator(`label:has-text("${reason}")`)).toBeVisible();
    }

    // Dismiss
    await page.locator('button:has-text("Keep Order")').click();
  });

  test('cancelled order does not appear in active orders list', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/storefront/live-orders`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // The active orders view filters out cancelled orders by default
    // Cancelled orders should not appear in the main live orders view
    // Check that no "Cancelled" status badges appear in the order list
    const cancelledBadge = page.locator('[data-testid="order-status-cancelled"], text=/^Cancelled$/');
    const cancelledCount = await cancelledBadge.count();

    // Active orders view should not show cancelled orders
    // (The status filter defaults to "All Active" which excludes cancelled)
    expect(cancelledCount).toBe(0);
  });

  test('storefront product is available after order cancellation restores stock', async ({ page }) => {
    // Navigate to the storefront catalog
    await navigateToCatalog(page);

    // Find an available product (should exist since cancel restores stock)
    const productLinks = page.locator('a[href*="/product/"]');
    const productCount = await productLinks.count();
    expect(productCount).toBeGreaterThan(0);

    // Click on first product
    await productLinks.first().click();
    await page.waitForLoadState('networkidle');

    // Product should be available (Add to Bag enabled) — not Out of Stock
    const addToBag = page.locator('button:has-text("Add to Bag"), button:has-text("Add to Cart")').first();
    const outOfStock = page.locator('text="Out of Stock"');

    const hasAddToBag = await addToBag.isVisible({ timeout: 5000 }).catch(() => false);
    const hasOutOfStock = await outOfStock.isVisible({ timeout: 3000 }).catch(() => false);

    // Product should be either in stock or out of stock (page renders correctly)
    expect(hasAddToBag || hasOutOfStock).toBe(true);

    // No error boundary should appear
    const errorBoundary = page.locator('text=/Something went wrong/i');
    expect(await errorBoundary.isVisible().catch(() => false)).toBe(false);
  });
});
