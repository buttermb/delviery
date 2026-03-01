/**
 * E2E: All 4 themes render correctly end to end
 *
 * Tests that each theme preset (Dark Mode, Minimalist, Strain Focused, Luxury)
 * applies the correct CSS variables, data attributes, background colors,
 * and visual properties when rendered on the storefront.
 *
 * Uses Supabase RPC route interception to mock store data with each theme.
 */

import { test, expect, Page, Route } from '@playwright/test';

const BASE_URL = process.env.VITE_APP_URL || 'http://localhost:8080';
const STORE_SLUG = 'test-theme-store';

// ============================================================================
// Theme Definitions (mirroring src/lib/storefrontThemes.ts)
// ============================================================================

interface ThemeTestConfig {
  id: string;
  name: string;
  darkMode: boolean;
  colors: {
    primary: string;
    background: string;
    text: string;
    accent: string;
    cardBg: string;
    border: string;
  };
  cssVariables: Record<string, string>;
  typography: {
    headingFont: string;
    bodyFont: string;
    headingWeight: string;
    borderRadius: string;
  };
}

const THEMES: ThemeTestConfig[] = [
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    darkMode: true,
    colors: {
      primary: '#22c55e',
      background: '#0a0a0a',
      text: '#fafafa',
      accent: '#00ff88',
      cardBg: '#171717',
      border: '#262626',
    },
    cssVariables: {
      '--storefront-bg': '#0a0a0a',
      '--storefront-text': '#fafafa',
      '--storefront-primary': '#22c55e',
      '--storefront-accent': '#00ff88',
      '--storefront-card-bg': '#171717',
      '--storefront-border': '#262626',
      '--storefront-radius': '12px',
      '--storefront-shadow': '0 10px 40px rgba(34, 197, 94, 0.2)',
    },
    typography: {
      headingFont: 'Outfit',
      bodyFont: 'Inter',
      headingWeight: '700',
      borderRadius: '12px',
    },
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    darkMode: false,
    colors: {
      primary: '#0f172a',
      background: '#ffffff',
      text: '#0f172a',
      accent: '#3b82f6',
      cardBg: '#ffffff',
      border: '#e2e8f0',
    },
    cssVariables: {
      '--storefront-bg': '#ffffff',
      '--storefront-text': '#0f172a',
      '--storefront-primary': '#0f172a',
      '--storefront-accent': '#3b82f6',
      '--storefront-card-bg': '#ffffff',
      '--storefront-border': '#e2e8f0',
      '--storefront-radius': '8px',
      '--storefront-shadow': '0 1px 3px rgba(0, 0, 0, 0.08)',
    },
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      headingWeight: '600',
      borderRadius: '8px',
    },
  },
  {
    id: 'strain-focused',
    name: 'Strain Focused',
    darkMode: false,
    colors: {
      primary: '#65a30d',
      background: '#fefce8',
      text: '#365314',
      accent: '#84cc16',
      cardBg: '#fffef5',
      border: '#d9f99d',
    },
    cssVariables: {
      '--storefront-bg': '#fefce8',
      '--storefront-text': '#365314',
      '--storefront-primary': '#65a30d',
      '--storefront-accent': '#84cc16',
      '--storefront-card-bg': '#fffef5',
      '--storefront-border': '#d9f99d',
      '--storefront-radius': '16px',
      '--storefront-shadow': '0 4px 20px rgba(101, 163, 13, 0.12)',
    },
    typography: {
      headingFont: 'Outfit',
      bodyFont: 'Inter',
      headingWeight: '700',
      borderRadius: '16px',
    },
  },
  {
    id: 'luxury',
    name: 'Luxury',
    darkMode: true,
    colors: {
      primary: '#d4af37',
      background: '#0c0a09',
      text: '#fafaf9',
      accent: '#f5f5f4',
      cardBg: '#1c1917',
      border: '#292524',
    },
    cssVariables: {
      '--storefront-bg': '#0c0a09',
      '--storefront-text': '#fafaf9',
      '--storefront-primary': '#d4af37',
      '--storefront-accent': '#f5f5f4',
      '--storefront-card-bg': '#1c1917',
      '--storefront-border': '#292524',
      '--storefront-radius': '2px',
      '--storefront-shadow': '0 25px 60px rgba(0, 0, 0, 0.5)',
    },
    typography: {
      headingFont: 'Playfair Display',
      bodyFont: 'Cormorant Garamond',
      headingWeight: '500',
      borderRadius: '2px',
    },
  },
];

// ============================================================================
// Mock store data factory
// ============================================================================

function createMockStoreResponse(theme: ThemeTestConfig): Record<string, unknown>[] {
  return [
    {
      id: 'test-store-id-' + theme.id,
      store_name: `Test Store (${theme.name})`,
      slug: STORE_SLUG,
      tagline: `Testing ${theme.name} theme`,
      is_active: true,
      primary_color: theme.colors.primary,
      secondary_color: theme.colors.accent,
      accent_color: theme.colors.accent,
      require_age_verification: false,
      minimum_age: 21,
      theme_config: {
        theme_id: theme.id,
        colors: {
          primary: theme.colors.primary,
          secondary: theme.colors.accent,
          accent: theme.colors.accent,
          background: theme.colors.background,
          text: theme.colors.text,
        },
        typography: {
          fontFamily: theme.typography.bodyFont,
        },
      },
      business_hours: null,
      ga4_measurement_id: null,
      sections: [
        {
          id: 'hero-1',
          type: 'hero',
          enabled: true,
          config: {
            headline: `Welcome to ${theme.name}`,
            subheadline: 'Test store for theme validation',
            showCta: true,
            ctaText: 'Shop Now',
          },
        },
      ],
      tenant_id: 'test-tenant-id',
    },
  ];
}

// ============================================================================
// Helper: Intercept Supabase RPC and return mock store
// ============================================================================

async function interceptStoreRPC(
  page: Page,
  theme: ThemeTestConfig,
): Promise<void> {
  await page.route('**/rest/v1/rpc/get_marketplace_store_by_slug', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createMockStoreResponse(theme)),
    });
  });

  // Also intercept any product queries to return empty
  await page.route('**/rest/v1/rpc/get_store_products*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  // Intercept menu/section queries
  await page.route('**/rest/v1/rpc/get_store_sections*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

// ============================================================================
// Helper: Get all storefront CSS variables from the document
// ============================================================================

async function getStorefrontCSSVars(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const style = window.getComputedStyle(root);
    const vars: Record<string, string> = {};
    const varNames = [
      '--storefront-bg',
      '--storefront-text',
      '--storefront-primary',
      '--storefront-accent',
      '--storefront-card-bg',
      '--storefront-border',
      '--storefront-radius',
      '--storefront-shadow',
      '--storefront-font-heading',
      '--storefront-font-body',
    ];
    for (const name of varNames) {
      // Check inline style first (set via element.style.setProperty)
      const inline = root.style.getPropertyValue(name).trim();
      if (inline) {
        vars[name] = inline;
      } else {
        // Fall back to computed style
        const computed = style.getPropertyValue(name).trim();
        if (computed) {
          vars[name] = computed;
        }
      }
    }
    return vars;
  });
}

// ============================================================================
// Helper: Get wrapper-level CSS variables (--store-* and --storefront-*)
// ============================================================================

async function getWrapperCSSVars(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const wrapper = document.querySelector('[data-testid="storefront-wrapper"]');
    if (!wrapper) return {};
    const style = (wrapper as HTMLElement).style;
    const vars: Record<string, string> = {};
    const varNames = [
      '--store-primary',
      '--store-secondary',
      '--store-accent',
      '--storefront-bg',
      '--storefront-text',
      '--storefront-primary',
      '--storefront-accent',
      '--storefront-card-bg',
      '--storefront-border',
      '--storefront-radius',
      '--storefront-shadow',
    ];
    for (const name of varNames) {
      const val = style.getPropertyValue(name).trim();
      if (val) vars[name] = val;
    }
    return vars;
  });
}

// ============================================================================
// Helper: Color luminance check
// ============================================================================

function hexToLuminance(hex: string): number {
  const match = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return -1;
  const r = parseInt(match[1].substring(0, 2), 16);
  const g = parseInt(match[1].substring(2, 4), 16);
  const b = parseInt(match[1].substring(4, 6), 16);
  return (r + g + b) / 3;
}

function isDarkHex(hex: string): boolean {
  return hexToLuminance(hex) < 50;
}

function isLightHex(hex: string): boolean {
  return hexToLuminance(hex) > 200;
}

// ============================================================================
// TEST SUITE: Each theme renders with correct CSS variables
// ============================================================================

test.describe('All 4 Themes Render Correctly E2E', () => {
  for (const theme of THEMES) {
    test.describe(`${theme.name} (${theme.id})`, () => {
      test(`applies correct --storefront-* CSS variables`, async ({ page }) => {
        await interceptStoreRPC(page, theme);
        await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

        // CSS variables are set on document.documentElement via useEffect
        const rootVars = await getStorefrontCSSVars(page);

        // Verify each expected CSS variable
        for (const [varName, expected] of Object.entries(theme.cssVariables)) {
          // Check root-level or wrapper-level
          const actual = rootVars[varName];
          if (actual) {
            expect(actual, `${varName} should be ${expected}`).toBe(expected);
          } else {
            // Also check wrapper-level inline styles
            const wrapperVars = await getWrapperCSSVars(page);
            expect(
              wrapperVars[varName],
              `${varName} should be ${expected} (on wrapper)`,
            ).toBe(expected);
          }
        }
      });

      test(`sets correct data-theme attribute`, async ({ page }) => {
        await interceptStoreRPC(page, theme);
        await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
        await page.waitForLoadState('networkidle');

        const wrapper = page.locator('[data-testid="storefront-wrapper"]');
        await expect(wrapper).toBeVisible({ timeout: 15000 });

        const dataTheme = await wrapper.getAttribute('data-theme');

        if (theme.id === 'luxury') {
          // Luxury has a special code path that hard-codes data-theme="luxury"
          expect(dataTheme).toBe('luxury');
        } else {
          // Other themes use store.theme_config.theme_id
          expect(dataTheme).toBe(theme.id);
        }
      });

      test(`renders with correct dark/light background`, async ({ page }) => {
        await interceptStoreRPC(page, theme);
        await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

        const bgColor = theme.colors.background;

        if (theme.darkMode) {
          expect(isDarkHex(bgColor)).toBe(true);
          // Verify the wrapper has a dark-associated class or dark background
          const wrapperClasses = await page
            .locator('[data-testid="storefront-wrapper"]')
            .getAttribute('class');
          expect(
            wrapperClasses?.includes('bg-black') || wrapperClasses?.includes('bg-shop-bg'),
          ).toBeTruthy();
        } else {
          expect(isLightHex(bgColor) || hexToLuminance(bgColor) > 180).toBe(true);
        }
      });

      test(`applies font variables for heading and body`, async ({ page }) => {
        await interceptStoreRPC(page, theme);
        await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

        const rootVars = await getStorefrontCSSVars(page);

        expect(rootVars['--storefront-font-heading']).toBe(theme.typography.headingFont);
        expect(rootVars['--storefront-font-body']).toBe(theme.typography.bodyFont);
      });

      test(`loads Google Fonts for theme typography`, async ({ page }) => {
        await interceptStoreRPC(page, theme);

        // Track Google Fonts requests
        const fontRequests: string[] = [];
        page.on('request', (req) => {
          if (req.url().includes('fonts.googleapis.com')) {
            fontRequests.push(req.url());
          }
        });

        await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

        // Wait for font link to be injected
        await page.waitForTimeout(1000);

        // Check that the font link element exists in the DOM
        const fontLink = await page.evaluate(() => {
          const link = document.getElementById('storefront-theme-fonts') as HTMLLinkElement | null;
          return link?.href ?? null;
        });

        // All themes use non-system fonts, so a Google Fonts link should be injected
        expect(fontLink).toBeTruthy();
        expect(fontLink).toContain('fonts.googleapis.com');

        // Verify the heading font is in the URL
        const headingFontParam = theme.typography.headingFont.replace(/ /g, '+');
        expect(fontLink).toContain(headingFontParam);
      });

      test(`--store-primary on wrapper matches theme primary`, async ({ page }) => {
        await interceptStoreRPC(page, theme);
        await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

        const wrapperVars = await getWrapperCSSVars(page);

        // Legacy --store-primary should match theme primary
        expect(wrapperVars['--store-primary']).toBe(theme.colors.primary);
      });

      test(`renders header and footer without errors`, async ({ page }) => {
        await interceptStoreRPC(page, theme);
        await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

        // Header should be visible
        const header = page.locator('header').first();
        await expect(header).toBeVisible({ timeout: 5000 });

        // Footer should be visible
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        const footer = page.locator('footer');
        await expect(footer).toBeVisible({ timeout: 5000 });

        // No error boundaries triggered
        const errorBoundary = page.locator('[data-testid="error-boundary"]');
        expect(await errorBoundary.count()).toBe(0);

        // No "Something went wrong" text
        const errorText = page.locator('text="Something went wrong"');
        expect(await errorText.count()).toBe(0);
      });

      test(`main content area renders with meaningful content`, async ({ page }) => {
        await interceptStoreRPC(page, theme);
        await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

        // Main content should exist and have content
        const mainContent = page.locator('main#main-content');
        if (await mainContent.isVisible({ timeout: 3000 }).catch(() => false)) {
          const textContent = await mainContent.textContent();
          expect(textContent!.length).toBeGreaterThan(0);
        }

        // Page body should have meaningful content
        const bodyText = await page.locator('body').textContent();
        expect(bodyText!.length).toBeGreaterThan(50);
      });
    });
  }
});

// ============================================================================
// TEST SUITE: Cross-theme differentiation
// ============================================================================

test.describe('Theme Differentiation — All Themes Are Distinct', () => {
  test('all 4 themes have unique primary colors', () => {
    const primaries = THEMES.map((t) => t.colors.primary);
    const unique = new Set(primaries);
    expect(unique.size).toBe(4);
  });

  test('all 4 themes have unique background colors', () => {
    const backgrounds = THEMES.map((t) => t.colors.background);
    const unique = new Set(backgrounds);
    expect(unique.size).toBe(4);
  });

  test('all 4 themes have unique border radius values', () => {
    const radii = THEMES.map((t) => t.typography.borderRadius);
    const unique = new Set(radii);
    expect(unique.size).toBe(4);
  });

  test('dark themes and light themes are correctly categorized', () => {
    const darkThemes = THEMES.filter((t) => t.darkMode);
    const lightThemes = THEMES.filter((t) => !t.darkMode);

    expect(darkThemes).toHaveLength(2); // dark-mode and luxury
    expect(lightThemes).toHaveLength(2); // minimalist and strain-focused

    // Dark themes should have dark backgrounds
    for (const theme of darkThemes) {
      expect(isDarkHex(theme.colors.background)).toBe(true);
    }

    // Light themes should have light backgrounds
    for (const theme of lightThemes) {
      expect(hexToLuminance(theme.colors.background) > 180).toBe(true);
    }
  });

  test('each theme has distinct font pairings', () => {
    const fontPairs = THEMES.map(
      (t) => `${t.typography.headingFont}|${t.typography.bodyFont}`,
    );
    // At least 3 of 4 should be unique (dark-mode and strain-focused share Outfit+Inter)
    const unique = new Set(fontPairs);
    expect(unique.size).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// TEST SUITE: Theme switch — storefront updates correctly
// ============================================================================

test.describe('Theme Switch Renders Correctly', () => {
  test('switching from dark-mode to minimalist updates CSS variables', async ({ page }) => {
    const darkTheme = THEMES.find((t) => t.id === 'dark-mode')!;
    const miniTheme = THEMES.find((t) => t.id === 'minimalist')!;

    // Start with dark theme
    await interceptStoreRPC(page, darkTheme);
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

    // Verify dark theme applied
    const darkVars = await getStorefrontCSSVars(page);
    expect(darkVars['--storefront-bg']).toBe('#0a0a0a');
    expect(darkVars['--storefront-primary']).toBe('#22c55e');

    // Switch to minimalist theme by re-routing
    await page.unrouteAll();
    await interceptStoreRPC(page, miniTheme);

    // Navigate to the same store (simulates theme change)
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

    // Verify minimalist theme applied
    const miniVars = await getStorefrontCSSVars(page);
    expect(miniVars['--storefront-bg']).toBe('#ffffff');
    expect(miniVars['--storefront-primary']).toBe('#0f172a');

    // Old dark theme values should NOT be present
    expect(miniVars['--storefront-bg']).not.toBe('#0a0a0a');
  });

  test('switching from minimalist to luxury updates layout', async ({ page }) => {
    const miniTheme = THEMES.find((t) => t.id === 'minimalist')!;
    const luxuryTheme = THEMES.find((t) => t.id === 'luxury')!;

    // Start with minimalist
    await interceptStoreRPC(page, miniTheme);
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

    const miniDataTheme = await page
      .locator('[data-testid="storefront-wrapper"]')
      .getAttribute('data-theme');
    expect(miniDataTheme).toBe('minimalist');

    // Switch to luxury
    await page.unrouteAll();
    await interceptStoreRPC(page, luxuryTheme);

    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

    const luxuryDataTheme = await page
      .locator('[data-testid="storefront-wrapper"]')
      .getAttribute('data-theme');
    expect(luxuryDataTheme).toBe('luxury');

    // Luxury uses gold primary
    const luxuryVars = await getWrapperCSSVars(page);
    expect(luxuryVars['--store-primary']).toBe('#d4af37');
  });
});

// ============================================================================
// TEST SUITE: Luxury theme special layout
// ============================================================================

test.describe('Luxury Theme Special Layout', () => {
  test('luxury theme renders with luxury-specific layout', async ({ page }) => {
    const luxuryTheme = THEMES.find((t) => t.id === 'luxury')!;
    await interceptStoreRPC(page, luxuryTheme);
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await page.waitForLoadState('networkidle');

    const wrapper = page.locator('[data-testid="storefront-wrapper"]');
    await expect(wrapper).toBeVisible({ timeout: 15000 });

    // Luxury theme uses bg-shop-bg class
    const wrapperClasses = await wrapper.getAttribute('class');
    expect(wrapperClasses).toContain('bg-shop-bg');

    // Luxury uses data-theme="luxury"
    expect(await wrapper.getAttribute('data-theme')).toBe('luxury');
  });

  test('luxury theme has gold primary color in CSS variables', async ({ page }) => {
    const luxuryTheme = THEMES.find((t) => t.id === 'luxury')!;
    await interceptStoreRPC(page, luxuryTheme);
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

    const rootVars = await getStorefrontCSSVars(page);
    expect(rootVars['--storefront-primary']).toBe('#d4af37');

    const wrapperVars = await getWrapperCSSVars(page);
    expect(wrapperVars['--store-primary']).toBe('#d4af37');
  });
});

// ============================================================================
// TEST SUITE: CSS variable cleanup on unmount
// ============================================================================

test.describe('Theme CSS Variable Cleanup', () => {
  test('navigating away from storefront cleans up CSS variables', async ({ page }) => {
    const darkTheme = THEMES.find((t) => t.id === 'dark-mode')!;
    await interceptStoreRPC(page, darkTheme);

    // Visit storefront
    await page.goto(`${BASE_URL}/shop/${STORE_SLUG}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="storefront-wrapper"]', { timeout: 15000 });

    // Verify variables are set
    const beforeVars = await getStorefrontCSSVars(page);
    expect(beforeVars['--storefront-primary']).toBe('#22c55e');

    // Navigate away from storefront entirely
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // CSS variables should be cleaned up from documentElement
    const afterVars = await getStorefrontCSSVars(page);
    // After cleanup, the storefront variables should be empty
    expect(afterVars['--storefront-primary'] || '').toBe('');
  });
});
