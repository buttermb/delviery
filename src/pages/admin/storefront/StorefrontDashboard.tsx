/**
 * Storefront Dashboard
 * Main hub for managing multi-store white-label online stores
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useActiveStore } from '@/hooks/useActiveStore';
import { useCreateStorefront } from '@/hooks/useCreditGatedAction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { showCopyToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal';
import {
  Store,
  ShoppingCart,
  Users,
  DollarSign,
  Package,
  Settings,
  ExternalLink,
  Plus,
  Palette,
  Globe,
  FileText,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { StorefrontFunnel } from '@/components/admin/storefront/StorefrontFunnel';
import { DeleteStoreDialog } from '@/components/admin/storefront/DeleteStoreDialog';
import { CreateStoreDialog } from '@/components/admin/storefront/CreateStoreDialog';
import { StoreSelector } from '@/components/admin/storefront/StoreSelector';
import { StoreListView } from '@/components/admin/storefront/StoreListView';
import { SmartOnboardingWidget } from '@/components/admin/storefront/SmartOnboardingWidget';
import { OnboardingProgressChecklist } from '@/components/admin/storefront/OnboardingProgressChecklist';
import { StorefrontAnalyticsWidget } from '@/components/admin/storefront/StorefrontAnalyticsWidget';

interface MarketplaceStore {
  id: string;
  tenant_id: string;
  store_name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  is_active: boolean;
  is_public: boolean;
  total_orders: number;
  total_revenue: number;
  total_customers: number;
  created_at: string;
}

interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  total: number;
  status: string;
  created_at: string;
}

export default function StorefrontDashboard() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const { activeStoreId, selectStore, clearSelection } = useActiveStore(tenantId);
  const [showListView, setShowListView] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<{ id: string; store_name: string } | null>(null);

  // Check URL params for view mode
  useEffect(() => {
    if (searchParams.get('view') === 'all') {
      setShowListView(true);
    }
  }, [searchParams]);

  // Fetch ALL stores for the tenant
  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: queryKeys.marketplaceStores.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch stores', error, { component: 'StorefrontDashboard' });
        throw error;
      }

      return data as MarketplaceStore[];
    },
    enabled: !!tenantId,
  });

  // Auto-select first store if none selected and stores exist
  useEffect(() => {
    if (stores.length > 0 && !activeStoreId) {
      selectStore(stores[0].id);
    }
  }, [stores, activeStoreId, selectStore]);

  // Get active store object
  const activeStore = stores.find(s => s.id === activeStoreId) || null;

  // Fetch recent orders for active store
  const { data: recentOrders = [] } = useQuery({
    queryKey: queryKeys.marketplaceStores.recentOrders(activeStoreId),
    queryFn: async () => {
      if (!activeStoreId) return [];

      const { data, error } = await supabase
        .from('storefront_orders')
        .select('id, order_number, customer_name, total, status, created_at')
        .eq('store_id', activeStoreId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        if (error.code === 'PGRST204' || error.code === '42P01') {
          return [];
        }
        logger.error('Failed to fetch recent orders', error, { component: 'StorefrontDashboard' });
        return [];
      }

      return data as RecentOrder[];
    },
    enabled: !!activeStoreId,
  });

  // Fetch product count for active store
  const { data: productStats } = useQuery({
    queryKey: queryKeys.marketplaceStores.productStats(activeStoreId, tenantId),
    queryFn: async () => {
      if (!activeStoreId || !tenantId) return { total: 0, visible: 0 };

      const { count: visible } = await supabase
        .from('marketplace_product_settings')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', activeStoreId)
        .eq('is_visible', true);

      const { count: total } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      return { total: total ?? 0, visible: visible ?? 0 };
    },
    enabled: !!activeStoreId && !!tenantId,
  });

  // Fetch revenue trend (today vs yesterday)
  const { data: revenueTrend } = useQuery({
    queryKey: queryKeys.marketplaceStores.revenueTrend(activeStoreId),
    queryFn: async () => {
      if (!activeStoreId) return { todayRevenue: 0, yesterdayRevenue: 0, percentChange: 0 };

      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);

      // Today's revenue
      const { data: todayOrders } = await supabase
        .from('storefront_orders')
        .select('total')
        .eq('store_id', activeStoreId)
        .gte('created_at', startOfToday.toISOString())
        .not('status', 'eq', 'cancelled');

      // Yesterday's revenue
      const { data: yesterdayOrders } = await supabase
        .from('storefront_orders')
        .select('total')
        .eq('store_id', activeStoreId)
        .gte('created_at', startOfYesterday.toISOString())
        .lt('created_at', startOfToday.toISOString())
        .not('status', 'eq', 'cancelled');

      const todayRevenue = (todayOrders ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);
      const yesterdayRevenue = (yesterdayOrders ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);

      let percentChange = 0;
      if (yesterdayRevenue > 0) {
        percentChange = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
      } else if (todayRevenue > 0) {
        percentChange = 100; // New revenue from nothing
      }

      return { todayRevenue, yesterdayRevenue, percentChange: Math.round(percentChange) };
    },
    enabled: !!activeStoreId,
    refetchInterval: 30000, // Refresh every 30 seconds for "live" feel
  });

  // Toggle store status
  const toggleStoreMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!activeStoreId || !tenantId) throw new Error('No store or tenant');

      const { error } = await supabase
        .from('marketplace_stores')
        .update({ is_active: isActive })
        .eq('id', activeStoreId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceStores.all });
      toast.success(isActive);
    },
  });

  // Delete store mutation
  const deleteStoreMutation = useMutation({
    mutationFn: async (storeId: string) => {
      if (!tenantId) throw new Error('No tenant context');

      // Delete related data first
      await supabase
        .from('marketplace_product_settings')
        .delete()
        .eq('store_id', storeId);

      // Delete the store with tenant filter for security
      const { error } = await supabase
        .from('marketplace_stores')
        .delete()
        .eq('id', storeId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return storeId;
    },
    onSuccess: (deletedStoreId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceStores.all });
      setDeleteDialogOpen(false);
      setStoreToDelete(null);

      // If deleted active store, clear selection
      if (deletedStoreId === activeStoreId) {
        clearSelection();
      }

      toast.success("Your store has been permanently deleted.");
    },
    onError: (error) => {
      logger.error('Failed to delete store', error, { component: 'StorefrontDashboard' });
      toast.error("Failed to delete store. Please try again.", { description: humanizeError(error) });
    },
  });

  // Credit-gated store creation
  const {
    createStorefront,
    isCreating: isCreditGateCreating,
    showOutOfCreditsModal,
    closeOutOfCreditsModal,
    blockedAction,
  } = useCreateStorefront();

  // Create new store mutation (used inside credit gate)
  const createNewStoreMutation = useMutation({
    mutationFn: async (data: { storeName: string; slug: string; tagline: string }) => {
      if (!tenantId) throw new Error('No tenant');

      const { data: newStore, error } = await supabase
        .from('marketplace_stores')
        .insert({
          tenant_id: tenantId,
          store_name: data.storeName,
          slug: data.slug,
          tagline: data.tagline ?? 'Welcome to our store',
          is_active: false,
          is_public: false,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return newStore;
    },
    onSuccess: (newStore) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceStores.all });
      setCreateDialogOpen(false);
      selectStore(newStore.id);
      setShowListView(false);
      toast.success("Your new store has been set up. Configure it to go live.");
    },
    onError: (error: Error) => {
      logger.error('Failed to create store', error, { component: 'StorefrontDashboard' });
      toast.error('Failed to create store', { description: humanizeError(error) });
    },
  });

  // Wrap store creation with credit gating + graceful fallback
  const handleCreateStore = async (data: { storeName: string; slug: string; tagline: string }) => {
    try {
      await createStorefront(
        () => createNewStoreMutation.mutateAsync(data),
        {
          onError: (error) => {
            logger.error('Credit-gated store creation failed', error, { component: 'StorefrontDashboard' });
          },
        }
      );
    } catch (err) {
      // Graceful fallback: if credit system itself throws, create store without credits
      logger.warn('Credit system unavailable, creating store without credit deduction', {
        component: 'StorefrontDashboard',
        error: err instanceof Error ? err.message : String(err),
      });
      createNewStoreMutation.mutate(data);
    }
  };

  const isCreatingStore = createNewStoreMutation.isPending || isCreditGateCreating;

  // Handlers
  const handleSelectStore = (storeId: string) => {
    selectStore(storeId);
    setShowListView(false);
    setSearchParams({});
  };

  const handlePreviewStore = (slug: string) => {
    window.open(`/shop/${slug}`, '_blank', 'noopener,noreferrer');
  };

  const handleSettingsStore = (storeId: string) => {
    selectStore(storeId);
    setSearchParams({ tab: 'settings' });
  };

  const handleDeleteStore = (store: { id: string; store_name: string }) => {
    setStoreToDelete(store);
    setDeleteDialogOpen(true);
  };

  const handleViewAllStores = () => {
    setShowListView(true);
    setSearchParams({ view: 'all' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'confirmed': return 'bg-blue-500';
      case 'preparing': return 'bg-purple-500';
      case 'ready': return 'bg-indigo-500';
      case 'out_for_delivery': return 'bg-orange-500';
      case 'delivered': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500 dark:bg-gray-600';
    }
  };

  // Loading state
  if (storesLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No stores - show create CTA
  if (stores.length === 0) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Store className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Create Your Online Store</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Set up a white-label storefront where customers can browse your products,
              add to cart, and checkout - all under your brand.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 w-full max-w-lg">
              <div className="flex flex-col items-center text-center p-4">
                <Palette className="w-8 h-8 text-primary mb-2" />
                <span className="text-sm font-medium">Custom Branding</span>
                <span className="text-xs text-muted-foreground">Your colors & logo</span>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <ShoppingCart className="w-8 h-8 text-primary mb-2" />
                <span className="text-sm font-medium">Full Checkout</span>
                <span className="text-xs text-muted-foreground">Cart & payment</span>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <Globe className="w-8 h-8 text-primary mb-2" />
                <span className="text-sm font-medium">Custom Domain</span>
                <span className="text-xs text-muted-foreground">Your own URL</span>
              </div>
            </div>
            <Button
              size="lg"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Store
            </Button>
          </CardContent>
        </Card>

        <CreateStoreDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={handleCreateStore}
          isCreating={isCreatingStore}
          defaultStoreName={tenant?.business_name ?? ''}
        />

        <OutOfCreditsModal
          open={showOutOfCreditsModal}
          onOpenChange={closeOutOfCreditsModal}
          actionAttempted={blockedAction ?? undefined}
        />
      </div>
    );
  }

  // Show list view
  if (showListView) {
    return (
      <div className="container mx-auto p-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              setShowListView(false);
              setSearchParams({});
            }}
          >
            ← Back to Dashboard
          </Button>
        </div>

        <StoreListView
          stores={stores}
          activeStoreId={activeStoreId}
          onSelectStore={handleSelectStore}
          onPreviewStore={handlePreviewStore}
          onSettingsStore={handleSettingsStore}
          onDeleteStore={handleDeleteStore}
          onCreateStore={() => setCreateDialogOpen(true)}
        />

        <DeleteStoreDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={() => storeToDelete && deleteStoreMutation.mutate(storeToDelete.id)}
          storeName={storeToDelete?.store_name ?? ''}
          isDeleting={deleteStoreMutation.isPending}
        />

        <CreateStoreDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={handleCreateStore}
          isCreating={isCreatingStore}
          defaultStoreName={tenant?.business_name ?? ''}
        />

        <OutOfCreditsModal
          open={showOutOfCreditsModal}
          onOpenChange={closeOutOfCreditsModal}
          actionAttempted={blockedAction ?? undefined}
        />
      </div>
    );
  }

  // Show store dashboard
  const storeUrl = activeStore ? `${window.location.origin}/shop/${activeStore.slug}` : null;

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Streamlined Header */}
      <div className="flex flex-col gap-4 md:gap-0 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          {/* Store Selector - only show if multiple stores */}
          {stores.length > 1 && (
            <StoreSelector
              stores={stores}
              activeStoreId={activeStoreId}
              onSelectStore={handleSelectStore}
              onViewAllStores={handleViewAllStores}
              onCreateStore={() => setCreateDialogOpen(true)}
            />
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-xl font-bold">{activeStore?.store_name}</h1>
              <Badge
                variant={activeStore?.is_active ? 'default' : 'secondary'}
                className={activeStore?.is_active ? 'bg-green-500' : ''}
              >
                {activeStore?.is_active ? '● Live' : 'Draft'}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">{activeStore?.tagline ?? 'Your online storefront'}</p>
          </div>
        </div>

        {/* Simplified Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary CTA: Go Live or Preview */}
          {!activeStore?.is_active ? (
            <Button
              size="lg"
              onClick={() => toggleStoreMutation.mutate(true)}
              disabled={toggleStoreMutation.isPending}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              {toggleStoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              Launch Store
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => toggleStoreMutation.mutate(false)}
              disabled={toggleStoreMutation.isPending}
            >
              {toggleStoreMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Pause Store
            </Button>
          )}

          {/* Preview Button */}
          {activeStore?.slug && (
            <Button
              variant="outline"
              onClick={() => window.open(`/shop/${activeStore.slug}`, '_blank', 'noopener,noreferrer')}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">View Store</span>
            </Button>
          )}

          {/* Settings - Icon only on mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchParams({ tab: 'settings' })}
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Smart Onboarding Widget or Quick Stats */}
      {productStats && productStats.total === 0 ? (
        <SmartOnboardingWidget productCount={0} className="mb-2" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{formatCurrency(activeStore?.total_revenue ?? 0)}</p>
                    {revenueTrend && revenueTrend.percentChange !== 0 && (
                      <span className={`flex items-center text-xs font-medium ${revenueTrend.percentChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {revenueTrend.percentChange > 0 ? (
                          <TrendingUp className="w-3 h-3 mr-0.5" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-0.5" />
                        )}
                        {Math.abs(revenueTrend.percentChange)}%
                      </span>
                    )}
                  </div>
                  {revenueTrend && revenueTrend.todayRevenue > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Today: {formatCurrency(revenueTrend.todayRevenue)}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{activeStore?.total_orders ?? 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Customers</p>
                  <p className="text-2xl font-bold">{activeStore?.total_customers ?? 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Products Listed</p>
                  <p className="text-2xl font-bold">
                    {productStats?.visible ?? 0}
                    <span className="text-sm text-muted-foreground font-normal">
                      /{productStats?.total ?? 0}
                    </span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Package className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Getting Started Checklist */}
      <OnboardingProgressChecklist storeId={activeStoreId} />

      {/* Sales Funnel Analytics */}
      {activeStoreId && (
        <StorefrontFunnel
          storeId={activeStoreId}
          primaryColor={activeStore?.primary_color ?? '#000'}
        />
      )}

      {/* Storefront Analytics - 7 Day Overview */}
      {activeStoreId && (
        <StorefrontAnalyticsWidget storeId={activeStoreId} />
      )}

      {/* Quick Actions + Recent Orders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New Order */}
            <Button
              className="w-full justify-start h-16 text-lg relative overflow-hidden group"
              onClick={() => navigate(`/${tenantSlug}/admin/cash-register`)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent group-hover:opacity-100 opacity-0 transition-opacity" />
              <ClipboardList className="w-6 h-6 mr-4 text-primary-foreground" />
              <div className="text-left">
                <span className="font-semibold block">New Order</span>
                <p className="text-xs font-normal opacity-90">Quick order entry</p>
              </div>
            </Button>

            {/* Create Menu */}
            <Button
              variant="outline"
              className="w-full justify-start h-16 text-lg hover:border-primary/50 hover:bg-primary/5"
              onClick={() => navigate(`/${tenantSlug}/admin/disposable-menus?action=create`)}
            >
              <FileText className="w-6 h-6 mr-4 text-violet-500" />
              <div className="text-left">
                <span className="font-semibold block">Create Menu</span>
                <p className="text-xs text-muted-foreground font-normal">Launch disposable menu</p>
              </div>
            </Button>

            {/* View Live Store */}
            <Button
              variant="outline"
              className="w-full justify-start h-16 text-lg hover:border-blue-500/50 hover:bg-blue-500/5"
              onClick={() => storeUrl && window.open(storeUrl, '_blank', 'noopener,noreferrer')}
              disabled={!storeUrl}
            >
              <ExternalLink className="w-6 h-6 mr-4 text-blue-500" />
              <div className="text-left">
                <span className="font-semibold block">View Live Store</span>
                <p className="text-xs text-muted-foreground font-normal">Open in new tab</p>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchParams({ tab: 'orders' })}
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No orders yet</p>
                <p className="text-sm">Orders will appear here when customers checkout</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                    onClick={() => navigate(`/${tenantSlug}/admin/storefront/orders/${order.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(order.status)}`} />
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.customer_name ?? 'Guest'} • {formatSmartDate(order.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(order.total)}</p>
                      <Badge variant="outline" className="capitalize">
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Store URL Card */}
      {storeUrl && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Globe className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium">Your Store URL</p>
                  <code className="text-sm text-muted-foreground bg-background px-2 py-1 rounded">
                    {storeUrl}
                  </code>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(storeUrl);
                    showCopyToast('Store URL');
                  }}
                >
                  Copy URL
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                    Open Store
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <DeleteStoreDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => storeToDelete && deleteStoreMutation.mutate(storeToDelete.id)}
        storeName={storeToDelete?.store_name ?? ''}
        isDeleting={deleteStoreMutation.isPending}
      />

      <CreateStoreDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateStore}
        isCreating={isCreatingStore}
        defaultStoreName={tenant?.business_name ?? ''}
      />

      <OutOfCreditsModal
        open={showOutOfCreditsModal}
        onOpenChange={closeOutOfCreditsModal}
        actionAttempted={blockedAction ?? undefined}
      />
    </div>
  );
}
