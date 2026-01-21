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
    Download,
} from 'lucide-react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { lazy, Suspense, useMemo, Fragment } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { QuickActions } from '@/components/admin/ui/QuickActions';
import { AlertBadge } from '@/components/admin/ui/AlertBadge';
import { useAdminBadgeCounts } from '@/hooks/useAdminBadgeCounts';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';

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

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab });
    };

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
