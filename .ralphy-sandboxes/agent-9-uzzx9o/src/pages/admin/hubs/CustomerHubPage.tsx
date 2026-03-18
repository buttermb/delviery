/**
 * Customer Hub Page
 * Consolidated customer management with tabs:
 * - Contacts: Customer management
 * - Wholesale: Wholesale clients
 * - CRM: Customer relationships
 * - Insights: Customer analytics
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Users,
    Briefcase,
    Heart,
    BarChart3,
    FileText,
    PieChart,
    Star,
} from 'lucide-react';
import { Fragment, lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { ScrollableTabsList } from '@/components/admin/ScrollableTabsList';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';

// Lazy load tab content for performance
const CustomerManagement = lazy(() => import('@/pages/admin/CustomerManagement').then(m => ({ default: m.CustomerManagement })));
const WholesaleClients = lazy(() => import('@/pages/admin/WholesaleClients'));
const CustomerCRMPage = lazy(() => import('@/pages/admin/CustomerCRMPage'));
const CustomerInsightsPage = lazy(() => import('@/pages/tenant-admin/CustomerInsightsPage'));
const CustomerInvoices = lazy(() => import('@/pages/admin/CustomerInvoices'));
const CustomerAnalyticsPage = lazy(() => import('@/pages/tenant-admin/CustomerAnalyticsPage'));
const LoyaltyProgramPage = lazy(() => import('@/pages/admin/LoyaltyProgramPage'));

const TabSkeleton = () => (
    <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Overview
    { id: 'contacts', label: 'All', icon: Users, group: 'Contacts' },
    // Relationships
    { id: 'crm', label: 'CRM', tooltip: 'Customer Relationship Management', icon: Heart, group: 'Relationships' },
    { id: 'wholesale', label: 'B2B', tooltip: 'Business-to-Business Clients', icon: Briefcase, group: 'Relationships' },
    // Transactions
    { id: 'invoices', label: 'Invoices', icon: FileText, group: 'Transactions' },
    // Engagement
    { id: 'loyalty', label: 'Loyalty', icon: Star, group: 'Engagement' },
    // Analytics
    { id: 'insights', label: 'Insights', icon: BarChart3, group: 'Analytics' },
    { id: 'analytics', label: 'Analytics', icon: PieChart, group: 'Analytics' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function CustomerHubPage() {
    usePageTitle('Customers');
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'contacts';
    const { tenant: _tenant } = useTenantAdminAuth();

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-6 py-4">
                    <HubBreadcrumbs
                        hubName="customer-hub"
                        hubHref="customer-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Customers</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage contacts, clients, and relationships
                            </p>
                        </div>
                    </div>
                    <ScrollableTabsList>
                        <TooltipProvider delayDuration={300}>
                            <TabsList className="inline-flex min-w-max gap-0.5">
                                {tabs.map((tab, index) => {
                                    const prevTab = index > 0 ? tabs[index - 1] : null;
                                    const showSeparator = prevTab && prevTab.group !== tab.group;
                                    const trigger = (
                                        <TabsTrigger value={tab.id} className="flex items-center gap-2">
                                            <tab.icon className="h-4 w-4" />
                                            <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                                        </TabsTrigger>
                                    );
                                    return (
                                        <Fragment key={tab.id}>
                                            {showSeparator && (
                                                <div className="w-px h-6 bg-border mx-1" />
                                            )}
                                            {'tooltip' in tab && tab.tooltip ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                                                    <TooltipContent>{tab.tooltip}</TooltipContent>
                                                </Tooltip>
                                            ) : trigger}
                                        </Fragment>
                                    );
                                })}
                            </TabsList>
                        </TooltipProvider>
                    </ScrollableTabsList>
                </div>

                {/* Contacts Tab */}
                <TabsContent value="contacts" className="m-0">
                    <ModuleErrorBoundary moduleName="Customer Management">
                        <Suspense fallback={<TabSkeleton />}>
                            <CustomerManagement />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Wholesale Tab */}
                <TabsContent value="wholesale" className="m-0">
                    <ModuleErrorBoundary moduleName="Wholesale Clients">
                        <Suspense fallback={<TabSkeleton />}>
                            <WholesaleClients />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* CRM Tab */}
                <TabsContent value="crm" className="m-0">
                    <ModuleErrorBoundary moduleName="CRM">
                        <Suspense fallback={<TabSkeleton />}>
                            <CustomerCRMPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Insights Tab */}
                <TabsContent value="insights" className="m-0">
                    <ModuleErrorBoundary moduleName="Customer Insights">
                        <Suspense fallback={<TabSkeleton />}>
                            <CustomerInsightsPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Invoices Tab */}
                <TabsContent value="invoices" className="m-0">
                    <ModuleErrorBoundary moduleName="Customer Invoices">
                        <Suspense fallback={<TabSkeleton />}>
                            <CustomerInvoices />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Loyalty Tab */}
                <TabsContent value="loyalty" className="m-0">
                    <ModuleErrorBoundary moduleName="Loyalty Program">
                        <Suspense fallback={<TabSkeleton />}>
                            <LoyaltyProgramPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="m-0">
                    <ModuleErrorBoundary moduleName="Customer Analytics">
                        <Suspense fallback={<TabSkeleton />}>
                            <CustomerAnalyticsPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
            </Tabs>
        </div>
    );
}
