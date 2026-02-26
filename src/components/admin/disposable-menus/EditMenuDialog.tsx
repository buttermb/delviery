import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Pencil } from 'lucide-react';

import type { Menu as _Menu } from '@/components/admin/disposable-menus/MenuCard';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useWholesaleInventory } from '@/hooks/useWholesaleData';
import { queryKeys } from '@/lib/queryKeys';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { sanitizeFormInput } from '@/lib/utils/sanitize';
import { logger } from '@/lib/logger';
import { useDirtyFormGuard } from '@/hooks/useDirtyFormGuard';

// ============================================
// Schema
// ============================================

const editMenuSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  expirationDate: z.string().optional(),
  neverExpires: z.boolean(),
  selectedProducts: z.array(z.string()).min(0),
});

type EditMenuFormValues = z.infer<typeof editMenuSchema>;

// ============================================
// Props
// ============================================

interface EditMenuDialogProps {
  menuId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================
// Component
// ============================================

export function EditMenuDialog({ menuId, open, onOpenChange, onSuccess }: EditMenuDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [productSearch, setProductSearch] = useState('');

  // Fetch current menu data
  const { data: menuData, isLoading: isLoadingMenu } = useQuery({
    queryKey: queryKeys.editMenu.byMenu(menuId),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      const { data, error } = await supabase
        .from('disposable_menus')
        .select(`
          id, name, expiration_date, never_expires, tenant_id,
          disposable_menu_products(id, product_id, custom_price, display_order)
        `)
        .eq('id', menuId)
        .eq('tenant_id', tenant.id)
        .maybeSingle() as { data: {
          id: string;
          name: string;
          expiration_date: string | null;
          never_expires: boolean;
          tenant_id: string;
          disposable_menu_products: Array<{
            id: string;
            product_id: string;
            custom_price: number | null;
            display_order: number;
          }>;
        } | null; error: { message: string } | null };

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: open && !!menuId && !!tenant?.id,
    staleTime: 0,
  });

  // Fetch products for checkbox list
  const { data: products, isLoading: isLoadingProducts } = useWholesaleInventory(tenant?.id);

  // Form setup
  const form = useForm<EditMenuFormValues>({
    resolver: zodResolver(editMenuSchema),
    defaultValues: {
      name: '',
      expirationDate: '',
      neverExpires: true,
      selectedProducts: [],
    },
  });

  // Reset form when menu data loads or dialog closes
  useEffect(() => {
    if (menuData && open) {
      const currentProductIds = menuData.disposable_menu_products?.map(
        (p: { product_id: string }) => p.product_id
      ) ?? [];

      form.reset({
        name: menuData.name ?? '',
        expirationDate: menuData.expiration_date
          ? menuData.expiration_date.slice(0, 16) // format for datetime-local input
          : '',
        neverExpires: menuData.never_expires ?? true,
        selectedProducts: currentProductIds,
      });
    }
    if (!open) {
      form.reset({
        name: '',
        expirationDate: '',
        neverExpires: true,
        selectedProducts: [],
      });
      setProductSearch('');
    }
  }, [menuData, open, form]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p: { product_name: string; category?: string | null }) =>
        p.product_name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (values: EditMenuFormValues) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const sanitizedName = sanitizeFormInput(values.name, 100);

      // 1. Update menu record
      const menuUpdate: Record<string, unknown> = {
        name: sanitizedName,
        never_expires: values.neverExpires,
      };

      if (!values.neverExpires && values.expirationDate) {
        menuUpdate.expiration_date = new Date(values.expirationDate).toISOString();
      } else if (values.neverExpires) {
        menuUpdate.expiration_date = null;
      }

      const { error: menuError } = await supabase
        .from('disposable_menus')
        .update(menuUpdate)
        .eq('id', menuId)
        .eq('tenant_id', tenant.id);

      if (menuError) throw new Error(menuError.message);

      // 2. Sync products — delete existing, insert new set
      const { error: deleteError } = await supabase
        .from('disposable_menu_products')
        .delete()
        .eq('menu_id', menuId);

      if (deleteError) throw new Error(deleteError.message);

      if (values.selectedProducts.length > 0) {
        const productRows = values.selectedProducts.map((productId, index) => ({
          menu_id: menuId,
          product_id: productId,
          display_order: index,
          display_availability: true,
          is_encrypted: false,
        }));

        const { error: insertError } = await supabase
          .from('disposable_menu_products')
          .insert(productRows);

        if (insertError) throw new Error(insertError.message);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.editMenu.byMenu(menuId) });
      showSuccessToast('Menu Updated', 'Menu name, products, and expiration updated successfully');
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : 'Failed to update menu';
      logger.error('Edit menu failed', { error, menuId, component: 'EditMenuDialog' });
      showErrorToast('Update Failed', msg);
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    updateMutation.mutate(values);
  });

  const selectedProducts = form.watch('selectedProducts');
  const neverExpires = form.watch('neverExpires');
  const isLoading = isLoadingMenu || isLoadingProducts;

  const { guardedOnOpenChange, dialogContentProps, DiscardAlert } = useDirtyFormGuard(
    form.formState.isDirty,
    () => onOpenChange(false)
  );

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" {...dialogContentProps}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit Menu
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !menuData ? (
          <div className="text-center py-8 text-muted-foreground">
            Menu not found
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Menu Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Menu Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter menu name"
                        maxLength={100}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Expiration */}
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="neverExpires"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Never expires</FormLabel>
                    </FormItem>
                  )}
                />

                {!neverExpires && (
                  <FormField
                    control={form.control}
                    name="expirationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration Date</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Products */}
              <div className="space-y-3">
                <Label>Products ({selectedProducts.length} selected)</Label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    aria-label="Search products"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="border rounded-md max-h-64 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      {productSearch ? 'No products match your search' : 'No products available'}
                    </div>
                  ) : (
                    filteredProducts.map((product: { id: string; product_name: string; category?: string | null; price_per_lb?: number }) => {
                      const isChecked = selectedProducts.includes(product.id);
                      return (
                        <label
                          key={product.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const current = form.getValues('selectedProducts');
                              if (checked) {
                                form.setValue('selectedProducts', [...current, product.id]);
                              } else {
                                form.setValue(
                                  'selectedProducts',
                                  current.filter((id) => id !== product.id)
                                );
                              }
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {product.product_name}
                            </div>
                            {product.category && (
                              <div className="text-xs text-muted-foreground">
                                {product.category}
                              </div>
                            )}
                          </div>
                          {product.price_per_lb != null && product.price_per_lb > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ${product.price_per_lb.toFixed(2)}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
    <DiscardAlert />
    </>
  );
}
