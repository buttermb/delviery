/**
 * ProductStorefrontPreview - Preview how a product appears on the storefront
 *
 * Shows exactly how this product appears on the storefront and any active menus.
 * Displays all product data as the customer would see it.
 * Useful for verifying product listings without visiting the actual storefront.
 *
 * Connects product module to storefront module.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Eye from 'lucide-react/dist/esm/icons/eye';
import Store from 'lucide-react/dist/esm/icons/store';
import Package from 'lucide-react/dist/esm/icons/package';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Tag from 'lucide-react/dist/esm/icons/tag';
import Leaf from 'lucide-react/dist/esm/icons/leaf';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Check from 'lucide-react/dist/esm/icons/check';
import X from 'lucide-react/dist/esm/icons/x';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/useProduct';
import type { Database } from '@/integrations/supabase/types';

type MarketplaceStore = Database['public']['Tables']['marketplace_stores']['Row'];
type DisposableMenu = Database['public']['Tables']['disposable_menus']['Row'];

interface ProductStorefrontPreviewProps {
  product: Product;
  buttonVariant?: 'default' | 'outline' | 'ghost';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

interface StoreWithProduct {
  store: MarketplaceStore;
  customPrice: number | null;
  isVisible: boolean;
  isFeatured: boolean;
}

interface MenuWithProduct {
  menu: DisposableMenu;
  customPrice: number | null;
  displayOrder: number;
}

/**
 * Hook to fetch stores and menus that feature this product
 */
function useProductStorefrontData(productId: string | undefined, tenantId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.products.all, 'storefront-preview', productId, tenantId],
    queryFn: async (): Promise<{ stores: StoreWithProduct[]; menus: MenuWithProduct[] }> => {
      if (!productId || !tenantId) {
        return { stores: [], menus: [] };
      }

      // Fetch marketplace stores with product settings
      const { data: storeSettings, error: storeError } = await supabase
        .from('marketplace_product_settings')
        .select(`
          custom_price,
          is_visible,
          featured,
          marketplace_stores!inner (*)
        `)
        .eq('product_id', productId);

      if (storeError) {
        logger.error('Failed to fetch store settings for preview', storeError, {
          component: 'ProductStorefrontPreview',
          productId,
        });
      }

      // Filter for tenant's stores
      const stores: StoreWithProduct[] = (storeSettings ?? [])
        .filter((ss) => {
          const store = ss.marketplace_stores as unknown as MarketplaceStore;
          return store?.tenant_id === tenantId && store?.is_active;
        })
        .map((ss) => ({
          store: ss.marketplace_stores as unknown as MarketplaceStore,
          customPrice: ss.custom_price,
          isVisible: ss.is_visible ?? true,
          isFeatured: ss.featured ?? false,
        }));

      // Fetch disposable menus with product
      const { data: menuProducts, error: menuError } = await supabase
        .from('disposable_menu_products')
        .select(`
          custom_price,
          display_order,
          disposable_menus!inner (*)
        `)
        .eq('product_id', productId);

      if (menuError) {
        logger.error('Failed to fetch menu products for preview', menuError, {
          component: 'ProductStorefrontPreview',
          productId,
        });
      }

      // Filter for tenant's active menus
      const menus: MenuWithProduct[] = (menuProducts ?? [])
        .filter((mp) => {
          const menu = mp.disposable_menus as unknown as DisposableMenu;
          return menu?.tenant_id === tenantId && menu?.status === 'active';
        })
        .map((mp) => ({
          menu: mp.disposable_menus as unknown as DisposableMenu,
          customPrice: mp.custom_price,
          displayOrder: mp.display_order ?? 0,
        }));

      return { stores, menus };
    },
    enabled: !!productId && !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Storefront Product Card Preview - mimics the actual storefront appearance
 */
function StorefrontProductCard({
  product,
  displayPrice,
  storePrimaryColor,
  isFeatured,
}: {
  product: Product;
  displayPrice: number;
  storePrimaryColor: string;
  isFeatured: boolean;
}) {
  const hasDiscount = product.sale_price && product.sale_price < displayPrice;
  const isLowStock = (product.available_quantity ?? 0) > 0 && (product.available_quantity ?? 0) <= 10;
  const isOutOfStock = (product.available_quantity ?? 0) <= 0;

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-300" data-dark-panel>
      {/* Product Image */}
      <div className="aspect-square relative overflow-hidden bg-zinc-800">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16 text-zinc-600" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {isFeatured && (
            <Badge className="bg-amber-500 text-black border-0 text-[10px] uppercase tracking-wider">
              Featured
            </Badge>
          )}
          {hasDiscount && (
            <Badge className="bg-red-500 text-white border-0 text-[10px] uppercase tracking-wider">
              Sale
            </Badge>
          )}
          {isOutOfStock && (
            <Badge className="bg-zinc-700 text-zinc-300 border-0 text-[10px] uppercase tracking-wider">
              Sold Out
            </Badge>
          )}
          {isLowStock && !isOutOfStock && (
            <Badge className="bg-amber-600 text-white border-0 text-[10px] uppercase tracking-wider">
              Low Stock
            </Badge>
          )}
        </div>

        {/* Quick actions overlay */}
        <div className="absolute bottom-3 left-3 right-3 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <Button
            size="sm"
            className="w-full text-white border-0 shadow-lg"
            style={{ backgroundColor: storePrimaryColor }}
            disabled={isOutOfStock}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </Button>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4 space-y-3">
        {/* Brand & Strain Type */}
        <div className="flex items-center gap-2 text-xs">
          {product.vendor_name && (
            <span className="text-zinc-500 uppercase tracking-wider">
              {product.vendor_name}
            </span>
          )}
          {product.strain_type && (
            <>
              {product.vendor_name && <span className="w-1 h-1 rounded-full bg-zinc-600" />}
              <Badge
                variant="outline"
                className={cn(
                  'border-zinc-700 text-[10px] uppercase',
                  product.strain_type.toLowerCase() === 'sativa' && 'text-yellow-400',
                  product.strain_type.toLowerCase() === 'indica' && 'text-purple-400',
                  product.strain_type.toLowerCase() === 'hybrid' && 'text-emerald-400'
                )}
              >
                {product.strain_type}
              </Badge>
            </>
          )}
        </div>

        {/* Name */}
        <h3 className="font-medium text-white line-clamp-2 leading-tight">
          {product.name}
        </h3>

        {/* THC/CBD Content */}
        {(product.thc_percent !== null || product.cbd_percent !== null) && (
          <div className="flex items-center gap-3 text-xs">
            {product.thc_percent !== null && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800">
                <span className="text-zinc-500">THC</span>
                <span className="font-medium text-emerald-400">{product.thc_percent}%</span>
              </div>
            )}
            {product.cbd_percent !== null && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800">
                <span className="text-zinc-500">CBD</span>
                <span className="font-medium text-blue-400">{product.cbd_percent}%</span>
              </div>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span
            className="text-lg font-semibold"
            style={{ color: storePrimaryColor }}
          >
            {formatCurrency(hasDiscount ? product.sale_price! : displayPrice)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-zinc-500 line-through">
              {formatCurrency(displayPrice)}
            </span>
          )}
        </div>

        {/* Category */}
        {product.category && (
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Tag className="w-3 h-3" />
            <span className="capitalize">{product.category}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Product Details Preview - mimics storefront product detail page
 */
function StorefrontProductDetail({
  product,
  displayPrice,
  storePrimaryColor,
}: {
  product: Product;
  displayPrice: number;
  storePrimaryColor: string;
}) {
  const hasDiscount = product.sale_price && product.sale_price < displayPrice;
  const isOutOfStock = (product.available_quantity ?? 0) <= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden" data-dark-panel>
      {/* Image Section */}
      <div className="aspect-square relative bg-zinc-800">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-24 h-24 text-zinc-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Details Section */}
      <div className="p-6 space-y-6">
        {/* Brand & Category */}
        <div className="flex items-center gap-3 text-sm">
          {product.vendor_name && (
            <span className="text-zinc-400 uppercase tracking-wider font-medium">
              {product.vendor_name}
            </span>
          )}
          {product.strain_type && (
            <>
              <span className="w-1 h-1 rounded-full bg-zinc-600" />
              <Badge
                variant="outline"
                className={cn(
                  'border-zinc-700',
                  product.strain_type.toLowerCase() === 'sativa' && 'text-yellow-400',
                  product.strain_type.toLowerCase() === 'indica' && 'text-purple-400',
                  product.strain_type.toLowerCase() === 'hybrid' && 'text-emerald-400'
                )}
              >
                {product.strain_type}
              </Badge>
            </>
          )}
        </div>

        {/* Name */}
        <h1 className="text-2xl font-light text-white leading-tight">
          {product.name}
        </h1>

        {/* Description */}
        {product.description && (
          <p className="text-zinc-400 text-sm leading-relaxed line-clamp-3">
            {product.description}
          </p>
        )}

        {/* THC/CBD */}
        {(product.thc_percent !== null || product.cbd_percent !== null) && (
          <div className="flex items-center gap-4">
            {product.thc_percent !== null && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700">
                <span className="text-xs uppercase tracking-wider text-zinc-500">THC</span>
                <span className="text-sm font-bold text-emerald-400">{product.thc_percent}%</span>
              </div>
            )}
            {product.cbd_percent !== null && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700">
                <span className="text-xs uppercase tracking-wider text-zinc-500">CBD</span>
                <span className="text-sm font-bold text-blue-400">{product.cbd_percent}%</span>
              </div>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-3">
          <span
            className="text-3xl font-medium"
            style={{ color: storePrimaryColor }}
          >
            {formatCurrency(hasDiscount ? product.sale_price! : displayPrice)}
          </span>
          {hasDiscount && (
            <span className="text-lg text-zinc-500 line-through">
              {formatCurrency(displayPrice)}
            </span>
          )}
        </div>

        {/* Stock Status */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isOutOfStock ? 'bg-red-500' : 'bg-emerald-500'
            )}
          />
          <span className={cn('text-sm', isOutOfStock ? 'text-red-400' : 'text-emerald-400')}>
            {isOutOfStock ? 'Out of Stock' : 'In Stock'}
          </span>
        </div>

        <Separator className="bg-zinc-800" />

        {/* Add to Cart Button */}
        <Button
          size="lg"
          className="w-full text-white border-0 h-12 text-lg"
          style={{ backgroundColor: storePrimaryColor }}
          disabled={isOutOfStock}
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
        </Button>

        {/* Effects */}
        {product.effects && product.effects.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-zinc-500">Effects</span>
            <div className="flex flex-wrap gap-2">
              {product.effects.map((effect, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="border-zinc-700 text-zinc-300"
                >
                  {effect}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Visibility Status Component
 */
function VisibilityStatus({ visible }: { visible: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 text-xs',
      visible ? 'text-emerald-500' : 'text-zinc-500'
    )}>
      {visible ? (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Visible</span>
        </>
      ) : (
        <>
          <X className="w-3.5 h-3.5" />
          <span>Hidden</span>
        </>
      )}
    </div>
  );
}

/**
 * Main ProductStorefrontPreview Component
 */
export function ProductStorefrontPreview({
  product,
  buttonVariant = 'outline',
  buttonSize = 'default',
  showLabel = true,
}: ProductStorefrontPreviewProps) {
  const { tenant } = useTenantAdminAuth();
  const [open, setOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'card' | 'detail'>('card');

  const { data, isLoading } = useProductStorefrontData(product.id, tenant?.id);

  const stores = data?.stores ?? [];
  const menus = data?.menus ?? [];

  // Get selected store or first store
  const selectedStore = stores.find(s => s.store.id === selectedStoreId) ?? stores[0];
  const displayPrice = selectedStore?.customPrice ?? product.retail_price ?? product.wholesale_price ?? 0;
  const storePrimaryColor = selectedStore?.store.primary_color ?? '#10b981';

  // Open storefront in new tab
  const handleOpenStorefront = () => {
    if (selectedStore?.store.slug) {
      window.open(`/shop/${selectedStore.store.slug}/products/${product.id}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize}>
          <Eye className="h-4 w-4" />
          {showLabel && <span className="ml-2">Preview on Storefront</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Storefront Preview
          </DialogTitle>
          <DialogDescription>
            See exactly how this product appears to customers on your storefront
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {/* Controls Bar */}
          <div className="px-6 py-4 bg-muted/30 border-b flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {/* Store Selector */}
              {stores.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Store:</span>
                  <Select
                    value={selectedStoreId ?? stores[0]?.store.id}
                    onValueChange={setSelectedStoreId}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.store.id} value={s.store.id}>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4" />
                            {s.store.store_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* View Mode Toggle */}
              <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as 'card' | 'detail')}>
                <TabsList className="h-9">
                  <TabsTrigger value="card" className="text-xs px-3">
                    Card View
                  </TabsTrigger>
                  <TabsTrigger value="detail" className="text-xs px-3">
                    Detail View
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Open in New Tab */}
            {selectedStore && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenStorefront}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Live
              </Button>
            )}
          </div>

          {/* Preview Content */}
          <ScrollArea className="flex-1 p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : stores.length === 0 && menus.length === 0 ? (
              <div className="text-center py-16">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Not on Any Storefront</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  This product is not currently visible on any active storefront or menu.
                  Add it to a storefront or menu to see how it will appear to customers.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Store Preview */}
                {stores.length > 0 && selectedStore && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        {selectedStore.store.store_name}
                      </h3>
                      <div className="flex items-center gap-3">
                        {selectedStore.isFeatured && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Featured
                          </Badge>
                        )}
                        <VisibilityStatus visible={selectedStore.isVisible} />
                        {selectedStore.customPrice && (
                          <Badge variant="secondary" className="text-xs">
                            Custom Price
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Preview Display */}
                    <div
                      className="rounded-xl p-6 bg-neutral-950"
                    >
                      {previewMode === 'card' ? (
                        <div className="max-w-xs mx-auto">
                          <StorefrontProductCard
                            product={product}
                            displayPrice={displayPrice}
                            storePrimaryColor={storePrimaryColor}
                            isFeatured={selectedStore.isFeatured}
                          />
                        </div>
                      ) : (
                        <StorefrontProductDetail
                          product={product}
                          displayPrice={displayPrice}
                          storePrimaryColor={storePrimaryColor}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Active Menus List */}
                {menus.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Leaf className="h-4 w-4" />
                      Active Menus ({menus.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {menus.map((m) => (
                        <div
                          key={m.menu.id}
                          className="p-4 border rounded-lg bg-muted/30 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium">{m.menu.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Price: {formatCurrency(m.customPrice ?? product.retail_price ?? 0)}
                              {m.customPrice && (
                                <Badge variant="secondary" className="text-xs ml-2">
                                  Custom
                                </Badge>
                              )}
                            </p>
                          </div>
                          <Badge>{m.menu.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product Data Summary */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-medium">Product Data (Customer View)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Display Price</span>
                      <p className="font-medium">{formatCurrency(displayPrice)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">In Stock</span>
                      <p className="font-medium">
                        {(product.available_quantity ?? 0) > 0 ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Category</span>
                      <p className="font-medium capitalize">{product.category ?? '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Visibility</span>
                      <p className="font-medium">
                        {product.menu_visibility ? 'Visible' : 'Hidden'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProductStorefrontPreview;
