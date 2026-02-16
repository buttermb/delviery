/**
 * useBreadcrumbs Hook
 * Auto-generates breadcrumb trail from current route path.
 * Maps route segments to human-readable labels using route mapping.
 * Includes tenant dashboard as root.
 * Dynamic segments (IDs) resolved to entity names via lightweight queries.
 */

import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface BreadcrumbItem {
  label: string;
  href: string;
}

interface EntityNameResult {
  id: string;
  name: string | null;
}

// ============================================================================
// Route Segment to Label Mapping
// ============================================================================

/**
 * Maps route segments to human-readable labels.
 * Used for static route segments (not dynamic IDs).
 */
const ROUTE_LABELS: Record<string, string> = {
  // Core
  admin: 'Admin',
  dashboard: 'Dashboard',
  'dashboard-hub': 'Dashboard Hub',
  hotbox: 'Hotbox',
  'tv-dashboard': 'TV Dashboard',
  'command-center': 'Command Center',
  'collection-mode': 'Collection Mode',

  // Orders & Sales
  orders: 'Orders',
  'orders-hub': 'Orders Hub',
  'wholesale-orders': 'Wholesale Orders',
  'live-orders': 'Live Orders',
  'order-analytics': 'Order Analytics',
  'sales-dashboard': 'Sales Dashboard',

  // Inventory & Products
  'inventory-hub': 'Inventory Hub',
  'inventory-dashboard': 'Inventory Dashboard',
  'inventory-monitoring': 'Inventory Monitoring',
  products: 'Products',
  'product-catalog': 'Product Catalog',
  'generate-barcodes': 'Generate Barcodes',
  catalog: 'Catalog',
  batches: 'Batches',
  categories: 'Categories',
  images: 'Images',

  // Customers & CRM
  'customer-hub': 'Customer Hub',
  customers: 'Customers',
  'big-plug-clients': 'Clients',
  crm: 'CRM',
  contacts: 'Contacts',

  // Vendors & Suppliers
  vendors: 'Vendors',
  'vendor-management': 'Vendor Management',
  suppliers: 'Suppliers',
  'purchase-orders': 'Purchase Orders',

  // Menus & Storefront
  'disposable-menus': 'Disposable Menus',
  'menu-analytics': 'Menu Analytics',
  'menu-migration': 'Menu Migration',
  storefront: 'Storefront',

  // Deliveries & Fleet
  'delivery-hub': 'Delivery Hub',
  'fleet-management': 'Fleet Management',
  'route-optimizer': 'Route Optimizer',
  'live-map': 'Live Map',

  // Analytics & Reports
  'analytics-hub': 'Analytics Hub',
  analytics: 'Analytics',
  reports: 'Reports',
  'advanced-reports': 'Advanced Reports',

  // Finance
  'financial-center': 'Financial Center',
  'finance-hub': 'Finance Hub',
  invoices: 'Invoices',
  payments: 'Payments',
  billing: 'Billing',

  // Marketplace
  marketplace: 'Marketplace',
  listings: 'Listings',
  browse: 'Browse',
  cart: 'Cart',
  purchases: 'Purchases',
  financials: 'Financials',
  messages: 'Messages',
  profile: 'Profile',

  // POS
  'pos-system': 'POS System',
  'cash-register': 'Cash Register',

  // Settings & Admin
  settings: 'Settings',
  'account-settings': 'Account Settings',
  'team-management': 'Team Management',
  roles: 'Roles',
  notifications: 'Notifications',
  help: 'Help',
  'help-hub': 'Help Hub',

  // Credits
  credits: 'Credits',

  // Loyalty & Marketing
  'loyalty-program': 'Loyalty Program',
  coupons: 'Coupons',
  'marketing-automation': 'Marketing',

  // Quality & Compliance
  'quality-control': 'Quality Control',
  'compliance-vault': 'Compliance',
  'batch-recall': 'Batch Recall',

  // Support
  support: 'Support',
  tickets: 'Tickets',

  // Returns
  returns: 'Returns',

  // Appointments
  appointments: 'Appointments',

  // Other
  new: 'New',
  edit: 'Edit',
  create: 'Create',
  detail: 'Detail',
  'fronted-inventory': 'Fronted Inventory',
  'dispatch-inventory': 'Dispatch Inventory',
  'risk-management': 'Risk Management',
};

// ============================================================================
// Entity Type Detection
// ============================================================================

type EntityType = 'order' | 'product' | 'customer' | 'vendor' | 'menu' | 'invoice' | 'delivery' | 'listing' | 'unknown';

/**
 * Maps route parent segments to entity types for ID resolution.
 */
const ROUTE_TO_ENTITY: Record<string, EntityType> = {
  orders: 'order',
  'wholesale-orders': 'order',
  products: 'product',
  'inventory-hub': 'product',
  customers: 'customer',
  'customer-hub': 'customer',
  'big-plug-clients': 'customer',
  vendors: 'vendor',
  'vendor-management': 'vendor',
  suppliers: 'vendor',
  'disposable-menus': 'menu',
  menus: 'menu',
  invoices: 'invoice',
  deliveries: 'delivery',
  'delivery-hub': 'delivery',
  listings: 'listing',
  marketplace: 'listing',
};

// ============================================================================
// UUID Detection
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(segment: string): boolean {
  return UUID_REGEX.test(segment);
}

// ============================================================================
// Entity Name Fetching
// ============================================================================

interface EntityQueryConfig {
  table: string;
  nameColumn: string;
  tenantColumn: string;
}

const ENTITY_QUERY_CONFIG: Record<EntityType, EntityQueryConfig | null> = {
  order: { table: 'orders', nameColumn: 'order_number', tenantColumn: 'tenant_id' },
  product: { table: 'products', nameColumn: 'name', tenantColumn: 'tenant_id' },
  customer: { table: 'profiles', nameColumn: 'full_name', tenantColumn: 'account_id' },
  vendor: { table: 'suppliers', nameColumn: 'company_name', tenantColumn: 'account_id' },
  menu: { table: 'disposable_menus', nameColumn: 'name', tenantColumn: 'tenant_id' },
  invoice: { table: 'crm_invoices', nameColumn: 'invoice_number', tenantColumn: 'account_id' },
  delivery: { table: 'wholesale_deliveries', nameColumn: 'id', tenantColumn: 'tenant_id' },
  listing: { table: 'marketplace_listings', nameColumn: 'title', tenantColumn: 'tenant_id' },
  unknown: null,
};

async function fetchEntityName(
  entityType: EntityType,
  entityId: string,
  tenantId: string
): Promise<string | null> {
  const config = ENTITY_QUERY_CONFIG[entityType];
  if (!config) return null;

  try {
    // Use type assertion for dynamic table access
    const { data, error } = await (supabase as any)
      .from(config.table)
      .select(`id, ${config.nameColumn}`)
      .eq('id', entityId)
      .eq(config.tenantColumn, tenantId)
      .maybeSingle();

    if (error) {
      logger.warn('Failed to fetch entity name for breadcrumb', { entityType, entityId, error: error.message });
      return null;
    }

    // Return the name value or format the ID as fallback
    const nameValue = data?.[config.nameColumn as keyof typeof data];
    if (typeof nameValue === 'string' && nameValue) {
      return nameValue;
    }

    // For order numbers, format nicely
    if (entityType === 'order' && data?.id) {
      return `#${data.id.slice(0, 8).toUpperCase()}`;
    }

    // For deliveries, format nicely
    if (entityType === 'delivery' && entityId) {
      return `Delivery #${entityId.slice(0, 8).toUpperCase()}`;
    }

    return null;
  } catch (err) {
    logger.error('Error fetching entity name for breadcrumb', err, { entityType, entityId });
    return null;
  }
}

// ============================================================================
// Main Hook
// ============================================================================

export interface UseBreadcrumbsOptions {
  /** Override the root label (default: tenant business name or 'Dashboard') */
  rootLabel?: string;
  /** Skip the admin segment in breadcrumbs */
  skipAdminSegment?: boolean;
}

export interface UseBreadcrumbsResult {
  breadcrumbs: BreadcrumbItem[];
  isLoading: boolean;
}

/**
 * Auto-generates breadcrumb trail from current route path.
 * Maps route segments to human-readable labels.
 * Resolves dynamic segments (UUIDs) to entity names via lightweight queries.
 */
export function useBreadcrumbs(options: UseBreadcrumbsOptions = {}): UseBreadcrumbsResult {
  const { rootLabel, skipAdminSegment = true } = options;
  const { pathname } = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();

  const tenantId = tenant?.id;

  // Parse route segments
  const segments = useMemo(() => {
    // Remove leading/trailing slashes and split
    const parts = pathname.replace(/^\/|\/$/g, '').split('/');

    // Filter out tenant slug and optionally 'admin'
    const filtered = parts.filter((part, index) => {
      // Skip tenant slug (usually first segment)
      if (index === 0 && part === tenantSlug) return false;
      // Optionally skip 'admin' segment
      if (skipAdminSegment && part === 'admin') return false;
      // Skip empty segments
      if (!part) return false;
      return true;
    });

    return filtered;
  }, [pathname, tenantSlug, skipAdminSegment]);

  // Identify entity IDs in the path for resolution
  const entityIdInfo = useMemo(() => {
    const result: { id: string; entityType: EntityType; index: number }[] = [];

    segments.forEach((segment, index) => {
      if (isUUID(segment) && index > 0) {
        // Look at the previous segment to determine entity type
        const parentSegment = segments[index - 1];
        const entityType = ROUTE_TO_ENTITY[parentSegment] ?? 'unknown';

        result.push({ id: segment, entityType, index });
      }
    });

    return result;
  }, [segments]);

  // Fetch entity names for all detected IDs
  const entityNamesQuery = useQuery({
    queryKey: [...queryKeys.activity.all, 'breadcrumbs', ...entityIdInfo.map((e) => e.id)],
    queryFn: async () => {
      if (!tenantId || entityIdInfo.length === 0) return {};

      const results: Record<string, string> = {};

      await Promise.all(
        entityIdInfo.map(async ({ id, entityType }) => {
          const name = await fetchEntityName(entityType, id, tenantId);
          if (name) {
            results[id] = name;
          }
        })
      );

      return results;
    },
    enabled: !!tenantId && entityIdInfo.length > 0,
    staleTime: 60_000, // Cache entity names for 1 minute
  });

  const entityNames = entityNamesQuery.data ?? {};

  // Build breadcrumbs
  const breadcrumbs = useMemo(() => {
    const items: BreadcrumbItem[] = [];

    // Root breadcrumb (tenant dashboard)
    const dashboardLabel = rootLabel ?? tenant?.business_name ?? 'Dashboard';
    items.push({
      label: dashboardLabel,
      href: tenantSlug ? `/${tenantSlug}/admin/dashboard` : '/admin/dashboard',
    });

    // Build cumulative path for each segment
    let cumulativePath = tenantSlug ? `/${tenantSlug}/admin` : '/admin';

    segments.forEach((segment, index) => {
      cumulativePath += `/${segment}`;

      // Determine label
      let label: string;

      if (isUUID(segment)) {
        // Use resolved entity name or format ID
        label = entityNames[segment] ?? `#${segment.slice(0, 8).toUpperCase()}`;
      } else {
        // Use route label mapping or format segment
        label = ROUTE_LABELS[segment] ?? formatSegment(segment);
      }

      // Don't add if it's the same as root label
      if (index === 0 && label.toLowerCase() === dashboardLabel.toLowerCase()) {
        return;
      }

      items.push({
        label,
        href: cumulativePath,
      });
    });

    return items;
  }, [segments, entityNames, tenantSlug, tenant?.business_name, rootLabel]);

  return {
    breadcrumbs,
    isLoading: entityNamesQuery.isLoading,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formats a route segment to a readable label.
 * Handles kebab-case and snake_case conversions.
 */
function formatSegment(segment: string): string {
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default useBreadcrumbs;
