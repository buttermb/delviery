/**
 * Admin Breadcrumbs Component
 * Provides contextual breadcrumb navigation across all admin pages
 * Shows: [Tenant Name] > [Section] > [Subsection] > [Current Page]
 * Includes tenant slug context and clickable navigation paths
 */

import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useBreadcrumbContext } from '@/contexts/BreadcrumbContext';

// Human-readable labels for URL segments
const SEGMENT_LABELS: Record<string, string> = {
  // Core pages
  dashboard: 'Dashboard',
  products: 'Products',
  orders: 'Orders',
  customers: 'Customers',
  inventory: 'Inventory',
  invoices: 'Invoices',
  settings: 'Settings',
  analytics: 'Analytics',
  storefront: 'Storefront',
  pos: 'Point of Sale',
  vendors: 'Vendors',
  compliance: 'Compliance',
  drivers: 'Drivers',
  manifests: 'Manifests',
  zones: 'Zones',
  team: 'Team',
  billing: 'Billing',
  notifications: 'Notifications',
  profile: 'Profile',
  reports: 'Reports',

  // Hub pages
  'orders-hub': 'Orders',
  'customer-hub': 'Customers',
  'inventory-hub': 'Inventory',
  'settings-hub': 'Settings',
  'analytics-hub': 'Analytics',
  'fulfillment-hub': 'Fulfillment',
  'finance-hub': 'Finance',
  'marketing-hub': 'Marketing',
  'operations-hub': 'Operations',
  'integrations-hub': 'Integrations',
  'storefront-hub': 'Storefront',
  'help-hub': 'Help & Support',
  'pos-hub': 'Point of Sale',

  // Specific pages
  'live-orders': 'Live Orders',
  'disposable-menus': 'Disposable Menus',
  'cash-register': 'Cash Register',
  'pre-orders': 'Pre-Orders',
  'route-planning': 'Route Planning',
  'delivery-zones': 'Delivery Zones',
  'pos-system': 'Point of Sale',
  'wholesale-clients': 'Wholesale Clients',
  'delivery-management': 'Delivery Management',
  'delivery-tracking': 'Delivery Tracking',
  'delivery-analytics': 'Delivery Analytics',
  'fleet-management': 'Fleet Management',
  'inventory-management': 'Inventory Management',
  'inventory-dashboard': 'Inventory Dashboard',
  'inventory-monitoring': 'Inventory Monitoring',
  'inventory-transfers': 'Inventory Transfers',
  'dispatch-inventory': 'Dispatch Inventory',
  'product-management': 'Product Management',
  'customer-management': 'Customer Management',
  'customer-analytics': 'Customer Analytics',
  'customer-insights': 'Customer Insights',
  'customer-crm': 'Customer CRM',
  'customer-invoices': 'Customer Invoices',
  'customer-reports': 'Customer Reports',
  'order-analytics': 'Order Analytics',
  'menu-analytics': 'Menu Analytics',
  'pos-analytics': 'POS Analytics',
  'advanced-analytics': 'Advanced Analytics',
  'location-analytics': 'Location Analytics',
  'predictive-analytics': 'Predictive Analytics',
  'financial-center': 'Financial Center',
  'financial-command-center': 'Financial Command Center',
  'expense-tracking': 'Expense Tracking',
  'commission-tracking': 'Commission Tracking',
  'advanced-reporting': 'Advanced Reporting',
  'custom-reports': 'Custom Reports',
  'board-report': 'Board Report',
  'expansion-analysis': 'Expansion Analysis',
  'data-export': 'Data Export',
  'api-access': 'API Access',
  'developer-tools': 'Developer Tools',
  'custom-integrations': 'Custom Integrations',
  'custom-domain': 'Custom Domain',
  'activity-logs': 'Activity Logs',
  'audit-trail': 'Audit Trail',
  'compliance-vault': 'Compliance Vault',
  'batch-recall': 'Batch Recall',
  'quality-control': 'Quality Control',
  'generate-barcodes': 'Generate Barcodes',
  'global-search': 'Global Search',
  'live-map': 'Live Map',
  'live-chat': 'Live Chat',
  'smart-tv': 'Smart TV',
  'realtime-dashboard': 'Realtime Dashboard',
  'performance-monitor': 'Performance Monitor',
  automation: 'Automation',
  'marketing-automation': 'Marketing Automation',
  'loyalty-program': 'Loyalty Program',
  'coupon-management': 'Coupons',
  'crm-settings': 'CRM Settings',
  'purchase-orders': 'Purchase Orders',
  'new-purchase-order': 'New Purchase Order',
  'new-wholesale-order': 'New Wholesale Order',
  'appointment-scheduler': 'Appointment Scheduler',
  'fronted-inventory': 'Fronted Inventory',
  'fronted-inventory-analytics': 'Fronted Analytics',
  'fronted-inventory-details': 'Fronted Details',
  'record-fronted-payment': 'Record Payment',
  'record-fronted-return': 'Record Return',
  'collection-mode': 'Collection Mode',
  couriers: 'Couriers',
  'menu-migration': 'Menu Migration',
  'disposable-menu-analytics': 'Menu Analytics',
  'disposable-menu-orders': 'Menu Orders',
  'disposable-menus-help': 'Menu Help',
  hotbox: 'Hotbox',
  'local-ai': 'Local AI',
  'priority-support': 'Priority Support',
  invites: 'Invites',
  'quick-export': 'Quick Export',
  locations: 'Locations',
  'locations-management': 'Locations',

  // Hub pages (additional)
  'dashboard-hub': 'Dashboard',

  // Command & operations
  'command-center': 'Command Center',
  'tv-dashboard': 'TV Dashboard',

  // Team & roles
  'staff-management': 'Staff Management',
  'team-members': 'Team Members',
  'team-management': 'Team Management',
  'role-management': 'Role Management',
  'vendor-management': 'Vendor Management',

  // Analytics & reporting
  'sales-dashboard': 'Sales Dashboard',
  'analytics-dashboard': 'Analytics Dashboard',
  'strategic-dashboard': 'Strategic Dashboard',
  'revenue-reports': 'Revenue Reports',
  'risk-management': 'Risk Management',

  // Inventory & stock
  'stock-alerts': 'Stock Alerts',
  'wholesale-pricing-tiers': 'Wholesale Pricing',

  // POS
  'pos-shifts': 'POS Shifts',
  'z-reports': 'Z Reports',

  // Finance & invoices
  'advanced-invoice': 'Advanced Invoice',
  'invoice-management': 'Invoices',

  // Integrations & tools
  'workflow-automation': 'Workflow Automation',
  'route-optimizer': 'Route Optimizer',
  'bulk-operations': 'Bulk Operations',
  'gps-tracking': 'GPS Tracking',
  'system-settings': 'System Settings',
  'button-tester': 'Button Tester',

  // Storefront sub-pages
  builder: 'Builder',
  'gift-cards': 'Gift Cards',
  themes: 'Themes',
  pages: 'Pages',
  domains: 'Domains',
  seo: 'SEO',
  'store-settings': 'Store Settings',

  // Detail/action pages
  create: 'Create',
  edit: 'Edit',
  details: 'Details',
  view: 'View',
  new: 'New',
};

// Segments that look like UUIDs or IDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_REGEX = /^\d+$/;

// Context labels for dynamic segments based on their parent
const DYNAMIC_SEGMENT_CONTEXT: Record<string, string> = {
  orders: 'Order Details',
  products: 'Product Details',
  customers: 'Customer Details',
  invoices: 'Invoice Details',
  clients: 'Client Details',
  drivers: 'Driver Details',
  manifests: 'Manifest Details',
  'pre-orders': 'Pre-Order Details',
  'purchase-orders': 'Order Details',
  'wholesale-clients': 'Client Details',
  vendors: 'Vendor Details',
  team: 'Member Details',
  'delivery-zones': 'Zone Details',
  zones: 'Zone Details',
  'fronted-inventory': 'Details',
  storefront: 'Store Details',
};

interface BreadcrumbItem {
  label: string;
  path: string;
  isCurrentPage: boolean;
}

interface BreadcrumbsProps {
  className?: string;
}

function isDynamicSegment(segment: string): boolean {
  return UUID_REGEX.test(segment) || NUMERIC_ID_REGEX.test(segment);
}

function getSegmentLabel(segment: string, parentSegment?: string): string {
  // Check static labels first
  if (SEGMENT_LABELS[segment]) {
    return SEGMENT_LABELS[segment];
  }

  // Check if this is a dynamic/ID segment
  if (isDynamicSegment(segment)) {
    if (parentSegment && DYNAMIC_SEGMENT_CONTEXT[parentSegment]) {
      return DYNAMIC_SEGMENT_CONTEXT[parentSegment];
    }
    return 'Details';
  }

  // Convert kebab-case to Title Case as fallback
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function Breadcrumbs({ className }: BreadcrumbsProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const { tenant } = useTenantAdminAuth();
  const { entityLabel } = useBreadcrumbContext();

  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const pathSegments = location.pathname
      .split('/')
      .filter(Boolean)
      .filter(segment => segment !== tenantSlug && segment !== 'admin');

    // Build breadcrumb items
    const items: BreadcrumbItem[] = [];

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      const parentSegment = i > 0 ? pathSegments[i - 1] : undefined;
      const path = `/${tenantSlug}/admin/${pathSegments.slice(0, i + 1).join('/')}`;
      const label = getSegmentLabel(segment, parentSegment);

      items.push({
        label,
        path,
        isCurrentPage: i === pathSegments.length - 1,
      });
    }

    return items;
  }, [location.pathname, tenantSlug]);

  // Tenant display name - use business_name if available, otherwise format the slug
  const tenantDisplayName = tenant?.business_name || (tenantSlug
    ? tenantSlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    : 'Admin');

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className={cn(
        'flex items-center gap-1.5 text-sm text-muted-foreground',
        className
      )}
    >
      {/* Tenant context - always shown */}
      <Link
        to={`/${tenantSlug}/admin/dashboard`}
        className="hover:text-foreground transition-colors inline-flex items-center gap-1.5 flex-shrink-0"
        title={`${tenantDisplayName} Dashboard`}
      >
        <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-medium">
          {tenantDisplayName}
        </span>
      </Link>

      {/* Path segments */}
      {breadcrumbs.map((crumb) => {
        // Use entity label from context for the last (current page) breadcrumb
        const displayLabel = crumb.isCurrentPage && entityLabel
          ? entityLabel
          : crumb.label;

        return (
          <span key={crumb.path} className="inline-flex items-center gap-1.5 flex-shrink-0">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
            {crumb.isCurrentPage ? (
              <span
                className="text-foreground font-medium whitespace-nowrap"
                aria-current="page"
              >
                {displayLabel}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:text-foreground transition-colors whitespace-nowrap"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
