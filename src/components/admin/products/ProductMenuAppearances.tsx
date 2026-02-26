/**
 * ProductMenuAppearances - Shows which menus/storefronts feature this product
 *
 * Displays:
 * - List of active disposable menus with links
 * - List of marketplace stores with links
 * - Pricing on each menu (may differ from base price)
 * - Toggle to add/remove from menus directly
 *
 * Connects product module to menu/storefront module bidirectionally.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Menu from 'lucide-react/dist/esm/icons/menu';
import Store from 'lucide-react/dist/esm/icons/store';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Plus from 'lucide-react/dist/esm/icons/plus';

import X from 'lucide-react/dist/esm/icons/x';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { format, isPast } from 'date-fns';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import type { Database } from '@/integrations/supabase/types';

type DisposableMenu = Database['public']['Tables']['disposable_menus']['Row'];
type DisposableMenuProduct = Database['public']['Tables']['disposable_menu_products']['Row'];
type MarketplaceStore = Database['public']['Tables']['marketplace_stores']['Row'];
type MarketplaceProductSettings = Database['public']['Tables']['marketplace_product_settings']['Row'];

interface MenuAppearance {
  menu: DisposableMenu;
  menuProduct: DisposableMenuProduct;
  isExpired: boolean;
}

interface StoreAppearance {
  store: MarketplaceStore;
  settings: MarketplaceProductSettings;
}

interface ProductMenuAppearancesProps {
  productId: string | undefined;
  basePrice?: number | null;
}

/**
 * Hook to fetch all menu appearances for a product
 */
function useProductMenuAppearances(productId: string | undefined, tenantId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.products.all, 'menu-appearances', productId, tenantId],
    queryFn: async (): Promise<{ menus: MenuAppearance[]; stores: StoreAppearance[] }> => {
      if (!productId || !tenantId) {
        return { menus: [], stores: [] };
      }

      // Fetch disposable menu products with menu details
      const { data: menuProducts, error: menuError } = await supabase
        .from('disposable_menu_products')
        .select(`
          *,
          disposable_menus!inner (*)
        `)
        .eq('product_id', productId);

      if (menuError) {
        logger.error('Failed to fetch menu appearances', menuError, {
          component: 'ProductMenuAppearances',
          productId
        });
        throw menuError;
      }

      // Filter for tenant's menus and map to MenuAppearance
      const menus: MenuAppearance[] = (menuProducts ?? [])
        .filter((mp) => {
          const menu = mp.disposable_menus as unknown as DisposableMenu;
          return menu?.tenant_id === tenantId;
        })
        .map((mp) => {
          const menu = mp.disposable_menus as unknown as DisposableMenu;
          const isExpired = !menu.never_expires && menu.expiration_date
            ? isPast(new Date(menu.expiration_date))
            : false;

          return {
            menu,
            menuProduct: {
              ...mp,
              disposable_menus: undefined, // Remove nested data
            } as DisposableMenuProduct,
            isExpired,
          };
        });

      // Fetch marketplace product settings with store details
      const { data: storeSettings, error: storeError } = await supabase
        .from('marketplace_product_settings')
        .select(`
          *,
          marketplace_stores!inner (*)
        `)
        .eq('product_id', productId);

      if (storeError) {
        logger.error('Failed to fetch store appearances', storeError, {
          component: 'ProductMenuAppearances',
          productId
        });
        // Don't throw - just return menus without stores
        return { menus, stores: [] };
      }

      // Filter for tenant's stores and map to StoreAppearance
      const stores: StoreAppearance[] = (storeSettings ?? [])
        .filter((ss) => {
          const store = ss.marketplace_stores as unknown as MarketplaceStore;
          return store?.tenant_id === tenantId;
        })
        .map((ss) => {
          const store = ss.marketplace_stores as unknown as MarketplaceStore;
          return {
            store,
            settings: {
              ...ss,
              marketplace_stores: undefined, // Remove nested data
            } as MarketplaceProductSettings,
          };
        });

      return { menus, stores };
    },
    enabled: !!productId && !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch available menus to add product to
 */
function useAvailableMenus(productId: string | undefined, tenantId: string | undefined, existingMenuIds: string[]) {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'available-for-product', productId, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name, status, expiration_date, never_expires')
        .eq('tenant_id', tenantId)
        .not('status', 'in', '("burned","hard_burned","soft_burned")')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch available menus', error, { component: 'ProductMenuAppearances' });
        throw error;
      }

      // Filter out menus that already have this product
      return (data ?? []).filter(m => !existingMenuIds.includes(m.id));
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Hook to add product to a menu
 */
function useAddToMenu() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuId, productId, customPrice }: {
      menuId: string;
      productId: string;
      customPrice?: number;
    }) => {
      const { data, error } = await supabase
        .from('disposable_menu_products')
        .insert({
          menu_id: menuId,
          product_id: productId,
          custom_price: customPrice ?? null,
          display_availability: true,
          display_order: 0,
        })
        .select()
        .maybeSingle();

      if (error) {
        logger.error('Failed to add product to menu', error, {
          component: 'ProductMenuAppearances',
          menuId,
          productId
        });
        throw error;
      }

      return data;
    },
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.products.all, 'menu-appearances', productId]
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      showSuccessToast('Product added to menu');
    },
    onError: (error) => {
      showErrorToast('Failed to add product to menu');
      logger.error('Add to menu mutation failed', error as Error, { component: 'ProductMenuAppearances' });
    },
  });
}

/**
 * Hook to remove product from a menu
 */
function useRemoveFromMenu() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuProductId, productId: _productId }: { menuProductId: string; productId: string }) => {
      const { error } = await supabase
        .from('disposable_menu_products')
        .delete()
        .eq('id', menuProductId);

      if (error) {
        logger.error('Failed to remove product from menu', error, {
          component: 'ProductMenuAppearances',
          menuProductId
        });
        throw error;
      }
    },
    onSuccess: (_, { productId: _productId }) => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.products.all, 'menu-appearances', _productId]
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      showSuccessToast('Product removed from menu');
    },
    onError: (error) => {
      showErrorToast('Failed to remove product from menu');
      logger.error('Remove from menu mutation failed', error as Error, { component: 'ProductMenuAppearances' });
    },
  });
}

/**
 * Hook to toggle store visibility
 */
function useToggleStoreVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ settingsId, isVisible, productId: _productId }: {
      settingsId: string;
      isVisible: boolean;
      productId: string;
    }) => {
      const { error } = await supabase
        .from('marketplace_product_settings')
        .update({ is_visible: isVisible })
        .eq('id', settingsId);

      if (error) {
        logger.error('Failed to update store visibility', error, {
          component: 'ProductMenuAppearances',
          settingsId
        });
        throw error;
      }
    },
    onSuccess: (_, { productId: _productId }) => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.products.all, 'menu-appearances', _productId]
      });
      showSuccessToast('Store visibility updated');
    },
    onError: (error) => {
      showErrorToast('Failed to update visibility');
      logger.error('Toggle visibility mutation failed', error as Error, { component: 'ProductMenuAppearances' });
    },
  });
}

/**
 * Menu item display component
 */
function MenuAppearanceItem({
  appearance,
  onRemove,
  basePrice,
  isRemoving,
}: {
  appearance: MenuAppearance;
  onRemove: () => void;
  basePrice?: number | null;
  isRemoving: boolean;
}) {
  const { navigateToAdmin } = useTenantNavigation();
  const { menu, menuProduct, isExpired } = appearance;

  const displayPrice = menuProduct.custom_price ?? basePrice;
  const hasCustomPrice = menuProduct.custom_price !== null && menuProduct.custom_price !== basePrice;

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Menu className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateToAdmin(`menus/${menu.id}`)}
              className="font-medium truncate hover:text-primary hover:underline underline-offset-2 transition-colors text-left"
            >
              {menu.name}
            </button>
            <Badge
              variant={menu.status === 'active' ? 'default' : 'secondary'}
              className="shrink-0"
            >
              {menu.status}
            </Badge>
            {isExpired && (
              <Badge variant="destructive" className="shrink-0">
                Expired
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
            {displayPrice != null && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(displayPrice)}
                {hasCustomPrice && (
                  <Badge variant="outline" className="text-xs ml-1">Custom</Badge>
                )}
              </span>
            )}
            {menu.expiration_date && !menu.never_expires && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(menu.expiration_date), 'MMM d, yyyy')}
              </span>
            )}
            {menu.never_expires && (
              <span className="text-xs">No expiration</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={() => navigateToAdmin(`menus/${menu.id}`)}
          aria-label="View menu"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onRemove}
          disabled={isRemoving}
          aria-label="Remove from menu"
        >
          {isRemoving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Store item display component
 */
function StoreAppearanceItem({
  appearance,
  onToggleVisibility,
  basePrice,
  isUpdating,
}: {
  appearance: StoreAppearance;
  onToggleVisibility: (isVisible: boolean) => void;
  basePrice?: number | null;
  isUpdating: boolean;
}) {
  const { navigateToAdmin } = useTenantNavigation();
  const { store, settings } = appearance;

  const displayPrice = settings.custom_price ?? basePrice;
  const hasCustomPrice = settings.custom_price !== null && settings.custom_price !== basePrice;
  const isVisible = settings.is_visible ?? true;

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
          <Store className="h-4 w-4 text-green-600" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateToAdmin(`storefront/${store.id}`)}
              className="font-medium truncate hover:text-primary hover:underline underline-offset-2 transition-colors text-left"
            >
              {store.store_name}
            </button>
            <Badge
              variant={store.is_active ? 'default' : 'secondary'}
              className="shrink-0"
            >
              {store.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {settings.featured && (
              <Badge variant="outline" className="shrink-0 text-amber-600 border-amber-300">
                Featured
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
            {displayPrice != null && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(displayPrice)}
                {hasCustomPrice && (
                  <Badge variant="outline" className="text-xs ml-1">Custom</Badge>
                )}
              </span>
            )}
            {store.slug && (
              <span className="text-xs truncate max-w-[120px]">
                /{store.slug}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {isVisible ? (
            <Eye className="h-4 w-4 text-green-600" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <Switch
            checked={isVisible}
            onCheckedChange={onToggleVisibility}
            disabled={isUpdating}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={() => navigateToAdmin(`storefront/${store.id}`)}
          aria-label="View storefront"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Add to Menu Dialog
 */
function AddToMenuDialog({
  open,
  onOpenChange,
  productId,
  tenantId,
  existingMenuIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  tenantId: string;
  existingMenuIds: string[];
}) {
  const { data: availableMenus = [], isLoading } = useAvailableMenus(productId, tenantId, existingMenuIds);
  const addToMenu = useAddToMenu();
  const [addingMenuId, setAddingMenuId] = useState<string | null>(null);

  const handleAdd = async (menuId: string) => {
    setAddingMenuId(menuId);
    try {
      await addToMenu.mutateAsync({ menuId, productId });
      onOpenChange(false);
    } finally {
      setAddingMenuId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Menu</DialogTitle>
          <DialogDescription>
            Select a menu to add this product to
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : availableMenus.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Menu className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No available menus</p>
              <p className="text-sm mt-1">Create a new menu or product is already on all menus</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {availableMenus.map((menu) => {
                const isExpired = !menu.never_expires && menu.expiration_date
                  ? isPast(new Date(menu.expiration_date))
                  : false;
                const isAdding = addingMenuId === menu.id;

                return (
                  <div
                    key={menu.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{menu.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant={menu.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {menu.status}
                        </Badge>
                        {isExpired && (
                          <Badge variant="destructive" className="text-xs">
                            Expired
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAdd(menu.id)}
                      disabled={isAdding || addToMenu.isPending}
                    >
                      {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ProductMenuAppearances Component
 */
export function ProductMenuAppearances({ productId, basePrice }: ProductMenuAppearancesProps) {
  const { tenant } = useTenantAdminAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [menuToRemove, setMenuToRemove] = useState<{ menuProductId: string; menuName: string } | null>(null);

  const { data, isLoading, error } = useProductMenuAppearances(productId, tenant?.id);
  const removeFromMenu = useRemoveFromMenu();
  const toggleVisibility = useToggleStoreVisibility();

  const menus = data?.menus ?? [];
  const stores = data?.stores ?? [];
  const existingMenuIds = menus.map(m => m.menu.id);
  const totalAppearances = menus.length + stores.length;
  const activeMenus = menus.filter(m => !m.isExpired && m.menu.status === 'active');
  const activeStores = stores.filter(s => s.store.is_active && (s.settings.is_visible ?? true));

  const handleRemoveFromMenu = async () => {
    if (!productId || !menuToRemove) return;
    setRemovingId(menuToRemove.menuProductId);
    try {
      await removeFromMenu.mutateAsync({ menuProductId: menuToRemove.menuProductId, productId });
    } finally {
      setRemovingId(null);
      setDeleteDialogOpen(false);
      setMenuToRemove(null);
    }
  };

  const handleToggleVisibility = async (settingsId: string, isVisible: boolean) => {
    if (!productId) return;
    setUpdatingId(settingsId);
    try {
      await toggleVisibility.mutateAsync({ settingsId, isVisible, productId });
    } finally {
      setUpdatingId(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Menu className="h-4 w-4" />
            Menu &amp; Store Appearances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Menu className="h-4 w-4" />
            Menu &amp; Store Appearances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load menu appearances</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (totalAppearances === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Menu className="h-4 w-4" />
            Menu &amp; Store Appearances
          </CardTitle>
          <CardDescription>
            Where this product is featured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Menu className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Not featured on any menus or storefronts</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Menu
            </Button>
          </div>
        </CardContent>
        {productId && tenant?.id && (
          <AddToMenuDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            productId={productId}
            tenantId={tenant.id}
            existingMenuIds={existingMenuIds}
          />
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Menu className="h-4 w-4" />
              Menu &amp; Store Appearances
            </CardTitle>
            <CardDescription>
              Featured on {activeMenus.length} active menu{activeMenus.length !== 1 ? 's' : ''} and {activeStores.length} active store{activeStores.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to Menu
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="menus" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="menus" className="flex items-center gap-2">
              <Menu className="h-4 w-4" />
              Menus ({menus.length})
            </TabsTrigger>
            <TabsTrigger value="stores" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Stores ({stores.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menus" className="space-y-2">
            {menus.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Menu className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Not on any disposable menus</p>
              </div>
            ) : (
              menus.map((appearance) => (
                <MenuAppearanceItem
                  key={appearance.menuProduct.id}
                  appearance={appearance}
                  onRemove={() => { setMenuToRemove({ menuProductId: appearance.menuProduct.id, menuName: appearance.menu.name }); setDeleteDialogOpen(true); }}
                  basePrice={basePrice}
                  isRemoving={removingId === appearance.menuProduct.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="stores" className="space-y-2">
            {stores.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Not on any storefronts</p>
                <p className="text-sm mt-1">Add via Storefront Builder</p>
              </div>
            ) : (
              stores.map((appearance) => (
                <StoreAppearanceItem
                  key={appearance.settings.id}
                  appearance={appearance}
                  onToggleVisibility={(isVisible) =>
                    handleToggleVisibility(appearance.settings.id, isVisible)
                  }
                  basePrice={basePrice}
                  isUpdating={updatingId === appearance.settings.id}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {productId && tenant?.id && (
        <AddToMenuDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          productId={productId}
          tenantId={tenant.id}
          existingMenuIds={existingMenuIds}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleRemoveFromMenu}
        title="Remove from menu"
        description={menuToRemove ? `Are you sure you want to remove this product from "${menuToRemove.menuName}"? This action cannot be undone.` : undefined}
        itemType="menu appearance"
        isLoading={removeFromMenu.isPending}
      />
    </Card>
  );
}

export default ProductMenuAppearances;
