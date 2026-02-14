/**
 * PageHeader Component
 * Consistent page header for all admin pages
 * Renders title, subtitle, breadcrumbs, actions, and optional status badge
 */

import { type ReactNode, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

/**
 * Breadcrumb item structure
 */
export interface BreadcrumbItem {
  /** Display label for the breadcrumb */
  label: string;
  /** Path to navigate to (will be prefixed with tenant slug) */
  href?: string;
}

/**
 * Badge configuration for page status
 */
export interface PageBadge {
  /** Badge display text */
  label: string;
  /** Badge variant for styling */
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  /** Additional CSS classes */
  className?: string;
}

/**
 * PageHeader Props
 */
export interface PageHeaderProps {
  /** Main page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Array of breadcrumb items (will auto-include tenant root) */
  breadcrumbs?: BreadcrumbItem[];
  /** Action buttons/elements to render on the right side */
  actions?: ReactNode;
  /** Optional status badge displayed next to title */
  badge?: PageBadge;
  /** Additional CSS classes for the container */
  className?: string;
  /** Additional CSS classes for the title */
  titleClassName?: string;
}

/**
 * PageHeader - Consistent header for all admin pages
 *
 * Provides:
 * - Breadcrumb navigation with tenant-aware links
 * - Page title with optional status badge
 * - Optional subtitle
 * - Right-aligned action buttons
 *
 * Usage:
 * ```tsx
 * <PageHeader
 *   title="Products"
 *   subtitle="Manage your product catalog"
 *   breadcrumbs={[
 *     { label: 'Inventory', href: '/admin/inventory' },
 *     { label: 'Products' }
 *   ]}
 *   badge={{ label: 'Beta', variant: 'secondary' }}
 *   actions={
 *     <>
 *       <Button variant="outline">Export</Button>
 *       <Button>Add Product</Button>
 *     </>
 *   }
 * />
 * ```
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  actions,
  badge,
  className,
  titleClassName,
}: PageHeaderProps) {
  const { tenantSlug, tenant } = useTenantAdminAuth();

  // Build full breadcrumb path with tenant prefix
  const buildHref = (href?: string): string | undefined => {
    if (!href) return undefined;
    // If href already starts with /, prefix with tenant slug
    if (href.startsWith('/')) {
      return `/${tenantSlug}${href}`;
    }
    return `/${tenantSlug}/admin/${href}`;
  };

  // Tenant display name for root breadcrumb
  const tenantDisplayName = tenant?.business_name || (tenantSlug
    ? tenantSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Dashboard');

  return (
    <div className={cn('space-y-1', className)}>
      {/* Breadcrumb Navigation */}
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Page breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          {/* Tenant root */}
          <Link
            to={`/${tenantSlug}/admin/dashboard`}
            className="hover:text-foreground transition-colors"
          >
            {tenantDisplayName}
          </Link>

          {/* Breadcrumb items */}
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const href = buildHref(crumb.href);

            return (
              <Fragment key={`${crumb.label}-${index}`}>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                {isLast || !href ? (
                  <span
                    className={cn(
                      'truncate max-w-[200px]',
                      isLast && 'text-foreground font-medium'
                    )}
                    aria-current={isLast ? 'page' : undefined}
                    title={crumb.label}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={href}
                    className="hover:text-foreground transition-colors truncate max-w-[150px]"
                    title={crumb.label}
                  >
                    {crumb.label}
                  </Link>
                )}
              </Fragment>
            );
          })}
        </nav>
      )}

      {/* Title Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          {/* Title with optional badge */}
          <div className="flex items-center gap-3">
            <h1
              className={cn(
                'text-2xl font-semibold tracking-tight truncate',
                titleClassName
              )}
            >
              {title}
            </h1>
            {badge && (
              <Badge
                variant={badge.variant || 'secondary'}
                className={cn('flex-shrink-0', badge.className)}
              >
                {badge.label}
              </Badge>
            )}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {/* Action buttons - aligned right */}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
