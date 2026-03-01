/**
 * Finance Hub Page
 * Consolidated financial management with tabs:
 * - Overview: Financial dashboard
 * - Invoices: Invoice management
 * - Expenses: Expense tracking
 * - Revenue: Revenue reports
 * - Payouts: Payout schedules and history
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DollarSign,
    FileText,
    CreditCard,
    TrendingUp,
    FileEdit,
    Wallet,
    Building2,
    Banknote,
} from 'lucide-react';
import { Fragment, lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { ScrollableTabsList } from '@/components/admin/ScrollableTabsList';
import { usePageTitle } from '@/hooks/usePageTitle';

const FinancialCenter = lazy(() => import('@/pages/admin/FinancialCenterReal'));
const InvoicesPage = lazy(() => import('@/pages/admin/InvoicesPage').then(m => ({ default: m.InvoicesPage })));
const ExpenseTracking = lazy(() => import('@/pages/admin/ExpenseTracking'));
const RevenueReportsPage = lazy(() => import('@/pages/tenant-admin/RevenueReportsPage'));
const PayoutsPage = lazy(() => import('@/pages/admin/PayoutsPage'));
const AdvancedInvoicePage = lazy(() => import('@/pages/admin/AdvancedInvoicePage'));
const CollectionMode = lazy(() => import('@/pages/admin/CollectionMode'));
const TaxManagementPage = lazy(() => import('@/pages/admin/TaxManagementPage'));
const TabSkeleton = () => (
    <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Overview
    { id: 'overview', label: 'Dashboard', icon: DollarSign, group: 'Overview' },
    // Core Financials
    { id: 'revenue', label: 'Revenue', icon: TrendingUp, group: 'Core' },
    { id: 'expenses', label: 'Expenses', icon: CreditCard, group: 'Core' },
    { id: 'tax', label: 'Tax', icon: Building2, group: 'Core' },
    // Transactions
    { id: 'invoices', label: 'Invoices', icon: FileText, group: 'Transactions' },
    { id: 'collections', label: 'Payment Collection', icon: Wallet, group: 'Transactions' },
    { id: 'payouts', label: 'Payouts', icon: Banknote, group: 'Transactions' },
    // Utilities
    { id: 'builder', label: 'Builder', icon: FileEdit, group: 'Tools' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function FinanceHubPage() {
    usePageTitle('Finance');
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'overview';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="border-b bg-card px-6 py-4">
                    <HubBreadcrumbs
                        hubName="finance-hub"
                        hubHref="finance-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Finance</h1>
                            <p className="text-muted-foreground text-sm">
                                Financial management and reporting
                            </p>
                        </div>
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

                <TabsContent value="overview" className="m-0">
                    <ModuleErrorBoundary moduleName="Financial Dashboard"><Suspense fallback={<TabSkeleton />}><FinancialCenter /></Suspense></ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="invoices" className="m-0">
                    <ModuleErrorBoundary moduleName="Invoices"><Suspense fallback={<TabSkeleton />}><InvoicesPage /></Suspense></ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="builder" className="m-0">
                    <ModuleErrorBoundary moduleName="Invoice Builder"><Suspense fallback={<TabSkeleton />}><AdvancedInvoicePage /></Suspense></ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="expenses" className="m-0">
                    <ModuleErrorBoundary moduleName="Expenses"><Suspense fallback={<TabSkeleton />}><ExpenseTracking /></Suspense></ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="revenue" className="m-0">
                    <ModuleErrorBoundary moduleName="Revenue Reports"><Suspense fallback={<TabSkeleton />}><RevenueReportsPage /></Suspense></ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="tax" className="m-0">
                    <ModuleErrorBoundary moduleName="Tax Management"><Suspense fallback={<TabSkeleton />}><TaxManagementPage /></Suspense></ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="collections" className="m-0">
                    <ModuleErrorBoundary moduleName="Payment Collection"><Suspense fallback={<TabSkeleton />}><CollectionMode embedded /></Suspense></ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="payouts" className="m-0">
                    <ModuleErrorBoundary moduleName="Payouts"><Suspense fallback={<TabSkeleton />}><PayoutsPage /></Suspense></ModuleErrorBoundary>
                </TabsContent>
            </Tabs>
        </div>
    );
}
