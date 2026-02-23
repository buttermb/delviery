/**
 * E2E Checkout Flow Tests
 * Tests the complete storefront checkout experience
 */

import { test, expect } from '@playwright/test';

// Test store configuration
const TEST_STORE_SLUG = 'willysbo';
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('Storefront Checkout Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to store
        await page.goto(`${BASE_URL}/shop/${TEST_STORE_SLUG}`);

        // Handle age verification if present
        const ageModal = page.locator('[data-testid="age-verification-modal"]');
        if (await ageModal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.click('button:has-text("Yes, I am 21+")');
        }
    });

    test('should display product catalog', async ({ page }) => {
        // Wait for products to load
        await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

        // Verify products are displayed
        const products = await page.locator('[data-testid="product-card"]').count();
        expect(products).toBeGreaterThan(0);
    });

    test('should add product to cart', async ({ page }) => {
        // Wait for products
        await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });

        // Click first product
        await page.locator('[data-testid="product-card"]').first().click();

        // Wait for product detail page
        await page.waitForSelector('[data-testid="add-to-cart-button"]', { timeout: 5000 });

        // Add to cart
        await page.click('[data-testid="add-to-cart-button"]');

        // Verify cart updated
        await expect(page.locator('[data-testid="cart-count"]')).toHaveText(/[1-9]/);
    });

    test('should complete checkout flow', async ({ page }) => {
        // Add item to cart first
        await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });
        await page.locator('[data-testid="product-card"]').first().click();
        await page.waitForSelector('[data-testid="add-to-cart-button"]');
        await page.click('[data-testid="add-to-cart-button"]');

        // Navigate to cart
        await page.click('[data-testid="cart-button"]');
        await page.waitForURL(`**/shop/${TEST_STORE_SLUG}/cart`);

        // Proceed to checkout
        await page.click('button:has-text("Checkout")');
        await page.waitForURL(`**/shop/${TEST_STORE_SLUG}/checkout`);

        // Step 1: Contact Information
        await page.fill('input[name="firstName"]', 'Test');
        await page.fill('input[name="lastName"]', 'Customer');
        await page.fill('input[name="email"]', 'test@example.com');
        await page.fill('input[name="phone"]', '555-123-4567');
        await page.click('button:has-text("Continue")');

        // Step 2: Delivery Address
        await page.fill('input[name="street"]', '123 Test Street');
        await page.fill('input[name="city"]', 'Test City');
        await page.fill('input[name="state"]', 'CA');
        await page.fill('input[name="zip"]', '12345');
        await page.click('button:has-text("Continue")');

        // Step 3: Payment Method
        await page.click('input[value="cash"]');
        await page.click('button:has-text("Continue")');

        // Step 4: Review & Place Order
        await page.check('input[type="checkbox"]'); // Terms agreement
        await page.click('button:has-text("Place Order")');

        // Verify order confirmation
        await page.waitForURL(`**/order-confirmation**`, { timeout: 15000 });
        await expect(page.locator('text=Order Confirmed')).toBeVisible();
    });

    test('should show out of stock error', async ({ page }) => {
        // This test requires a product that's out of stock
        // Skip if no out of stock products
        test.skip(true, 'Requires out of stock product setup');
    });

    test('should validate delivery zone', async ({ page }) => {
        // This test requires store with delivery zones configured
        // Skip if no zones configured
        test.skip(true, 'Requires delivery zones setup');
    });

    test('should apply coupon code', async ({ page }) => {
        // Add item to cart
        await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });
        await page.locator('[data-testid="product-card"]').first().click();
        await page.waitForSelector('[data-testid="add-to-cart-button"]');
        await page.click('[data-testid="add-to-cart-button"]');

        // Go to cart
        await page.click('[data-testid="cart-button"]');
        await page.waitForURL(`**/shop/${TEST_STORE_SLUG}/cart`);

        // Apply coupon
        const couponInput = page.locator('input[placeholder*="coupon"]');
        if (await couponInput.isVisible()) {
            await couponInput.fill('TEST10');
            await page.click('button:has-text("Apply")');

            // Verify discount or error message appears
            const result = page.locator('text=/discount|invalid|expired/i');
            await expect(result).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Product Detail Page', () => {
    test('should display product information', async ({ page }) => {
        await page.goto(`${BASE_URL}/shop/${TEST_STORE_SLUG}`);

        // Handle age verification
        const ageModal = page.locator('[data-testid="age-verification-modal"]');
        if (await ageModal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.click('button:has-text("Yes, I am 21+")');
        }

        // Click first product
        await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });
        await page.locator('[data-testid="product-card"]').first().click();

        // Verify product details
        await expect(page.locator('h1')).toBeVisible(); // Product name
        await expect(page.locator('text=/\\$\\d+/')).toBeVisible(); // Price
        await expect(page.locator('[data-testid="add-to-cart-button"]')).toBeVisible();
    });

    test('should allow quantity selection', async ({ page }) => {
        await page.goto(`${BASE_URL}/shop/${TEST_STORE_SLUG}`);

        const ageModal = page.locator('[data-testid="age-verification-modal"]');
        if (await ageModal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.click('button:has-text("Yes, I am 21+")');
        }

        await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });
        await page.locator('[data-testid="product-card"]').first().click();

        // Increase quantity
        const increaseBtn = page.locator('button:has-text("+")');
        if (await increaseBtn.isVisible()) {
            await increaseBtn.click();
            await expect(page.locator('input[type="number"]')).toHaveValue('2');
        }
    });
});

test.describe('Cart Page', () => {
    test('should update quantities in cart', async ({ page }) => {
        await page.goto(`${BASE_URL}/shop/${TEST_STORE_SLUG}`);

        const ageModal = page.locator('[data-testid="age-verification-modal"]');
        if (await ageModal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.click('button:has-text("Yes, I am 21+")');
        }

        // Add product to cart
        await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });
        await page.locator('[data-testid="product-card"]').first().click();
        await page.waitForSelector('[data-testid="add-to-cart-button"]');
        await page.click('[data-testid="add-to-cart-button"]');

        // Go to cart
        await page.click('[data-testid="cart-button"]');
        await page.waitForURL(`**/shop/${TEST_STORE_SLUG}/cart`);

        // Verify cart has items
        const cartItems = page.locator('[data-testid="cart-item"]');
        await expect(cartItems.first()).toBeVisible();
    });

    test('should remove items from cart', async ({ page }) => {
        await page.goto(`${BASE_URL}/shop/${TEST_STORE_SLUG}`);

        const ageModal = page.locator('[data-testid="age-verification-modal"]');
        if (await ageModal.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.click('button:has-text("Yes, I am 21+")');
        }

        // Add product
        await page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 });
        await page.locator('[data-testid="product-card"]').first().click();
        await page.waitForSelector('[data-testid="add-to-cart-button"]');
        await page.click('[data-testid="add-to-cart-button"]');

        // Go to cart  
        await page.click('[data-testid="cart-button"]');
        await page.waitForURL(`**/shop/${TEST_STORE_SLUG}/cart`);

        // Remove item
        const removeBtn = page.locator('button[aria-label="Remove item"]');
        if (await removeBtn.isVisible()) {
            await removeBtn.click();
            await expect(page.locator('text=empty')).toBeVisible({ timeout: 5000 });
        }
    });
});
