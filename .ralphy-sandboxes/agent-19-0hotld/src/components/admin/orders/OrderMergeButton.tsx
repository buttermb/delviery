import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Merge from "lucide-react/dist/esm/icons/merge";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Package from "lucide-react/dist/esm/icons/package";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  user_id: string;
  user?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  order_items?: Array<{
    id: string;
    product_id: string;
    product_name?: string;
    quantity: number;
    price: number;
  }>;
}

interface OrderMergeDialogProps {
  /** List of selected orders to potentially merge */
  selectedOrders: Order[];
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when merge is successful */
  onSuccess?: () => void;
}

interface OrderMergeButtonProps extends Omit<OrderMergeDialogProps, 'open' | 'onOpenChange'> {
  /** Disabled state */
  disabled?: boolean;
  /** Variant for the button */
  variant?: 'default' | 'outline' | 'ghost';
}

/**
 * Dialog component for merging orders - can be controlled externally
 */
export function OrderMergeDialog({
  selectedOrders,
  open,
  onOpenChange,
  onSuccess,
}: OrderMergeDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetOrderId, setTargetOrderId] = useState<string>('');

  // Group orders by customer (user_id)
  const ordersByCustomer = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    for (const order of selectedOrders) {
      const key = order.user_id || 'unknown';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);
    }
    return groups;
  }, [selectedOrders]);

  // Find the largest group with same customer for merge
  const mergeableOrders = useMemo(() => {
    const groups = Object.values(ordersByCustomer);
    const largestSameCustomerGroup = groups.find(g => g.length >= 2);
    return largestSameCustomerGroup ?? [];
  }, [ordersByCustomer]);

  // Can we merge? Need at least 2 orders from same customer
  const canMerge = mergeableOrders.length >= 2;

  // Calculate merged total
  const mergedTotal = useMemo(() => {
    return mergeableOrders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
  }, [mergeableOrders]);

  // Get customer name for display
  const customerName = useMemo(() => {
    if (mergeableOrders.length === 0) return '';
    const order = mergeableOrders[0];
    return order.user?.full_name || order.user?.email || order.user?.phone || 'Unknown Customer';
  }, [mergeableOrders]);

  // Reset targetOrderId when dialog opens or mergeableOrders changes
  useEffect(() => {
    if (open && mergeableOrders.length > 0) {
      setTargetOrderId(mergeableOrders[0].id);
    }
  }, [open, mergeableOrders]);

  // Reset targetOrderId when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTargetOrderId('');
    }
    onOpenChange(newOpen);
  };

  const handleMerge = async () => {
    if (!tenant?.id || !targetOrderId || mergeableOrders.length < 2) {
      toast.error('Invalid merge configuration');
      return;
    }

    setIsSubmitting(true);

    try {
      const targetOrder = mergeableOrders.find(o => o.id === targetOrderId);
      const sourceOrders = mergeableOrders.filter(o => o.id !== targetOrderId);

      if (!targetOrder || sourceOrders.length === 0) {
        throw new Error('Invalid order selection');
      }

      // 1. Fetch all order items from source orders
      const sourceOrderIds = sourceOrders.map(o => o.id);
      const { data: sourceItems, error: itemsError } = await supabase
        .from('order_items')
        .select('id, order_id')
        .in('order_id', sourceOrderIds);

      if (itemsError) {
        throw itemsError;
      }

      // 2. Move all source order items to target order
      if (sourceItems && sourceItems.length > 0) {
        const { error: updateItemsError } = await supabase
          .from('order_items')
          .update({ order_id: targetOrderId })
          .in('order_id', sourceOrderIds);

        if (updateItemsError) {
          throw updateItemsError;
        }
      }

      // 3. Calculate new total amount
      const newTotal = mergeableOrders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
      const newSubtotal = mergeableOrders.reduce((sum, order) => {
        // Estimate subtotal if not available (total - delivery_fee typically)
        return sum + (order.total_amount ?? 0);
      }, 0);

      // 4. Update target order with new totals
      const mergeNote = `[MERGED] Combined from orders: ${sourceOrders.map(o => o.order_number || o.id.slice(0, 8)).join(', ')}`;
      const { error: updateTargetError } = await supabase
        .from('orders')
        .update({
          total_amount: newTotal,
          subtotal: newSubtotal,
          delivery_notes: mergeNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetOrderId)
        .eq('tenant_id', tenant.id);

      if (updateTargetError) {
        throw updateTargetError;
      }

      // 5. Mark source orders as merged (cancelled with special reason)
      const { error: cancelSourceError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          delivery_notes: `[MERGED INTO #${targetOrder.order_number || targetOrder.id.slice(0, 8)}] This order was merged.`,
          updated_at: new Date().toISOString(),
        })
        .in('id', sourceOrderIds)
        .eq('tenant_id', tenant.id);

      if (cancelSourceError) {
        throw cancelSourceError;
      }

      // 6. Invalidate queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

      // Success
      logger.info('Orders merged successfully', {
        targetOrderId,
        sourceOrderIds,
        newTotal,
        component: 'OrderMergeDialog',
      });

      toast.success(
        `Merged ${sourceOrders.length + 1} orders into #${targetOrder.order_number || targetOrder.id.slice(0, 8)}`,
        {
          description: `New total: ${formatCurrency(newTotal)}`,
        }
      );

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to merge orders', error instanceof Error ? error : new Error(String(error)), {
        component: 'OrderMergeDialog',
      });
      toast.error('Failed to merge orders', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Orders
          </DialogTitle>
          <DialogDescription>
            {canMerge ? (
              <>Combine {mergeableOrders.length} orders from <strong>{customerName}</strong> into a single order.</>
            ) : (
              <>Select at least 2 orders from the same customer to merge them.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {!canMerge ? (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-400">
                Cannot merge selected orders
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You need to select at least 2 orders from the same customer to merge them.
                {selectedOrders.length > 0 && (
                  <span className="block mt-1">
                    Currently selected: {selectedOrders.length} order(s) from different customers.
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Orders summary */}
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Orders to merge:</span>
                <span className="font-medium">{mergeableOrders.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Combined Total:</span>
                <span className="font-mono font-bold text-lg">{formatCurrency(mergedTotal)}</span>
              </div>
            </div>

            {/* Select target order */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Select the order to keep (items from other orders will be added here):
              </Label>
              <ScrollArea className="h-[200px] rounded-md border p-3">
                <RadioGroup value={targetOrderId} onValueChange={setTargetOrderId}>
                  {mergeableOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        targetOrderId === order.id
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                      onClick={() => setTargetOrderId(order.id)}
                    >
                      <RadioGroupItem value={order.id} id={order.id} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold">
                            #{order.order_number || order.id.slice(0, 8)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatSmartDate(order.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(order.total_amount)}
                          </span>
                          {order.order_items && (
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {order.order_items.length} items
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </ScrollArea>
            </div>

            {/* Warning */}
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
              <p className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <span>
                  The other {mergeableOrders.length - 1} order(s) will be marked as cancelled and their items
                  transferred to the selected order.
                </span>
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={isSubmitting || !canMerge || !targetOrderId}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Merge className="h-4 w-4 mr-2" />
                Merge {mergeableOrders.length} Orders
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
export function OrderMergeButton({
  selectedOrders,
  onSuccess,
  disabled = false,
  variant = 'outline',
}: OrderMergeButtonProps) {
  const [open, setOpen] = useState(false);

  // Group orders by customer (user_id)
  const ordersByCustomer = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    for (const order of selectedOrders) {
      const key = order.user_id || 'unknown';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);
    }
    return groups;
  }, [selectedOrders]);

  // Find the largest group with same customer for merge
  const mergeableOrders = useMemo(() => {
    const groups = Object.values(ordersByCustomer);
    const largestSameCustomerGroup = groups.find(g => g.length >= 2);
    return largestSameCustomerGroup ?? [];
  }, [ordersByCustomer]);

  // Can we merge? Need at least 2 orders from same customer
  const canMerge = mergeableOrders.length >= 2;

  // Get customer name for display
  const customerName = useMemo(() => {
    if (mergeableOrders.length === 0) return '';
    const order = mergeableOrders[0];
    return order.user?.full_name || order.user?.email || order.user?.phone || 'Unknown Customer';
  }, [mergeableOrders]);

  // Don't render if not enough orders selected
  if (selectedOrders.length < 2) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled || !canMerge}
        title={
          !canMerge
            ? 'Select at least 2 orders from the same customer to merge'
            : `Merge ${mergeableOrders.length} orders from ${customerName}`
        }
      >
        <Merge className="h-4 w-4 mr-2" />
        Merge Orders
      </Button>

      <OrderMergeDialog
        selectedOrders={selectedOrders}
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}
