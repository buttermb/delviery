/**
 * Analytics Hub Page
 * Consolidated analytics with tabs:
 * - Overview: Main analytics dashboard
 * - Orders: Order analytics
 * - Menu: Menu performance
 * - Delivery: Delivery analytics
 * - Forecasting: Predictive analytics
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    BarChart3,
    ShoppingCart,
    UtensilsCrossed,
    Truck,
    TrendingUp
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load tab content for performance
const AnalyticsPage = lazy(() => import('@/pages/admin/AnalyticsPage'));
const OrderAnalyticsPage = lazy(() => import('@/pages/tenant-admin/OrderAnalyticsPage'));
const MenuAnalytics = lazy(() => import('@/pages/admin/MenuAnalytics'));
const DeliveryAnalyticsPage = lazy(() => import('@/pages/tenant-admin/DeliveryAnalyticsPage'));
const PredictiveAnalyticsPage = lazy(() => import('@/pages/admin/PredictiveAnalyticsPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'delivery', label: 'Delivery', icon: Truck },
    { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
] as const;

type TabId = typeof tabs[number]['id'];

export default function AnalyticsHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'overview';

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab });
    };

    return (
        <div className="min-h-screen bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Analytics</h1>
                            <p className="text-muted-foreground text-sm">
                                Business intelligence and performance metrics
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

                {/* Overview Tab */}
                <TabsContent value="overview" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <AnalyticsPage />
                    </Suspense>
                </TabsContent>

                {/* Orders Tab */}
                <TabsContent value="orders" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <OrderAnalyticsPage />
                    </Suspense>
                </TabsContent>

                {/* Menu Tab */}
                <TabsContent value="menu" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <MenuAnalytics />
                    </Suspense>
                </TabsContent>

                {/* Delivery Tab */}
                <TabsContent value="delivery" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <DeliveryAnalyticsPage />
                    </Suspense>
                </TabsContent>

                {/* Forecasting Tab */}
                <TabsContent value="forecasting" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <PredictiveAnalyticsPage />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
