import { logger } from '@/lib/logger';

/**
 * Route Audit System
 * 
 * Validates all sidebar navigation paths against defined routes on app startup.
 * Only runs in development mode.
 */

export interface RouteAuditResult {
  totalSidebarPaths: number;
  validPaths: number;
  invalidPaths: string[];
  warnings: string[];
  status: 'pass' | 'warn' | 'fail';
}

// All valid admin routes defined in App.tsx
// This list should be kept in sync with actual route definitions
const VALID_ADMIN_ROUTES = new Set([
  // Dashboard & Command Center
  '/admin/dashboard',
  '/admin/dashboard-hub',
  '/admin/hotbox',
  '/admin/live-map',
  '/admin/command-center',
  '/admin/realtime-dashboard',
  '/admin/tv-dashboard',
  '/admin/collection-mode',

  // Inventory
  '/admin/inventory-hub',
  '/admin/inventory/products',
  '/admin/inventory-dashboard',
  '/admin/generate-barcodes',
  '/admin/advanced-inventory',
  '/admin/stock-alerts',
  '/admin/inventory-transfers',
  '/admin/fronted-inventory',
  '/admin/fronted-inventory-analytics',
  '/admin/dispatch-inventory',
  '/admin/catalog/images',
  '/admin/catalog/batches',
  '/admin/catalog/categories',
  '/admin/operations/receiving',

  // Orders
  '/admin/orders',
  '/admin/order-analytics',
  '/admin/disposable-menus',
  '/admin/wholesale-orders/new',
  '/admin/wholesale-orders/new-po',
  '/admin/orders/offline-create',

  // Customers
  '/admin/customer-hub',
  '/admin/customer-details',
  '/admin/customer-reports',
  '/admin/customer-invoices',
  '/admin/customer-crm',
  '/admin/big-plug-clients',
  '/admin/crm/clients',
  '/admin/crm/invoices',

  // Analytics
  '/admin/analytics-hub',
  '/admin/reports',
  '/admin/menu-analytics',
  '/admin/disposable-menu-analytics',
  '/admin/sales-dashboard',
  '/admin/analytics/comprehensive',
  '/admin/advanced-analytics',
  '/admin/advanced-reporting',
  '/admin/custom-reports',

  // Finance
  '/admin/finance-hub',
  '/admin/billing',
  '/admin/financial-center',
  '/admin/commission-tracking',
  '/admin/revenue-reports',
  '/admin/advanced-invoice',

  // Fulfillment & Delivery
  '/admin/fulfillment-hub',
  '/admin/delivery-management',
  '/admin/delivery-hub',
  '/admin/delivery-zones',
  '/admin/route-optimizer',
  '/admin/delivery-analytics',
  '/admin/gps-tracking',

  // POS
  '/admin/pos-system',
  '/admin/cash-register',
  '/admin/pos-analytics',

  // Operations
  '/admin/operations-hub',
  '/admin/staff-management',
  '/admin/team-members',
  '/admin/team-management',
  '/admin/role-management',
  '/admin/activity-logs',
  '/admin/locations',
  '/admin/locations/warehouses',
  '/admin/locations/runners',
  '/admin/location-analytics',
  '/admin/vendor-management',
  '/admin/purchase-orders',
  '/admin/risk-management',

  // Users & Permissions
  '/admin/user-management',
  '/admin/permissions',
  '/admin/bulk-operations',

  // Integrations
  '/admin/api-access',
  '/admin/webhooks',
  '/admin/custom-integrations',
  '/admin/workflow-automation',
  '/admin/local-ai',
  '/admin/integrations-hub',
  '/admin/developer-tools',
  '/admin/data-export',

  // Compliance
  '/admin/audit-trail',
  '/admin/compliance',

  // Marketing & Storefront
  '/admin/storefront-hub',
  '/admin/marketing-hub',
  '/admin/marketing/reviews',
  '/admin/marketplace/dashboard',

  // Communication
  '/admin/live-chat',
  '/admin/notifications',

  // Settings
  '/admin/settings',
  '/admin/account-settings',
  '/admin/settings-hub',
  '/admin/system-settings',
  '/admin/white-label',
  '/admin/custom-domain',
  '/admin/help-hub',
  '/admin/priority-support',
]);

/**
 * Extract base path from a full path (removes query params)
 */
function getBasePath(fullPath: string): string {
  return fullPath.split('?')[0];
}

/**
 * Validate a single sidebar path.
 * Query params (?tab=, ?section=, etc.) are stripped before comparison
 * so that hub paths with tab params don't produce false positives.
 */
function validatePath(path: string): { valid: boolean; warning?: string } {
  const basePath = getBasePath(path);

  if (VALID_ADMIN_ROUTES.has(basePath)) {
    return { valid: true };
  }

  return { valid: false };
}

/**
 * Run a full audit of all sidebar paths
 */
export function auditSidebarRoutes(sidebarPaths: string[]): RouteAuditResult {
  const invalidPaths: string[] = [];
  const warnings: string[] = [];
  
  for (const path of sidebarPaths) {
    const result = validatePath(path);
    
    if (!result.valid) {
      invalidPaths.push(path);
    }
    
    if (result.warning) {
      warnings.push(result.warning);
    }
  }
  
  const validPaths = sidebarPaths.length - invalidPaths.length;
  
  let status: RouteAuditResult['status'] = 'pass';
  if (invalidPaths.length > 0) {
    status = 'fail';
  } else if (warnings.length > 0) {
    status = 'warn';
  }
  
  return {
    totalSidebarPaths: sidebarPaths.length,
    validPaths,
    invalidPaths,
    warnings,
    status,
  };
}

/**
 * Log audit results to console (dev mode only)
 */
export function logAuditResults(result: RouteAuditResult): void {
  if (!import.meta.env.DEV) return;
  
  const statusEmoji = {
    pass: '✅',
    warn: '⚠️',
    fail: '❌',
  };
  
  logger.info(
    `[Route Audit] ${statusEmoji[result.status]} ${result.validPaths}/${result.totalSidebarPaths} sidebar paths valid`
  );
  
  if (result.invalidPaths.length > 0) {
    logger.error('[Route Audit] Invalid sidebar paths:', result.invalidPaths);
  }
  
  if (result.warnings.length > 0) {
    logger.warn('[Route Audit] Warnings:', result.warnings);
  }
}

/**
 * Extract all paths from sidebar configurations
 */
export function extractSidebarPaths(configs: Array<{ items: Array<{ path: string }> }>): string[] {
  const paths: string[] = [];
  
  for (const section of configs) {
    for (const item of section.items) {
      if (item.path) {
        paths.push(item.path);
      }
    }
  }
  
  return paths;
}

/**
 * Main entry point - run full audit on app startup
 */
export function runRouteAudit(sidebarConfigs: Array<{ items: Array<{ path: string }> }>): void {
  if (!import.meta.env.DEV) return;
  
  const paths = extractSidebarPaths(sidebarConfigs);
  const result = auditSidebarRoutes(paths);
  logAuditResults(result);
}
