/**
 * Fulfillment & Delivery Hub Page
 * Consolidated fulfillment page with tabs:
 * - Dashboard: Shipping overview and status
 * - Pending: Orders ready to ship
 * - In Transit: Active deliveries
 * - Couriers: Courier management
 * - Fleet: Vehicle and route management
 * - Returns: Return processing
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    LayoutDashboard,
    Clock,
    Truck,
    Users,
    Car,
    ArrowLeftRight,
    MapPinned,
    Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';

// Lazy load tab content for performance
const DeliveryManagement = lazy(() => import('@/pages/admin/DeliveryManagement'));
const LiveOrders = lazy(() => import('@/pages/admin/LiveOrders'));
const Couriers = lazy(() => import('@/pages/admin/Couriers'));
const FleetManagement = lazy(() => import('@/pages/admin/FleetManagement'));
const ReturnsManagementPage = lazy(() => import('@/pages/admin/ReturnsManagementPage'));
const RouteOptimization = lazy(() => import('@/pages/admin/RouteOptimization'));
const LiveMap = lazy(() => import('@/pages/admin/LiveMap'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Overview
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
    // Live Shipments
    { id: 'pending', label: 'Pending', icon: Clock, group: 'Shipments' },
    { id: 'in-transit', label: 'In Transit', icon: Truck, group: 'Shipments' },
    { id: 'map', label: 'Live Map', icon: MapPinned, group: 'Shipments' },
    // Team & Fleet
    { id: 'couriers', label: 'Couriers', icon: Users, group: 'Fleet' },
    { id: 'fleet', label: 'Fleet', icon: Car, group: 'Fleet' },
    { id: 'routes', label: 'Routes', icon: Package, group: 'Fleet' },
    // Returns
    { id: 'returns', label: 'Returns', icon: ArrowLeftRight, group: 'Returns' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function FulfillmentHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'dashboard';
    const { navigateToAdmin } = useTenantNavigation();

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <HubBreadcrumbs
                        hubName="fulfillment-hub"
                        hubHref="fulfillment-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Fulfillment & Delivery</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage shipments, couriers, and delivery operations
                            </p>
                        </div>
                        {activeTab === 'pending' && (
                            <Button onClick={() => navigateToAdmin('orders')}>
                                View All Orders
                            </Button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                return (
                                    <>
                                        {showSeparator && (
                                            <div key={`sep-${index}`} className="w-px h-6 bg-border mx-1" />
                                        )}
                                        <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                            <tab.icon className="h-4 w-4" />
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </TabsTrigger>
                                    </>
                                );
                            })}
                        </TabsList>
                    </div>
                </div>

                {/* Dashboard Tab */}
                <TabsContent value="dashboard" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <DeliveryManagement />
                    </Suspense>
                </TabsContent>

                {/* Pending Shipments Tab */}
                <TabsContent value="pending" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <LiveOrders />
                    </Suspense>
                </TabsContent>

                {/* In Transit Tab */}
                <TabsContent value="in-transit" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <LiveOrders />
                    </Suspense>
                </TabsContent>

                {/* Live Map Tab */}
                <TabsContent value="map" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <LiveMap />
                    </Suspense>
                </TabsContent>

                {/* Couriers Tab */}
                <TabsContent value="couriers" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <Couriers />
                    </Suspense>
                </TabsContent>

                {/* Fleet Tab */}
                <TabsContent value="fleet" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <FleetManagement />
                    </Suspense>
                </TabsContent>

                {/* Routes Tab */}
                <TabsContent value="routes" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <RouteOptimization />
                    </Suspense>
                </TabsContent>

                {/* Returns Tab */}
                <TabsContent value="returns" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <ReturnsManagementPage />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
