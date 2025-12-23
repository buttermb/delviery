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
    TrendingUp,
    LineChart,
    FileText,
    PieChart,
    Download,
} from 'lucide-react';
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load tab content for performance
const AnalyticsPage = lazy(() => import('@/pages/admin/AnalyticsPage'));
const OrderAnalyticsPage = lazy(() => import('@/pages/tenant-admin/OrderAnalyticsPage'));
const MenuAnalytics = lazy(() => import('@/pages/admin/MenuAnalytics'));
const DeliveryAnalyticsPage = lazy(() => import('@/pages/tenant-admin/DeliveryAnalyticsPage'));
const PredictiveAnalyticsPage = lazy(() => import('@/pages/admin/PredictiveAnalyticsPage'));
const AdvancedAnalyticsPage = lazy(() => import('@/pages/tenant-admin/AdvancedAnalyticsPage'));
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage'));
const CustomReportsPage = lazy(() => import('@/pages/tenant-admin/CustomReportsPage'));
const DataExportPage = lazy(() => import('@/pages/tenant-admin/DataExportPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Overview
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    // Business Metrics
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'delivery', label: 'Delivery', icon: Truck },
    // Advanced Analysis
    { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
    { id: 'advanced', label: 'Advanced', icon: LineChart },
    // Reports
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'custom', label: 'Custom', icon: PieChart },
    { id: 'export', label: 'Export', icon: Download },
] as const;

type TabId = typeof tabs[number]['id'];

export default function AnalyticsHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'overview';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

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
                    <div className="overflow-x-auto">
                        <TabsList className="inline-flex min-w-max">
                            {tabs.map((tab) => (
                                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                    <tab.icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
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

                {/* Advanced Tab */}
                <TabsContent value="advanced" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <AdvancedAnalyticsPage />
                    </Suspense>
                </TabsContent>

                {/* Reports Tab */}
                <TabsContent value="reports" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <ReportsPage />
                    </Suspense>
                </TabsContent>

                {/* Custom Tab */}
                <TabsContent value="custom" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CustomReportsPage />
                    </Suspense>
                </TabsContent>

                {/* Export Tab */}
                <TabsContent value="export" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <DataExportPage />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
