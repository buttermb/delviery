import { test, expect } from '@playwright/test';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:5173';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'TestPass123!';
const TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'test-tenant';

test.describe('Menu Creation Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/login`);
        await page.fill('input[type="email"]', ADMIN_EMAIL);
        await page.fill('input[type="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(`**/${TENANT_SLUG}/admin/**`);
    });

    test('Should validate required fields in Create Menu Wizard', async ({ page }) => {
        await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/disposable-menus`);

        // Open dialog
        await page.click('button:has-text("Create Menu")');

        // Try to submit without name
        await page.click('button:has-text("Next")');

        // Check for validation error
        // Note: Actual validation might be browser-native or UI-based. 
        // Assuming UI based on previous code reviews.
        const nextButton = page.locator('button:has-text("Next")');
        // If validation prevents progress, we should still be on step 1
        await expect(page.locator('text=Menu Details')).toBeVisible();
    });

    test('Should successfully create a new disposable menu', async ({ page }) => {
        await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/disposable-menus`);

        // Open dialog
        await page.click('button:has-text("Create Menu")');

        // Step 1: Details
        await page.fill('input[name="name"]', 'Playwright Test Menu');
        await page.fill('textarea[name="description"]', 'Created via automated test');
        await page.click('button:has-text("Next")');

        // Step 2: Products
        // Select first available product if any
        const productCheckbox = page.locator('input[type="checkbox"]').first();
        if (await productCheckbox.isVisible()) {
            await productCheckbox.check();
        }
        await page.click('button:has-text("Next")');

        // Step 3: Settings (Defaults)
        await page.click('button:has-text("Next")');

        // Step 4: Review & Create
        await page.click('button:has-text("Create Menu")');

        // Verify success toast
        await expect(page.locator('text=Menu Created')).toBeVisible({ timeout: 10000 });

        // Verify menu appears in list
        await expect(page.locator('text=Playwright Test Menu')).toBeVisible();
    });

    test('Button Tester page should be accessible', async ({ page }) => {
        await page.goto(`${BASE_URL}/admin/button-tester`);
        await expect(page.locator('h1')).toContainText('Button Health Monitor');

        // Check if scan button exists
        await expect(page.locator('button:has-text("Start Scan")')).toBeVisible();
    });
});
