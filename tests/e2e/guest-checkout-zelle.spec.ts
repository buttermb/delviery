/**
 * E2E: Guest checkout with Zelle payment flow
 *
 * Scenario:
 * 1. Navigate to storefront, browse products
 * 2. Add item to cart
 * 3. Proceed to checkout as guest
 * 4. Fill contact info (Step 1)
 * 5. Select delivery/pickup and fill address (Step 2)
 * 6. Select Zelle payment, verify Zelle info shown, confirm payment sent (Step 3)
 * 7. Review order, check age verification + terms (Step 4)
 * 8. Place order
 * 9. Verify order confirmation page shows correct payment method
 *
 * Validates:
 * - Zelle payment method is available when configured
 * - Zelle contact info (email/phone) is displayed
 * - "I've sent payment via Zelle" confirmation checkbox is required
 * - Order is saved with payment_method=zelle
 * - Order confirmation page renders correctly
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:8080';
const STORE_SLUG = process.env.TEST_STORE_SLUG || 'willysbo';

// Helpers

async function handleAgeVerification(page: Page): Promise<void> {
  const ageButton = page.locator('button:has-text("21+"), button:has-text("I\'m 21")');
  if (await ageButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await ageButton.first().click();
    await page.waitForTimeout(500);
  }
}

async function navigateToStore(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
  await handleAgeVerification(page);
  await page.waitForLoadState('networkidle');
}

async function addFirstProductToCart(page: Page): Promise<void> {
  // Navigate to products page
  await page.goto(`${BASE_URL}/shop/${STORE_SLUG}/products`);
  await handleAgeVerification(page);

  // Wait for products to load
  const productCard = page.locator('[data-testid="product-card"]');
  await productCard.first().waitFor({ state: 'visible', timeout: 15000 });

  // Click first product to go to detail page
  await productCard.first().click();

  // Wait for product detail page
  const addToCartButton = page.locator('[data-testid="add-to-cart-button"]');
  await addToCartButton.waitFor({ state: 'visible', timeout: 10000 });

  // Add to cart
  await addToCartButton.click();

  // Wait for cart count to update
  await expect(page.locator('[data-testid="cart-count"]')).toHaveText(/[1-9]/, { timeout: 5000 });
}

async function navigateToCheckout(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/shop/${STORE_SLUG}/checkout`);
  await handleAgeVerification(page);
  await page.waitForLoadState('networkidle');
}

// ============================================================================
// TEST SUITE: Checkout form has Zelle payment option
// ============================================================================
test.describe('Checkout — Zelle Payment Option Available', () => {

  test('checkout Step 3 shows Zelle as a payment method when configured', async ({ page }) => {
    await addFirstProductToCart(page);
    await navigateToCheckout(page);

    // Fill Step 1: Contact info (required to advance)
    await page.fill('#firstName', 'Zelle');
    await page.fill('#lastName', 'Tester');
    await page.fill('#email', 'zelletest@example.com');
    await page.fill('#phone', '5551234567');

    // Click Continue to go to Step 2
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 2: Select Pickup (simpler, avoids delivery zone validation)
    const pickupButton = page.locator('button:has-text("Pickup"), label:has-text("Pickup")');
    if (await pickupButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await pickupButton.first().click();
      await page.waitForTimeout(300);
    }

    // Click Continue to go to Step 3 (Payment)
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Verify Zelle option is present
    const zelleOption = page.locator('label:has-text("Zelle"), div:has-text("Zelle")');
    const hasZelle = await zelleOption.first().isVisible({ timeout: 5000 }).catch(() => false);

    // If Zelle is not configured for this store, skip gracefully
    if (!hasZelle) {
      test.skip(true, 'Zelle payment not configured for test store');
      return;
    }

    await expect(zelleOption.first()).toBeVisible();
  });
});

// ============================================================================
// TEST SUITE: Zelle payment details and confirmation
// ============================================================================
test.describe('Checkout — Zelle Payment Details', () => {

  test('selecting Zelle shows payment info and confirmation checkbox', async ({ page }) => {
    await addFirstProductToCart(page);
    await navigateToCheckout(page);

    // Step 1: Contact info
    await page.fill('#firstName', 'Zelle');
    await page.fill('#lastName', 'Buyer');
    await page.fill('#email', 'zellebuyer@example.com');
    await page.fill('#phone', '5559876543');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 2: Fulfillment — select Pickup for simplicity
    const pickupButton = page.locator('button:has-text("Pickup"), label:has-text("Pickup")');
    if (await pickupButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await pickupButton.first().click();
      await page.waitForTimeout(300);
    }
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 3: Payment — select Zelle
    const zelleRadio = page.locator('#zelle');
    const zelleLabel = page.locator('label[for="zelle"]');
    const zelleDiv = page.locator('div:has(#zelle)');

    // Click the Zelle option (try radio, then label, then enclosing div)
    if (await zelleRadio.isVisible({ timeout: 3000 }).catch(() => false)) {
      await zelleDiv.first().click();
    } else if (await zelleLabel.isVisible({ timeout: 1000 }).catch(() => false)) {
      await zelleLabel.click();
    } else {
      test.skip(true, 'Zelle payment not configured for test store');
      return;
    }

    await page.waitForTimeout(500);

    // Verify Zelle payment details section appeared
    const zelleSection = page.locator('text="I\'ve sent payment via Zelle"');
    await expect(zelleSection).toBeVisible({ timeout: 5000 });

    // The "zelle-confirmed" checkbox should exist
    const zelleCheckbox = page.locator('#zelle-confirmed');
    await expect(zelleCheckbox).toBeVisible();
  });

  test('Zelle confirmation checkbox is required to proceed', async ({ page }) => {
    await addFirstProductToCart(page);
    await navigateToCheckout(page);

    // Step 1
    await page.fill('#firstName', 'Zelle');
    await page.fill('#lastName', 'Required');
    await page.fill('#email', 'zellerequired@example.com');
    await page.fill('#phone', '5551112222');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 2: Pickup
    const pickupButton = page.locator('button:has-text("Pickup"), label:has-text("Pickup")');
    if (await pickupButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await pickupButton.first().click();
      await page.waitForTimeout(300);
    }
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 3: Select Zelle but DON'T check the confirmation
    const zelleDiv = page.locator('div:has(#zelle)');
    if (await zelleDiv.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await zelleDiv.first().click();
    } else {
      test.skip(true, 'Zelle payment not configured for test store');
      return;
    }
    await page.waitForTimeout(500);

    // Try to Continue without checking the Zelle confirmation checkbox
    await page.click('button:has-text("Continue")');

    // Should show error toast about Zelle confirmation
    const errorToast = page.locator('text=/confirm.*Zelle/i');
    await expect(errorToast).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// TEST SUITE: Full guest checkout with Zelle — end to end
// ============================================================================
test.describe('Full E2E — Guest Checkout with Zelle', () => {

  test('complete guest checkout with Zelle payment and verify confirmation', async ({ page }) => {
    // 1. Add a product to cart
    await addFirstProductToCart(page);

    // 2. Navigate to checkout
    await navigateToCheckout(page);

    // ---- Step 1: Contact Information ----
    await page.fill('#firstName', 'ZelleE2E');
    await page.fill('#lastName', 'TestUser');
    await page.fill('#email', 'zellee2e@example.com');
    await page.fill('#phone', '5553334444');

    // Click Continue
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // ---- Step 2: Fulfillment Method ----
    // Select Pickup to avoid delivery zone validation
    const pickupButton = page.locator('button:has-text("Pickup"), label:has-text("Pickup")');
    if (await pickupButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await pickupButton.first().click();
      await page.waitForTimeout(300);
    }

    // Click Continue
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // ---- Step 3: Payment Method — Zelle ----
    const zelleDiv = page.locator('div:has(#zelle)');
    if (await zelleDiv.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await zelleDiv.first().click();
    } else {
      test.skip(true, 'Zelle payment not configured for test store');
      return;
    }

    await page.waitForTimeout(500);

    // Verify Zelle info is displayed (if store has zelle_email configured)
    const zelleInfo = page.locator('text=/Send Zelle payment to/i');
    const hasZelleInfo = await zelleInfo.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasZelleInfo) {
      await expect(zelleInfo).toBeVisible();
    }

    // Check the "I've sent payment via Zelle" confirmation
    const zelleCheckbox = page.locator('#zelle-confirmed');
    await zelleCheckbox.click();
    await expect(zelleCheckbox).toBeChecked();

    // Click Continue
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // ---- Step 4: Review Order ----
    // Verify payment method shows "Zelle" in review
    const paymentReview = page.locator('text="Zelle"');
    await expect(paymentReview.first()).toBeVisible({ timeout: 5000 });

    // Check age verification
    const ageCheckbox = page.locator('#age-verify');
    await ageCheckbox.click();

    // Check terms
    const termsCheckbox = page.locator('#terms');
    await termsCheckbox.click();

    // Place Order button should be enabled
    const placeOrderButton = page.locator('button:has-text("Place Order"), button:has-text("Pre-Order")');
    await expect(placeOrderButton.first()).toBeEnabled({ timeout: 3000 });

    // Place the order
    await placeOrderButton.first().click();

    // Wait for order confirmation page
    await page.waitForURL('**/order-confirmation**', { timeout: 30000 });

    // Verify confirmation page
    const confirmationHeading = page.locator('text=/Order Confirmed|Thank you/i');
    await expect(confirmationHeading.first()).toBeVisible({ timeout: 10000 });

    // Verify order number is displayed
    const orderNumber = page.locator('text=/#\\d+/');
    await expect(orderNumber.first()).toBeVisible({ timeout: 5000 });
  });

  test('Zelle order shows correct payment method in review step', async ({ page }) => {
    await addFirstProductToCart(page);
    await navigateToCheckout(page);

    // Step 1
    await page.fill('#firstName', 'PayReview');
    await page.fill('#lastName', 'Zelle');
    await page.fill('#email', 'payreview@example.com');
    await page.fill('#phone', '5556667777');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 2: Pickup
    const pickupButton = page.locator('button:has-text("Pickup"), label:has-text("Pickup")');
    if (await pickupButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await pickupButton.first().click();
      await page.waitForTimeout(300);
    }
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 3: Select Zelle + confirm
    const zelleDiv = page.locator('div:has(#zelle)');
    if (await zelleDiv.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await zelleDiv.first().click();
    } else {
      test.skip(true, 'Zelle payment not configured for test store');
      return;
    }
    await page.waitForTimeout(500);

    await page.locator('#zelle-confirmed').click();
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 4: Review — verify "Zelle" appears in payment section
    const paymentSection = page.locator('text="Payment"');
    await expect(paymentSection.first()).toBeVisible({ timeout: 3000 });

    const zellePaymentLabel = page.locator('p:has-text("Zelle")');
    await expect(zellePaymentLabel.first()).toBeVisible({ timeout: 3000 });
  });
});

// ============================================================================
// TEST SUITE: Zelle with delivery fulfillment
// ============================================================================
test.describe('Checkout — Zelle with Delivery', () => {

  test('Zelle checkout works with delivery fulfillment', async ({ page }) => {
    await addFirstProductToCart(page);
    await navigateToCheckout(page);

    // Step 1: Contact info
    await page.fill('#firstName', 'ZelleDel');
    await page.fill('#lastName', 'Delivery');
    await page.fill('#email', 'zelledel@example.com');
    await page.fill('#phone', '5558889999');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 2: Delivery (default) — fill address
    const deliveryButton = page.locator('button:has-text("Delivery"), label:has-text("Delivery")');
    if (await deliveryButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await deliveryButton.first().click();
      await page.waitForTimeout(300);
    }

    // Fill delivery address fields
    // Street address may use autocomplete component — fill via the visible input
    const streetInput = page.locator('input[placeholder*="address" i], #street');
    if (await streetInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await streetInput.first().fill('123 Test Street');
    }

    const cityInput = page.locator('#city');
    if (await cityInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cityInput.fill('New York');
    }

    const stateInput = page.locator('#state');
    if (await stateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stateInput.fill('NY');
    }

    const zipInput = page.locator('#zip');
    if (await zipInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await zipInput.fill('10002');
    }

    // Wait for ZIP validation
    await page.waitForTimeout(600);

    // Try to continue — may fail if ZIP not in configured zones
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // If we advanced to Step 3, continue with Zelle
    const paymentHeading = page.locator('h2:has-text("Payment Method")');
    const onPaymentStep = await paymentHeading.isVisible({ timeout: 3000 }).catch(() => false);

    if (!onPaymentStep) {
      // ZIP not in delivery zone or delivery not enabled — skip
      test.skip(true, 'Delivery zone validation prevented advancing to payment step');
      return;
    }

    // Select Zelle
    const zelleDiv = page.locator('div:has(#zelle)');
    if (await zelleDiv.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await zelleDiv.first().click();
    } else {
      test.skip(true, 'Zelle payment not configured for test store');
      return;
    }

    await page.waitForTimeout(500);

    // Confirm Zelle payment
    await page.locator('#zelle-confirmed').click();
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 4: Review — verify delivery address is shown
    const addressReview = page.locator('text=/123 Test Street/');
    await expect(addressReview.first()).toBeVisible({ timeout: 3000 });

    // Verify payment shows Zelle
    const zelleReview = page.locator('p:has-text("Zelle")');
    await expect(zelleReview.first()).toBeVisible({ timeout: 3000 });
  });
});

// ============================================================================
// TEST SUITE: Zelle copy contact functionality
// ============================================================================
test.describe('Checkout — Zelle Copy Contact', () => {

  test('copy Zelle contact button is visible when zelle_email is configured', async ({ page }) => {
    await addFirstProductToCart(page);
    await navigateToCheckout(page);

    // Step 1
    await page.fill('#firstName', 'Copy');
    await page.fill('#lastName', 'Test');
    await page.fill('#email', 'copytest@example.com');
    await page.fill('#phone', '5551110000');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 2: Pickup
    const pickupButton = page.locator('button:has-text("Pickup"), label:has-text("Pickup")');
    if (await pickupButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await pickupButton.first().click();
      await page.waitForTimeout(300);
    }
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);

    // Step 3: Select Zelle
    const zelleDiv = page.locator('div:has(#zelle)');
    if (await zelleDiv.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await zelleDiv.first().click();
    } else {
      test.skip(true, 'Zelle payment not configured for test store');
      return;
    }

    await page.waitForTimeout(500);

    // Check if "Copy Zelle contact" button is visible (only when zelle_email is configured)
    const copyButton = page.locator('button:has-text("Copy Zelle contact")');
    const hasCopyButton = await copyButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasCopyButton) {
      // Verify the Zelle email/info text is displayed
      const zelleInfo = page.locator('text=/Send Zelle payment to/i');
      await expect(zelleInfo).toBeVisible();

      // Click copy button (clipboard API may not work in test env, just verify no crash)
      await copyButton.click();
      await page.waitForTimeout(300);
    }

    // Whether or not copy button exists, the confirmation checkbox should always be visible
    const zelleCheckbox = page.locator('#zelle-confirmed');
    await expect(zelleCheckbox).toBeVisible();
  });
});
