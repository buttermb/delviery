/**
 * Analytics Hub Page
 * Consolidated analytics with 5 top-level tabs:
 * - Analytics (sub-tabs: Overview, Orders, Menu, Delivery)
 * - Storefront: Store metrics
 * - Insights (sub-tabs: Forecasting, Advanced, Strategy)
 * - Reports (sub-tabs: Standard, Custom, Export)
 * - Board Report: Board-level presentations
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
    Target,
    Presentation,
    Store,
    Plus,
    Lightbulb,
} from 'lucide-react';
import { Fragment, lazy, Suspense, useCallback, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { ScrollableTabsList } from '@/components/admin/ScrollableTabsList';
import { usePageTitle } from '@/hooks/usePageTitle';

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
const StrategicDashboardPage = lazy(() => import('@/pages/admin/StrategicDashboardPage'));
const BoardReportPage = lazy(() => import('@/pages/admin/BoardReportPage'));
const StorefrontAnalytics = lazy(() => import('@/pages/admin/storefront/StorefrontAnalytics'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Core' },
    { id: 'storefront', label: 'Storefront', icon: Store, group: 'Core' },
    { id: 'insights', label: 'Insights', icon: Lightbulb, group: 'Advanced' },
    { id: 'reports', label: 'Reports', icon: FileText, group: 'Reports' },
    { id: 'board', label: 'Board Report', icon: Presentation, group: 'Enterprise' },
] as const;

type TabId = typeof tabs[number]['id'];

// Map legacy tab IDs to new grouped structure for backward compatibility
const legacyTabMap: Record<string, { tab: TabId; sub?: string }> = {
    overview: { tab: 'analytics', sub: 'overview' },
    orders: { tab: 'analytics', sub: 'orders' },
    menu: { tab: 'analytics', sub: 'menu' },
    delivery: { tab: 'analytics', sub: 'delivery' },
    forecasting: { tab: 'insights', sub: 'forecasting' },
    advanced: { tab: 'insights', sub: 'advanced' },
    strategy: { tab: 'insights', sub: 'strategy' },
    reports: { tab: 'reports', sub: 'standard' },
    custom: { tab: 'reports', sub: 'custom' },
    export: { tab: 'reports', sub: 'export' },
};

const analyticsSubTabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'delivery', label: 'Delivery', icon: Truck },
] as const;

const insightsSubTabs = [
    { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
    { id: 'advanced', label: 'Advanced', icon: LineChart },
    { id: 'strategy', label: 'Strategy', icon: Target },
] as const;

const reportsSubTabs = [
    { id: 'standard', label: 'Standard', icon: FileText },
    { id: 'custom', label: 'Custom', icon: PieChart },
    { id: 'export', label: 'Export', icon: Download },
] as const;

export default function AnalyticsHubPage() {
    usePageTitle('Analytics');
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab') || 'analytics';
    const rawSub = searchParams.get('sub') || '';

    // Redirect legacy tab IDs to new structure
    useEffect(() => {
        const legacy = legacyTabMap[rawTab];
        if (legacy) {
            const params: Record<string, string> = { tab: legacy.tab };
            if (legacy.sub) params.sub = legacy.sub;
            setSearchParams(params, { replace: true });
        }
    }, [rawTab, setSearchParams]);

    const activeTab = (legacyTabMap[rawTab]?.tab ?? rawTab) as TabId;
    const activeSub = legacyTabMap[rawTab]?.sub ?? rawSub;

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    const handleSubTabChange = useCallback((tab: string, sub: string) => {
        setSearchParams({ tab, sub }, { replace: true });
    }, [setSearchParams]);

    const activeTabLabel = (() => {
        const topTab = tabs.find(t => t.id === activeTab);
        if (!topTab) return undefined;
        if (activeTab === 'analytics' && activeSub) {
            const subTab = analyticsSubTabs.find(s => s.id === activeSub);
            return subTab ? `${topTab.label} / ${subTab.label}` : topTab.label;
        }
        if (activeTab === 'insights' && activeSub) {
            const subTab = insightsSubTabs.find(s => s.id === activeSub);
            return subTab ? `${topTab.label} / ${subTab.label}` : topTab.label;
        }
        if (activeTab === 'reports' && activeSub) {
            const subTab = reportsSubTabs.find(s => s.id === activeSub);
            return subTab ? `${topTab.label} / ${subTab.label}` : topTab.label;
        }
        return topTab.label;
    })();

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-6 py-4">
                    <HubBreadcrumbs
                        hubName="analytics-hub"
                        hubHref="analytics-hub"
                        currentTab={activeTabLabel}
                    />
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Analytics</h1>
                            <p className="text-muted-foreground text-sm">
                                Business intelligence and performance metrics
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => handleSubTabChange('reports', 'custom')}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Report
                        </Button>
                    </div>
                    <ScrollableTabsList>
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
                                            <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                                        </TabsTrigger>
                                    </Fragment>
                                );
                            })}
                        </TabsList>
                    </ScrollableTabsList>
                </div>

                {/* Analytics Tab (grouped: Overview, Orders, Menu, Delivery) */}
                <TabsContent value="analytics" className="m-0">
                    <Tabs
                        value={activeSub || 'overview'}
                        onValueChange={(sub) => handleSubTabChange('analytics', sub)}
                        className="w-full"
                    >
                        <div className="border-b px-6 pt-2">
                            <TabsList className="h-9 bg-transparent gap-1">
                                {analyticsSubTabs.map((sub) => (
                                    <TabsTrigger
                                        key={sub.id}
                                        value={sub.id}
                                        className="flex items-center gap-1.5 text-xs data-[state=active]:bg-muted"
                                    >
                                        <sub.icon className="h-3.5 w-3.5" />
                                        {sub.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>
                        <TabsContent value="overview" className="m-0">
                            <Suspense fallback={<TabSkeleton />}>
                                <AnalyticsPage />
                            </Suspense>
                        </TabsContent>
                        <TabsContent value="orders" className="m-0">
                            <Suspense fallback={<TabSkeleton />}>
                                <OrderAnalyticsPage />
                            </Suspense>
                        </TabsContent>
                        <TabsContent value="menu" className="m-0">
                            <Suspense fallback={<TabSkeleton />}>
                                <MenuAnalytics />
                            </Suspense>
                        </TabsContent>
                        <TabsContent value="delivery" className="m-0">
                            <Suspense fallback={<TabSkeleton />}>
                                <DeliveryAnalyticsPage />
                            </Suspense>
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                {/* Storefront Tab */}
                <TabsContent value="storefront" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <StorefrontAnalytics />
                    </Suspense>
                </TabsContent>

                {/* Insights Tab (grouped: Forecasting, Advanced, Strategy) */}
                <TabsContent value="insights" className="m-0">
                    <Tabs
                        value={activeSub || 'forecasting'}
                        onValueChange={(sub) => handleSubTabChange('insights', sub)}
                        className="w-full"
                    >
                        <div className="border-b px-6 pt-2">
                            <TabsList className="h-9 bg-transparent gap-1">
                                {insightsSubTabs.map((sub) => (
                                    <TabsTrigger
                                        key={sub.id}
                                        value={sub.id}
                                        className="flex items-center gap-1.5 text-xs data-[state=active]:bg-muted"
                                    >
                                        <sub.icon className="h-3.5 w-3.5" />
                                        {sub.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>
                        <TabsContent value="forecasting" className="m-0">
                            <Suspense fallback={<TabSkeleton />}>
                                <PredictiveAnalyticsPage />
                            </Suspense>
                        </TabsContent>
                        <TabsContent value="advanced" className="m-0">
                            <Suspense fallback={<TabSkeleton />}>
                                <AdvancedAnalyticsPage />
                            </Suspense>
                        </TabsContent>
                        <TabsContent value="strategy" className="m-0">
                            <Suspense fallback={<TabSkeleton />}>
                                <StrategicDashboardPage />
                            </Suspense>
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                {/* Reports Tab (grouped: Standard, Custom, Export) */}
                <TabsContent value="reports" className="m-0">
                    <Tabs
                        value={activeSub || 'standard'}
                        onValueChange={(sub) => handleSubTabChange('reports', sub)}
                        className="w-full"
                    >
                        <div className="border-b px-6 pt-2">
                            <TabsList className="h-9 bg-transparent gap-1">
                                {reportsSubTabs.map((sub) => (
                                    <TabsTrigger
                                        key={sub.id}
                                        value={sub.id}
                                        className="flex items-center gap-1.5 text-xs data-[state=active]:bg-muted"
                                    >
                                        <sub.icon className="h-3.5 w-3.5" />
                                        {sub.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>
                        <TabsContent value="standard" className="m-0">
                            <Suspense fallback={<TabSkeleton />}>
                                <ReportsPage />
                            </Suspense>
                        </TabsContent>
                        <TabsContent value="custom" className="m-0">
                            <Suspense fallback={<TabSkeleton />}>
                                <CustomReportsPage />
                            </Suspense>
                        </TabsContent>
                        <TabsContent value="export" className="m-0">
                            <Suspense fallback={<TabSkeleton />}>
                                <DataExportPage />
                            </Suspense>
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                {/* Board Report Tab (Enterprise) */}
                <TabsContent value="board" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <BoardReportPage />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
