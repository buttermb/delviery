/**
 * Analytics Hub Page
 * Consolidated analytics with tabs:
 * - Dashboard: Main analytics dashboard
 * - Sales: Sales reports and metrics
 * - Inventory: Inventory reports
 * - Customers: Customer analytics
 * - Compliance: Compliance reports
 * - Advanced: Advanced analytics and forecasting
 * - Export: Data export options
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
    BarChart3,
    DollarSign,
    Package,
    Users,
    Shield,
    LineChart,
    Download,
    TrendingUp,
    FileText,
} from 'lucide-react';
import { lazy, Suspense, Fragment, useCallback, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { DateRangePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { subDays } from 'date-fns';
import { toast } from 'sonner';
import { AnalyticsDateRangeContext } from '@/contexts/AnalyticsDateRangeContext';

// Lazy load tab content for performance
const AnalyticsPage = lazy(() => import('@/pages/admin/AnalyticsPage'));
const SalesDashboardPage = lazy(() => import('@/pages/tenant-admin/SalesDashboardPage'));
const InventoryDashboard = lazy(() => import('@/pages/admin/InventoryDashboard'));
const CustomerReports = lazy(() => import('@/pages/admin/CustomerReports'));
const ComplianceDashboard = lazy(() => import('@/components/admin/compliance/ComplianceDashboard').then(m => ({ default: m.ComplianceDashboard })));
const AdvancedAnalyticsPage = lazy(() => import('@/pages/tenant-admin/AdvancedAnalyticsPage'));
const DataExportPage = lazy(() => import('@/pages/tenant-admin/DataExportPage'));
const PredictiveAnalyticsPage = lazy(() => import('@/pages/admin/PredictiveAnalyticsPage'));
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Core Reports (matching acceptance criteria)
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, group: 'Reports' },
    { id: 'sales', label: 'Sales Reports', icon: DollarSign, group: 'Reports' },
    { id: 'inventory', label: 'Inventory Reports', icon: Package, group: 'Reports' },
    { id: 'customers', label: 'Customer Reports', icon: Users, group: 'Reports' },
    { id: 'compliance', label: 'Compliance Reports', icon: Shield, group: 'Reports' },
    // Advanced Analysis
    { id: 'advanced', label: 'Advanced', icon: LineChart, group: 'Analysis' },
    { id: 'forecasting', label: 'Forecasting', icon: TrendingUp, group: 'Analysis' },
    { id: 'reports', label: 'Custom', icon: FileText, group: 'Analysis' },
    // Export
    { id: 'export', label: 'Export', icon: Download, group: 'Export' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function AnalyticsHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'dashboard';

    // Persistent date range state - defaults to last 30 days
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: subDays(new Date(), 29),
        to: new Date(),
    });

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

    const handleExportAll = useCallback(() => {
        toast.info('Export initiated', {
            description: 'Navigate to the Export tab to download your data in various formats.',
        });
        setSearchParams({ tab: 'export' });
    }, [setSearchParams]);

    return (
        <AnalyticsDateRangeContext.Provider value={{ dateRange, setDateRange }}>
            <div className="min-h-dvh bg-background">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    {/* Header */}
                    <div className="border-b bg-card px-4 py-4">
                        <HubBreadcrumbs
                            hubName="analytics-hub"
                            hubHref="analytics-hub"
                            currentTab={tabs.find(t => t.id === activeTab)?.label}
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div>
                                <h1 className="text-2xl font-bold">Analytics</h1>
                                <p className="text-muted-foreground text-sm">
                                    Business intelligence and performance metrics
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                {/* Date Range Selector - persists across tabs */}
                                <DateRangePickerWithPresets
                                    dateRange={dateRange}
                                    onDateRangeChange={setDateRange}
                                    placeholder="Select date range"
                                    className="w-full sm:w-[280px]"
                                />
                                {/* Hub-level Export Button */}
                                <Button
                                    variant="outline"
                                    onClick={handleExportAll}
                                    className="gap-2 w-full sm:w-auto"
                                >
                                    <Download className="h-4 w-4" />
                                    Export Data
                                </Button>
                            </div>
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

                    {/* Dashboard Tab */}
                    <TabsContent value="dashboard" className="m-0">
                        <Suspense fallback={<TabSkeleton />}>
                            <AnalyticsPage />
                        </Suspense>
                    </TabsContent>

                    {/* Sales Reports Tab */}
                    <TabsContent value="sales" className="m-0">
                        <Suspense fallback={<TabSkeleton />}>
                            <SalesDashboardPage />
                        </Suspense>
                    </TabsContent>

                    {/* Inventory Reports Tab */}
                    <TabsContent value="inventory" className="m-0">
                        <Suspense fallback={<TabSkeleton />}>
                            <InventoryDashboard />
                        </Suspense>
                    </TabsContent>

                    {/* Customer Reports Tab */}
                    <TabsContent value="customers" className="m-0">
                        <Suspense fallback={<TabSkeleton />}>
                            <CustomerReports />
                        </Suspense>
                    </TabsContent>

                    {/* Compliance Reports Tab */}
                    <TabsContent value="compliance" className="m-0">
                        <Suspense fallback={<TabSkeleton />}>
                            <ComplianceDashboard />
                        </Suspense>
                    </TabsContent>

                    {/* Advanced Analytics Tab */}
                    <TabsContent value="advanced" className="m-0">
                        <Suspense fallback={<TabSkeleton />}>
                            <AdvancedAnalyticsPage />
                        </Suspense>
                    </TabsContent>

                    {/* Forecasting Tab */}
                    <TabsContent value="forecasting" className="m-0">
                        <Suspense fallback={<TabSkeleton />}>
                            <PredictiveAnalyticsPage />
                        </Suspense>
                    </TabsContent>

                    {/* Custom Reports Tab */}
                    <TabsContent value="reports" className="m-0">
                        <Suspense fallback={<TabSkeleton />}>
                            <ReportsPage />
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
        </AnalyticsDateRangeContext.Provider>
    );
}
