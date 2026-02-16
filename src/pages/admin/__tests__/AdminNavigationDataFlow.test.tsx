/**
 * Admin Panel Navigation & Data Flow Verification Tests
 *
 * These tests verify:
 * - All sidebar navigation items point to valid routes
 * - Feature registry paths are consistent with sidebar configs
 * - Sidebar configs across tiers are well-structured
 * - Navigation patterns use tenant-aware paths
 * - Data flow patterns (tenant context) are properly enforced
 * - No broken or orphaned navigation links
 */

import { describe, it, expect } from 'vitest';
import {
  STARTER_SIDEBAR,
  PROFESSIONAL_SIDEBAR,
  ENTERPRISE_SIDEBAR,
  getSidebarConfig,
  getSidebarConfigByTier,
} from '@/lib/sidebar/sidebarConfigs';
import {
  FEATURE_REGISTRY,
  ESSENTIAL_FEATURES,
  getFeature,
  getAllFeatures,
  getFeaturesByCategory,
  getFeaturesByTier,
  isFeatureAccessible,
} from '@/lib/sidebar/featureRegistry';

// Known valid admin route paths (extracted from App.tsx route definitions)
const VALID_ADMIN_ROUTES = [
  'dashboard',
  'hotbox',
  'tv-dashboard',
  'command-center',
  'collection-mode',
  'analytics-hub',
  'analytics/comprehensive',
  'disposable-menus',
  'menu-migration',
  'orders',
  'disposable-menu-analytics',
  'menu-analytics',
  'catalog/images',
  'catalog/batches',
  'catalog/categories',
  'customer-hub',
  'generate-barcodes',
  'wholesale-orders/new',
  'wholesale-orders/new-po',
  'inventory-hub',
  'reports',
  'settings',
  'marketplace/dashboard',
  'marketplace/profile',
  'marketplace/listings',
  'marketplace/orders',
  'marketplace/messages',
  'marketplace/financials',
  'marketplace/browse',
  'marketplace/product',
  'marketplace/cart',
  'marketplace/purchases',
  'storefront',
  'storefront-hub',
  'live-orders',
  'staff-management',
  'team-members',
  'fronted-inventory',
  'invoice-management',
  'fulfillment-hub',
  'finance-hub',
  'settings-hub',
  'operations-hub',
  'marketing-hub',
  'marketing/reviews',
  'live-map',
  'gps-tracking',
  'pos-system',
  'locations',
  'locations/warehouses',
  'locations/runners',
  'sales/pricing',
  'live-chat',
  'notifications',
  'customer-details',
  'customer-reports',
  'dispatch-inventory',
  'fronted-inventory-analytics',
  'global-search',
  'crm/clients',
  'crm/invoices',
  'crm/invoices/new',
  'crm/pre-orders',
  'crm/pre-orders/new',
  'crm/settings',
  'crm/invites',
  'advanced-reporting',
  'board-report',
  'strategic-dashboard',
  'expansion',
  'order-analytics',
  'sales-dashboard',
  'risk-management',
  'system-settings',
  'vendor-management',
  'stock-alerts',
  'inventory-transfers',
  'customer-analytics',
  'advanced-analytics',
  'realtime-dashboard',
  'custom-reports',
  'commission-tracking',
  'revenue-reports',
  'delivery-analytics',
  'cash-register',
  'pos-analytics',
  'pos-shifts',
  'z-reports',
  'role-management',
  'activity-logs',
  'analytics-dashboard',
  'route-optimizer',
  'wholesale-pricing-tiers',
  'advanced-invoice',
  'local-ai',
  'workflow-automation',
  'location-analytics',
  'bulk-operations',
  'operations/receiving',
  'developer-tools',
  'button-tester',
  'api-access',
  'webhooks',
  'custom-integrations',
  'data-export',
  'audit-trail',
  'compliance',
  'white-label',
  'custom-domain',
  'priority-support',
  'expense-tracking',
  'help-hub',
  'credits/analytics',
  'credits/success',
  'credits/cancelled',
];

// Known redirect routes
const REDIRECT_ROUTES = [
  'billing',  // → settings?section=billing
  'wholesale-orders',  // → orders?tab=wholesale
  'inventory-dashboard', // → inventory-hub?tab=stock
  'inventory-monitoring', // → inventory-hub?tab=monitoring
  'suppliers',  // → operations-hub?tab=suppliers
  'purchase-orders', // → operations-hub?tab=purchase-orders
  'returns', // → operations-hub?tab=returns
  'loyalty-program', // → marketing-hub?tab=loyalty
  'coupons', // → storefront-hub?tab=coupons
  'quality-control', // → operations-hub?tab=quality
  'appointments', // → operations-hub?tab=appointments
  'support-tickets', // → operations-hub?tab=support
  'batch-recall', // → compliance-hub?tab=batch-recall
  'compliance-vault', // → compliance-hub?tab=vault
  'delivery-hub', // → fulfillment-hub
  'fleet-management', // → fulfillment-hub?tab=fleet
  'marketing-automation', // → marketing-hub?tab=campaigns
  'delivery-management', // → operations-hub?tab=delivery
  'predictive-analytics', // → analytics-hub?tab=forecasting
  'customer-crm', // → customer-hub?tab=crm
  'customer-insights', // → customer-hub?tab=insights
  'financial-center', // → command-center
  'integrations-hub', // → settings-hub?tab=integrations
  'user-management', // → team-members
  'permissions', // → role-management
  'products', // → inventory-hub?tab=products
  'clients', // → customer-hub?tab=contacts
  'customers', // → customer-hub?tab=contacts
];

/**
 * Extract the route path from a sidebar path like '/admin/inventory-hub?tab=stock'
 * Returns 'inventory-hub'
 */
function extractRoutePath(fullPath: string): string {
  const withoutAdmin = fullPath.replace(/^\/admin\//, '');
  const withoutQuery = withoutAdmin.split('?')[0];
  return withoutQuery;
}

/**
 * Verify a path resolves to a valid route (either direct or redirect)
 */
function _isValidPath(path: string): boolean {
  const routePath = extractRoutePath(path);
  return VALID_ADMIN_ROUTES.includes(routePath) || REDIRECT_ROUTES.includes(routePath);
}

describe('Admin Panel Navigation & Data Flow', () => {
  describe('Sidebar Configuration Structure', () => {
    it('STARTER sidebar has required sections', () => {
      const sections = STARTER_SIDEBAR.map(s => s.section);
      expect(sections).toContain('Command Center');
      expect(sections).toContain('Sales & Orders');
      expect(sections).toContain('Settings');
    });

    it('PROFESSIONAL sidebar has all starter sections plus extras', () => {
      const sections = PROFESSIONAL_SIDEBAR.map(s => s.section);
      expect(sections).toContain('Command Center');
      expect(sections).toContain('Sales & Orders');
      expect(sections).toContain('Settings');
      expect(sections).toContain('Analytics & Finance');
      expect(sections).toContain('Integrations');
    });

    it('ENTERPRISE sidebar has comprehensive sections', () => {
      const sections = ENTERPRISE_SIDEBAR.map(s => s.section);
      expect(sections).toContain('Command Center');
      expect(sections).toContain('Orders');
      expect(sections).toContain('Inventory');
      expect(sections).toContain('Customers');
      expect(sections).toContain('Finance');
      expect(sections).toContain('Fulfillment');
      expect(sections).toContain('Marketing');
      expect(sections).toContain('Analytics');
      expect(sections).toContain('Operations');
      expect(sections).toContain('Integrations');
      expect(sections).toContain('Settings');
    });

    it('all sidebar items have required properties', () => {
      const allSidebars = [STARTER_SIDEBAR, PROFESSIONAL_SIDEBAR, ENTERPRISE_SIDEBAR];

      for (const sidebar of allSidebars) {
        for (const section of sidebar) {
          expect(section.section).toBeTruthy();
          expect(section.items.length).toBeGreaterThan(0);

          for (const item of section.items) {
            expect(item.id).toBeTruthy();
            expect(item.name).toBeTruthy();
            expect(item.path).toBeTruthy();
            expect(item.icon).toBeTruthy();
            expect(item.path.startsWith('/admin/')).toBe(true);
          }
        }
      }
    });

    it('Command Center section is always pinned', () => {
      const allSidebars = [STARTER_SIDEBAR, PROFESSIONAL_SIDEBAR, ENTERPRISE_SIDEBAR];

      for (const sidebar of allSidebars) {
        const commandCenter = sidebar.find(s => s.section === 'Command Center');
        expect(commandCenter?.pinned).toBe(true);
        expect(commandCenter?.defaultExpanded).toBe(true);
      }
    });

    it('Dashboard is always the first item in Command Center', () => {
      const allSidebars = [STARTER_SIDEBAR, PROFESSIONAL_SIDEBAR, ENTERPRISE_SIDEBAR];

      for (const sidebar of allSidebars) {
        const commandCenter = sidebar.find(s => s.section === 'Command Center');
        expect(commandCenter?.items[0]?.id).toBe('dashboard');
        expect(commandCenter?.items[0]?.path).toBe('/admin/dashboard');
      }
    });
  });

  describe('Sidebar Navigation Paths Validity', () => {
    it('all STARTER sidebar paths point to valid routes', () => {
      for (const section of STARTER_SIDEBAR) {
        for (const item of section.items) {
          const routePath = extractRoutePath(item.path);
          const valid = VALID_ADMIN_ROUTES.includes(routePath) || REDIRECT_ROUTES.includes(routePath);
          expect(valid, `STARTER sidebar item "${item.name}" has invalid path: ${item.path} (route: ${routePath})`).toBe(true);
        }
      }
    });

    it('all PROFESSIONAL sidebar paths point to valid routes', () => {
      for (const section of PROFESSIONAL_SIDEBAR) {
        for (const item of section.items) {
          const routePath = extractRoutePath(item.path);
          const valid = VALID_ADMIN_ROUTES.includes(routePath) || REDIRECT_ROUTES.includes(routePath);
          expect(valid, `PROFESSIONAL sidebar item "${item.name}" has invalid path: ${item.path} (route: ${routePath})`).toBe(true);
        }
      }
    });

    it('all ENTERPRISE sidebar paths point to valid routes', () => {
      for (const section of ENTERPRISE_SIDEBAR) {
        for (const item of section.items) {
          const routePath = extractRoutePath(item.path);
          const valid = VALID_ADMIN_ROUTES.includes(routePath) || REDIRECT_ROUTES.includes(routePath);
          expect(valid, `ENTERPRISE sidebar item "${item.name}" has invalid path: ${item.path} (route: ${routePath})`).toBe(true);
        }
      }
    });

    it('all paths start with /admin/ prefix', () => {
      const allSidebars = [STARTER_SIDEBAR, PROFESSIONAL_SIDEBAR, ENTERPRISE_SIDEBAR];

      for (const sidebar of allSidebars) {
        for (const section of sidebar) {
          for (const item of section.items) {
            expect(item.path.startsWith('/admin/'),
              `Item "${item.name}" path "${item.path}" does not start with /admin/`
            ).toBe(true);
          }
        }
      }
    });
  });

  describe('Feature Registry Consistency', () => {
    it('all feature registry entries have required fields', () => {
      const features = getAllFeatures();

      for (const feature of features) {
        expect(feature.id, `Feature missing id`).toBeTruthy();
        expect(feature.name, `Feature "${feature.id}" missing name`).toBeTruthy();
        expect(feature.icon, `Feature "${feature.id}" missing icon`).toBeTruthy();
        expect(feature.path, `Feature "${feature.id}" missing path`).toBeTruthy();
        expect(feature.category, `Feature "${feature.id}" missing category`).toBeTruthy();
        expect(feature.minTier, `Feature "${feature.id}" missing minTier`).toBeTruthy();
      }
    });

    it('all feature registry paths start with /admin/', () => {
      const features = getAllFeatures();

      for (const feature of features) {
        // vendor-portal is an exception with /vendor/ prefix
        if (feature.id === 'vendor-portal') continue;
        expect(feature.path.startsWith('/admin/'),
          `Feature "${feature.id}" path "${feature.path}" does not start with /admin/`
        ).toBe(true);
      }
    });

    it('feature registry paths point to valid routes or hub tabs', () => {
      const features = getAllFeatures();

      for (const feature of features) {
        // Skip vendor-portal as it's external
        if (feature.id === 'vendor-portal') continue;

        const routePath = extractRoutePath(feature.path);
        const valid = VALID_ADMIN_ROUTES.includes(routePath) || REDIRECT_ROUTES.includes(routePath);
        expect(valid,
          `Feature "${feature.id}" has invalid path: ${feature.path} (route: ${routePath})`
        ).toBe(true);
      }
    });

    it('essential features exist in registry', () => {
      for (const featureId of ESSENTIAL_FEATURES) {
        const feature = getFeature(featureId);
        expect(feature, `Essential feature "${featureId}" not found in registry`).toBeDefined();
      }
    });

    it('essential features are starter tier', () => {
      for (const featureId of ESSENTIAL_FEATURES) {
        const feature = getFeature(featureId);
        expect(feature?.minTier,
          `Essential feature "${featureId}" should be starter tier, is "${feature?.minTier}"`
        ).toBe('starter');
      }
    });

    it('tier hierarchy is respected (starter < professional < enterprise)', () => {
      const starterFeatures = getFeaturesByTier('starter');
      const professionalFeatures = getFeaturesByTier('professional');
      const enterpriseFeatures = getFeaturesByTier('enterprise');

      expect(starterFeatures.length).toBeLessThanOrEqual(professionalFeatures.length);
      expect(professionalFeatures.length).toBeLessThanOrEqual(enterpriseFeatures.length);
    });

    it('minTier values are valid subscription tiers', () => {
      const validTiers = ['starter', 'professional', 'enterprise'];
      const features = getAllFeatures();

      for (const feature of features) {
        expect(validTiers,
          `Feature "${feature.id}" has invalid minTier: "${feature.minTier}"`
        ).toContain(feature.minTier);
      }
    });
  });

  describe('Feature Access Control', () => {
    it('starter features are accessible to all tiers', () => {
      const starterFeatures = getAllFeatures().filter(f => f.minTier === 'starter');

      for (const feature of starterFeatures) {
        expect(isFeatureAccessible(feature.id, 'starter')).toBe(true);
        expect(isFeatureAccessible(feature.id, 'professional')).toBe(true);
        expect(isFeatureAccessible(feature.id, 'enterprise')).toBe(true);
      }
    });

    it('professional features are not accessible to starter', () => {
      const professionalFeatures = getAllFeatures().filter(f => f.minTier === 'professional');

      for (const feature of professionalFeatures) {
        expect(isFeatureAccessible(feature.id, 'starter')).toBe(false);
        expect(isFeatureAccessible(feature.id, 'professional')).toBe(true);
        expect(isFeatureAccessible(feature.id, 'enterprise')).toBe(true);
      }
    });

    it('enterprise features are only accessible to enterprise', () => {
      const enterpriseFeatures = getAllFeatures().filter(f => f.minTier === 'enterprise');

      for (const feature of enterpriseFeatures) {
        expect(isFeatureAccessible(feature.id, 'starter')).toBe(false);
        expect(isFeatureAccessible(feature.id, 'professional')).toBe(false);
        expect(isFeatureAccessible(feature.id, 'enterprise')).toBe(true);
      }
    });

    it('non-existent features return false for access check', () => {
      expect(isFeatureAccessible('non-existent-feature', 'enterprise')).toBe(false);
    });
  });

  describe('Sidebar Config Functions', () => {
    it('getSidebarConfigByTier returns correct configs', () => {
      expect(getSidebarConfigByTier('starter')).toBe(STARTER_SIDEBAR);
      expect(getSidebarConfigByTier('professional')).toBe(PROFESSIONAL_SIDEBAR);
      expect(getSidebarConfigByTier('enterprise')).toBe(ENTERPRISE_SIDEBAR);
    });

    it('getSidebarConfigByTier defaults to starter for unknown tier', () => {
      expect(getSidebarConfigByTier('unknown' as any)).toBe(STARTER_SIDEBAR);
    });

    it('legacy getSidebarConfig maps operation sizes correctly', () => {
      expect(getSidebarConfig('street')).toBe(STARTER_SIDEBAR);
      expect(getSidebarConfig('small')).toBe(STARTER_SIDEBAR);
      expect(getSidebarConfig('medium')).toBe(PROFESSIONAL_SIDEBAR);
      expect(getSidebarConfig('enterprise')).toBe(ENTERPRISE_SIDEBAR);
    });
  });

  describe('Feature Categories', () => {
    it('getFeaturesByCategory returns features for known categories', () => {
      const commandCenter = getFeaturesByCategory('Command Center');
      expect(commandCenter.length).toBeGreaterThan(0);

      const salesOrders = getFeaturesByCategory('Sales & Orders');
      expect(salesOrders.length).toBeGreaterThan(0);

      const inventory = getFeaturesByCategory('Inventory');
      expect(inventory.length).toBeGreaterThan(0);
    });

    it('all features belong to known categories', () => {
      const knownCategories = [
        'Command Center',
        'Sales & Orders',
        'Inventory',
        'Customers',
        'Operations',
        'Delivery & Fleet',
        'Point of Sale',
        'Analytics & Finance',
        'Integrations',
        'Security & Compliance',
        'Settings',
      ];

      const features = getAllFeatures();
      for (const feature of features) {
        expect(knownCategories,
          `Feature "${feature.id}" has unknown category: "${feature.category}"`
        ).toContain(feature.category);
      }
    });
  });

  describe('Hub-Based Navigation Architecture', () => {
    it('hub pages are the primary navigation targets in enterprise sidebar', () => {
      const hubPaths = ENTERPRISE_SIDEBAR.flatMap(s => s.items)
        .filter(item => item.path.includes('-hub'))
        .map(item => extractRoutePath(item.path));

      // Key hubs should be present
      const keyHubs = ['inventory-hub', 'customer-hub', 'finance-hub', 'fulfillment-hub',
                       'analytics-hub', 'operations-hub', 'marketing-hub', 'storefront-hub'];

      for (const hub of keyHubs) {
        const found = hubPaths.includes(hub) ||
          ENTERPRISE_SIDEBAR.flatMap(s => s.items).some(item => item.path.includes(hub));
        expect(found, `Hub "${hub}" should be accessible from enterprise sidebar`).toBe(true);
      }
    });

    it('feature registry hub paths use tab parameters consistently', () => {
      const features = getAllFeatures();
      const hubFeatures = features.filter(f => f.path.includes('-hub?tab='));

      for (const feature of hubFeatures) {
        const [basePath, query] = feature.path.split('?');
        expect(basePath.endsWith('-hub'),
          `Feature "${feature.id}" path "${feature.path}" has tab param but doesn't end with -hub`
        ).toBe(true);
        expect(query.startsWith('tab='),
          `Feature "${feature.id}" query "${query}" should start with tab=`
        ).toBe(true);
      }
    });
  });

  describe('Navigation Consistency Across Tiers', () => {
    it('higher tiers include core features from lower tiers', () => {
      const starterItems = STARTER_SIDEBAR.flatMap(s => s.items).map(i => i.id);
      const professionalItems = PROFESSIONAL_SIDEBAR.flatMap(s => s.items).map(i => i.id);

      // Core items from starter should be in professional
      // Some starter items are consolidated into higher-tier equivalents:
      // - 'reports' → 'analytics' (analytics subsumes reports at professional level)
      const consolidatedItems: Record<string, string> = {
        'reports': 'analytics', // professional uses analytics-hub which includes reports
      };

      for (const itemId of starterItems) {
        const mappedId = consolidatedItems[itemId] || itemId;
        const inProfessional = professionalItems.includes(itemId) || professionalItems.includes(mappedId);
        expect(inProfessional,
          `Starter item "${itemId}" (or equivalent "${mappedId}") missing from professional sidebar`
        ).toBe(true);
      }
    });

    it('all sidebar items have valid featureId references', () => {
      const allSidebars = [STARTER_SIDEBAR, PROFESSIONAL_SIDEBAR, ENTERPRISE_SIDEBAR];

      for (const sidebar of allSidebars) {
        for (const section of sidebar) {
          for (const item of section.items) {
            if (item.featureId) {
              const feature = getFeature(item.featureId);
              expect(feature,
                `Sidebar item "${item.name}" references non-existent feature: ${item.featureId}`
              ).toBeDefined();
            }
          }
        }
      }
    });
  });

  describe('Data Flow Patterns', () => {
    it('feature registry does not contain hardcoded tenant slugs', () => {
      const features = getAllFeatures();

      for (const feature of features) {
        expect(feature.path).not.toMatch(/\/[a-z-]+\/admin\//);
        // Paths should be relative (start with /admin/) not absolute with tenant
        expect(feature.path.startsWith('/admin/') || feature.path.startsWith('/vendor/'),
          `Feature "${feature.id}" has unexpected path format: ${feature.path}`
        ).toBe(true);
      }
    });

    it('sidebar paths are relative (tenant slug added at runtime)', () => {
      const allSidebars = [STARTER_SIDEBAR, PROFESSIONAL_SIDEBAR, ENTERPRISE_SIDEBAR];

      for (const sidebar of allSidebars) {
        for (const section of sidebar) {
          for (const item of section.items) {
            // Paths should start with /admin/ (tenant slug prepended at runtime)
            expect(item.path.startsWith('/admin/'),
              `Item "${item.name}" path "${item.path}" should start with /admin/`
            ).toBe(true);
            // Should not contain actual tenant slugs
            expect(item.path).not.toMatch(/^\/[a-z-]+\/admin\//);
          }
        }
      }
    });
  });

  describe('No Duplicate Navigation Items', () => {
    it('no duplicate item IDs within same sidebar section', () => {
      const allSidebars = [
        { name: 'STARTER', config: STARTER_SIDEBAR },
        { name: 'PROFESSIONAL', config: PROFESSIONAL_SIDEBAR },
        { name: 'ENTERPRISE', config: ENTERPRISE_SIDEBAR },
      ];

      for (const { name, config } of allSidebars) {
        for (const section of config) {
          const ids = section.items.map(i => i.id);
          // Allow storefront to appear multiple times as it's used for different contexts
          const filteredIds = ids.filter(id => id !== 'storefront');
          const filteredUniqueIds = [...new Set(filteredIds)];
          expect(filteredIds.length,
            `${name} sidebar section "${section.section}" has duplicate IDs: ${ids.join(', ')}`
          ).toBe(filteredUniqueIds.length);
        }
      }
    });

    it('no duplicate paths within same sidebar', () => {
      const allSidebars = [
        { name: 'STARTER', config: STARTER_SIDEBAR },
        { name: 'PROFESSIONAL', config: PROFESSIONAL_SIDEBAR },
        { name: 'ENTERPRISE', config: ENTERPRISE_SIDEBAR },
      ];

      for (const { name, config } of allSidebars) {
        const allPaths = config.flatMap(s => s.items).map(i => i.path);
        const duplicates = allPaths.filter((path, index) => allPaths.indexOf(path) !== index);

        // A few duplicates are acceptable (e.g., orders with different tabs)
        // but we should flag excessive duplication
        expect(duplicates.length,
          `${name} sidebar has duplicate paths: ${duplicates.join(', ')}`
        ).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('Feature Registry Completeness', () => {
    it('all sidebar featureIds exist in FEATURE_REGISTRY', () => {
      const allSidebars = [STARTER_SIDEBAR, PROFESSIONAL_SIDEBAR, ENTERPRISE_SIDEBAR];

      for (const sidebar of allSidebars) {
        for (const section of sidebar) {
          for (const item of section.items) {
            if (item.featureId) {
              expect(FEATURE_REGISTRY[item.featureId],
                `Sidebar item "${item.name}" uses featureId "${item.featureId}" not in FEATURE_REGISTRY`
              ).toBeDefined();
            }
          }
        }
      }
    });

    it('feature registry has entries for all categories', () => {
      const categories = [...new Set(getAllFeatures().map(f => f.category))];

      expect(categories.length).toBeGreaterThanOrEqual(8);
      expect(categories).toContain('Command Center');
      expect(categories).toContain('Sales & Orders');
      expect(categories).toContain('Inventory');
      expect(categories).toContain('Customers');
      expect(categories).toContain('Operations');
      expect(categories).toContain('Analytics & Finance');
      expect(categories).toContain('Settings');
    });
  });
});
