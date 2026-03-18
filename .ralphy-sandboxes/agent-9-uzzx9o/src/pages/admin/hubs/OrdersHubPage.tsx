/**
 * Orders Hub Page
 * Consolidated orders page with tabs:
 * - Menu Orders: Disposable menu orders
 * - Wholesale: B2B wholesale orders
 * - Storefront: Online store orders
 * - Pre-Orders: Advance orders
 * - Live: Real-time order tracking
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Package,
    Store,
    Clock,
    Radio,
    Plus,
    History,
    Workflow,
    FileText,
    Link,
} from 'lucide-react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Fragment, lazy, Suspense, useMemo, useCallback, useState } from 'react';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { QuickActions } from '@/components/admin/ui/QuickActions';
import { AlertBadge } from '@/components/admin/ui/AlertBadge';
import { useAdminBadgeCounts } from '@/hooks/useAdminBadgeCounts';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { ScrollableTabsList } from '@/components/admin/ScrollableTabsList';
import { useUnifiedOrders, type UnifiedOrder } from '@/hooks/useUnifiedOrders';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { usePageTitle } from '@/hooks/usePageTitle';

// Lazy load tab content for performance
const WholesaleOrdersPage = lazy(() => import('@/pages/admin/WholesaleOrdersPage'));
const StorefrontOrders = lazy(() => import('@/pages/admin/storefront/StorefrontOrders'));
const PreOrdersPage = lazy(() => import('@/pages/admin/PreOrdersPage'));
const LiveOrders = lazy(() => import('@/pages/admin/LiveOrders'));
const OrderPipelinePage = lazy(() => import('@/pages/tenant-admin/OrderPipelinePage'));
const Orders = lazy(() => import('@/pages/admin/Orders'));
const DisposableMenuOrders = lazy(() => import('@/pages/admin/DisposableMenuOrders'));

const TabSkeleton = () => (
    <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Live Operations
    { id: 'live', label: 'Pending', icon: Radio, group: 'Live' },
    { id: 'history', label: 'All', icon: History, group: 'Live' },
    // Order Sources
    { id: 'menu', label: 'Menu', tooltip: 'Disposable Menu Orders', icon: Link, group: 'Sources' },
    { id: 'wholesale', label: 'B2B', tooltip: 'Business-to-Business Orders', icon: Package, group: 'Sources' },
    { id: 'storefront', label: 'Store', icon: Store, group: 'Sources' },
    { id: 'preorders', label: 'Pre-Orders', icon: Clock, group: 'Sources' },
    // Pipeline
    { id: 'pipeline', label: 'Pipeline', icon: Workflow, group: 'Pipeline' },
] as const;

type TabId = typeof tabs[number]['id'];

/**
 * Export orders to CSV file using papaparse
 */
async function exportToCSV(orders: UnifiedOrder[], filename: string = 'orders-export'): Promise<void> {
    if (!orders || orders.length === 0) {
        toast.error('No orders to export');
        return;
    }

    // Transform orders into flat CSV-friendly rows
    const csvData = orders.map((order) => ({
        order_number: order.order_number,
        order_type: order.order_type,
        source: order.source,
        menu_source: order.menu?.name ?? '',
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method ?? '',
        subtotal: order.subtotal,
        tax_amount: order.tax_amount,
        discount_amount: order.discount_amount,
        total_amount: order.total_amount,
        customer_name: order.customer
            ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
            : order.client?.business_name ?? order.contact_name ?? '',
        customer_email: order.customer?.email ?? '',
        contact_phone: order.contact_phone ?? '',
        delivery_address: order.delivery_address ?? '',
        delivery_notes: order.delivery_notes ?? '',
        courier_name: order.courier?.full_name ?? '',
        items_count: order.items?.length ?? 0,
        created_at: order.created_at,
        updated_at: order.updated_at,
        cancelled_at: order.cancelled_at ?? '',
        cancellation_reason: order.cancellation_reason ?? '',
    }));

    // Lazy-load papaparse only when export is requested.
    const Papa = (await import('papaparse')).default;

    // Generate CSV using papaparse
    const csv = Papa.unparse(csvData, {
        quotes: true, // Wrap all fields in quotes for safety
        header: true,
    });

    // Create and trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${orders.length} orders to CSV`);
}

export default function OrdersHubPage() {
    usePageTitle('Orders');
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'live';
    const { navigateToAdmin } = useTenantNavigation();
    const { totalPending } = useAdminBadgeCounts();
    const [isExporting, setIsExporting] = useState(false);

    // Fetch orders for export (all order types, higher limit for export)
    const { data: _orders, refetch: refetchOrders } = useUnifiedOrders({
        orderType: 'all',
        limit: 1000,
        enabled: false, // Only fetch when export is triggered
    });

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab }, { replace: true });
    };

    const handleExport = useCallback(async () => {
        setIsExporting(true);
        try {
            const { data } = await refetchOrders();
            if (data) {
                await exportToCSV(data, 'orders-export');
            }
        } catch (error) {
            toast.error('Failed to export orders', { description: humanizeError(error) });
        } finally {
            setIsExporting(false);
        }
    }, [refetchOrders]);

    const quickActions = useMemo(() => {
        const actions = [];
        if (activeTab === 'wholesale') {
            actions.push({
                id: 'new-wholesale',
                label: 'New B2B Order',
                icon: Plus,
                onClick: () => navigateToAdmin('/wholesale-orders/new'),
            });
        }
        if (activeTab === 'preorders') {
            actions.push({
                id: 'new-preorder',
                label: 'New Pre-Order',
                icon: Plus,
                onClick: () => navigateToAdmin('/crm/pre-orders/new'),
            });
        }
        actions.push({
            id: 'export',
            label: isExporting ? 'Exporting...' : 'Export',
            icon: FileText,
            onClick: handleExport,
            variant: 'outline' as const,
            disabled: isExporting,
        });
        return actions;
    }, [activeTab, navigateToAdmin, handleExport, isExporting]);

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-6 py-4">
                    <HubBreadcrumbs
                        hubName="orders"
                        hubHref="orders-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div>
                                <h1 className="text-2xl font-bold">Orders</h1>
                                <p className="text-muted-foreground text-sm">
                                    Manage all order types in one place
                                </p>
                            </div>
                            {activeTab === 'live' && totalPending > 0 && (
                                <AlertBadge level="critical" count={totalPending} pulse />
                            )}
                        </div>
                        <QuickActions actions={quickActions} />
                    </div>
                    <ScrollableTabsList>
                        <TooltipProvider delayDuration={300}>
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                const trigger = (
                                    <TabsTrigger value={tab.id} className="flex items-center gap-2">
                                        <tab.icon className="h-4 w-4" />
                                        <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                                    </TabsTrigger>
                                );
                                return (
                                    <Fragment key={tab.id}>
                                        {showSeparator && (
                                            <div className="w-px h-6 bg-border mx-1" />
                                        )}
                                        {'tooltip' in tab && tab.tooltip ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                                                <TooltipContent>{tab.tooltip}</TooltipContent>
                                            </Tooltip>
                                        ) : trigger}
                                    </Fragment>
                                );
                            })}
                        </TabsList>
                        </TooltipProvider>
                    </ScrollableTabsList>
                </div>


                {/* Menu Orders Tab */}
                <TabsContent value="menu" className="m-0">
                    <ModuleErrorBoundary moduleName="Menu Orders">
                        <Suspense fallback={<TabSkeleton />}>
                            <DisposableMenuOrders />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Wholesale Orders Tab */}
                <TabsContent value="wholesale" className="m-0">
                    <ModuleErrorBoundary moduleName="Wholesale Orders">
                        <Suspense fallback={<TabSkeleton />}>
                            <WholesaleOrdersPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Storefront Orders Tab */}
                <TabsContent value="storefront" className="m-0">
                    <ModuleErrorBoundary moduleName="Storefront Orders">
                        <Suspense fallback={<TabSkeleton />}>
                            <StorefrontOrders />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Pre-Orders Tab */}
                <TabsContent value="preorders" className="m-0">
                    <ModuleErrorBoundary moduleName="Pre-Orders">
                        <Suspense fallback={<TabSkeleton />}>
                            <PreOrdersPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Live Orders Tab */}
                <TabsContent value="live" className="m-0">
                    <ModuleErrorBoundary moduleName="Live Orders">
                        <Suspense fallback={<TabSkeleton />}>
                            <LiveOrders />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Pipeline Tab */}
                <TabsContent value="pipeline" className="m-0">
                    <ModuleErrorBoundary moduleName="Pipeline">
                        <Suspense fallback={<TabSkeleton />}>
                            <OrderPipelinePage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="m-0">
                    <ModuleErrorBoundary moduleName="Order History">
                        <Suspense fallback={<TabSkeleton />}>
                            <Orders />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
            </Tabs>
        </div>
    );
}
