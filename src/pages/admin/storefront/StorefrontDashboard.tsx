// @ts-nocheck
/**
 * Storefront Dashboard
 * Main hub for managing the white-label online store
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import {
  Store,
  ShoppingCart,
  Users,
  DollarSign,
  Package,
  Settings,
  ExternalLink,
  TrendingUp,
  Eye,
  Plus,
  BarChart3,
  Palette,
  Globe,
  Percent,
  Bell
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { StorePreviewButton } from '@/components/admin/storefront/StorePreviewButton';
import { StorefrontFunnel } from '@/components/admin/storefront/StorefrontFunnel';

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
  const { tenantSlug } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Fetch store data
  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['marketplace-store', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to fetch store', error, { component: 'StorefrontDashboard' });
        throw error;
      }

      return data as MarketplaceStore | null;
    },
    enabled: !!tenantId,
  });

  // Fetch recent orders
  const { data: recentOrders = [] } = useQuery({
    queryKey: ['marketplace-recent-orders', store?.id],
    queryFn: async () => {
      if (!store?.id) return [];

      const { data, error } = await supabase
        .from('marketplace_orders')
        .select('id, order_number, customer_name, total, status, created_at')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        logger.error('Failed to fetch recent orders', error, { component: 'StorefrontDashboard' });
        return [];
      }

      return data as RecentOrder[];
    },
    enabled: !!store?.id,
  });

  // Fetch product count
  const { data: productStats } = useQuery({
    queryKey: ['marketplace-product-stats', store?.id],
    queryFn: async () => {
      if (!store?.id) return { total: 0, visible: 0 };

      const { count: visible } = await supabase
        .from('marketplace_product_settings')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('is_visible', true);

      const { count: total } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      return { total: total || 0, visible: visible || 0 };
    },
    enabled: !!store?.id && !!tenantId,
  });

  // Create store mutation
  const createStoreMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !tenant) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('marketplace_stores')
        .insert({
          tenant_id: tenantId,
          store_name: tenant.business_name || 'My Store',
          slug: tenant.slug || `store-${Date.now()}`,
          tagline: 'Welcome to our store',
          is_active: false,
          is_public: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-store'] });
      toast({
        title: 'Store created!',
        description: 'Your online store has been set up. Configure it to go live.',
      });
    },
    onError: (error) => {
      logger.error('Failed to create store', error, { component: 'StorefrontDashboard' });
      toast({
        title: 'Error',
        description: 'Failed to create store. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Toggle store status
  const toggleStoreMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!store?.id) throw new Error('No store');

      const { error } = await supabase
        .from('marketplace_stores')
        .update({ is_active: isActive })
        .eq('id', store.id);

      if (error) throw error;
    },
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-store'] });
      toast({
        title: isActive ? 'Store is now live!' : 'Store paused',
        description: isActive
          ? 'Customers can now browse and order from your store.'
          : 'Your store is now hidden from customers.',
      });
    },
  });

  const storeUrl = store ? `${window.location.origin}/shop/${store.slug}` : null;

  // No store yet - show setup
  if (!storeLoading && !store) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
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
              onClick={() => createStoreMutation.mutate()}
              disabled={createStoreMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              {createStoreMutation.isPending ? 'Creating...' : 'Create Store'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (storeLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'confirmed': return 'bg-blue-500';
      case 'preparing': return 'bg-purple-500';
      case 'ready': return 'bg-indigo-500';
      case 'out_for_delivery': return 'bg-orange-500';
      case 'delivered': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{store?.store_name}</h1>
            <Badge variant={store?.is_active ? 'default' : 'secondary'}>
              {store?.is_active ? 'Live' : 'Draft'}
            </Badge>
          </div>
          <p className="text-muted-foreground">{store?.tagline || 'Your online storefront'}</p>
        </div>
        <div className="flex items-center gap-2">
          {store?.slug && (
            <StorePreviewButton
              storeSlug={store.slug}
              storeName={store.store_name}
            />
          )}
          <Button
            variant={store?.is_active ? 'secondary' : 'default'}
            onClick={() => toggleStoreMutation.mutate(!store?.is_active)}
            disabled={toggleStoreMutation.isPending}
          >
            {store?.is_active ? 'Pause Store' : 'Go Live'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/${tenantSlug}/admin/storefront/settings`)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(store?.total_revenue || 0)}</p>
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
                <p className="text-2xl font-bold">{store?.total_orders || 0}</p>
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
                <p className="text-2xl font-bold">{store?.total_customers || 0}</p>
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
                  {productStats?.visible || 0}
                  <span className="text-sm text-muted-foreground font-normal">
                    /{productStats?.total || 0}
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

      {/* Sales Funnel Analytics */}
      {store?.id && (
        <StorefrontFunnel
          storeId={store.id}
          primaryColor={store.primary_color}
        />
      )}

      {/* Quick Actions + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront/products`)}
            >
              <Package className="w-5 h-5" />
              <span className="text-sm">Manage Products</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront/orders`)}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="text-sm">View Orders</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront/customers`)}
            >
              <Users className="w-5 h-5" />
              <span className="text-sm">Customers</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront/coupons`)}
            >
              <Percent className="w-5 h-5" />
              <span className="text-sm">Coupons</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront/analytics`)}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="text-sm">Analytics</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront/settings`)}
            >
              <Palette className="w-5 h-5" />
              <span className="text-sm">Customize</span>
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
              onClick={() => navigate(`/${tenantSlug}/admin/storefront/orders`)}
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
                          {order.customer_name || 'Guest'} • {formatSmartDate(order.created_at)}
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
                    toast({ title: 'URL copied!' });
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
    </div>
  );
}





