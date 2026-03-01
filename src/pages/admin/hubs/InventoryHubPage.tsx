/**
 * Inventory Hub Page
 * Consolidated inventory page with tabs:
 * - Products: Product management
 * - Stock: Inventory dashboard and levels
 * - Adjustments: Inventory adjustments
 * - Monitoring: Alerts and quick receiving
 * - Transfers: Inventory transfers
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Package,
    BarChart3,
    ArrowLeftRight,
    AlertTriangle,
    Truck,
    CreditCard,
    Barcode,
    Menu,
    Globe,
} from 'lucide-react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Fragment, lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { ScrollableTabsList } from '@/components/admin/ScrollableTabsList';
import { usePageTitle } from '@/hooks/usePageTitle';

// Lazy load tab content for performance
const ProductManagement = lazy(() => import('@/pages/admin/ProductManagement'));
const DisposableMenus = lazy(() => import('@/pages/admin/DisposableMenus'));
const InventoryDashboard = lazy(() => import('@/pages/admin/InventoryDashboard'));
const InventoryManagement = lazy(() => import('@/pages/admin/InventoryManagement').then(m => ({ default: m.InventoryManagement })));
const InventoryMonitoringPage = lazy(() => import('@/pages/admin/InventoryMonitoringPage'));
const FrontedInventory = lazy(() => import('@/pages/admin/FrontedInventory'));
const DispatchInventory = lazy(() => import('@/pages/admin/DispatchInventory'));
const GenerateBarcodes = lazy(() => import('@/pages/admin/GenerateBarcodes'));
const GlobalProductCatalog = lazy(() => import('@/components/admin/products/GlobalProductCatalog').then(m => ({ default: m.GlobalProductCatalog })));

const TabSkeleton = () => (
    <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Catalog
    { id: 'products', label: 'Products', icon: Package, group: 'Catalog' },
    { id: 'global', label: 'Global', icon: Globe, group: 'Catalog' },
    { id: 'menus', label: 'Menus', icon: Menu, group: 'Catalog' },
    // Levels & Alerts
    { id: 'stock', label: 'Stock', icon: BarChart3, group: 'Levels' },
    { id: 'monitoring', label: 'Alerts', icon: AlertTriangle, group: 'Levels' },
    // Movement
    { id: 'adjustments', label: 'Transfers', icon: ArrowLeftRight, group: 'Movement' },
    { id: 'dispatch', label: 'Dispatch', icon: Truck, group: 'Movement' },
    // Tracking & Tools
    { id: 'fronted', label: 'Fronted', icon: CreditCard, group: 'Tools' },
    { id: 'barcodes', label: 'Barcodes', icon: Barcode, group: 'Tools' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function InventoryHubPage() {
    usePageTitle('Inventory');
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'products';
    const { navigateToAdmin: _navigateToAdmin } = useTenantNavigation();

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab }, { replace: true });
    };

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-6 py-4">
                    <HubBreadcrumbs
                        hubName="inventory-hub"
                        hubHref="inventory-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Inventory</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage products, stock levels, and alerts
                            </p>
                        </div>
                    </div>
                    <ScrollableTabsList>
                        <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 w-full max-w-full gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                return (
                                    <Fragment key={tab.id}>
                                        {showSeparator && (
                                            <div className="w-px h-6 bg-border mx-1" />
                                        )}
                                        <TabsTrigger value={tab.id} className="flex items-center gap-2 whitespace-nowrap">
                                            <tab.icon className="h-4 w-4" />
                                            <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                                        </TabsTrigger>
                                    </Fragment>
                                );
                            })}
                        </TabsList>
                    </ScrollableTabsList>
                </div>

                {/* Products Tab */}
                <TabsContent value="products" className="m-0">
                    <ModuleErrorBoundary moduleName="Products">
                        <Suspense fallback={<TabSkeleton />}>
                            <ProductManagement />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Menus Tab (moved from Orders) */}
                <TabsContent value="menus" className="m-0">
                    <ModuleErrorBoundary moduleName="Menus">
                        <Suspense fallback={<TabSkeleton />}>
                            <DisposableMenus />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Global Catalog Tab */}
                <TabsContent value="global" className="m-0 p-4">
                    <ModuleErrorBoundary moduleName="Global Catalog">
                        <Suspense fallback={<TabSkeleton />}>
                            <GlobalProductCatalog />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Stock Levels Tab */}
                <TabsContent value="stock" className="m-0">
                    <ModuleErrorBoundary moduleName="Stock Levels">
                        <Suspense fallback={<TabSkeleton />}>
                            <InventoryDashboard />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Adjustments Tab */}
                <TabsContent value="adjustments" className="m-0">
                    <ModuleErrorBoundary moduleName="Inventory Transfers">
                        <Suspense fallback={<TabSkeleton />}>
                            <InventoryManagement />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Monitoring Tab */}
                <TabsContent value="monitoring" className="m-0">
                    <ModuleErrorBoundary moduleName="Inventory Alerts">
                        <Suspense fallback={<TabSkeleton />}>
                            <InventoryMonitoringPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Who Owes Me (Fronted) Tab */}
                <TabsContent value="fronted" className="m-0">
                    <ModuleErrorBoundary moduleName="Fronted Inventory">
                        <Suspense fallback={<TabSkeleton />}>
                            <FrontedInventory />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Dispatch Tab */}
                <TabsContent value="dispatch" className="m-0">
                    <ModuleErrorBoundary moduleName="Dispatch">
                        <Suspense fallback={<TabSkeleton />}>
                            <DispatchInventory />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Barcodes Tab */}
                <TabsContent value="barcodes" className="m-0">
                    <ModuleErrorBoundary moduleName="Barcodes">
                        <Suspense fallback={<TabSkeleton />}>
                            <GenerateBarcodes />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
            </Tabs>
        </div>
    );
}
