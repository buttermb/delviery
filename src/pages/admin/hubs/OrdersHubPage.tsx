/**
 * Orders Hub Page
 * Consolidated orders page with tabs:
 * - Menu Orders: Disposable menu orders
 * - Wholesale: B2B wholesale orders
 * - Storefront: Online store orders
 * - Pre-Orders: Advance orders
 * - Live: Real-time order tracking
 *
 * Quick Links section provides access to:
 * - Order List, Create Order, Order Templates
 * - Delivery Routes, Driver Management (cross-hub links)
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
    Download,
    List,
    FileStack,
    Route,
    Users,
} from 'lucide-react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { lazy, Suspense, useMemo, Fragment, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { QuickActions } from '@/components/admin/ui/QuickActions';
import { AlertBadge } from '@/components/admin/ui/AlertBadge';
import { useAdminBadgeCounts } from '@/hooks/useAdminBadgeCounts';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { HubLinkCard, HubLinkGrid } from '@/components/admin/ui/HubLinkCard';
import { useOrdersHubCounts } from '@/hooks/useOrdersHubCounts';

// Lazy load tab content for performance
const WholesaleOrdersPage = lazy(() => import('@/pages/admin/WholesaleOrdersPage'));
const StorefrontOrders = lazy(() => import('@/pages/admin/storefront/StorefrontOrders'));
const PreOrdersPage = lazy(() => import('@/pages/admin/PreOrdersPage'));
const LiveOrders = lazy(() => import('@/pages/admin/LiveOrders'));
const OrderPipelinePage = lazy(() => import('@/pages/tenant-admin/OrderPipelinePage'));
const Orders = lazy(() => import('@/pages/admin/Orders'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Live Operations
    { id: 'live', label: 'Pending', icon: Radio, group: 'Live' },
    { id: 'history', label: 'All', icon: History, group: 'Live' },
    // Order Sources
    { id: 'wholesale', label: 'B2B', icon: Package, group: 'Sources' },
    { id: 'storefront', label: 'Store', icon: Store, group: 'Sources' },
    { id: 'preorders', label: 'Pre-Orders', icon: Clock, group: 'Sources' },
    // Pipeline
    { id: 'pipeline', label: 'Pipeline', icon: Workflow, group: 'Pipeline' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function OrdersHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'live';
    const { navigateToAdmin } = useTenantNavigation();
    const { totalPending } = useAdminBadgeCounts();
    const { counts, isLoading: countsLoading } = useOrdersHubCounts();

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

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
            label: 'Export',
            icon: Download,
            onClick: () => {
                toast.info('Export feature coming soon', {
                    description: 'Order export will be available in the next update.',
                });
            },
            variant: 'outline' as const,
        });
        return actions;
    }, [activeTab, navigateToAdmin]);

    return (
        <div className="min-h-dvh bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <HubBreadcrumbs
                        hubName="orders"
                        hubHref="orders-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex items-center justify-between mb-4">
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
                    <div className="overflow-x-auto">
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                return (
                                    <Fragment key={tab.id}>
                                        {showSeparator && (
                                            <div className="w-px h-6 bg-border mx-1" />
                                        )}
                                        <TabsTrigger value={tab.id} className="flex items-center gap-2">
                                            <tab.icon className="h-4 w-4" />
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </TabsTrigger>
                                    </Fragment>
                                );
                            })}
                        </TabsList>
                    </div>

                    {/* Quick Links Section */}
                    <div className="mt-4 pt-4 border-t">
                        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Links</h2>
                        <HubLinkGrid>
                            <HubLinkCard
                                title="Order List"
                                description="View all orders across channels"
                                icon={List}
                                href="orders-hub?tab=history"
                                count={counts.totalOrders}
                                countLabel="total"
                                status="info"
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Create Order"
                                description="Start a new wholesale or pre-order"
                                icon={Plus}
                                href="wholesale-orders/new"
                                status="active"
                            />
                            <HubLinkCard
                                title="Order Templates"
                                description="Saved order templates for quick reuse"
                                icon={FileStack}
                                href="orders-hub?tab=pipeline"
                                count={counts.templates}
                                countLabel="saved"
                                status="info"
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Delivery Routes"
                                description="Plan and optimize delivery routes"
                                icon={Route}
                                href="fulfillment-hub?tab=routes"
                                count={counts.activeRoutes}
                                countLabel="active"
                                status={counts.activeRoutes > 0 ? 'active' : 'info'}
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Driver Management"
                                description="Manage couriers and drivers"
                                icon={Users}
                                href="fulfillment-hub?tab=couriers"
                                count={counts.activeCouriers}
                                countLabel="online"
                                status={counts.activeCouriers > 0 ? 'active' : 'pending'}
                                isLoading={countsLoading}
                            />
                        </HubLinkGrid>
                    </div>
                </div>


                {/* Wholesale Orders Tab */}
                <TabsContent value="wholesale" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <WholesaleOrdersPage />
                    </Suspense>
                </TabsContent>

                {/* Storefront Orders Tab */}
                <TabsContent value="storefront" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <StorefrontOrders />
                    </Suspense>
                </TabsContent>

                {/* Pre-Orders Tab */}
                <TabsContent value="preorders" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <PreOrdersPage />
                    </Suspense>
                </TabsContent>

                {/* Live Orders Tab */}
                <TabsContent value="live" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <LiveOrders />
                    </Suspense>
                </TabsContent>

                {/* Pipeline Tab */}
                <TabsContent value="pipeline" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <OrderPipelinePage />
                    </Suspense>
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <Orders />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
