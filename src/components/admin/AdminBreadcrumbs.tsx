/**
 * Admin Breadcrumbs Component
 * Provides navigation context for all admin pages below hub level
 *
 * Features:
 * - Dashboard always shown as first crumb with Home icon
 * - Each segment clickable except current page
 * - Tenant-aware routing
 * - Mobile responsive with middle truncation
 * - Format: Dashboard > Hub Name > Sub-page > Detail
 */

import { Link, useParams, useLocation } from 'react-router-dom';
import { ChevronRight, Home, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export interface BreadcrumbSegment {
    label: string;
    href?: string;
}

interface AdminBreadcrumbsProps {
    /** Optional custom breadcrumb items - if provided, auto-generation is skipped */
    items?: BreadcrumbSegment[];
    /** Additional CSS classes */
    className?: string;
    /** Maximum visible segments before truncation (default: 4) */
    maxVisibleSegments?: number;
}

// Route segment to display name mapping
const SEGMENT_DISPLAY_NAMES: Record<string, string> = {
    // Hubs
    'inventory-hub': 'Inventory',
    'customer-hub': 'Customers',
    'finance-hub': 'Finance',
    'fulfillment-hub': 'Fulfillment',
    'marketing-hub': 'Marketing',
    'analytics-hub': 'Analytics',
    'operations-hub': 'Operations',
    'integrations-hub': 'Integrations',
    'settings-hub': 'Settings',
    'help-hub': 'Help',
    'storefront-hub': 'Storefront',
    'pos-system': 'Point of Sale',
    'orders-hub': 'Orders',
    // Common routes
    'dashboard': 'Dashboard',
    'orders': 'Orders',
    'products': 'Products',
    'clients': 'Clients',
    'invoices': 'Invoices',
    'pre-orders': 'Pre-Orders',
    'inventory': 'Inventory',
    'crm': 'CRM',
    'reports': 'Reports',
    'settings': 'Settings',
    'users': 'Users',
    'team': 'Team',
    'billing': 'Billing',
    'account': 'Account',
    'stores': 'Stores',
    'promotions': 'Promotions',
    'coupons': 'Coupons',
    'compliance': 'Compliance',
    'manifests': 'Manifests',
    'vehicles': 'Vehicles',
    'drivers': 'Drivers',
    'routes': 'Routes',
    'payments': 'Payments',
    'quickbooks': 'QuickBooks',
    'metrc': 'METRC',
    'pos': 'POS',
    'notifications': 'Notifications',
    'profile': 'Profile',
};

// Segments to skip in breadcrumb generation
const SKIP_SEGMENTS = new Set(['admin']);

/**
 * Format a path segment into a readable label
 */
function formatSegmentLabel(segment: string): string {
    // Check for known display name
    if (SEGMENT_DISPLAY_NAMES[segment]) {
        return SEGMENT_DISPLAY_NAMES[segment];
    }

    // Check if it looks like an ID (UUID or numeric)
    if (/^[0-9a-f-]{36}$/i.test(segment) || /^\d+$/.test(segment)) {
        return `#${segment.slice(0, 8)}...`;
    }

    // Convert kebab-case to Title Case
    return segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Generate breadcrumbs from current URL path
 */
function generateBreadcrumbsFromPath(
    pathname: string,
    tenantSlug: string | undefined
): BreadcrumbSegment[] {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbSegment[] = [];

    // Always start with Dashboard
    breadcrumbs.push({
        label: 'Dashboard',
        href: tenantSlug ? `/${tenantSlug}/admin/dashboard` : '/admin/dashboard',
    });

    // Skip tenant slug if present
    const startIndex = tenantSlug && paths[0] === tenantSlug ? 1 : 0;
    const relevantPaths = paths.slice(startIndex);

    // Build breadcrumbs from remaining path segments
    let currentPath = tenantSlug ? `/${tenantSlug}` : '';

    for (const segment of relevantPaths) {
        // Skip certain segments
        if (SKIP_SEGMENTS.has(segment)) {
            currentPath += `/${segment}`;
            continue;
        }

        currentPath += `/${segment}`;
        const label = formatSegmentLabel(segment);

        // Don't duplicate Dashboard
        if (segment === 'dashboard' && breadcrumbs.length === 1) {
            continue;
        }

        breadcrumbs.push({
            label,
            href: currentPath,
        });
    }

    // Remove href from last item (current page)
    if (breadcrumbs.length > 0) {
        const lastIndex = breadcrumbs.length - 1;
        breadcrumbs[lastIndex] = {
            label: breadcrumbs[lastIndex].label,
            href: undefined,
        };
    }

    return breadcrumbs;
}

export function AdminBreadcrumbs({
    items,
    className,
    maxVisibleSegments = 4,
}: AdminBreadcrumbsProps) {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const location = useLocation();

    // Use custom items or generate from path
    const breadcrumbs = items ?? generateBreadcrumbsFromPath(location.pathname, tenantSlug);

    // Don't render if only Dashboard (we're on the dashboard itself)
    if (breadcrumbs.length <= 1) {
        return null;
    }

    // Calculate which items to show vs collapse
    const shouldTruncate = breadcrumbs.length > maxVisibleSegments;
    const firstItem = breadcrumbs[0];
    const lastItems = shouldTruncate
        ? breadcrumbs.slice(-2) // Show last 2 items
        : breadcrumbs.slice(1);
    const middleItems = shouldTruncate
        ? breadcrumbs.slice(1, -2) // Items to collapse
        : [];

    return (
        <Breadcrumb className={className}>
            <BreadcrumbList className="flex-nowrap">
                {/* First item (Dashboard) - always visible */}
                <BreadcrumbItem>
                    {firstItem.href ? (
                        <BreadcrumbLink asChild>
                            <Link
                                to={firstItem.href}
                                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                            >
                                <Home className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{firstItem.label}</span>
                            </Link>
                        </BreadcrumbLink>
                    ) : (
                        <BreadcrumbPage className="flex items-center gap-1.5">
                            <Home className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{firstItem.label}</span>
                        </BreadcrumbPage>
                    )}
                </BreadcrumbItem>

                {/* Collapsed middle items (if truncating) */}
                {shouldTruncate && middleItems.length > 0 && (
                    <>
                        <BreadcrumbSeparator>
                            <ChevronRight className="h-3.5 w-3.5" />
                        </BreadcrumbSeparator>
                        <BreadcrumbItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-1 hover:bg-accent"
                                    >
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Toggle menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    {middleItems.map((item, index) => (
                                        <DropdownMenuItem key={index} asChild>
                                            {item.href ? (
                                                <Link to={item.href}>{item.label}</Link>
                                            ) : (
                                                <span>{item.label}</span>
                                            )}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </BreadcrumbItem>
                    </>
                )}

                {/* Remaining visible items */}
                {lastItems.map((item, index) => (
                    <span key={index} className="contents">
                        <BreadcrumbSeparator>
                            <ChevronRight className="h-3.5 w-3.5" />
                        </BreadcrumbSeparator>
                        <BreadcrumbItem className="whitespace-nowrap">
                            {item.href ? (
                                <BreadcrumbLink asChild>
                                    <Link
                                        to={item.href}
                                        className="hover:text-foreground transition-colors max-w-[150px] truncate block"
                                        title={item.label}
                                    >
                                        {item.label}
                                    </Link>
                                </BreadcrumbLink>
                            ) : (
                                <BreadcrumbPage
                                    className={cn(
                                        'font-medium max-w-[200px] truncate block',
                                        'text-foreground'
                                    )}
                                    title={item.label}
                                >
                                    {item.label}
                                </BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                    </span>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

/**
 * Mobile-optimized breadcrumb that only shows current page title
 * Used in mobile header
 */
export function MobileBreadcrumbTitle({ className }: { className?: string }) {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const location = useLocation();

    const breadcrumbs = generateBreadcrumbsFromPath(location.pathname, tenantSlug);
    const currentPage = breadcrumbs[breadcrumbs.length - 1];

    if (!currentPage) {
        return <span className={cn('font-semibold', className)}>Dashboard</span>;
    }

    return (
        <span className={cn('font-semibold truncate', className)}>
            {currentPage.label}
        </span>
    );
}
