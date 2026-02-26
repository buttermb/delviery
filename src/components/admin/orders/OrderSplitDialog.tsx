/**
 * OrderSplitDialog - Split one order into multiple orders
 *
 * Use case: Customer wants to ship some items now and some later.
 * Split creates new order(s) with selected items, adjusts original order totals.
 * Both orders reference the original via parent_order_id.
 * Activity log tracks the split. Customer can see all related orders.
 */

import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Scissors from 'lucide-react/dist/esm/icons/scissors';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Package from 'lucide-react/dist/esm/icons/package';
import ArrowRightLeft from 'lucide-react/dist/esm/icons/arrow-right-left';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';
import { logActivity } from '@/lib/activityLog';
import { unifiedOrdersKeys } from '@/hooks/useUnifiedOrders';

interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sku?: string | null;
  quantity_unit?: string;
  metadata?: Record<string, unknown>;
}

interface Order {
  id: string;
  order_number: string;
  tenant_id: string;
  order_type: string;
  source: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: string | null;
  payment_status: string;
  customer_id: string | null;
  wholesale_client_id: string | null;
  menu_id: string | null;
  shift_id: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  courier_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  metadata?: Record<string, unknown>;
  items?: OrderItem[];
}

interface OrderSplitDialogProps {
  /** The order to split */
  order: Order;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when split is successful */
  onSuccess?: (newOrderId: string) => void;
}

interface OrderSplitButtonProps {
  /** The order to split */
  order: Order;
  /** Disabled state */
  disabled?: boolean;
  /** Variant for the button */
  variant?: 'default' | 'outline' | 'ghost';
  /** Size for the button */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Callback when split is successful */
  onSuccess?: (newOrderId: string) => void;
}

/**
 * Dialog component for splitting orders - can be controlled externally
 */
export function OrderSplitDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: OrderSplitDialogProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const orderItems = useMemo(() => order.items ?? [], [order.items]);

  // Calculate totals for split and remaining
  const { splitItems, remainingItems, splitTotal, remainingTotal } = useMemo(() => {
    const split = orderItems.filter((item) => selectedItemIds.has(item.id));
    const remaining = orderItems.filter((item) => !selectedItemIds.has(item.id));

    const splitSum = split.reduce((sum, item) => sum + (item.total_price ?? 0), 0);
    const remainingSum = remaining.reduce((sum, item) => sum + (item.total_price ?? 0), 0);

    return {
      splitItems: split,
      remainingItems: remaining,
      splitTotal: splitSum,
      remainingTotal: remainingSum,
    };
  }, [orderItems, selectedItemIds]);

  // Can we split? Need at least 1 item selected and at least 1 remaining
  const canSplit = splitItems.length > 0 && remainingItems.length > 0;

  // Toggle item selection
  const toggleItem = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Select all / deselect all
  const toggleAll = useCallback(() => {
    if (selectedItemIds.size === orderItems.length) {
      setSelectedItemIds(new Set());
    } else if (selectedItemIds.size === orderItems.length - 1) {
      // Don't select all - need at least 1 remaining
      setSelectedItemIds(new Set());
    } else {
      // Select all but one (first item remains)
      const allButFirst = orderItems.slice(1).map((item) => item.id);
      setSelectedItemIds(new Set(allButFirst));
    }
  }, [orderItems, selectedItemIds.size]);

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSelectedItemIds(new Set());
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Split mutation
  const splitMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !admin?.id) {
        throw new Error('Authentication required');
      }

      if (!canSplit) {
        throw new Error('Invalid split configuration');
      }

      // 1. Create new order with selected items
      const newOrderData = {
        tenant_id: tenant.id,
        order_type: order.order_type,
        source: order.source,
        status: 'pending',
        subtotal: splitTotal,
        tax_amount: 0, // Will be recalculated if needed
        discount_amount: 0,
        total_amount: splitTotal,
        payment_method: order.payment_method,
        payment_status: 'unpaid',
        customer_id: order.customer_id,
        wholesale_client_id: order.wholesale_client_id,
        menu_id: order.menu_id,
        shift_id: null, // New order, no POS shift
        delivery_address: order.delivery_address,
        delivery_notes: `[SPLIT FROM #${order.order_number}] ${order.delivery_notes ?? ''}`.trim(),
        courier_id: null, // Courier needs to be reassigned
        contact_name: order.contact_name,
        contact_phone: order.contact_phone,
        metadata: {
          ...(order.metadata || {}),
          parent_order_id: order.id,
          parent_order_number: order.order_number,
          split_at: new Date().toISOString(),
          split_by: admin.id,
        },
      };

      const { data: newOrder, error: createError } = await supabase
        .from('unified_orders')
        .insert(newOrderData)
        .select('id, order_number')
        .maybeSingle();

      if (createError) {
        logger.error('Failed to create split order', createError, {
          component: 'OrderSplitDialog',
          originalOrderId: order.id,
        });
        throw new Error(createError.message);
      }

      // 2. Move selected items to new order
      const itemUpdates = splitItems.map((item) => ({
        id: item.id,
        order_id: newOrder.id,
      }));

      for (const update of itemUpdates) {
        const { error: moveError } = await supabase
          .from('unified_order_items')
          .update({ order_id: update.order_id })
          .eq('id', update.id);

        if (moveError) {
          logger.warn('Failed to move order item', {
            itemId: update.id,
            error: moveError.message,
            component: 'OrderSplitDialog',
          });
        }
      }

      // 3. Update original order totals
      const { error: updateOriginalError } = await supabase
        .from('unified_orders')
        .update({
          subtotal: remainingTotal,
          total_amount: remainingTotal,
          delivery_notes: `[SPLIT - See also #${newOrder.order_number}] ${order.delivery_notes ?? ''}`.trim(),
          metadata: {
            ...(order.metadata || {}),
            split_orders: [
              ...((order.metadata as Record<string, unknown>)?.split_orders as string[] ?? []),
              newOrder.id,
            ],
            last_split_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('tenant_id', tenant.id);

      if (updateOriginalError) {
        logger.warn('Failed to update original order after split', {
          orderId: order.id,
          error: updateOriginalError.message,
          component: 'OrderSplitDialog',
        });
      }

      // 4. Log activity for both orders
      await logActivity(
        tenant.id,
        admin.id,
        'updated',
        'order',
        order.id,
        {
          action: 'split',
          split_to_order_id: newOrder.id,
          split_to_order_number: newOrder.order_number,
          items_moved: splitItems.length,
          original_total: order.total_amount,
          remaining_total: remainingTotal,
          split_total: splitTotal,
        }
      );

      await logActivity(
        tenant.id,
        admin.id,
        'created',
        'order',
        newOrder.id,
        {
          action: 'split_from',
          parent_order_id: order.id,
          parent_order_number: order.order_number,
          items_count: splitItems.length,
          total: splitTotal,
        }
      );

      return {
        newOrderId: newOrder.id,
        newOrderNumber: newOrder.order_number,
      };
    },
    onSuccess: (result) => {
      // Invalidate queries — both original and new order, plus related data
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.detail(order.id) });
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.detail(result.newOrderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });

      toast.success('Order split successfully', {
        description: `Created new order #${result.newOrderNumber}`,
        action: {
          label: 'View',
          onClick: () => navigateToAdmin(`orders/${result.newOrderId}`),
        },
      });

      handleOpenChange(false);
      onSuccess?.(result.newOrderId);
    },
    onError: (error: Error) => {
      logger.error('Order split failed', error, { component: 'OrderSplitDialog' });
      toast.error('Failed to split order', {
        description: humanizeError(error),
      });
    },
  });

  const handleSplit = useCallback(() => {
    setIsSubmitting(true);
    splitMutation.mutate(undefined, {
      onSettled: () => setIsSubmitting(false),
    });
  }, [splitMutation]);

  // Don't render if order has less than 2 items
  if (orderItems.length < 2) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Cannot Split Order
            </DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Not enough items</AlertTitle>
            <AlertDescription>
              This order only has {orderItems.length} item(s). You need at least 2 items to split
              an order.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Split Order #{order.order_number}
          </DialogTitle>
          <DialogDescription>
            Select items to move to a new order. The remaining items will stay in the original
            order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Items selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Select items to split off:</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="text-xs"
              >
                {selectedItemIds.size > 0 ? 'Clear selection' : 'Select items'}
              </Button>
            </div>

            <ScrollArea className="h-[250px] rounded-md border p-3">
              <div className="space-y-2">
                {orderItems.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  const isLastRemaining =
                    !isSelected && remainingItems.length === 1;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted/50'
                      } ${isLastRemaining ? 'opacity-50' : 'cursor-pointer'}`}
                      onClick={() => !isLastRemaining && toggleItem(item.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isLastRemaining}
                        onCheckedChange={() => !isLastRemaining && toggleItem(item.id)}
                        aria-label={`Select ${item.product_name}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{item.product_name}</span>
                          {item.sku && (
                            <Badge variant="outline" className="text-xs">
                              {item.sku}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Qty: {item.quantity}</span>
                          <span>@ {formatCurrency(item.unit_price)}</span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(item.total_price)}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          Moving
                        </Badge>
                      )}
                      {isLastRemaining && (
                        <Badge variant="secondary" className="text-xs">
                          Must stay
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Split preview */}
          {canSplit && (
            <div className="grid grid-cols-2 gap-4">
              {/* Original order */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>Original Order</span>
                  <Badge variant="outline">#{order.order_number}</Badge>
                </div>
                <Separator />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span>{remainingItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Total:</span>
                    <span className="font-mono font-medium">{formatCurrency(remainingTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden sm:flex">
                <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* New order */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>New Order</span>
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    Will be created
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items:</span>
                    <span>{splitItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-mono font-medium">{formatCurrency(splitTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          {canSplit && (
            <Alert className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                The new order will need its courier assigned separately. Both orders will reference
                each other for tracking purposes.
              </AlertDescription>
            </Alert>
          )}

          {!canSplit && selectedItemIds.size > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You must leave at least one item in the original order.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSplit} disabled={isSubmitting || !canSplit}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Splitting...
              </>
            ) : (
              <>
                <Scissors className="h-4 w-4 mr-2" />
                Split Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Button component that includes its own dialog - for standalone use
 */
export function OrderSplitButton({
  order,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  onSuccess,
}: OrderSplitButtonProps) {
  const [open, setOpen] = useState(false);

  const orderItems = order.items ?? [];
  const canSplit = orderItems.length >= 2;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        disabled={disabled || !canSplit}
        title={!canSplit ? 'Order needs at least 2 items to split' : 'Split this order'}
      >
        <Scissors className="h-4 w-4 mr-2" />
        Split Order
      </Button>

      <OrderSplitDialog
        order={order}
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}

export default OrderSplitDialog;
