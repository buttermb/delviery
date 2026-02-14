import { test, expect } from '@playwright/test';

/**
 * E2E Security Tests for Disposable Menus
 * 
 * These tests validate the complete security workflow:
 * 1. Menu creation with encryption
 * 2. Access control (whitelist, tokens)
 * 3. Velocity detection and rate limiting
 * 4. Auto-burn conditions
 * 5. Security event logging
 */

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:5173';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'TestPass123!';
const TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'test-tenant';

test.describe('Disposable Menu Security Flow', () => {
    let menuAccessUrl: string;
    let menuId: string;

    test.beforeAll(async () => {
        // Setup: Ensure test tenant exists
        console.log('🔧 Setting up E2E test environment...');
    });

    test('Admin can create an encrypted menu', async ({ page }) => {
        // Navigate to admin login
        await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/login`);

        // Login
        await page.fill('input[type="email"]', ADMIN_EMAIL);
        await page.fill('input[type="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');

        // Wait for redirect to dashboard
        await page.waitForURL(`**/${TENANT_SLUG}/admin/**`);

        // Navigate to Disposable Menus
        await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/disposable-menus`);

        // Click "New Menu" button
        await page.click('button:has-text("New Menu")');

        // Fill in menu details
        await page.fill('input[name="name"]', 'E2E Test Menu');
        await page.fill('textarea[name="description"]', 'Automated security test');

        // Select products (if available)
        const productCheckbox = page.locator('input[type="checkbox"]').first();
        if (await productCheckbox.isVisible()) {
            await productCheckbox.check();
        }

        // Set security settings
        await page.click('button:has-text("Security")');
        await page.fill('input[name="max_views"]', '5');
        await page.check('input[name="auto_burn"]');

        // Create menu
        await page.click('button:has-text("Create Menu")');

        // Wait for success
        await page.waitForSelector('text=/created successfully/i');

        // Extract menu URL (should be shown in a dialog or card)
        const menuCard = page.locator('[data-testid="menu-card"]').first();
        menuAccessUrl = await menuCard.getAttribute('data-access-url') || '';
        menuId = await menuCard.getAttribute('data-menu-id') || '';

        expect(menuAccessUrl).toBeTruthy();
        expect(menuId).toBeTruthy();
    });

    test('Customer can access menu with valid token', async ({ page }) => {
        test.skip(!menuAccessUrl, 'No menu URL from previous test');

        // Access menu as customer
        await page.goto(menuAccessUrl);

        // Should see menu content (not blocked)
        await expect(page.locator('h1')).toContainText('E2E Test Menu');

        // Verify screenshot protection is active
        const watchers = await page.evaluate(() => {
            return {
                hasDevToolsListener: window.hasOwnProperty('devtools'),
                hasContextMenu: document.oncontextmenu !== null,
            };
        });

        expect(watchers.hasContextMenu).toBe(true);
    });

    test('Rapid access triggers velocity detection', async ({ browser }) => {
        test.skip(!menuAccessUrl, 'No menu URL from previous test');

        // Create multiple browser contexts (simulate different users)
        const contexts = await Promise.all([
            browser.newContext(),
            browser.newContext(),
            browser.newContext(),
        ]);

        const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));

        // Access menu rapidly
        await Promise.all(pages.map(page => page.goto(menuAccessUrl)));

        // Wait a bit for backend processing
        await pages[0].waitForTimeout(1000);

        // Check if velocity warning is shown
        const alerts = await Promise.all(
            pages.map(page => page.locator('text=/suspicious activity/i').count())
        );

        const hasAlert = alerts.some(count => count > 0);
        expect(hasAlert).toBe(true);

        // Cleanup
        await Promise.all(contexts.map(ctx => ctx.close()));
    });

    test('Menu auto-burns after max views exceeded', async ({ page }) => {
        test.skip(!menuAccessUrl, 'No menu URL from previous test');

        // Access menu multiple times to exceed max_views (5)
        for (let i = 0; i < 6; i++) {
            await page.goto(menuAccessUrl);
            await page.waitForTimeout(500);
        }

        // On 6th access, should see "burned" message
        await page.goto(menuAccessUrl);

        await expect(page.locator('text=/menu.*burned/i')).toBeVisible();
    });

    test('Admin sees security events in dashboard', async ({ page }) => {
        test.skip(!menuId, 'No menu ID from previous test');

        // Navigate to admin dashboard
        await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/disposable-menus`);

        // Go to Security tab
        await page.click('button[role="tab"]:has-text("Security")');

        // Should see security events related to this menu
        const eventsList = page.locator('[data-testid="security-events"]');
        await expect(eventsList).toBeVisible();

        // Verify event contains our menu
        const menuEvent = eventsList.locator(`text=/${menuId.slice(0, 8)}/`);
        await expect(menuEvent).toBeVisible();
    });

    test('Unauthorized access without token is blocked', async ({ page }) => {
        // Try to access menu without proper token
        await page.goto(`${BASE_URL}/menu/invalid-token-12345`);

        // Should see error or "not found" message
        await expect(
            page.locator('text=/not found|invalid|access denied/i')
        ).toBeVisible();
    });

    test.afterAll(async ({ request }) => {
        // Cleanup: Delete test menu
        if (menuId) {
            console.log('🧹 Cleaning up test menu:', menuId);
            // This would call the menu deletion endpoint
            // await request.delete(`${BASE_URL}/api/menus/${menuId}`);
        }
    });
});

test.describe('Panic Mode Security Test', () => {
    test('Admin can trigger Panic Mode', async ({ page }) => {
        // Login as admin
        await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/login`);
        await page.fill('input[type="email"]', ADMIN_EMAIL);
        await page.fill('input[type="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');

        await page.waitForURL(`**/${TENANT_SLUG}/admin/**`);

        // Navigate to disposable menus
        await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/disposable-menus`);

        // Click Panic Mode button
        await page.click('button:has-text("Panic Mode")');

        // Confirm action
        await page.click('button:has-text("Confirm")');

        // Should see success message
        await expect(page.locator('text=/panic mode activated/i')).toBeVisible();

        // All menus should be locked
        const menuCards = page.locator('[data-testid="menu-card"]');
        const count = await menuCards.count();

        for (let i = 0; i < count; i++) {
            const status = await menuCards.nth(i).locator('[data-testid="menu-status"]').textContent();
            expect(status?.toLowerCase()).toContain('locked');
        }
    });
});
