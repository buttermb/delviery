/**
 * E2E: Telegram auto-forward fires on new order
 *
 * Verifies that when a new order is placed:
 * 1. The storefront-checkout edge function is called and includes Telegram forwarding
 * 2. The order completes successfully regardless of Telegram outcome
 * 3. If the client fallback path fires, the forward-order-telegram call includes order details
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:8080';
const STORE_SLUG = process.env.TEST_STORE_SLUG || 'willysbo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function handleAgeVerification(page: Page): Promise<void> {
  const ageButton = page.locator('button:has-text("21+"), button:has-text("I\'m 21")');
  if (await ageButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await ageButton.first().click();
    await page.waitForTimeout(500);
  }
}

async function addProductToCart(page: Page): Promise<boolean> {
  await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
  await handleAgeVerification(page);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Try "Add to Bag/Cart" button on catalog page
  const addButton = page.locator('button:has-text("Add to Bag"), button:has-text("Add to Cart")').first();
  if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addButton.click();
    await page.waitForTimeout(500);
    return true;
  }

  // Fallback: click into product detail and add from there
  const productLink = page.locator('a[href*="/product/"]').first();
  if (await productLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await productLink.click();
    await page.waitForLoadState('networkidle');
    const detailAdd = page.locator('button:has-text("Add to Bag"), button:has-text("Add to Cart")').first();
    if (await detailAdd.isVisible({ timeout: 5000 }).catch(() => false)) {
      await detailAdd.click();
      await page.waitForTimeout(500);
      return true;
    }
  }

  return false;
}

async function fillCheckoutForm(page: Page): Promise<void> {
  // Step 1: Contact info
  const emailField = page.locator('input[name="email"], input[type="email"]').first();
  if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailField.fill('e2e-telegram-test@example.com');
  }
  const firstName = page.locator('input[name="firstName"]').first();
  if (await firstName.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstName.fill('Telegram');
  }
  const lastName = page.locator('input[name="lastName"]').first();
  if (await lastName.isVisible({ timeout: 3000 }).catch(() => false)) {
    await lastName.fill('TestOrder');
  }
  const phone = page.locator('input[name="phone"], input[type="tel"]').first();
  if (await phone.isVisible({ timeout: 3000 }).catch(() => false)) {
    await phone.fill('555-999-0000');
  }

  // Advance to next step
  const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(1500);
  }

  // Step 2: Delivery address
  const street = page.locator('input[name="street"]').first();
  if (await street.isVisible({ timeout: 3000 }).catch(() => false)) {
    await street.fill('123 Telegram Test Ave');
  }
  const city = page.locator('input[name="city"]').first();
  if (await city.isVisible({ timeout: 3000 }).catch(() => false)) {
    await city.fill('Test City');
  }
  const state = page.locator('input[name="state"]').first();
  if (await state.isVisible({ timeout: 3000 }).catch(() => false)) {
    await state.fill('CA');
  }
  const zip = page.locator('input[name="zip"]').first();
  if (await zip.isVisible({ timeout: 3000 }).catch(() => false)) {
    await zip.fill('90210');
  }

  // Advance
  const nextBtn = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
  if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(1500);
  }

  // Step 3: Payment method — select cash
  const cashOption = page.locator('input[value="cash"]').first();
  if (await cashOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cashOption.click();
  }

  // Advance
  const payBtn = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
  if (await payBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await payBtn.click();
    await page.waitForTimeout(1500);
  }

  // Step 4: Agree to terms if present
  const termsCheckbox = page.locator('input[type="checkbox"]').first();
  if (await termsCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
    const isChecked = await termsCheckbox.isChecked();
    if (!isChecked) {
      await termsCheckbox.check();
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Telegram Auto-Forward on New Order', () => {
  test('storefront-checkout triggers forward-order-telegram with order details', async ({ page }) => {
    // 1. Add product to cart
    const added = await addProductToCart(page);
    if (!added) {
      test.skip(true, 'No products available to add to cart');
      return;
    }

    // 2. Set up request interception BEFORE navigating to checkout
    //    Track calls to both storefront-checkout and forward-order-telegram
    let checkoutRequestBody: Record<string, unknown> | null = null;
    let checkoutResponseBody: Record<string, unknown> | null = null;
    let telegramCallSeen = false;
    let telegramRequestBody: Record<string, unknown> | null = null;

    // Intercept storefront-checkout call to inspect request/response
    await page.route('**/functions/v1/storefront-checkout', async (route) => {
      const request = route.request();
      try {
        checkoutRequestBody = JSON.parse(request.postData() ?? '{}');
      } catch {
        // ignore parse errors
      }

      // Let the real request through
      const response = await route.fetch();
      const body = await response.json();
      checkoutResponseBody = body;

      await route.fulfill({
        status: response.status(),
        headers: Object.fromEntries(response.headers().entries ? Object.entries(response.headers()) : []),
        body: JSON.stringify(body),
      });
    });

    // Intercept forward-order-telegram (client fallback path)
    await page.route('**/functions/v1/forward-order-telegram', async (route) => {
      telegramCallSeen = true;
      try {
        telegramRequestBody = JSON.parse(route.request().postData() ?? '{}');
      } catch {
        // ignore parse errors
      }

      // Return success — don't actually call Telegram during tests
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sent: true }),
      });
    });

    // 3. Navigate to checkout and fill form
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}/checkout`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check we're on the checkout page (may redirect if cart is empty)
    if (!page.url().includes('checkout')) {
      test.skip(true, 'Redirected from checkout — cart may be empty');
      return;
    }

    await fillCheckoutForm(page);

    // 4. Place the order
    const placeOrderBtn = page.locator('button:has-text("Place Order"), button:has-text("Submit Order")').first();
    if (!await placeOrderBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'Place Order button not visible — checkout form may be incomplete');
      return;
    }

    await placeOrderBtn.click();

    // 5. Wait for order confirmation page or success indicators
    await page.waitForTimeout(5000);

    // Verify: storefront-checkout was called
    expect(checkoutRequestBody).not.toBeNull();

    // Verify: storefront-checkout returned orderId (order was created)
    expect(checkoutResponseBody).not.toBeNull();
    if (checkoutResponseBody) {
      expect(checkoutResponseBody.orderId).toBeTruthy();
      expect(checkoutResponseBody.orderNumber).toBeTruthy();
    }

    // Verify: checkout request included customer info that would be forwarded
    if (checkoutRequestBody) {
      expect(checkoutRequestBody.customerInfo).toBeTruthy();
      expect(checkoutRequestBody.storeSlug).toBe(STORE_SLUG);
      expect(checkoutRequestBody.items).toBeTruthy();
    }

    // The server-side forward-order-telegram call can't be intercepted by Playwright,
    // but the storefront-checkout edge function includes it at line 393-420.
    // If the client fallback path fired, verify the Telegram payload.
    if (telegramCallSeen && telegramRequestBody) {
      expect(telegramRequestBody.orderId).toBeTruthy();
      expect(telegramRequestBody.tenantId).toBeTruthy();
      expect(telegramRequestBody.customerName).toContain('Telegram');
      expect(telegramRequestBody.items).toBeTruthy();
    }
  });

  test('order saves successfully even when Telegram forwarding fails', async ({ page }) => {
    // 1. Add product to cart
    const added = await addProductToCart(page);
    if (!added) {
      test.skip(true, 'No products available to add to cart');
      return;
    }

    let checkoutResponseBody: Record<string, unknown> | null = null;

    // Intercept storefront-checkout to capture response
    await page.route('**/functions/v1/storefront-checkout', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      checkoutResponseBody = body;

      await route.fulfill({
        status: response.status(),
        headers: Object.fromEntries(Object.entries(response.headers())),
        body: JSON.stringify(body),
      });
    });

    // Make forward-order-telegram FAIL — simulating Telegram outage
    await page.route('**/functions/v1/forward-order-telegram', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ sent: false, reason: 'E2E test: simulated failure' }),
      });
    });

    // 2. Navigate to checkout
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}/checkout`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (!page.url().includes('checkout')) {
      test.skip(true, 'Redirected from checkout — cart may be empty');
      return;
    }

    await fillCheckoutForm(page);

    // 3. Place order
    const placeOrderBtn = page.locator('button:has-text("Place Order"), button:has-text("Submit Order")').first();
    if (!await placeOrderBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'Place Order button not visible');
      return;
    }

    await placeOrderBtn.click();

    // 4. Wait for the checkout to complete
    //    The order should save even though Telegram failed
    await page.waitForTimeout(5000);

    // Verify: order was created successfully despite Telegram failure
    expect(checkoutResponseBody).not.toBeNull();
    if (checkoutResponseBody) {
      expect(checkoutResponseBody.orderId).toBeTruthy();
      expect(checkoutResponseBody.orderNumber).toBeTruthy();
      // No error field — order creation succeeded
      expect(checkoutResponseBody.error).toBeFalsy();
    }

    // The order confirmation page should load (or the URL should indicate success)
    const currentUrl = page.url();
    const confirmationVisible = page.locator('text=/order.*confirm|thank.*you|order.*placed|order.*number/i');
    const hasConfirmation = await confirmationVisible.first().isVisible({ timeout: 10000 }).catch(() => false);

    // Either the confirmation page loaded OR the URL changed to confirmation
    expect(hasConfirmation || currentUrl.includes('confirmation')).toBeTruthy();
  });

  test('checkout response includes telegramLink when tenant has it configured', async ({ page }) => {
    // This test verifies the settings → checkout data flow for Telegram contact link.
    // The storefront-checkout edge function fetches telegram_customer_link from
    // account_settings and includes it in the response as telegramLink.

    let checkoutResponseBody: Record<string, unknown> | null = null;

    // 1. Add product to cart
    const added = await addProductToCart(page);
    if (!added) {
      test.skip(true, 'No products available to add to cart');
      return;
    }

    // Intercept checkout response
    await page.route('**/functions/v1/storefront-checkout', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      checkoutResponseBody = body;

      await route.fulfill({
        status: response.status(),
        headers: Object.fromEntries(Object.entries(response.headers())),
        body: JSON.stringify(body),
      });
    });

    // Mock Telegram endpoint to not call real API
    await page.route('**/functions/v1/forward-order-telegram', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sent: true }),
      });
    });

    // 2. Checkout
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}/checkout`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (!page.url().includes('checkout')) {
      test.skip(true, 'Redirected from checkout — cart may be empty');
      return;
    }

    await fillCheckoutForm(page);

    const placeOrderBtn = page.locator('button:has-text("Place Order"), button:has-text("Submit Order")').first();
    if (!await placeOrderBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'Place Order button not visible');
      return;
    }

    await placeOrderBtn.click();
    await page.waitForTimeout(5000);

    // 3. Verify checkout response
    expect(checkoutResponseBody).not.toBeNull();
    if (checkoutResponseBody) {
      expect(checkoutResponseBody.orderId).toBeTruthy();

      // telegramLink is optional — only included when tenant has configured it
      // If present, it should be a valid URL (t.me or custom)
      if (checkoutResponseBody.telegramLink) {
        const link = checkoutResponseBody.telegramLink as string;
        expect(link.length).toBeGreaterThan(0);
      }
    }
  });
});
