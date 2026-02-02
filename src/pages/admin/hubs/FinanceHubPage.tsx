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
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import FileText from "lucide-react/dist/esm/icons/file-text";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import FileEdit from "lucide-react/dist/esm/icons/file-edit";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import Banknote from "lucide-react/dist/esm/icons/banknote";
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';

const FinancialCenter = lazy(() => import('@/pages/admin/FinancialCenterReal'));
const InvoicesPage = lazy(() => import('@/pages/admin/InvoicesPage'));
const ExpenseTracking = lazy(() => import('@/pages/admin/ExpenseTracking'));
const RevenueReportsPage = lazy(() => import('@/pages/tenant-admin/RevenueReportsPage'));
const PayoutsPage = lazy(() => import('@/pages/admin/PayoutsPage'));
const AdvancedInvoicePage = lazy(() => import('@/pages/admin/AdvancedInvoicePage'));
const CollectionMode = lazy(() => import('@/pages/admin/CollectionMode'));
const TaxManagementPage = lazy(() => import('@/pages/admin/TaxManagementPage'));
const FrontedInventory = lazy(() => import('@/pages/admin/FrontedInventory'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
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
    { id: 'collections', label: 'Collect', icon: Wallet, group: 'Transactions' },
    { id: 'payouts', label: 'Payouts', icon: Banknote, group: 'Transactions' },
    // Utilities
    { id: 'builder', label: 'Builder', icon: FileEdit, group: 'Tools' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function FinanceHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'overview';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="border-b bg-card px-4 py-4">
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
                    <div className="overflow-x-auto">
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                return (
                                    <>
                                        {showSeparator && (
                                            <div key={`sep-${index}`} className="w-px h-6 bg-border mx-1" />
                                        )}
                                        <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                            <tab.icon className="h-4 w-4" />
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </TabsTrigger>
                                    </>
                                );
                            })}
                        </TabsList>
                    </div>
                </div>

                <TabsContent value="overview" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><FinancialCenter /></Suspense>
                </TabsContent>
                <TabsContent value="invoices" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><InvoicesPage /></Suspense>
                </TabsContent>
                <TabsContent value="builder" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><AdvancedInvoicePage /></Suspense>
                </TabsContent>
                <TabsContent value="expenses" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><ExpenseTracking /></Suspense>
                </TabsContent>
                <TabsContent value="revenue" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><RevenueReportsPage /></Suspense>
                </TabsContent>
                <TabsContent value="tax" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><TaxManagementPage /></Suspense>
                </TabsContent>
                <TabsContent value="collections" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><CollectionMode embedded /></Suspense>
                </TabsContent>
                <TabsContent value="payouts" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><PayoutsPage /></Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
