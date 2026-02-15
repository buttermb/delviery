/**
 * Customer Hub Page
 * Consolidated customer management with tabs:
 * - Contacts: Customer management
 * - Wholesale: Wholesale clients
 * - CRM: Customer relationships
 * - Insights: Customer analytics
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Users,
    Briefcase,
    Heart,
    BarChart3,
    FileText,
    PieChart,
    Headphones,
    Star,
    Plus,
} from 'lucide-react';
import { Fragment, lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { QuickCreateCustomerDialog } from '@/components/pos/QuickCreateCustomerDialog';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

// Lazy load tab content for performance
const CustomerManagement = lazy(() => import('@/pages/admin/CustomerManagement').then(m => ({ default: m.CustomerManagement })));
const WholesaleClients = lazy(() => import('@/pages/admin/WholesaleClients'));
const CustomerCRMPage = lazy(() => import('@/pages/admin/CustomerCRMPage'));
const CustomerInsightsPage = lazy(() => import('@/pages/tenant-admin/CustomerInsightsPage'));
const CustomerInvoices = lazy(() => import('@/pages/admin/CustomerInvoices'));
const CustomerAnalyticsPage = lazy(() => import('@/pages/tenant-admin/CustomerAnalyticsPage'));
const SupportTicketsPage = lazy(() => import('@/pages/admin/SupportTicketsPage'));
const LoyaltyProgramPage = lazy(() => import('@/pages/admin/LoyaltyProgramPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Overview
    { id: 'contacts', label: 'All', icon: Users, group: 'Contacts' },
    // Relationships
    { id: 'crm', label: 'CRM', icon: Heart, group: 'Relationships' },
    { id: 'wholesale', label: 'B2B', icon: Briefcase, group: 'Relationships' },
    // Transactions
    { id: 'invoices', label: 'Invoices', icon: FileText, group: 'Transactions' },
    // Support & Loyalty
    { id: 'support', label: 'Support', icon: Headphones, group: 'Engagement' },
    { id: 'loyalty', label: 'Loyalty', icon: Star, group: 'Engagement' },
    // Analytics
    { id: 'insights', label: 'Insights', icon: BarChart3, group: 'Analytics' },
    { id: 'analytics', label: 'Analytics', icon: PieChart, group: 'Analytics' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function CustomerHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'contacts';
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const { tenant } = useTenantAdminAuth();

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <HubBreadcrumbs
                        hubName="customer-hub"
                        hubHref="customer-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Customers</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage contacts, clients, and relationships
                            </p>
                        </div>
                        {activeTab === 'contacts' && (
                            <Button onClick={() => setCreateDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Customer
                            </Button>
                        )}
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
                                            <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                                        </TabsTrigger>
                                    </Fragment>
                                );
                            })}
                        </TabsList>
                    </div>
                </div>

                {/* Contacts Tab */}
                <TabsContent value="contacts" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CustomerManagement />
                    </Suspense>
                </TabsContent>

                {/* Wholesale Tab */}
                <TabsContent value="wholesale" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <WholesaleClients />
                    </Suspense>
                </TabsContent>

                {/* CRM Tab */}
                <TabsContent value="crm" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CustomerCRMPage />
                    </Suspense>
                </TabsContent>

                {/* Insights Tab */}
                <TabsContent value="insights" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CustomerInsightsPage />
                    </Suspense>
                </TabsContent>

                {/* Invoices Tab */}
                <TabsContent value="invoices" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CustomerInvoices />
                    </Suspense>
                </TabsContent>

                {/* Support Tab (new) */}
                <TabsContent value="support" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <SupportTicketsPage />
                    </Suspense>
                </TabsContent>

                {/* Loyalty Tab (new - dual access with Marketing) */}
                <TabsContent value="loyalty" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <LoyaltyProgramPage />
                    </Suspense>
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CustomerAnalyticsPage />
                    </Suspense>
                </TabsContent>
            </Tabs>

            {tenant && (
                <QuickCreateCustomerDialog
                    open={createDialogOpen}
                    onOpenChange={setCreateDialogOpen}
                    tenantId={tenant.id}
                    onSuccess={() => setCreateDialogOpen(false)}
                />
            )}
        </div>
    );
}
