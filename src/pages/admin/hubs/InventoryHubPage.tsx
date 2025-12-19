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
    Plus,
    CreditCard,
    Barcode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load tab content for performance
const ProductManagement = lazy(() => import('@/pages/admin/ProductManagement'));
const InventoryDashboard = lazy(() => import('@/pages/admin/InventoryDashboard'));
const InventoryManagement = lazy(() => import('@/pages/admin/InventoryManagement'));
const InventoryMonitoringPage = lazy(() => import('@/pages/admin/InventoryMonitoringPage'));
const FrontedInventory = lazy(() => import('@/pages/admin/FrontedInventory'));
const DispatchInventory = lazy(() => import('@/pages/admin/DispatchInventory'));
const GenerateBarcodes = lazy(() => import('@/pages/admin/GenerateBarcodes'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    { id: 'products', label: 'Products', icon: Package },     // Core catalog
    { id: 'stock', label: 'Stock', icon: BarChart3 },         // Levels overview
    { id: 'monitoring', label: 'Alerts', icon: AlertTriangle }, // Urgent items
    { id: 'adjustments', label: 'Transfers', icon: ArrowLeftRight }, // Actions
    { id: 'dispatch', label: 'Dispatch', icon: Truck },
    { id: 'fronted', label: 'Owed', icon: CreditCard },       // Tracking
    { id: 'barcodes', label: 'Barcodes', icon: Barcode },     // Utility
] as const;

type TabId = typeof tabs[number]['id'];

export default function InventoryHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'products';
    const { navigateToAdmin } = useTenantNavigation();

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab });
    };

    return (
        <div className="min-h-screen bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Inventory</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage products, stock levels, and alerts
                            </p>
                        </div>
                        {activeTab === 'products' && (
                            <Button onClick={() => navigateToAdmin('inventory-hub?tab=products&new=true')}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Product
                            </Button>
                        )}
                    </div>
                    <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 overflow-x-auto w-full max-w-full">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2 whitespace-nowrap">
                                <tab.icon className="h-4 w-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {/* Products Tab */}
                <TabsContent value="products" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <ProductManagement />
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
