/**
 * Admin Breadcrumbs Component
 * Provides breadcrumb navigation across all admin pages
 * Shows: Home > [Section] > [Subsection] > [Current Page]
 */

import { Fragment } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// Human-readable labels for URL segments
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  orders: 'Orders',
  'orders-hub': 'Orders',
  customers: 'Customers',
  'customer-hub': 'Customers',
  'wholesale-clients': 'Wholesale Clients',
  inventory: 'Inventory',
  'inventory-hub': 'Inventory',
  invoices: 'Invoices',
  settings: 'Settings',
  'settings-hub': 'Settings',
  analytics: 'Analytics',
  'analytics-hub': 'Analytics',
  'fulfillment-hub': 'Fulfillment',
  'finance-hub': 'Finance',
  'marketing-hub': 'Marketing',
  'operations-hub': 'Operations',
  'integrations-hub': 'Integrations',
  storefront: 'Storefront',
  'storefront-hub': 'Storefront',
  'help-hub': 'Help',
  pos: 'Point of Sale',
  'pos-system': 'Point of Sale',
  vendors: 'Vendors',
  'live-orders': 'Live Orders',
  'disposable-menus': 'Disposable Menus',
  'cash-register': 'Cash Register',
  'pre-orders': 'Pre-Orders',
  compliance: 'Compliance',
  drivers: 'Drivers',
  manifests: 'Manifests',
  'route-planning': 'Route Planning',
  zones: 'Zones',
  'delivery-zones': 'Delivery Zones',
  team: 'Team',
  billing: 'Billing',
  notifications: 'Notifications',
  profile: 'Profile',
};

interface BreadcrumbsProps {
  className?: string;
}

function formatSegmentLabel(segment: string): string {
  if (SEGMENT_LABELS[segment]) {
    return SEGMENT_LABELS[segment];
  }

  // Convert kebab-case or plain text to Title Case
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function Breadcrumbs({ className }: BreadcrumbsProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();

  const pathSegments = location.pathname
    .split('/')
    .filter(Boolean)
    .filter(segment => segment !== tenantSlug && segment !== 'admin');

  // Don't show breadcrumbs if we're at the dashboard (root)
  if (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === 'dashboard')) {
    return null;
  }

  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = `/${tenantSlug}/admin/${pathSegments.slice(0, index + 1).join('/')}`;
    const label = formatSegmentLabel(segment);

    return { path, label };
  });

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className={cn(
        'flex items-center gap-1.5 text-sm text-muted-foreground',
        className
      )}
    >
      <Link
        to={`/${tenantSlug}/admin/dashboard`}
        className="hover:text-foreground transition-colors flex items-center"
        aria-label="Dashboard"
      >
        <Home className="h-4 w-4" />
      </Link>

      {breadcrumbs.map((crumb, index) => (
        <Fragment key={crumb.path}>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
          {index === breadcrumbs.length - 1 ? (
            <span
              className="text-foreground font-medium whitespace-nowrap"
              aria-current="page"
            >
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-foreground transition-colors whitespace-nowrap"
            >
              {crumb.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
