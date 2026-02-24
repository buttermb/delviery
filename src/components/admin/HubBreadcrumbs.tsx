/**
 * Hub Breadcrumbs Component
 * Provides contextual navigation for hub pages with tenant context
 * Shows: [Tenant Name] > [Hub Name] > [Tab Name]
 */

import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface HubBreadcrumbsProps {
    hubName: string;
    hubHref: string;
    currentTab?: string;
    className?: string;
}

// Hub name to display name mapping
const HUB_DISPLAY_NAMES: Record<string, string> = {
    dashboard: 'Dashboard',
    'dashboard-hub': 'Dashboard',
    'inventory-hub': 'Inventory',
    'customer-hub': 'Customers',
    'finance-hub': 'Finance',
    'fulfillment-hub': 'Fulfillment',
    'marketing-hub': 'Marketing',
    'analytics-hub': 'Analytics',
    'operations-hub': 'Operations',
    'integrations-hub': 'Integrations',
    'settings-hub': 'Settings',
    'help-hub': 'Help & Support',
    'storefront-hub': 'Storefront',
    'pos-system': 'Point of Sale',
    orders: 'Orders',
};

export function HubBreadcrumbs({
    hubName,
    hubHref,
    currentTab,
    className,
}: HubBreadcrumbsProps) {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const { tenant } = useTenantAdminAuth();

    // Tenant display name
    const tenantDisplayName = tenant?.business_name || (tenantSlug
        ? tenantSlug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        : 'Admin');

    const breadcrumbs: BreadcrumbItem[] = [
        {
            label: HUB_DISPLAY_NAMES[hubName] || hubName,
            href: currentTab ? `/${tenantSlug}/admin/${hubHref}` : undefined,
        },
    ];

    // Add current tab if provided
    if (currentTab) {
        breadcrumbs.push({
            label: currentTab,
        });
    }

    return (
        <nav
            aria-label="Breadcrumb"
            className={cn(
                'flex items-center text-sm text-muted-foreground mb-4',
                className
            )}
        >
            <ol className="flex items-center gap-1">
                {/* Tenant context */}
                <li className="flex items-center">
                    <Link
                        to={`/${tenantSlug}/admin/dashboard`}
                        className="hover:text-foreground transition-colors flex items-center gap-1.5"
                        title={`${tenantDisplayName} Dashboard`}
                    >
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="font-medium max-w-[120px] truncate">
                            {tenantDisplayName}
                        </span>
                    </Link>
                </li>

                {/* Hub and tab breadcrumbs */}
                {breadcrumbs.map((item, index) => (
                    <li key={index} className="flex items-center">
                        <ChevronRight className="h-3.5 w-3.5 mx-1 text-muted-foreground/50 flex-shrink-0" />
                        {item.href ? (
                            <Link
                                to={item.href}
                                className="hover:text-foreground transition-colors"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span className="text-foreground font-medium">{item.label}</span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
