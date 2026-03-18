/**
 * Dashboard Navigation Routes Verification
 *
 * Ensures every admin route referenced by the DashboardPage ecosystem
 * (KPI cards, QuickActionsRow, SetupCompletionWidget, NeedsAttentionWidget,
 * AISuggestionBanner, LowStockBanner) matches a route defined in App.tsx.
 *
 * Uses the routeAudit VALID_ADMIN_ROUTES set as the source of truth.
 */

import { describe, it, expect } from 'vitest';
import { auditSidebarRoutes } from '@/utils/routeAudit';

/**
 * All admin route paths referenced in the DashboardPage component tree.
 * Each entry is the path portion after /:tenantSlug (e.g. /admin/orders).
 * Query params are stripped by the audit system before comparison.
 */
const DASHBOARD_NAVIGATION_ROUTES = [
  // DashboardPage.tsx — KPI card hrefs
  '/admin/finance-hub',
  '/admin/orders',
  '/admin/customer-hub',
  '/admin/inventory-hub',

  // QuickActionsRow.tsx — DASHBOARD_ACTIONS paths
  '/admin/orders',
  '/admin/inventory-hub',
  '/admin/customer-hub',
  '/admin/crm/invoices',       // "Create Invoice" quick action (navigates to /new)
  '/admin/pos-system',         // "Open POS" quick action
  '/admin/finance-hub',

  // NeedsAttentionWidget.tsx — hardcoded "View all" link
  '/admin/hotbox',

  // useAttentionQueue.ts — buildAdminUrl targets
  '/admin/orders',
  '/admin/fulfillment-hub',
  '/admin/inventory-hub',
  '/admin/customer-hub',

  // useSetupChecklist.ts — checklist item hrefs
  '/admin/settings',
  '/admin/inventory-hub',
  '/admin/delivery-zones',
  '/admin/drivers',
  '/admin/orders',
  '/admin/storefront',
  '/admin/settings',
];

describe('DashboardPage navigation routes', () => {
  it('all referenced admin routes should exist in the route registry', () => {
    const uniqueRoutes = [...new Set(DASHBOARD_NAVIGATION_ROUTES)];
    const result = auditSidebarRoutes(uniqueRoutes);

    if (result.invalidPaths.length > 0) {
      throw new Error(
        `Dashboard references ${result.invalidPaths.length} invalid route(s):\n` +
        result.invalidPaths.map(p => `  - ${p}`).join('\n') +
        '\n\nEither add the route to App.tsx or fix the path in the Dashboard component.',
      );
    }

    expect(result.status).toBe('pass');
    expect(result.invalidPaths).toHaveLength(0);
  });

  it('quick action routes should point to valid admin routes', () => {
    const quickActionPaths = [
      '/admin/orders',
      '/admin/inventory-hub',
      '/admin/customer-hub',
      '/admin/crm/invoices',
      '/admin/pos-system',
      '/admin/finance-hub',
    ];

    const result = auditSidebarRoutes(quickActionPaths);
    expect(result.invalidPaths).toHaveLength(0);
  });

  it('KPI card hrefs should point to valid admin routes', () => {
    const kpiPaths = [
      '/admin/finance-hub',
      '/admin/orders',
      '/admin/customer-hub',
      '/admin/inventory-hub',
    ];

    const result = auditSidebarRoutes(kpiPaths);
    expect(result.invalidPaths).toHaveLength(0);
  });

  it('setup checklist hrefs should point to valid admin routes', () => {
    const checklistPaths = [
      '/admin/settings',
      '/admin/inventory-hub',
      '/admin/delivery-zones',
      '/admin/drivers',
      '/admin/orders',
      '/admin/storefront',
    ];

    const result = auditSidebarRoutes(checklistPaths);
    expect(result.invalidPaths).toHaveLength(0);
  });

  it('attention queue action URLs should point to valid admin routes', () => {
    const attentionPaths = [
      '/admin/orders',
      '/admin/fulfillment-hub',
      '/admin/inventory-hub',
      '/admin/customer-hub',
    ];

    const result = auditSidebarRoutes(attentionPaths);
    expect(result.invalidPaths).toHaveLength(0);
  });
});
