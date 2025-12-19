/**
 * Storefront Hub Page
 * Consolidated storefront management with tabs:
 * - Dashboard: Store overview
 * - Products: Product visibility
 * - Orders: Storefront orders
 * - Customers: Customer management
 * - Coupons: Discount codes
 * - Settings: Store configuration
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Tag,
    Settings,
    Brush,
    Boxes,
} from 'lucide-react';
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const StorefrontDashboard = lazy(() => import('@/pages/admin/storefront/StorefrontDashboard'));
const StorefrontProducts = lazy(() => import('@/pages/admin/storefront/StorefrontProducts'));
const StorefrontOrders = lazy(() => import('@/pages/admin/storefront/StorefrontOrders'));
const StorefrontCustomers = lazy(() => import('@/pages/admin/storefront/StorefrontCustomers'));
const StorefrontCoupons = lazy(() => import('@/pages/admin/storefront/StorefrontCoupons'));
const StorefrontSettings = lazy(() => import('@/pages/admin/storefront/StorefrontSettings'));
const StorefrontBuilder = lazy(() => import('@/pages/admin/storefront/StorefrontBuilder'));
const StorefrontBundles = lazy(() => import('@/pages/admin/storefront/StorefrontBundles'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Overview
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    // Store Operations
    { id: 'products', label: 'Catalog', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'customers', label: 'Customers', icon: Users },
    // Marketing
    { id: 'coupons', label: 'Promos', icon: Tag },
    { id: 'bundles', label: 'Bundles', icon: Boxes },
    // Customization
    { id: 'builder', label: 'Design', icon: Brush },
    { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = typeof tabs[number]['id'];

export default function StorefrontHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'dashboard';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

    return (
        <div className="min-h-0 bg-background flex flex-col -m-3 sm:-m-4 md:-m-6" style={{ height: 'calc(100vh - 56px)' }}>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 min-h-0 flex flex-col">
                <div className="border-b bg-card px-4 py-4 shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Storefront</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage your online store
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <TabsList className="inline-flex min-w-max">
                            {tabs.map((tab) => (
                                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                    <tab.icon className="h-4 w-4" />
                                    <span className="hidden md:inline">{tab.label}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                </div>

                {/* Constrain tab content height so embedded tools (like Builder) don't get clipped */}
                <div className="flex-1 min-h-0 overflow-auto">
                    <TabsContent value="dashboard" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}><StorefrontDashboard /></Suspense>
                    </TabsContent>
                    <TabsContent value="products" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}><StorefrontProducts /></Suspense>
                    </TabsContent>
                    <TabsContent value="orders" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}><StorefrontOrders /></Suspense>
                    </TabsContent>
                    <TabsContent value="customers" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}><StorefrontCustomers /></Suspense>
                    </TabsContent>
                    <TabsContent value="coupons" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}><StorefrontCoupons /></Suspense>
                    </TabsContent>
                    <TabsContent value="builder" className="m-0 h-full overflow-hidden">
                        <Suspense fallback={<TabSkeleton />}><StorefrontBuilder /></Suspense>
                    </TabsContent>
                    <TabsContent value="bundles" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}><StorefrontBundles /></Suspense>
                    </TabsContent>
                    <TabsContent value="settings" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}><StorefrontSettings /></Suspense>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
