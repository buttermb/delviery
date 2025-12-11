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
    Settings
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const StorefrontDashboard = lazy(() => import('@/pages/admin/storefront/StorefrontDashboard'));
const StorefrontProducts = lazy(() => import('@/pages/admin/storefront/StorefrontProducts'));
const StorefrontOrders = lazy(() => import('@/pages/admin/storefront/StorefrontOrders'));
const StorefrontCustomers = lazy(() => import('@/pages/admin/storefront/StorefrontCustomers'));
const StorefrontCoupons = lazy(() => import('@/pages/admin/storefront/StorefrontCoupons'));
const StorefrontSettings = lazy(() => import('@/pages/admin/storefront/StorefrontSettings'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = typeof tabs[number]['id'];

export default function StorefrontHubPage() {
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
                            <h1 className="text-2xl font-bold">Storefront</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage your online store
                            </p>
                        </div>
                    </div>
                    <TabsList className="grid w-full max-w-3xl grid-cols-6">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                <tab.icon className="h-4 w-4" />
                                <span className="hidden md:inline">{tab.label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <TabsContent value="dashboard" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><StorefrontDashboard /></Suspense>
                </TabsContent>
                <TabsContent value="products" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><StorefrontProducts /></Suspense>
                </TabsContent>
                <TabsContent value="orders" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><StorefrontOrders /></Suspense>
                </TabsContent>
                <TabsContent value="customers" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><StorefrontCustomers /></Suspense>
                </TabsContent>
                <TabsContent value="coupons" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><StorefrontCoupons /></Suspense>
                </TabsContent>
                <TabsContent value="settings" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><StorefrontSettings /></Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
