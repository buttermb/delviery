/**
 * Order Product Quick View Component
 *
 * A slide-over panel that shows detailed product information when clicking
 * on a product in the order items list. Displays image, description, current
 * stock, vendor, category, price history, and a link to the full product page.
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { DetailPanel, type DetailPanelAction } from '@/components/admin/shared/DetailPanel';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import Package from 'lucide-react/dist/esm/icons/package';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Tag from 'lucide-react/dist/esm/icons/tag';
import Building2 from 'lucide-react/dist/esm/icons/building-2';
import Boxes from 'lucide-react/dist/esm/icons/boxes';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import Minus from 'lucide-react/dist/esm/icons/minus';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';

/**
 * Product details fetched from the database
 */
interface ProductDetails {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  vendor_name: string | null;
  sku: string | null;
  available_quantity: number | null;
  low_stock_alert: number | null;
  retail_price: number | null;
  wholesale_price: number | null;
  cost_per_unit: number | null;
  strain_name: string | null;
  strain_type: string | null;
  thc_percent: number | null;
  cbd_percent: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Price history entry
 */
interface PriceHistoryEntry {
  id: string;
  old_price: number | null;
  new_price: number | null;
  price_type: string;
  changed_at: string;
  changed_by: string | null;
}

interface OrderProductQuickViewProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback when the panel should close */
  onClose: () => void;
  /** Product ID to display */
  productId: string | null;
  /** Product name for the title (used while loading) */
  productName?: string;
}

/**
 * Displays product details in a slide-over panel
 */
export function OrderProductQuickView({
  isOpen,
  onClose,
  productId,
  productName,
}: OrderProductQuickViewProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();

  // Fetch product details
  const { data: product, isLoading: productLoading, error: productError } = useQuery({
    queryKey: queryKeys.products.detail(tenant?.id || '', productId || ''),
    queryFn: async (): Promise<ProductDetails | null> => {
      if (!tenant?.id || !productId) return null;

      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          image_url,
          category,
          vendor_name,
          sku,
          available_quantity,
          low_stock_alert,
          retail_price,
          wholesale_price,
          cost_per_unit,
          strain_name,
          strain_type,
          thc_percent,
          cbd_percent,
          created_at
        `)
        .eq('id', productId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch product details', error, {
          component: 'OrderProductQuickView',
          productId,
        });
        throw error;
      }

      return data as ProductDetails | null;
    },
    enabled: isOpen && !!tenant?.id && !!productId,
  });

  // Fetch price history (if table exists, otherwise return empty)
  const { data: priceHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: queryKeys.productPriceHistory.byProduct(tenant?.id, productId),
    queryFn: async (): Promise<PriceHistoryEntry[]> => {
      if (!tenant?.id || !productId) return [];

      // Try to fetch from product_price_history table
      const { data, error } = await supabase
        .from('product_price_history')
        .select('id, old_price, new_price, price_type, changed_at, changed_by')
        .eq('product_id', productId)
        .eq('tenant_id', tenant.id)
        .order('changed_at', { ascending: false })
        .limit(5);

      // If table doesn't exist or error, return empty array gracefully
      if (error) {
        logger.debug('Price history not available', { productId, error: error.message });
        return [];
      }

      return (data || []) as PriceHistoryEntry[];
    },
    enabled: isOpen && !!tenant?.id && !!productId,
  });

  // Navigate to full product page
  const handleViewFullPage = useCallback(() => {
    if (productId) {
      navigateToAdmin(`products/${productId}`);
      onClose();
    }
  }, [productId, navigateToAdmin, onClose]);

  // Panel actions
  const actions: DetailPanelAction[] = [
    {
      label: 'View Full Page',
      icon: ExternalLink,
      onClick: handleViewFullPage,
      variant: 'outline',
    },
  ];

  // Calculate stock status
  const getStockStatus = () => {
    if (!product) return null;
    const quantity = product.available_quantity ?? 0;
    const threshold = product.low_stock_alert ?? 10;

    if (quantity <= 0) {
      return { label: 'Out of Stock', variant: 'destructive' as const, icon: AlertTriangle };
    }
    if (quantity <= threshold) {
      return { label: 'Low Stock', variant: 'warning' as const, icon: AlertTriangle };
    }
    return { label: 'In Stock', variant: 'success' as const, icon: Boxes };
  };

  const stockStatus = getStockStatus();

  // Get price trend for history
  const getPriceTrend = (oldPrice: number | null, newPrice: number | null) => {
    if (oldPrice === null || newPrice === null) return 'same';
    if (newPrice > oldPrice) return 'up';
    if (newPrice < oldPrice) return 'down';
    return 'same';
  };

  const isLoading = productLoading;
  const displayTitle = product?.name || productName || 'Product Details';

  return (
    <DetailPanel
      isOpen={isOpen}
      onClose={onClose}
      title={displayTitle}
      entityType="PRODUCT"
      entityId={productId || undefined}
      actions={actions}
      loading={isLoading}
      width="lg"
    >
      {productError ? (
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Failed to load product details</p>
        </div>
      ) : product ? (
        <div className="space-y-6">
          {/* Product Image */}
          <div className="aspect-video relative bg-muted rounded-lg overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-muted-foreground/50" />
              </div>
            )}
          </div>

          {/* Stock Status Badge */}
          {stockStatus && (
            <div className="flex items-center gap-2">
              <Badge
                variant={stockStatus.variant === 'success' ? 'default' : stockStatus.variant === 'warning' ? 'secondary' : 'destructive'}
                className={stockStatus.variant === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}
              >
                <stockStatus.icon className="w-3 h-3 mr-1" />
                {stockStatus.label}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {product.available_quantity ?? 0} units available
              </span>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">{product.description}</p>
            </div>
          )}

          <Separator />

          {/* Product Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="flex items-start gap-2">
              <Tag className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="text-sm font-medium capitalize">{product.category || 'Uncategorized'}</p>
              </div>
            </div>

            {/* Vendor */}
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Vendor</p>
                <p className="text-sm font-medium">{product.vendor_name || 'Unknown'}</p>
              </div>
            </div>

            {/* SKU */}
            {product.sku && (
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">SKU</p>
                  <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">
                    {product.sku}
                  </code>
                </div>
              </div>
            )}

            {/* Current Stock */}
            <div className="flex items-start gap-2">
              <Boxes className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Current Stock</p>
                <p className="text-sm font-medium">{product.available_quantity ?? 0} units</p>
              </div>
            </div>
          </div>

          {/* Cannabis-specific info */}
          {(product.strain_name || product.thc_percent || product.cbd_percent) && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">Product Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  {product.strain_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Strain</p>
                      <p className="text-sm font-medium">{product.strain_name}</p>
                      {product.strain_type && (
                        <Badge variant="outline" className="mt-1 capitalize">
                          {product.strain_type}
                        </Badge>
                      )}
                    </div>
                  )}
                  {(product.thc_percent !== null || product.cbd_percent !== null) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Potency</p>
                      <div className="flex gap-2 mt-1">
                        {product.thc_percent !== null && (
                          <Badge variant="secondary">THC: {product.thc_percent}%</Badge>
                        )}
                        {product.cbd_percent !== null && (
                          <Badge variant="secondary">CBD: {product.cbd_percent}%</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Pricing Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Pricing</h3>
            <div className="grid grid-cols-3 gap-4">
              {product.retail_price !== null && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Retail</p>
                  <p className="text-lg font-bold">{formatCurrency(product.retail_price)}</p>
                </div>
              )}
              {product.wholesale_price !== null && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Wholesale</p>
                  <p className="text-lg font-bold">{formatCurrency(product.wholesale_price)}</p>
                </div>
              )}
              {product.cost_per_unit !== null && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Cost</p>
                  <p className="text-lg font-bold">{formatCurrency(product.cost_per_unit)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Price History */}
          {!historyLoading && priceHistory.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">Price History</h3>
                <div className="space-y-2">
                  {priceHistory.map((entry) => {
                    const trend = getPriceTrend(entry.old_price, entry.new_price);
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {trend === 'up' ? (
                            <TrendingUp className="w-4 h-4 text-red-500" />
                          ) : trend === 'down' ? (
                            <TrendingDown className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Minus className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="capitalize">{entry.price_type || 'retail'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground line-through">
                            {formatCurrency(entry.old_price || 0)}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(entry.new_price || 0)}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatSmartDate(entry.changed_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Last Updated */}
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Last updated: {formatSmartDate(product.updated_at || product.created_at)}
            </p>
          </div>
        </div>
      ) : null}
    </DetailPanel>
  );
}

export default OrderProductQuickView;
