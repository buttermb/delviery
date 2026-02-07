/**
 * Hub Breadcrumbs Component
 * Provides navigation context for hub pages
 * Shows: Dashboard > [Hub Name] > [Tab Name]
 */

import { Link, useParams, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    orders: 'Orders',
};

export function HubBreadcrumbs({
    hubName,
    hubHref,
    currentTab,
    className,
}: HubBreadcrumbsProps) {
    const { tenantSlug } = useParams();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            label: 'Dashboard',
            href: `/${tenantSlug}/admin/dashboard`,
        },
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
                {breadcrumbs.map((item, index) => (
                    <li key={index} className="flex items-center">
                        {index > 0 && (
                            <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" />
                        )}
                        {item.href ? (
                            <Link
                                to={item.href}
                                className="hover:text-foreground transition-colors flex items-center gap-1"
                            >
                                {index === 0 && <Home className="h-3.5 w-3.5" />}
                                <span>{item.label}</span>
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
