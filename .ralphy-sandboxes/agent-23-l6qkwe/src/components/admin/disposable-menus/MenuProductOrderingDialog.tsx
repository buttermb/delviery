/**
 * Menu Product Ordering Dialog
 *
 * Dialog wrapper for the MenuProductOrdering component.
 * Fetches menu products and provides the ordering interface.
 */

import { useQuery } from '@tanstack/react-query';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { MenuProductOrdering } from '@/components/admin/disposable-menus/MenuProductOrdering';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import Package from 'lucide-react/dist/esm/icons/package';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import { queryKeys } from '@/lib/queryKeys';

interface MenuProductOrderingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuId: string;
  menuName: string;
}

export function MenuProductOrderingDialog({
  open,
  onOpenChange,
  menuId,
  menuName,
}: MenuProductOrderingDialogProps) {
  const { tenant } = useTenantAdminAuth();

  // Fetch menu products with product details
  const { data: menuProducts, isLoading, error } = useQuery({
    queryKey: queryKeys.menuProducts.ordering(menuId, tenant?.id),
    queryFn: async () => {
      if (!tenant?.id || !menuId) return [];

      const { data, error } = await supabase
        .from('disposable_menu_products')
        .select(`
          id,
          product_id,
          custom_price,
          display_order,
          products:product_id (
            id,
            name,
            price,
            image_url,
            category
          )
        `)
        .eq('menu_id', menuId)
        .order('display_order', { ascending: true });

      if (error) {
        logger.error('Failed to fetch menu products for ordering', error, {
          component: 'MenuProductOrderingDialog',
          menuId,
        });
        throw error;
      }

      // Transform the data to match expected format
      return (data ?? []).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        custom_price: item.custom_price,
        display_order: item.display_order,
        product: item.products as unknown as {
          id: string;
          name: string;
          price: number;
          image_url?: string;
          category?: string;
        } | null,
      })).filter(item => item.product !== null);
    },
    enabled: open && !!tenant?.id && !!menuId,
    staleTime: 30 * 1000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Reorder Products
          </DialogTitle>
          <DialogDescription>
            Drag and drop to reorder products and categories for "{menuName}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="space-y-4 p-4">
              <Skeleton className="h-10 w-full" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
              <p className="text-sm text-destructive">Failed to load menu products</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please try again later
              </p>
            </div>
          )}

          {!isLoading && !error && menuProducts && (
            <MenuProductOrdering
              menuId={menuId}
              menuProducts={menuProducts}
              showPreview={true}
              isLoading={isLoading}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MenuProductOrderingDialog;
