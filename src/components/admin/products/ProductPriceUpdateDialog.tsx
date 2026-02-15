/**
 * ProductPriceUpdateDialog
 *
 * Confirmation dialog for product price updates with menu sync.
 * Shows affected menus/storefronts before saving price changes.
 * Option to sync new price to menus or keep menu-specific pricing.
 * Publishes price_changed event to eventBus on successful update.
 *
 * Task 099: Create product price update with menu sync
 */

import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Check from 'lucide-react/dist/esm/icons/check';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Menu from 'lucide-react/dist/esm/icons/menu';
import Store from 'lucide-react/dist/esm/icons/store';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/eventBus';
import { formatCurrency } from '@/utils/formatters';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { useLogPriceChange } from '@/hooks/usePriceHistory';
import type { Database } from '@/integrations/supabase/types';

type DisposableMenu = Database['public']['Tables']['disposable_menus']['Row'];
type MarketplaceStore = Database['public']['Tables']['marketplace_stores']['Row'];

interface AffectedMenu {
  id: string;
  menuProductId: string;
  name: string;
  status: string;
  customPrice: number | null;
  type: 'menu';
}

interface AffectedStore {
  id: string;
  settingsId: string;
  name: string;
  isActive: boolean;
  customPrice: number | null;
  type: 'store';
}

type AffectedItem = AffectedMenu | AffectedStore;

export interface PriceUpdateData {
  productId: string;
  wholesalePriceOld: number | null;
  wholesalePriceNew: number | null;
  retailPriceOld: number | null;
  retailPriceNew: number | null;
  costPerUnitOld?: number | null;
  costPerUnitNew?: number | null;
  changeReason?: string;
}

interface ProductPriceUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceUpdate: PriceUpdateData | null;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * Hook to fetch affected menus/storefronts for a product
 */
function useAffectedMenusAndStores(
  productId: string | undefined,
  tenantId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: [...queryKeys.products.all, 'affected-menus', productId, tenantId],
    queryFn: async (): Promise<AffectedItem[]> => {
      if (!productId || !tenantId) {
        return [];
      }

      const affectedItems: AffectedItem[] = [];

      // Fetch disposable menu products with menu details
      const { data: menuProducts, error: menuError } = await supabase
        .from('disposable_menu_products')
        .select(`
          id,
          custom_price,
          disposable_menus!inner (
            id,
            name,
            status,
            tenant_id
          )
        `)
        .eq('product_id', productId);

      if (menuError) {
        logger.error('Failed to fetch affected menus', menuError, {
          component: 'ProductPriceUpdateDialog',
          productId,
        });
      } else if (menuProducts) {
        for (const mp of menuProducts) {
          const menu = mp.disposable_menus as unknown as DisposableMenu;
          if (menu?.tenant_id === tenantId && !['burned', 'hard_burned', 'soft_burned'].includes(menu.status ?? '')) {
            affectedItems.push({
              id: menu.id,
              menuProductId: mp.id,
              name: menu.name,
              status: menu.status ?? 'draft',
              customPrice: mp.custom_price,
              type: 'menu',
            });
          }
        }
      }

      // Fetch marketplace product settings with store details
      const { data: storeSettings, error: storeError } = await supabase
        .from('marketplace_product_settings')
        .select(`
          id,
          custom_price,
          marketplace_stores!inner (
            id,
            store_name,
            is_active,
            tenant_id
          )
        `)
        .eq('product_id', productId);

      if (storeError) {
        logger.error('Failed to fetch affected stores', storeError, {
          component: 'ProductPriceUpdateDialog',
          productId,
        });
      } else if (storeSettings) {
        for (const ss of storeSettings) {
          const store = ss.marketplace_stores as unknown as MarketplaceStore;
          if (store?.tenant_id === tenantId) {
            affectedItems.push({
              id: store.id,
              settingsId: ss.id,
              name: store.store_name,
              isActive: store.is_active ?? false,
              customPrice: ss.custom_price,
              type: 'store',
            });
          }
        }
      }

      return affectedItems;
    },
    enabled: enabled && !!productId && !!tenantId,
    staleTime: 10_000,
  });
}

/**
 * Hook to sync prices to menus and stores
 */
function useSyncPricesToMenus() {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async ({
      productId,
      newPrice,
      menuProductIds,
      storeSettingsIds,
    }: {
      productId: string;
      newPrice: number | null;
      menuProductIds: string[];
      storeSettingsIds: string[];
    }) => {
      const results = {
        menusUpdated: 0,
        storesUpdated: 0,
        errors: [] as string[],
      };

      // Update menu product prices
      if (menuProductIds.length > 0) {
        const { error: menuError, count } = await supabase
          .from('disposable_menu_products')
          .update({ custom_price: newPrice })
          .in('id', menuProductIds);

        if (menuError) {
          logger.error('Failed to sync prices to menus', menuError, {
            component: 'ProductPriceUpdateDialog',
            productId,
          });
          results.errors.push('Some menu prices failed to update');
        } else {
          results.menusUpdated = count ?? menuProductIds.length;
        }
      }

      // Update store product settings prices
      if (storeSettingsIds.length > 0) {
        const { error: storeError, count } = await supabase
          .from('marketplace_product_settings')
          .update({ custom_price: newPrice })
          .in('id', storeSettingsIds);

        if (storeError) {
          logger.error('Failed to sync prices to stores', storeError, {
            component: 'ProductPriceUpdateDialog',
            productId,
          });
          results.errors.push('Some store prices failed to update');
        } else {
          results.storesUpdated = count ?? storeSettingsIds.length;
        }
      }

      return results;
    },
    onSuccess: (_data, { productId }) => {
      // Invalidate product menu appearances query
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.products.all, 'menu-appearances', productId],
      });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.products.all, 'affected-menus', productId, tenant?.id],
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
    },
    onError: (error) => {
      logger.error('Price sync mutation failed', error, {
        component: 'ProductPriceUpdateDialog',
      });
    },
  });
}

/**
 * ProductPriceUpdateDialog Component
 */
export function ProductPriceUpdateDialog({
  open,
  onOpenChange,
  priceUpdate,
  onConfirm,
  onCancel,
}: ProductPriceUpdateDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [syncToMenus, setSyncToMenus] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: affectedItems = [], isLoading } = useAffectedMenusAndStores(
    priceUpdate?.productId,
    tenant?.id,
    open
  );

  const syncPrices = useSyncPricesToMenus();
  const logPriceChange = useLogPriceChange();

  // Separate menus and stores
  const { menus, stores, itemsWithCustomPrice, itemsWithBasePrice } = useMemo(() => {
    const menusList = affectedItems.filter((item): item is AffectedMenu => item.type === 'menu');
    const storesList = affectedItems.filter((item): item is AffectedStore => item.type === 'store');
    const withCustom = affectedItems.filter((item) => item.customPrice !== null);
    const withBase = affectedItems.filter((item) => item.customPrice === null);

    return {
      menus: menusList,
      stores: storesList,
      itemsWithCustomPrice: withCustom,
      itemsWithBasePrice: withBase,
    };
  }, [affectedItems]);

  // Calculate price change display
  const priceDisplay = useMemo(() => {
    if (!priceUpdate) return null;

    const { wholesalePriceOld, wholesalePriceNew, retailPriceOld, retailPriceNew } = priceUpdate;
    const changes: { label: string; old: number | null; new: number | null }[] = [];

    if (wholesalePriceOld !== wholesalePriceNew) {
      changes.push({
        label: 'Wholesale',
        old: wholesalePriceOld,
        new: wholesalePriceNew,
      });
    }

    if (retailPriceOld !== retailPriceNew) {
      changes.push({
        label: 'Retail',
        old: retailPriceOld,
        new: retailPriceNew,
      });
    }

    return changes;
  }, [priceUpdate]);

  // Handle dialog confirm
  const handleConfirm = async () => {
    if (!priceUpdate || !tenant?.id) return;

    setIsUpdating(true);

    try {
      // Log the price change first
      await logPriceChange.mutateAsync({
        productId: priceUpdate.productId,
        wholesalePriceOld: priceUpdate.wholesalePriceOld,
        wholesalePriceNew: priceUpdate.wholesalePriceNew,
        retailPriceOld: priceUpdate.retailPriceOld,
        retailPriceNew: priceUpdate.retailPriceNew,
        costPerUnitOld: priceUpdate.costPerUnitOld,
        costPerUnitNew: priceUpdate.costPerUnitNew,
        changeReason: priceUpdate.changeReason,
        changeSource: 'manual',
      });

      // If sync is enabled, update menu prices (only items using base price)
      if (syncToMenus && itemsWithBasePrice.length > 0) {
        const menuProductIds = itemsWithBasePrice
          .filter((item): item is AffectedMenu => item.type === 'menu')
          .map((item) => item.menuProductId);

        const storeSettingsIds = itemsWithBasePrice
          .filter((item): item is AffectedStore => item.type === 'store')
          .map((item) => item.settingsId);

        // Sync with null to remove custom price (use base product price)
        const result = await syncPrices.mutateAsync({
          productId: priceUpdate.productId,
          newPrice: null, // Setting to null means use base product price
          menuProductIds,
          storeSettingsIds,
        });

        if (result.errors.length === 0) {
          const totalUpdated = result.menusUpdated + result.storesUpdated;
          showSuccessToast(
            'Prices synced successfully',
            `Updated ${totalUpdated} menu${totalUpdated !== 1 ? 's' : ''} and store${totalUpdated !== 1 ? 's' : ''}`
          );
        }
      }

      // Publish price_changed event for cross-module sync
      eventBus.publish('price_changed', {
        productId: priceUpdate.productId,
        tenantId: tenant.id,
        wholesalePriceOld: priceUpdate.wholesalePriceOld,
        wholesalePriceNew: priceUpdate.wholesalePriceNew,
        retailPriceOld: priceUpdate.retailPriceOld,
        retailPriceNew: priceUpdate.retailPriceNew,
        changedAt: new Date().toISOString(),
      });

      logger.info('Product price updated with menu sync', {
        productId: priceUpdate.productId,
        syncToMenus,
        affectedMenus: menus.length,
        affectedStores: stores.length,
      });

      // Invalidate queries - use products.all to match existing patterns
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.products.all, 'detail'],
      });

      // Build toast message
      const updatedList: string[] = [];
      if (syncToMenus && itemsWithBasePrice.length > 0) {
        const menuNames = itemsWithBasePrice
          .filter((item) => item.type === 'menu')
          .map((item) => item.name);
        const storeNames = itemsWithBasePrice
          .filter((item) => item.type === 'store')
          .map((item) => item.name);

        if (menuNames.length > 0) {
          updatedList.push(`Menus: ${menuNames.slice(0, 3).join(', ')}${menuNames.length > 3 ? ` +${menuNames.length - 3} more` : ''}`);
        }
        if (storeNames.length > 0) {
          updatedList.push(`Stores: ${storeNames.slice(0, 3).join(', ')}${storeNames.length > 3 ? ` +${storeNames.length - 3} more` : ''}`);
        }
      }

      if (updatedList.length > 0) {
        showSuccessToast('Price updated', updatedList.join(' • '));
      } else {
        showSuccessToast('Price updated successfully');
      }

      // Call parent confirm handler
      onConfirm();
      onOpenChange(false);
    } catch (error) {
      logger.error('Failed to update product price', error as Error, {
        component: 'ProductPriceUpdateDialog',
        productId: priceUpdate.productId,
      });
      showErrorToast('Failed to update price', 'Please try again');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle dialog cancel
  const handleCancel = () => {
    setSyncToMenus(false);
    onCancel?.();
    onOpenChange(false);
  };

  if (!priceUpdate) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Confirm Price Update
          </AlertDialogTitle>
          <AlertDialogDescription>
            You're about to change the product price. This may affect menus and storefronts
            featuring this product.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Price Changes */}
          {priceDisplay && priceDisplay.length > 0 && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="text-sm font-medium">Price Changes</div>
              {priceDisplay.map((change, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{change.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="line-through text-muted-foreground">
                      {change.old !== null ? formatCurrency(change.old) : 'Not set'}
                    </span>
                    <span className="text-lg">→</span>
                    <span className="font-semibold text-primary">
                      {change.new !== null ? formatCurrency(change.new) : 'Not set'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Affected Menus and Stores */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Affected Menus & Stores</div>
              {!isLoading && affectedItems.length > 0 && (
                <Badge variant="secondary">
                  {affectedItems.length} item{affectedItems.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : affectedItems.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                <Menu className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p>This product is not featured on any menus or stores</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2 pr-4">
                  {menus.map((menu) => (
                    <div
                      key={menu.id}
                      className="flex items-center justify-between p-2 rounded-md border bg-background"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Menu className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm truncate">{menu.name}</span>
                        <Badge
                          variant={menu.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs shrink-0"
                        >
                          {menu.status}
                        </Badge>
                      </div>
                      {menu.customPrice !== null ? (
                        <Badge variant="outline" className="text-xs shrink-0">
                          Custom: {formatCurrency(menu.customPrice)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">Base price</span>
                      )}
                    </div>
                  ))}
                  {stores.map((store) => (
                    <div
                      key={store.id}
                      className="flex items-center justify-between p-2 rounded-md border bg-background"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Store className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="text-sm truncate">{store.name}</span>
                        <Badge
                          variant={store.isActive ? 'default' : 'secondary'}
                          className="text-xs shrink-0"
                        >
                          {store.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {store.customPrice !== null ? (
                        <Badge variant="outline" className="text-xs shrink-0">
                          Custom: {formatCurrency(store.customPrice)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">Base price</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Sync Option */}
            {affectedItems.length > 0 && (
              <div className="pt-2 border-t">
                {itemsWithCustomPrice.length > 0 && (
                  <div className="flex items-start gap-2 mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      {itemsWithCustomPrice.length} item{itemsWithCustomPrice.length !== 1 ? 's have' : ' has'} custom
                      pricing and will not be affected by this change.
                    </p>
                  </div>
                )}

                {itemsWithBasePrice.length > 0 && (
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="sync-to-menus"
                      checked={syncToMenus}
                      onCheckedChange={(checked) => setSyncToMenus(checked as boolean)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="sync-to-menus" className="cursor-pointer flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Sync price to {itemsWithBasePrice.length} item{itemsWithBasePrice.length !== 1 ? 's' : ''}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Items using base price will automatically reflect the new price.
                        Uncheck to keep them using the old price via custom pricing.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isUpdating}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isUpdating}
            className="gap-2"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirm Update
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ProductPriceUpdateDialog;
