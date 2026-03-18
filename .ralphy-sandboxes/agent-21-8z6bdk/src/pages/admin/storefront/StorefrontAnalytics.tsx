/**
 * Storefront Analytics Page
 * Displays aggregated metrics for the storefront including
 * revenue, orders, conversion rate, AOV, top products, and traffic sources.
 * Shows an empty state with share link + QR code when no orders exist yet.
 */

import { useState, useEffect } from 'react';
import { subDays } from 'date-fns';
import { ShoppingCart, DollarSign, TrendingUp, Package, Share2, Copy, Download, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { generateQRCodeDataURL, downloadQRCodePNG } from '@/lib/utils/qrCode';
import { showCopyToast } from '@/utils/toastHelpers';
import { humanizeError } from '@/lib/humanizeError';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { StoreShareDialog } from '@/components/admin/storefront/StoreShareDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateRangePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { RevenueChart } from '@/components/admin/analytics/RevenueChart';
import { AverageOrderValueChart } from '@/components/admin/analytics/AverageOrderValueChart';
import { TopSellingProducts } from '@/components/admin/analytics/TopSellingProducts';
import { TrafficSources } from '@/components/admin/analytics/TrafficSources';
import { ConversionRateChart } from '@/components/admin/analytics/ConversionRateChart';
import { CustomerRetentionChart } from '@/components/admin/analytics/CustomerRetentionChart';

interface OrderMetrics {
  totalOrders: number;
  totalRevenue: number;
  conversionRate: number;
  averageOrderValue: number;
}

export default function StorefrontAnalytics() {
  const { tenant } = useTenantAdminAuth();
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const tenantId = tenant?.id;

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Get the store for this tenant (include fields needed for share link)
  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: queryKeys.marketplaceStore.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('marketplace_stores')
        .select('id, store_name, slug, encrypted_url_token, is_active, is_public')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch summary metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: queryKeys.analytics.orders(tenantId, { storeId: store?.id, from: dateRange.from?.toISOString(), to: dateRange.to?.toISOString() }),
    queryFn: async (): Promise<OrderMetrics> => {
      if (!store?.id) return { totalOrders: 0, totalRevenue: 0, conversionRate: 0, averageOrderValue: 0 };

      let query = supabase
        .from('storefront_orders')
        .select('id, total, status, created_at')
        .eq('store_id', store.id);

      if (dateRange.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data: orders, error } = await query;

      if (error || !orders?.length) {
        if (error) logger.warn('Failed to fetch order metrics', error);
        return { totalOrders: 0, totalRevenue: 0, conversionRate: 0, averageOrderValue: 0 };
      }

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);
      const completedOrders = orders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;
      // Conversion rate: completed orders vs estimated visitors (5x order count)
      const estimatedVisitors = totalOrders * 5;
      const conversionRate = estimatedVisitors > 0
        ? Math.round((completedOrders / estimatedVisitors) * 1000) / 10
        : 0;
      const averageOrderValue = totalOrders > 0
        ? Math.round((totalRevenue / totalOrders) * 100) / 100
        : 0;

      return { totalOrders, totalRevenue: Math.round(totalRevenue * 100) / 100, conversionRate, averageOrderValue };
    },
    enabled: !!store?.id,
  });

  // Build share URL for the store
  const storeUrl = store?.slug
    ? `${window.location.origin}/shop/${store.slug}`
    : null;

  // Generate QR code when store is available but has no orders
  const hasNoOrders = !metricsLoading && metrics && metrics.totalOrders === 0;

  useEffect(() => {
    if (storeUrl && hasNoOrders) {
      generateQRCodeDataURL(storeUrl, { size: 200 })
        .then(setQrCodeDataUrl)
        .catch((error) => {
          logger.error('Failed to generate QR code for empty state', error);
        });
    }
  }, [storeUrl, hasNoOrders]);

  const handleCopyLink = () => {
    if (!storeUrl) return;
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    showCopyToast('Store link');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = async () => {
    if (!storeUrl || !store?.slug) return;
    try {
      await downloadQRCodePNG(storeUrl, `store-qr-${store.slug}.png`, { size: 512 });
      toast.success('QR Code downloaded!');
    } catch (error) {
      toast.error('Download failed', { description: humanizeError(error) });
    }
  };

  if (storeLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  // No store found — prompt to create one
  if (!store) {
    return (
      <div className="p-6">
        <EnhancedEmptyState
          type="no_analytics"
          title="No Storefront Found"
          description="Create a storefront to start tracking your sales and customer analytics."
          designSystem="tenant-admin"
        />
      </div>
    );
  }

  // Store exists but no orders yet — show share link + QR code to drive traffic
  if (hasNoOrders) {
    return (
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Storefront Analytics</h2>
          <p className="text-muted-foreground">
            Insights into your customers and sales performance.
          </p>
        </div>

        <Card className="p-8">
          <CardContent className="flex flex-col items-center text-center space-y-6 p-0">
            <div className="text-6xl" aria-hidden="true">📊</div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold">No Orders Yet</h3>
              <p className="text-muted-foreground max-w-md">
                Share your store link with customers to start receiving orders. Analytics will populate automatically once sales come in.
              </p>
            </div>

            {/* Store Link */}
            {storeUrl && (
              <div className="w-full max-w-md space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={storeUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant={copied ? 'default' : 'outline'}
                    size="icon"
                    onClick={handleCopyLink}
                    aria-label="Copy store link"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(storeUrl, '_blank', 'noopener,noreferrer')}
                    aria-label="Open store"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* QR Code */}
            {qrCodeDataUrl && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center border p-2">
                  <img
                    src={qrCodeDataUrl}
                    alt="Store QR Code"
                    className="w-full h-full"
                    loading="lazy"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                  <Download className="w-4 h-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            )}

            {/* Full Share Dialog */}
            <Button onClick={() => setShareDialogOpen(true)}>
              <Share2 className="w-4 h-4 mr-2" />
              Share Your Store
            </Button>
          </CardContent>
        </Card>

        {store && (
          <StoreShareDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            store={store}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* Header with date range filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Storefront Analytics</h2>
          <p className="text-muted-foreground">
            Insights into your customers and sales performance.
          </p>
        </div>
        <DateRangePickerWithPresets
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          className="w-[280px]"
        />
      </div>

      {/* Summary metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">${(metrics?.totalRevenue ?? 0).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.totalOrders ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.conversionRate ?? 0}%</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">${(metrics?.averageOrderValue ?? 0).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart - full width */}
      <RevenueChart storeId={store.id} dateRange={dateRange} />

      {/* Two-column grid for remaining charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopSellingProducts storeId={store.id} dateRange={dateRange} />
        <TrafficSources storeId={store.id} dateRange={dateRange} />
        <AverageOrderValueChart storeId={store.id} />
        <ConversionRateChart storeId={store.id} />
        <CustomerRetentionChart storeId={store.id} />
      </div>
    </div>
  );
}
