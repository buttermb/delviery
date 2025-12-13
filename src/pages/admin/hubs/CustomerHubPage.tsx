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
    Plus,
    FileText,
    PieChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load tab content for performance
const CustomerManagement = lazy(() => import('@/pages/admin/CustomerManagement'));
const WholesaleClients = lazy(() => import('@/pages/admin/WholesaleClients'));
const CustomerCRMPage = lazy(() => import('@/pages/admin/CustomerCRMPage'));
const CustomerInsightsPage = lazy(() => import('@/pages/tenant-admin/CustomerInsightsPage'));
const CustomerInvoices = lazy(() => import('@/pages/admin/CustomerInvoices'));
const CustomerAnalyticsPage = lazy(() => import('@/pages/tenant-admin/CustomerAnalyticsPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    { id: 'all', label: 'All', icon: Users },
    { id: 'wholesale', label: 'Wholesale', icon: Briefcase },
    { id: 'crm', label: 'CRM', icon: Heart },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const;

type TabId = typeof tabs[number]['id'];

export default function CustomerHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'all';

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
                            <h1 className="text-2xl font-bold">Customers</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage contacts, clients, and relationships
                            </p>
                        </div>
                    </div>
                    <TabsList className="grid w-full max-w-2xl grid-cols-6">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                <tab.icon className="h-4 w-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {/* All Tab */}
                <TabsContent value="all" className="m-0">
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

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CustomerAnalyticsPage />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
