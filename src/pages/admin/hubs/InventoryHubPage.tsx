/**
 * Inventory Hub Page
 * Consolidated inventory page with tabs:
 * - Products: Product management
 * - Stock: Inventory dashboard and levels
 * - Adjustments: Inventory adjustments
 * - Monitoring: Alerts and quick receiving
 * - Transfers: Inventory transfers
 *
 * Quick Links section provides access to:
 * - Products, Categories, Stock Levels, Low Stock Alerts
 * - Bulk Import, Price Management, Marketplace Sync (if enabled)
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Package,
    BarChart3,
    ArrowLeftRight,
    AlertTriangle,
    Truck,
    Plus,
    CreditCard,
    Barcode,
    Menu,
    Globe,
    Tag,
    TrendingDown,
    Upload,
    DollarSign,
    RefreshCcw,
} from 'lucide-react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { lazy, Suspense, Fragment, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { QuickActions } from '@/components/admin/ui/QuickActions';
import { AlertBadge } from '@/components/admin/ui/AlertBadge';
import { HubLinkCard, HubLinkGrid } from '@/components/admin/ui/HubLinkCard';
import { useInventoryHubCounts } from '@/hooks/useInventoryHubCounts';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

// Lazy load tab content for performance
const ProductManagement = lazy(() => import('@/pages/admin/ProductManagement'));
const DisposableMenus = lazy(() => import('@/pages/admin/DisposableMenus'));
const InventoryDashboard = lazy(() => import('@/pages/admin/InventoryDashboard'));
const InventoryManagement = lazy(() => import('@/pages/admin/InventoryManagement'));
const InventoryMonitoringPage = lazy(() => import('@/pages/admin/InventoryMonitoringPage'));
const FrontedInventory = lazy(() => import('@/pages/admin/FrontedInventory'));
const DispatchInventory = lazy(() => import('@/pages/admin/DispatchInventory'));
const GenerateBarcodes = lazy(() => import('@/pages/admin/GenerateBarcodes'));
const GlobalProductCatalog = lazy(() => import('@/components/admin/products/GlobalProductCatalog').then(m => ({ default: m.GlobalProductCatalog })));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
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
    { id: 'fronted', label: 'Owed', icon: CreditCard, group: 'Tools' },
    { id: 'barcodes', label: 'Barcodes', icon: Barcode, group: 'Tools' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function InventoryHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'products';
    const { navigateToAdmin } = useTenantNavigation();
    const { counts, isLoading: countsLoading } = useInventoryHubCounts();
    const { canAccess } = useFeatureAccess();

    // Check if marketplace feature is enabled
    const marketplaceEnabled = canAccess('marketplace');

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

    // Calculate total alerts (low stock + out of stock)
    const totalAlerts = counts.lowStockCount + counts.outOfStockCount;

    return (
        <div className="min-h-dvh bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <HubBreadcrumbs
                        hubName="inventory-hub"
                        hubHref="inventory-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div>
                                <h1 className="text-2xl font-bold">Inventory</h1>
                                <p className="text-muted-foreground text-sm">
                                    Manage products, stock levels, and alerts
                                </p>
                            </div>
                            {activeTab === 'monitoring' && totalAlerts > 0 && (
                                <AlertBadge level={counts.outOfStockCount > 0 ? 'critical' : 'warning'} count={totalAlerts} pulse />
                            )}
                        </div>
                        <QuickActions actions={[
                            ...(activeTab === 'products' ? [{
                                id: 'new-product',
                                label: 'Add Product',
                                icon: Plus,
                                onClick: () => navigateToAdmin('inventory-hub?tab=products&new=true'),
                            }] : []),
                        ]} />
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

                    {/* Quick Links Section */}
                    <div className="mt-4 pt-4 border-t">
                        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Links</h2>
                        <HubLinkGrid>
                            <HubLinkCard
                                title="Products"
                                description="View and manage all products"
                                icon={Package}
                                href="inventory-hub?tab=products"
                                count={counts.totalProducts}
                                countLabel="total"
                                status="info"
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Categories"
                                description="Organize products with categories"
                                icon={Tag}
                                href="catalog/categories"
                                count={counts.categoryCount}
                                countLabel="categories"
                                status="info"
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Stock Levels"
                                description="Monitor inventory quantities"
                                icon={BarChart3}
                                href="inventory-hub?tab=stock"
                                count={counts.activeProducts}
                                countLabel="in stock"
                                status="active"
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Low Stock Alerts"
                                description="Products below reorder level"
                                icon={TrendingDown}
                                href="inventory-hub?tab=monitoring"
                                count={counts.lowStockCount}
                                countLabel="low"
                                status={counts.lowStockCount > 0 ? 'warning' : 'info'}
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Bulk Import"
                                description="Import products from CSV or spreadsheet"
                                icon={Upload}
                                href="menu-migration"
                                status="info"
                            />
                            <HubLinkCard
                                title="Price Management"
                                description="Bulk edit product pricing"
                                icon={DollarSign}
                                href="inventory-hub?tab=products"
                                status="info"
                            />
                            {marketplaceEnabled && (
                                <HubLinkCard
                                    title="Marketplace Sync"
                                    description="Sync inventory with marketplace listings"
                                    icon={RefreshCcw}
                                    href="marketplace/listings"
                                    status="active"
                                />
                            )}
                        </HubLinkGrid>
                    </div>
                </div>

                {/* Products Tab */}
                <TabsContent value="products" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <ProductManagement />
                    </Suspense>
                </TabsContent>

                {/* Menus Tab (moved from Orders) */}
                <TabsContent value="menus" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <DisposableMenus />
                    </Suspense>
                </TabsContent>

                {/* Global Catalog Tab */}
                <TabsContent value="global" className="m-0 p-4">
                    <Suspense fallback={<TabSkeleton />}>
                        <GlobalProductCatalog />
                    </Suspense>
                </TabsContent>

                {/* Stock Levels Tab */}
                <TabsContent value="stock" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <InventoryDashboard />
                    </Suspense>
                </TabsContent>

                {/* Adjustments Tab */}
                <TabsContent value="adjustments" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <InventoryManagement />
                    </Suspense>
                </TabsContent>

                {/* Monitoring Tab */}
                <TabsContent value="monitoring" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <InventoryMonitoringPage />
                    </Suspense>
                </TabsContent>

                {/* Who Owes Me (Fronted) Tab */}
                <TabsContent value="fronted" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <FrontedInventory />
                    </Suspense>
                </TabsContent>

                {/* Dispatch Tab */}
                <TabsContent value="dispatch" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <DispatchInventory />
                    </Suspense>
                </TabsContent>

                {/* Barcodes Tab */}
                <TabsContent value="barcodes" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <GenerateBarcodes />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
