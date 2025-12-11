/**
 * Delivery Hub Page
 * Consolidated delivery management with tabs:
 * - Dashboard: Delivery overview
 * - Fleet: Vehicle management
 * - Couriers: Driver management
 * - Tracking: Live delivery tracking
 * - Routes: Route optimization
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Truck,
    Car,
    Users,
    MapPin,
    Route
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const DeliveryManagement = lazy(() => import('@/pages/admin/DeliveryManagement'));
const FleetManagement = lazy(() => import('@/pages/admin/FleetManagement'));
const Couriers = lazy(() => import('@/pages/admin/Couriers'));
const DeliveryTracking = lazy(() => import('@/pages/admin/DeliveryTracking'));
const RouteOptimizationPage = lazy(() => import('@/pages/tenant-admin/RouteOptimizationPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Truck },
    { id: 'fleet', label: 'Fleet', icon: Car },
    { id: 'couriers', label: 'Couriers', icon: Users },
    { id: 'tracking', label: 'Tracking', icon: MapPin },
    { id: 'routes', label: 'Routes', icon: Route },
] as const;

type TabId = typeof tabs[number]['id'];

export default function DeliveryHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'dashboard';

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab });
    };

    return (
        <div className="min-h-screen bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="border-b bg-card px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Delivery</h1>
                            <p className="text-muted-foreground text-sm">
                                Fleet, couriers, and delivery operations
                            </p>
                        </div>
                    </div>
                    <TabsList className="grid w-full max-w-2xl grid-cols-5">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                <tab.icon className="h-4 w-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <TabsContent value="dashboard" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><DeliveryManagement /></Suspense>
                </TabsContent>
                <TabsContent value="fleet" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><FleetManagement /></Suspense>
                </TabsContent>
                <TabsContent value="couriers" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><Couriers /></Suspense>
                </TabsContent>
                <TabsContent value="tracking" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><DeliveryTracking /></Suspense>
                </TabsContent>
                <TabsContent value="routes" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><RouteOptimizationPage /></Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
