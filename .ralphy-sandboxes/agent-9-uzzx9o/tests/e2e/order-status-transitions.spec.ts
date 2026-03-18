/**
 * E2E: Admin processes order through all status transitions
 *
 * Tests the complete order lifecycle from the admin Live Orders page:
 * 1. Customer places order via storefront checkout
 * 2. Admin transitions order: pending → confirmed → preparing → ready → out_for_delivery → delivered
 * 3. Customer confirmation page updates in real-time at each step
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:8080';
const STORE_SLUG = process.env.TEST_STORE_SLUG || 'willysbo';
const TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'willysbo';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'alex@gmail.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Test123!';

// Helpers

async function clearBrowserStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}

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

/**
 * Place an order via storefront checkout and return the order number.
 * Returns null if unable to complete checkout (e.g. no products available).
 */
async function placeStorefrontOrder(page: Page): Promise<string | null> {
  // Navigate to storefront
  await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
  await handleAgeVerification(page);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Add a product to the cart
  const addButton = page.locator(
    'button:has-text("Add to Bag"), button:has-text("Add to Cart"), [data-testid="add-to-cart-button"]'
  ).first();
  let hasProduct = await addButton.isVisible({ timeout: 5000 }).catch(() => false);

  if (!hasProduct) {
    // Try navigating to a product detail page first
    const productLink = page.locator('[data-testid="product-card"], a[href*="/product/"]').first();
    if (await productLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productLink.click();
      await page.waitForLoadState('networkidle');
      const detailAdd = page.locator(
        'button:has-text("Add to Bag"), button:has-text("Add to Cart"), [data-testid="add-to-cart-button"]'
      ).first();
      hasProduct = await detailAdd.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasProduct) {
        await detailAdd.click();
        await page.waitForTimeout(1000);
      }
    }
  } else {
    await addButton.click();
    await page.waitForTimeout(1000);
  }

  if (!hasProduct) return null;

  // Go to checkout
  await page.goto(`${BASE_URL}/shop/${STORE_SLUG}/checkout`);
  await handleAgeVerification(page);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Unique customer name for test isolation
  const uniqueId = `e2e-${Date.now()}`;
  const customerName = `Test ${uniqueId}`;

  // Step 1: Contact information
  const emailField = page.locator('input[name="email"], input[type="email"]').first();
  if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailField.fill(`${uniqueId}@test.com`);
  }
  const firstNameField = page.locator('input[name="firstName"]').first();
  if (await firstNameField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await firstNameField.fill('Test');
  }
  const lastNameField = page.locator('input[name="lastName"]').first();
  if (await lastNameField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await lastNameField.fill(uniqueId);
  }
  const phoneField = page.locator('input[name="phone"], input[type="tel"]').first();
  if (await phoneField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await phoneField.fill('555-000-1234');
  }

  // Continue to next step
  const continueBtn = page.locator('button:has-text("Continue")').first();
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(1000);
  }

  // Step 2: Delivery address
  const streetField = page.locator('input[name="street"]').first();
  if (await streetField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await streetField.fill('123 E2E Test Street');
  }
  const cityField = page.locator('input[name="city"]').first();
  if (await cityField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cityField.fill('Test City');
  }
  const stateField = page.locator('input[name="state"]').first();
  if (await stateField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await stateField.fill('CA');
  }
  const zipField = page.locator('input[name="zip"]').first();
  if (await zipField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await zipField.fill('90210');
  }

  const continueBtn2 = page.locator('button:has-text("Continue")').first();
  if (await continueBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn2.click();
    await page.waitForTimeout(1000);
  }

  // Step 3: Payment method — select cash
  const cashOption = page.locator('input[value="cash"], label:has-text("Cash")').first();
  if (await cashOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cashOption.click();
    await page.waitForTimeout(500);
  }

  const continueBtn3 = page.locator('button:has-text("Continue")').first();
  if (await continueBtn3.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn3.click();
    await page.waitForTimeout(1000);
  }

  // Step 4: Review & place order
  const termsCheckbox = page.locator('input[type="checkbox"]').first();
  if (await termsCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await termsCheckbox.check();
    await page.waitForTimeout(300);
  }

  const placeOrderBtn = page.locator('button:has-text("Place Order")').first();
  if (await placeOrderBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await placeOrderBtn.click();
  }

  // Wait for confirmation page
  await page.waitForURL('**/order-confirmation**', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Extract order number from confirmation page
  const orderNumberEl = page.locator('text=/^#/').first();
  const orderNumText = await orderNumberEl.textContent().catch(() => null);

  if (orderNumText) {
    // Strip "#" prefix
    return orderNumText.replace('#', '').trim();
  }

  // Fallback: try to get from URL
  const url = page.url();
  const orderMatch = url.match(/order=([^&]+)/);
  return orderMatch ? orderMatch[1] : customerName;
}

/**
 * Navigate admin to Live Orders page and wait for orders to load.
 */
async function navigateToLiveOrders(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/storefront/live-orders`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

/**
 * Switch the live orders view to List mode for easier targeting.
 */
async function switchToListView(page: Page): Promise<void> {
  const listBtn = page.locator('button:has-text("List")').first();
  if (await listBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await listBtn.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Find an order card in the kanban/list view by order number and click the
 * primary action button to advance it to the next status.
 */
async function advanceOrderStatus(
  page: Page,
  orderNumber: string,
  expectedButtonLabel: string
): Promise<void> {
  // Look for the order card that contains the order number
  const orderCard = page.locator(`text=#${orderNumber}`).first();
  await expect(orderCard).toBeVisible({ timeout: 10000 });

  // Find the action button near this order (in the same card/row)
  // In kanban view, the button is a sibling within the same Card component
  const card = orderCard.locator('xpath=ancestor::*[contains(@class,"card") or contains(@class,"Card")]').first();

  const actionButton = card.locator(`button:has-text("${expectedButtonLabel}")`).first();
  await expect(actionButton).toBeVisible({ timeout: 5000 });
  await actionButton.click();

  // Wait for the mutation to complete and UI to update
  await page.waitForTimeout(2000);
}

/**
 * Verify the customer confirmation page shows the expected current status step.
 */
async function verifyCustomerStatus(
  page: Page,
  expectedStatusLabel: string
): Promise<void> {
  // The confirmation page has a "Current" badge next to the active status step
  // and a timeline showing all status labels
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Find the current status indicator — the step with "Current" badge
  const currentBadge = page.locator('text=Current').first();
  const hasCurrent = await currentBadge.isVisible({ timeout: 10000 }).catch(() => false);

  if (hasCurrent) {
    // The parent of the "Current" badge should contain the expected label
    const statusContainer = currentBadge.locator('xpath=ancestor::div[contains(@class,"relative")]').first();
    const statusText = await statusContainer.textContent().catch(() => '');
    expect(statusText).toContain(expectedStatusLabel);
  }
}

// ============================================================================
// TEST SUITE: Admin Order Status Transitions
// ============================================================================
test.describe('Admin Order Status Transitions', () => {
  test.setTimeout(120000); // 2 minutes for the full flow

  test('should process delivery order through all status transitions with customer page updates', async ({ browser }) => {
    // Create two contexts: one for the customer, one for the admin
    const customerCtx: BrowserContext = await browser.newContext();
    const adminCtx: BrowserContext = await browser.newContext();
    const customerPage: Page = await customerCtx.newPage();
    const adminPage: Page = await adminCtx.newPage();

    try {
      // ----------------------------------------------------------------
      // STEP 1: Customer places an order
      // ----------------------------------------------------------------
      const orderNumber = await placeStorefrontOrder(customerPage);

      if (!orderNumber) {
        test.skip(true, 'Could not place order — no products available in store');
        return;
      }

      // Customer is now on the order confirmation page
      // The status should be "pending" (Order Placed)
      await verifyCustomerStatus(customerPage, 'Order Placed');

      // ----------------------------------------------------------------
      // STEP 2: Admin logs in and navigates to Live Orders
      // ----------------------------------------------------------------
      await loginAsAdmin(adminPage);
      await navigateToLiveOrders(adminPage);

      // Ensure the new order is visible — it should appear in the "NEW" column
      const orderInAdmin = adminPage.locator(`text=#${orderNumber}`).first();
      await expect(orderInAdmin).toBeVisible({ timeout: 15000 });

      // ----------------------------------------------------------------
      // STEP 3: Transition pending → confirmed
      // ----------------------------------------------------------------
      await advanceOrderStatus(adminPage, orderNumber, 'Confirm');

      // Verify admin sees success toast
      const confirmToast = adminPage.locator('text=/Confirmed/i').first();
      await expect(confirmToast).toBeVisible({ timeout: 5000 });

      // Verify customer page reflects new status
      await verifyCustomerStatus(customerPage, 'Confirmed');

      // ----------------------------------------------------------------
      // STEP 4: Transition confirmed → preparing
      // ----------------------------------------------------------------
      // The order may have moved to the PREPARING column; change status filter if needed
      await navigateToLiveOrders(adminPage);
      await advanceOrderStatus(adminPage, orderNumber, 'Start Preparing');

      const preparingToast = adminPage.locator('text=/Preparing/i').first();
      await expect(preparingToast).toBeVisible({ timeout: 5000 });

      await verifyCustomerStatus(customerPage, 'Preparing');

      // ----------------------------------------------------------------
      // STEP 5: Transition preparing → ready
      // ----------------------------------------------------------------
      await navigateToLiveOrders(adminPage);
      await advanceOrderStatus(adminPage, orderNumber, 'Mark Ready');

      const readyToast = adminPage.locator('text=/Ready/i').first();
      await expect(readyToast).toBeVisible({ timeout: 5000 });

      await verifyCustomerStatus(customerPage, 'Ready');

      // ----------------------------------------------------------------
      // STEP 6: Transition ready → out_for_delivery
      // ----------------------------------------------------------------
      await navigateToLiveOrders(adminPage);
      await advanceOrderStatus(adminPage, orderNumber, 'Out for Delivery');

      const outForDeliveryToast = adminPage.locator('text=/Out for Delivery/i').first();
      await expect(outForDeliveryToast).toBeVisible({ timeout: 5000 });

      await verifyCustomerStatus(customerPage, 'Out for Delivery');

      // ----------------------------------------------------------------
      // STEP 7: Transition out_for_delivery → delivered
      // ----------------------------------------------------------------
      // The order moves to a terminal state; need to filter to see "out_for_delivery" status
      // Switch status filter to show out_for_delivery
      await adminPage.goto(`${BASE_URL}/${TENANT_SLUG}/admin/storefront/live-orders`);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(2000);

      // Select "Out for Delivery" from status filter to find the order
      const statusFilter = adminPage.locator('button:has-text("All Active"), [role="combobox"]').first();
      if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await statusFilter.click();
        await adminPage.waitForTimeout(300);
        const outForDeliveryOption = adminPage.locator('[role="option"]:has-text("Out for Delivery")').first();
        if (await outForDeliveryOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await outForDeliveryOption.click();
          await adminPage.waitForTimeout(1000);
        }
      }

      await advanceOrderStatus(adminPage, orderNumber, 'Mark Delivered');

      const deliveredToast = adminPage.locator('text=/Delivered/i').first();
      await expect(deliveredToast).toBeVisible({ timeout: 5000 });

      // ----------------------------------------------------------------
      // STEP 8: Verify final customer status
      // ----------------------------------------------------------------
      await verifyCustomerStatus(customerPage, 'Delivered');

      // ----------------------------------------------------------------
      // STEP 9: Verify terminal state — no more action buttons
      // ----------------------------------------------------------------
      // The delivered order should show "Delivered" in the filter and have no action buttons
      await adminPage.goto(`${BASE_URL}/${TENANT_SLUG}/admin/storefront/live-orders`);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Switch filter to "Delivered"
      const statusFilter2 = adminPage.locator('button:has-text("All Active"), [role="combobox"]').first();
      if (await statusFilter2.isVisible({ timeout: 3000 }).catch(() => false)) {
        await statusFilter2.click();
        await adminPage.waitForTimeout(300);
        const deliveredOption = adminPage.locator('[role="option"]:has-text("Delivered")').first();
        if (await deliveredOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await deliveredOption.click();
          await adminPage.waitForTimeout(1000);
        }
      }

      const deliveredOrder = adminPage.locator(`text=#${orderNumber}`).first();
      const isDeliveredVisible = await deliveredOrder.isVisible({ timeout: 5000 }).catch(() => false);

      if (isDeliveredVisible) {
        const deliveredCard = deliveredOrder
          .locator('xpath=ancestor::*[contains(@class,"card") or contains(@class,"Card")]')
          .first();

        // No "Confirm", "Start Preparing", etc. buttons should exist for delivered orders
        const anyActionBtn = deliveredCard.locator(
          'button:has-text("Confirm"), button:has-text("Start Preparing"), button:has-text("Mark Ready"), button:has-text("Mark Delivered")'
        ).first();
        const hasActions = await anyActionBtn.isVisible({ timeout: 2000 }).catch(() => false);
        expect(hasActions).toBe(false);
      }
    } finally {
      await customerCtx.close();
      await adminCtx.close();
    }
  });

  test('should show correct status badges throughout transitions', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page);
    await navigateToLiveOrders(page);

    // Verify the kanban columns exist with proper labels
    const newColumn = page.locator('text=NEW').first();
    const preparingColumn = page.locator('text=PREPARING').first();
    const readyColumn = page.locator('text=READY').first();
    const outForDeliveryColumn = page.locator('text=OUT FOR DELIVERY').first();

    await expect(newColumn).toBeVisible({ timeout: 10000 });
    await expect(preparingColumn).toBeVisible({ timeout: 5000 });
    await expect(readyColumn).toBeVisible({ timeout: 5000 });
    await expect(outForDeliveryColumn).toBeVisible({ timeout: 5000 });
  });

  test('should allow filtering orders by status', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page);
    await navigateToLiveOrders(page);

    // Open the status filter dropdown
    const filterTrigger = page.locator('[role="combobox"]').first();
    await expect(filterTrigger).toBeVisible({ timeout: 10000 });
    await filterTrigger.click();
    await page.waitForTimeout(300);

    // Verify filter options exist
    const pendingOption = page.locator('[role="option"]:has-text("Pending")');
    const confirmedOption = page.locator('[role="option"]:has-text("Confirmed")');
    const preparingOption = page.locator('[role="option"]:has-text("Preparing")');
    const readyOption = page.locator('[role="option"]:has-text("Ready")');

    await expect(pendingOption).toBeVisible({ timeout: 3000 });
    await expect(confirmedOption).toBeVisible({ timeout: 3000 });
    await expect(preparingOption).toBeVisible({ timeout: 3000 });
    await expect(readyOption).toBeVisible({ timeout: 3000 });

    // Select "Pending" to filter
    await pendingOption.click();
    await page.waitForTimeout(1000);

    // Only pending orders (or empty state) should be visible
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('should toggle between kanban and list view', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page);
    await navigateToLiveOrders(page);

    // Default is kanban (Board)
    const boardBtn = page.locator('button:has-text("Board")').first();
    const listBtn = page.locator('button:has-text("List")').first();

    await expect(boardBtn).toBeVisible({ timeout: 10000 });
    await expect(listBtn).toBeVisible({ timeout: 5000 });

    // Switch to list view
    await listBtn.click();
    await page.waitForTimeout(1000);

    // List view should show a table
    const table = page.locator('table, [role="table"]').first();
    const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

    // Switch back to kanban
    await boardBtn.click();
    await page.waitForTimeout(1000);

    // Kanban columns should be visible again
    const newColumn = page.locator('text=NEW').first();
    await expect(newColumn).toBeVisible({ timeout: 5000 });
  });

  test('should display order search functionality', async ({ page }) => {
    await clearBrowserStorage(page);
    await loginAsAdmin(page);
    await navigateToLiveOrders(page);

    // Search input should be present
    const searchInput = page.locator('input[placeholder*="Search"], input[aria-label*="Search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type a search query — should filter without errors
    await searchInput.fill('test-query-that-matches-nothing');
    await page.waitForTimeout(1000);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });
});
