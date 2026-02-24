/**
 * LowStockToPODialog Component
 *
 * Creates purchase orders from low stock alerts.
 * - Groups low stock items by vendor
 * - Pre-fills vendor, product, and suggested quantity from reorder settings
 * - Multiple items from same vendor grouped into one PO
 * - Creates draft PO for review before sending
 *
 * Directly connects inventory alerts to vendor ordering workflow.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Building2 from 'lucide-react/dist/esm/icons/building-2';
import Package from 'lucide-react/dist/esm/icons/package';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import type { LowStockProduct } from '@/hooks/useLowStockAlerts';

// ============================================================================
// Types
// ============================================================================

interface LowStockWithVendor extends LowStockProduct {
  vendor_id: string | null;
  vendor_name: string | null;
  cost_per_unit: number | null;
  reorder_quantity: number | null;
}

interface VendorGroup {
  vendorId: string;
  vendorName: string;
  items: LowStockWithVendor[];
  totalEstimatedCost: number;
}

interface SelectedItem {
  productId: string;
  quantity: number;
  unitCost: number;
}

interface LowStockToPODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected product IDs (from stock alerts page) */
  preSelectedProductIds?: string[];
  /** Callback when POs are created */
  onSuccess?: (createdPOIds: string[]) => void;
}

// ============================================================================
// Component
// ============================================================================

export function LowStockToPODialog({
  open,
  onOpenChange,
  preSelectedProductIds = [],
  onSuccess,
}: LowStockToPODialogProps) {
  const navigate = useNavigate();
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  // Selection state: Map<productId, SelectedItem>
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());

  // ============================================================================
  // Fetch low stock products with vendor info
  // ============================================================================

  const { data: lowStockProducts, isLoading } = useQuery({
    queryKey: [...queryKeys.stockAlerts.active(tenantId), 'with-vendors'],
    queryFn: async (): Promise<LowStockWithVendor[]> => {
      if (!tenantId) return [];

      // Fetch products below low stock threshold with vendor info
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, name, category, available_quantity, stock_quantity, low_stock_alert, vendor_id, vendor_name, cost_per_unit, reorder_quantity'
        )
        .eq('tenant_id', tenantId)
        .or('available_quantity.lte.low_stock_alert,available_quantity.eq.0,available_quantity.is.null')
        .order('available_quantity', { ascending: true });

      if (error) {
        logger.error('Failed to fetch low stock products with vendor info', error, {
          component: 'LowStockToPODialog',
          tenantId,
        });
        throw new Error(error.message);
      }

      return (data || []).map((p) => {
        const available = p.available_quantity ?? p.stock_quantity ?? 0;
        const threshold = p.low_stock_alert ?? 10;

        let alertLevel: LowStockProduct['alertLevel'] = 'warning';
        if (available <= 0) {
          alertLevel = 'out_of_stock';
        } else if (available <= threshold * 0.25) {
          alertLevel = 'critical';
        }

        return {
          id: p.id,
          name: p.name,
          stockQuantity: p.stock_quantity ?? 0,
          availableQuantity: available,
          lowStockThreshold: threshold,
          category: p.category ?? '',
          alertLevel,
          vendor_id: p.vendor_id,
          vendor_name: p.vendor_name,
          cost_per_unit: p.cost_per_unit,
          reorder_quantity: p.reorder_quantity,
        };
      });
    },
    enabled: !!tenantId && open,
    staleTime: 30000,
  });

  // ============================================================================
  // Group products by vendor
  // ============================================================================

  const vendorGroups = useMemo((): VendorGroup[] => {
    if (!lowStockProducts) return [];

    const grouped = new Map<string, VendorGroup>();
    const noVendorKey = '__no_vendor__';

    lowStockProducts.forEach((product) => {
      const key = product.vendor_id || noVendorKey;
      const vendorName = product.vendor_name || 'No Vendor Assigned';

      if (!grouped.has(key)) {
        grouped.set(key, {
          vendorId: key,
          vendorName,
          items: [],
          totalEstimatedCost: 0,
        });
      }

      const group = grouped.get(key);
      if (!group) return;
      group.items.push(product);

      // Calculate estimated cost for this item
      const suggestedQty = calculateSuggestedQuantity(product);
      const cost = suggestedQty * (product.cost_per_unit || 0);
      group.totalEstimatedCost += cost;
    });

    // Sort: vendors with items first, then no vendor at the end
    return Array.from(grouped.values()).sort((a, b) => {
      if (a.vendorId === noVendorKey) return 1;
      if (b.vendorId === noVendorKey) return -1;
      return a.vendorName.localeCompare(b.vendorName);
    });
  }, [lowStockProducts]);

  // ============================================================================
  // Initialize selection from preSelectedProductIds
  // ============================================================================

  useMemo(() => {
    if (preSelectedProductIds.length > 0 && lowStockProducts) {
      const newSelection = new Map<string, SelectedItem>();

      preSelectedProductIds.forEach((productId) => {
        const product = lowStockProducts.find((p) => p.id === productId);
        if (product && product.vendor_id) {
          newSelection.set(productId, {
            productId,
            quantity: calculateSuggestedQuantity(product),
            unitCost: product.cost_per_unit || 0,
          });
        }
      });

      if (newSelection.size > 0) {
        setSelectedItems(newSelection);
      }
    }
  }, [preSelectedProductIds, lowStockProducts]);

  // ============================================================================
  // Selection handlers
  // ============================================================================

  const toggleItemSelection = useCallback(
    (product: LowStockWithVendor, checked: boolean) => {
      setSelectedItems((prev) => {
        const newMap = new Map(prev);

        if (checked) {
          newMap.set(product.id, {
            productId: product.id,
            quantity: calculateSuggestedQuantity(product),
            unitCost: product.cost_per_unit || 0,
          });
        } else {
          newMap.delete(product.id);
        }

        return newMap;
      });
    },
    []
  );

  const toggleVendorGroup = useCallback(
    (group: VendorGroup, checked: boolean) => {
      setSelectedItems((prev) => {
        const newMap = new Map(prev);

        group.items.forEach((product) => {
          // Only include items with a vendor
          if (!product.vendor_id) return;

          if (checked) {
            newMap.set(product.id, {
              productId: product.id,
              quantity: calculateSuggestedQuantity(product),
              unitCost: product.cost_per_unit || 0,
            });
          } else {
            newMap.delete(product.id);
          }
        });

        return newMap;
      });
    },
    []
  );

  const updateItemQuantity = useCallback((productId: string, quantity: number) => {
    setSelectedItems((prev) => {
      const newMap = new Map(prev);
      const item = newMap.get(productId);

      if (item) {
        newMap.set(productId, { ...item, quantity: Math.max(1, quantity) });
      }

      return newMap;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!lowStockProducts) return;

    const newSelection = new Map<string, SelectedItem>();

    lowStockProducts.forEach((product) => {
      if (product.vendor_id) {
        newSelection.set(product.id, {
          productId: product.id,
          quantity: calculateSuggestedQuantity(product),
          unitCost: product.cost_per_unit || 0,
        });
      }
    });

    setSelectedItems(newSelection);
  }, [lowStockProducts]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Map());
  }, []);

  // ============================================================================
  // Create POs mutation
  // ============================================================================

  const createPOsMutation = useMutation({
    mutationFn: async (): Promise<string[]> => {
      if (!tenantId) throw new Error('No tenant context');
      if (selectedItems.size === 0) throw new Error('No items selected');

      // Group selected items by vendor
      const vendorItems = new Map<string, SelectedItem[]>();

      selectedItems.forEach((item) => {
        const product = lowStockProducts?.find((p) => p.id === item.productId);
        if (!product?.vendor_id) return;

        const vendorId = product.vendor_id;
        if (!vendorItems.has(vendorId)) {
          vendorItems.set(vendorId, []);
        }
        const vendorItemList = vendorItems.get(vendorId);
        if (vendorItemList) vendorItemList.push(item);
      });

      if (vendorItems.size === 0) {
        throw new Error('No items with assigned vendors selected');
      }

      logger.info('Creating purchase orders from low stock alerts', {
        component: 'LowStockToPODialog',
        vendorCount: vendorItems.size,
        totalItems: selectedItems.size,
      });

      const createdPOIds: string[] = [];
      const errors: string[] = [];

      // Create a PO for each vendor
      for (const [vendorId, items] of vendorItems) {
        try {
          const { data, error } = await supabase.functions.invoke('create-purchase-order', {
            body: {
              supplier_id: vendorId,
              notes: 'Auto-generated from low stock alerts',
              status: 'draft',
              items: items.map((item) => ({
                product_id: item.productId,
                quantity_lbs: item.quantity,
                unit_cost: item.unitCost,
              })),
            },
          });

          if (error) {
            logger.error('Failed to create PO for vendor', error, {
              component: 'LowStockToPODialog',
              vendorId,
            });
            errors.push(`Vendor ${vendorId}: ${error.message}`);
            continue;
          }

          if (data?.error) {
            errors.push(`Vendor ${vendorId}: ${data.error}`);
            continue;
          }

          if (data?.purchase_order?.id) {
            createdPOIds.push(data.purchase_order.id);
            logger.info('Created PO from low stock', {
              component: 'LowStockToPODialog',
              poId: data.purchase_order.id,
              vendorId,
              itemCount: items.length,
            });
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Vendor ${vendorId}: ${errorMessage}`);
          logger.error('Exception creating PO', err, {
            component: 'LowStockToPODialog',
            vendorId,
          });
        }
      }

      if (createdPOIds.length === 0 && errors.length > 0) {
        throw new Error(`Failed to create any POs: ${errors.join('; ')}`);
      }

      return createdPOIds;
    },
    onSuccess: (createdPOIds) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });

      const count = createdPOIds.length;
      toast.success(
        `Created ${count} draft purchase order${count !== 1 ? 's' : ''}. Review before sending.`
      );

      onSuccess?.(createdPOIds);
      onOpenChange(false);

      // Navigate to purchase orders page to review
      if (tenantSlug) {
        navigate(`/${tenantSlug}/admin/purchase-orders`);
      }
    },
    onError: (error: Error) => {
      logger.error('Failed to create purchase orders', error, {
        component: 'LowStockToPODialog',
      });
      toast.error(humanizeError(error, 'Failed to create purchase orders'));
    },
  });

  // ============================================================================
  // Computed values
  // ============================================================================

  const selectedCount = selectedItems.size;
  const totalSelectedCost = useMemo(() => {
    let total = 0;
    selectedItems.forEach((item) => {
      total += item.quantity * item.unitCost;
    });
    return total;
  }, [selectedItems]);

  const selectedVendorCount = useMemo(() => {
    const vendors = new Set<string>();
    selectedItems.forEach((item) => {
      const product = lowStockProducts?.find((p) => p.id === item.productId);
      if (product?.vendor_id) {
        vendors.add(product.vendor_id);
      }
    });
    return vendors.size;
  }, [selectedItems, lowStockProducts]);

  const hasItemsWithoutVendor = useMemo(() => {
    return lowStockProducts?.some((p) => !p.vendor_id) || false;
  }, [lowStockProducts]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Create Purchase Orders from Low Stock
          </DialogTitle>
          <DialogDescription>
            Select items to include in purchase orders. Items will be grouped by vendor.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : vendorGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-success mb-4 opacity-50" />
            <h3 className="text-lg font-medium">All Stock Levels Healthy</h3>
            <p className="text-muted-foreground mt-1">
              No products are currently below their low stock threshold.
            </p>
          </div>
        ) : (
          <>
            {/* Selection controls */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
              </div>
            </div>

            {hasItemsWithoutVendor && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <span className="text-yellow-800 dark:text-yellow-200">
                  Some items have no vendor assigned and cannot be added to a purchase order.
                </span>
              </div>
            )}

            {/* Vendor groups */}
            <ScrollArea className="flex-1 pr-4">
              <Accordion type="multiple" defaultValue={vendorGroups.map((g) => g.vendorId)}>
                {vendorGroups.map((group) => {
                  const hasVendor = group.vendorId !== '__no_vendor__';
                  const groupSelectedCount = group.items.filter(
                    (item) => selectedItems.has(item.id)
                  ).length;
                  const allSelected =
                    hasVendor && groupSelectedCount === group.items.length;
                  const someSelected = hasVendor && groupSelectedCount > 0 && !allSelected;

                  return (
                    <AccordionItem key={group.vendorId} value={group.vendorId}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3">
                            {hasVendor && (
                              <Checkbox
                                checked={allSelected}
                                ref={(el) => {
                                  if (el) {
                                    (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected;
                                  }
                                }}
                                onCheckedChange={(checked) =>
                                  toggleVendorGroup(group, checked as boolean)
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{group.vendorName}</span>
                            <Badge variant="secondary" className="text-xs">
                              {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          {hasVendor && (
                            <Badge variant="outline" className="text-xs">
                              Est. ${group.totalEstimatedCost.toFixed(2)}
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 pl-8">
                          {group.items.map((product) => {
                            const isSelected = selectedItems.has(product.id);
                            const selectedItem = selectedItems.get(product.id);
                            const suggestedQty = calculateSuggestedQuantity(product);

                            return (
                              <div
                                key={product.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                  product.alertLevel === 'out_of_stock'
                                    ? 'border-destructive/50 bg-destructive/5'
                                    : product.alertLevel === 'critical'
                                    ? 'border-red-500/50 bg-red-50 dark:bg-red-950'
                                    : 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950'
                                }`}
                              >
                                {hasVendor ? (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) =>
                                      toggleItemSelection(product, checked as boolean)
                                    }
                                  />
                                ) : (
                                  <div className="w-4" />
                                )}

                                <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">
                                    {product.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Stock: {product.availableQuantity} / Threshold:{' '}
                                    {product.lowStockThreshold}
                                    {product.category && (
                                      <span className="ml-2">({product.category})</span>
                                    )}
                                  </div>
                                </div>

                                <Badge
                                  variant={
                                    product.alertLevel === 'out_of_stock'
                                      ? 'destructive'
                                      : product.alertLevel === 'critical'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                  className="text-xs flex-shrink-0"
                                >
                                  {product.alertLevel === 'out_of_stock'
                                    ? 'Out'
                                    : product.alertLevel}
                                </Badge>

                                {isSelected && hasVendor && (
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`qty-${product.id}`} className="text-xs sr-only">
                                      Quantity
                                    </Label>
                                    <Input
                                      id={`qty-${product.id}`}
                                      type="number"
                                      min={1}
                                      value={selectedItem?.quantity || suggestedQty}
                                      onChange={(e) =>
                                        updateItemQuantity(
                                          product.id,
                                          parseInt(e.target.value, 10) || 1
                                        )
                                      }
                                      className="w-20 h-8 text-sm"
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      @ ${(product.cost_per_unit || 0).toFixed(2)}
                                    </span>
                                  </div>
                                )}

                                {!hasVendor && (
                                  <span className="text-xs text-muted-foreground italic">
                                    No vendor
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </ScrollArea>

            {/* Summary */}
            {selectedCount > 0 && (
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Selected Items:</span>
                  <span className="font-medium">{selectedCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Purchase Orders to Create:</span>
                  <span className="font-medium">{selectedVendorCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Estimated Total:</span>
                  <span className="font-medium text-primary">
                    ${totalSelectedCost.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createPOsMutation.mutate()}
            disabled={selectedCount === 0 || createPOsMutation.isPending}
          >
            {createPOsMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create {selectedVendorCount > 0 ? selectedVendorCount : ''} Draft PO
            {selectedVendorCount !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateSuggestedQuantity(product: LowStockWithVendor): number {
  // Use reorder_quantity if set, otherwise calculate based on threshold
  if (product.reorder_quantity && product.reorder_quantity > 0) {
    return product.reorder_quantity;
  }

  // Default: order enough to reach 2x threshold
  const threshold = product.lowStockThreshold;
  const current = product.availableQuantity;
  const target = threshold * 2;
  const needed = Math.ceil(target - current);

  // Minimum order of 1 unit, round up to nearest 5
  return Math.max(1, Math.ceil(needed / 5) * 5);
}

export default LowStockToPODialog;
