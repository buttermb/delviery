/**
 * Storefront Hub Page
 * Consolidated storefront management with tabs:
 * - Dashboard: Store overview
 * - Products: Product visibility
 * - Orders: Storefront orders
 * - Customers: Customer management
 * - Coupons: Discount codes
 * - Settings: Store configuration
 */

import { useSearchParams, useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Tag,
    Settings,
    Brush,
    Boxes,
    Radio,
    BarChart3,
    Gift,
    ExternalLink,
    ThumbsUp,
} from 'lucide-react';
import { lazy, Suspense, useCallback, Fragment } from 'react';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { ScrollableTabsList } from '@/components/admin/ScrollableTabsList';
import { usePageTitle } from '@/hooks/usePageTitle';

const StorefrontDashboard = lazy(() => import('@/pages/admin/storefront/StorefrontDashboard'));
const StorefrontProducts = lazy(() => import('@/pages/admin/storefront/StorefrontProducts'));
const StorefrontOrders = lazy(() => import('@/pages/admin/storefront/StorefrontOrders'));
const StorefrontCustomers = lazy(() => import('@/pages/admin/storefront/StorefrontCustomers'));
const StorefrontCoupons = lazy(() => import('@/pages/admin/storefront/StorefrontCoupons'));
const StorefrontSettings = lazyWithRetry(() => import('@/pages/admin/storefront/StorefrontSettings'));
const StorefrontDesignPage = lazy(() => import('@/pages/admin/storefront/StorefrontDesignPage').then(m => ({ default: m.StorefrontDesignPage })));
const StorefrontBundles = lazy(() => import('@/pages/admin/storefront/StorefrontBundles'));
const StorefrontLiveOrders = lazy(() => import('@/pages/admin/storefront/StorefrontLiveOrders'));
const StorefrontAnalytics = lazy(() => import('@/pages/admin/storefront/StorefrontAnalytics'));
const StorefrontGiftCards = lazy(() => import('@/pages/admin/storefront/StorefrontGiftCards'));
const ReviewsPage = lazy(() => import('@/pages/admin/ReviewsPage'));

const TabSkeleton = () => (
    <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Overview
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Overview' },
    { id: 'live', label: 'Live', icon: Radio, group: 'Overview' },
    // Store Operations
    { id: 'products', label: 'Catalog', icon: Package, group: 'Operations' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, group: 'Operations' },
    { id: 'customers', label: 'Customers', icon: Users, group: 'Operations' },
    // Marketing
    { id: 'coupons', label: 'Promos', tooltip: 'Promotions & Coupons', icon: Tag, group: 'Marketing' },
    { id: 'reviews', label: 'Reviews', tooltip: 'Customer Reviews & Ratings', icon: ThumbsUp, group: 'Marketing' },
    { id: 'gift-cards', label: 'Gift Cards', icon: Gift, group: 'Marketing' },
    { id: 'bundles', label: 'Bundles', icon: Boxes, group: 'Marketing' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Marketing' },
    // Customization
    { id: 'builder', label: 'Design', icon: Brush, group: 'Design' },
    { id: 'settings', label: 'Settings', icon: Settings, group: 'Design' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function StorefrontHubPage() {
    usePageTitle('Storefront');
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'dashboard';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    return (
        <div className="min-h-0 bg-background flex flex-col -m-4 sm:-m-6" style={{ height: 'calc(100vh - 56px)' }}>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 min-h-0 flex flex-col">
                <div className="border-b bg-card px-6 py-4 shrink-0">
                    <HubBreadcrumbs
                        hubName="storefront-hub"
                        hubHref="storefront-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Storefront</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage your online store
                            </p>
                        </div>
                        {/* Quick Actions - Always Visible */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/shop/${tenantSlug}`, '_blank', 'noopener,noreferrer')}
                                className="gap-2"
                            >
                                <ExternalLink className="h-4 w-4" />
                                <span className="hidden sm:inline">View Store</span>
                            </Button>
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

                {/* Constrain tab content height so embedded tools (like Builder) don't get clipped */}
                <div className="flex-1 min-h-0 overflow-auto">
                    <TabsContent value="dashboard" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Store Overview"><Suspense fallback={<TabSkeleton />}><StorefrontDashboard /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="live" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Live Orders"><Suspense fallback={<TabSkeleton />}><StorefrontLiveOrders /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="products" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Store Products"><Suspense fallback={<TabSkeleton />}><StorefrontProducts /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="orders" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Store Orders"><Suspense fallback={<TabSkeleton />}><StorefrontOrders /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="customers" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Store Customers"><Suspense fallback={<TabSkeleton />}><StorefrontCustomers /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="coupons" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Promotions"><Suspense fallback={<TabSkeleton />}><StorefrontCoupons /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="reviews" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Reviews"><Suspense fallback={<TabSkeleton />}><ReviewsPage /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="builder" className="m-0 h-full overflow-hidden">
                        <ModuleErrorBoundary moduleName="Store Design"><Suspense fallback={<TabSkeleton />}><StorefrontDesignPage /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="bundles" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Bundles"><Suspense fallback={<TabSkeleton />}><StorefrontBundles /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="analytics" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Store Analytics"><Suspense fallback={<TabSkeleton />}><StorefrontAnalytics /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="gift-cards" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Gift Cards"><Suspense fallback={<TabSkeleton />}><StorefrontGiftCards /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                    <TabsContent value="settings" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Store Settings"><Suspense fallback={<TabSkeleton />}><StorefrontSettings /></Suspense></ModuleErrorBoundary>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
