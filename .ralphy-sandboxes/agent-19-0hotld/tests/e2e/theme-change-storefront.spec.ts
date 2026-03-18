/**
 * E2E: Theme change reflects on public storefront (full flow)
 *
 * End-to-end flow test:
 * 1. Admin logs in, navigates to storefront builder
 * 2. Selects Dark Mode theme
 * 3. Saves/publishes
 * 4. Customer visits storefront, verifies dark bg + green accents
 * 5. All sections render correctly in new theme
 * 6. Sub-pages (product catalog) also inherit the theme
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:8080';

const STORE_SLUG = process.env.TEST_STORE_SLUG || 'willysbo';
const TENANT_SLUG = process.env.TEST_TENANT_SLUG || 'willysbo';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'alex@gmail.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Test123!';

const DARK_MODE_THEME = {
  id: 'dark-mode',
  background: '#0a0a0a',
  primary: '#22c55e',
  accent: '#00ff88',
  text: '#fafafa',
};

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

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/${TENANT_SLUG}/admin/**`, { timeout: 15000 });
}

async function handleAgeVerification(page: Page): Promise<void> {
  const ageButton = page.locator('button:has-text("21+"), button:has-text("I\'m 21")');
  if (await ageButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await ageButton.first().click();
    await page.waitForTimeout(500);
  }
}

/** Get --store-* CSS custom properties from the storefront wrapper. */
async function getStorefrontThemeVars(page: Page) {
  return page.evaluate(() => {
    const wrapper = document.querySelector('[data-testid="storefront-wrapper"]');
    if (!wrapper) return { storePrimary: '', storeSecondary: '', storeAccent: '' };
    const style = (wrapper as HTMLElement).style;
    return {
      storePrimary: style.getPropertyValue('--store-primary').trim(),
      storeSecondary: style.getPropertyValue('--store-secondary').trim(),
      storeAccent: style.getPropertyValue('--store-accent').trim(),
    };
  });
}

/** Get --storefront-* CSS variables from the document root. */
async function getRootThemeVars(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const style = root.style;
    return {
      bg: style.getPropertyValue('--storefront-bg').trim(),
      text: style.getPropertyValue('--storefront-text').trim(),
      primary: style.getPropertyValue('--storefront-primary').trim(),
      accent: style.getPropertyValue('--storefront-accent').trim(),
      cardBg: style.getPropertyValue('--storefront-card-bg').trim(),
    };
  });
}

/** Check if an rgb/hex color string is dark (avg luminance < 50). */
function isDarkColor(colorStr: string): boolean {
  const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const avg =
      (parseInt(rgbMatch[1], 10) + parseInt(rgbMatch[2], 10) + parseInt(rgbMatch[3], 10)) / 3;
    return avg < 50;
  }
  const hexMatch = colorStr.match(/#([0-9a-fA-F]{6})/);
  if (hexMatch) {
    const r = parseInt(hexMatch[1].substring(0, 2), 16);
    const g = parseInt(hexMatch[1].substring(2, 4), 16);
    const b = parseInt(hexMatch[1].substring(4, 6), 16);
    return (r + g + b) / 3 < 50;
  }
  return false;
}

/** Attempt to select the Dark Mode theme in the admin storefront builder. */
async function selectDarkModeTheme(page: Page): Promise<boolean> {
  // Try advanced mode preset button first
  const darkPreset = page.locator('[data-testid="theme-preset-dark-mode"]');
  if (await darkPreset.isVisible({ timeout: 3000 }).catch(() => false)) {
    await darkPreset.click();
    await page.waitForTimeout(500);
    return true;
  }

  // Try the theme preview card variant
  const darkPreview = page.locator('[data-testid="theme-preview-dark-mode"]');
  if (await darkPreview.isVisible({ timeout: 3000 }).catch(() => false)) {
    await darkPreview.click();
    await page.waitForTimeout(500);
    return true;
  }

  // Switch to advanced mode if available, then retry
  const advancedButton = page.locator('button:has-text("Advanced")');
  if (await advancedButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await advancedButton.click();
    await page.waitForTimeout(1000);

    if (await darkPreset.isVisible({ timeout: 3000 }).catch(() => false)) {
      await darkPreset.click();
      await page.waitForTimeout(500);
      return true;
    }
  }

  return false;
}

/** Click Save Draft or Publish and wait for the success toast. */
async function saveOrPublish(page: Page): Promise<void> {
  const publishButton = page.locator('button:has-text("Publish")').first();
  const saveDraftButton = page.locator('button:has-text("Save Draft")').first();

  if (await publishButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await publishButton.click();
  } else if (await saveDraftButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveDraftButton.click();
  } else {
    throw new Error('Neither Save Draft nor Publish button found in builder');
  }

  // Wait for success toast from Sonner
  const successToast = page.locator(
    '[data-sonner-toast]:has-text("saved"), [data-sonner-toast]:has-text("published"), [data-sonner-toast]:has-text("success"), [data-sonner-toast]:has-text("Success")',
  );
  await expect(successToast.first()).toBeVisible({ timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Theme Change Reflects on Public Storefront', () => {
  test.describe.configure({ mode: 'serial' });

  /**
   * Full E2E: Admin changes theme → customer sees updated storefront.
   *
   * Steps:
   * 1. Admin logs in, opens storefront builder
   * 2. Selects Dark Mode theme
   * 3. Publishes the change
   * 4. Customer visits the storefront
   * 5. Verifies dark background, green accents, and no errors
   */
  test('admin changes theme and customer sees it on storefront', async ({ page }) => {
    // ---- Step 1: Admin logs in and navigates to storefront builder ----
    await clearBrowserStorage(page);
    await loginAsAdmin(page);

    await page.goto(`${BASE_URL}/${TENANT_SLUG}/admin/storefront-hub?tab=builder`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Let builder hydrate

    // Verify builder is accessible
    const builderContent = page.locator(
      '[data-testid^="theme-preset-"], [data-testid^="theme-preview-"], button:has-text("Save Draft"), button:has-text("Publish")',
    );
    const hasBuilder = await builderContent.first().isVisible({ timeout: 15000 }).catch(() => false);
    test.skip(!hasBuilder, 'Storefront builder not accessible — store may not exist');

    // ---- Step 2: Select Dark Mode theme ----
    const selected = await selectDarkModeTheme(page);
    test.skip(!selected, 'Could not find Dark Mode theme preset in builder');

    // ---- Step 3: Save / Publish the change ----
    await saveOrPublish(page);

    // Give the DB a moment to settle
    await page.waitForTimeout(1000);

    // ---- Step 4: Customer visits the storefront ----
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    const wrapper = page.locator('[data-testid="storefront-wrapper"]');
    await expect(wrapper).toBeVisible({ timeout: 10000 });

    // ---- Step 5: Verify dark background ----
    const wrapperBg = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="storefront-wrapper"]');
      if (!el) return '';
      return window.getComputedStyle(el).backgroundColor;
    });

    // The wrapper or root should have a dark background
    const rootVars = await getRootThemeVars(page);
    const themeVars = await getStorefrontThemeVars(page);

    // At least one dark-bg indicator should be true:
    // - computed bg is dark, OR
    // - --storefront-bg is dark hex, OR
    // - --store-primary matches dark-mode primary (#22c55e)
    const bgIsDark =
      isDarkColor(wrapperBg) ||
      isDarkColor(rootVars.bg) ||
      rootVars.bg.toLowerCase() === DARK_MODE_THEME.background;
    const primaryIsGreen =
      themeVars.storePrimary.toLowerCase() === DARK_MODE_THEME.primary ||
      rootVars.primary.toLowerCase() === DARK_MODE_THEME.primary;

    expect(bgIsDark || primaryIsGreen).toBeTruthy();

    // ---- Step 6: Verify green accents are present ----
    // Check that at least one interactive element uses the green accent color
    const hasGreenAccent = await page.evaluate((darkTheme) => {
      const elements = document.querySelectorAll('button, a, [role="button"]');
      return Array.from(elements).some((el) => {
        const styles = window.getComputedStyle(el);
        return (
          styles.backgroundColor.includes('34, 197, 94') || // rgb for #22c55e
          styles.color.includes('34, 197, 94') ||
          styles.backgroundColor.includes('0, 255, 136') || // rgb for #00ff88
          styles.color.includes('0, 255, 136') ||
          (el as HTMLElement).style.backgroundColor === darkTheme.primary ||
          (el as HTMLElement).style.color === darkTheme.primary
        );
      });
    }, DARK_MODE_THEME);

    // Green accents should be present (buttons, links, CTA, etc.)
    expect(hasGreenAccent || primaryIsGreen).toBeTruthy();

    // ---- Step 7: No error states on the page ----
    const errorText = page.locator('text="Something went wrong"');
    expect(await errorText.count()).toBe(0);

    const errorBoundary = page.locator('[data-testid="error-boundary"]');
    expect(await errorBoundary.count()).toBe(0);
  });

  test('all storefront sections render correctly after theme change', async ({ page }) => {
    // Visit the storefront (theme should already be dark from previous test)
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const wrapper = page.locator('[data-testid="storefront-wrapper"]');
    await expect(wrapper).toBeVisible({ timeout: 10000 });

    // Main content area should render
    const mainContent = page.locator('main#main-content');
    await expect(mainContent).toBeVisible({ timeout: 5000 });

    // Page should have meaningful content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);

    // Header should be visible and themed
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 5000 });

    // Scroll to bottom to check footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 5000 });

    // Dark theme: header should not have a bright white background
    const headerBg = await page.evaluate(() => {
      const h = document.querySelector('header');
      return h ? window.getComputedStyle(h).backgroundColor : '';
    });
    if (headerBg && !headerBg.includes('rgba(0, 0, 0, 0)')) {
      // If header has an opaque background in a dark theme, it shouldn't be white
      const isWhite =
        headerBg === 'rgb(255, 255, 255)' || headerBg === 'rgba(255, 255, 255, 1)';
      // Allow transparent or dark backgrounds, but pure white is wrong for dark theme
      const rootVars = await getRootThemeVars(page);
      if (rootVars.bg.toLowerCase() === DARK_MODE_THEME.background) {
        expect(isWhite).toBeFalsy();
      }
    }
  });

  test('product catalog page inherits dark theme', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}/products`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');

    const wrapper = page.locator('[data-testid="storefront-wrapper"]');
    const isVisible = await wrapper.isVisible({ timeout: 10000 }).catch(() => false);

    if (isVisible) {
      const themeVars = await getStorefrontThemeVars(page);
      const rootVars = await getRootThemeVars(page);

      // Theme vars should be set on the catalog sub-page too
      expect(themeVars.storePrimary || rootVars.primary).toBeTruthy();

      // Verify the primary matches dark-mode green or the root bg is dark
      const primaryIsGreen =
        themeVars.storePrimary.toLowerCase() === DARK_MODE_THEME.primary ||
        rootVars.primary.toLowerCase() === DARK_MODE_THEME.primary;
      const bgIsDark = isDarkColor(rootVars.bg) || rootVars.bg.toLowerCase() === DARK_MODE_THEME.background;

      expect(primaryIsGreen || bgIsDark).toBeTruthy();
    }

    // Catalog should show products or an empty state
    const hasContent = page.locator(
      '[data-testid="product-card"], [data-testid="empty-catalog"], h1, h2',
    );
    await expect(hasContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('theme persists after hard refresh', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 10000 });

    // Capture theme vars before refresh
    const before = await getStorefrontThemeVars(page);
    const rootBefore = await getRootThemeVars(page);

    // Hard refresh
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 10000 });

    // Capture theme vars after refresh
    const after = await getStorefrontThemeVars(page);
    const rootAfter = await getRootThemeVars(page);

    // Theme should be identical — no stale cache
    expect(after.storePrimary).toBe(before.storePrimary);
    expect(after.storeAccent).toBe(before.storeAccent);
    expect(rootAfter.bg).toBe(rootBefore.bg);
    expect(rootAfter.primary).toBe(rootBefore.primary);
  });

  test('text is readable in dark theme', async ({ page }) => {
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await handleAgeVerification(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Collect heading text colors
    const headingColors = await page.evaluate(() => {
      const headings = document.querySelectorAll('h1, h2, h3');
      return Array.from(headings).map((h) => {
        const styles = window.getComputedStyle(h);
        return { text: (h.textContent ?? '').substring(0, 30), color: styles.color };
      });
    });

    // Every heading should have a visible (non-transparent) color
    for (const h of headingColors) {
      expect(h.color).toBeTruthy();
      expect(h.color).not.toBe('rgba(0, 0, 0, 0)');
    }

    // On a dark background, body text should be light (not black)
    const rootVars = await getRootThemeVars(page);
    if (rootVars.bg.toLowerCase() === DARK_MODE_THEME.background) {
      // Dark theme text color should be a light value
      expect(rootVars.text).toBeTruthy();
      // #fafafa or similar light color expected
      const hexMatch = rootVars.text.match(/#([0-9a-fA-F]{6})/);
      if (hexMatch) {
        const r = parseInt(hexMatch[1].substring(0, 2), 16);
        const g = parseInt(hexMatch[1].substring(2, 4), 16);
        const b = parseInt(hexMatch[1].substring(4, 6), 16);
        expect((r + g + b) / 3).toBeGreaterThan(150);
      }
    }
  });
});
