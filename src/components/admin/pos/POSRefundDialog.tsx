import { useState, useMemo, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UnifiedOrder, UnifiedOrderItem } from '@/hooks/useUnifiedOrders';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import Search from 'lucide-react/dist/esm/icons/search';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Package from 'lucide-react/dist/esm/icons/package';
import { sanitizeTextareaInput } from '@/lib/utils/sanitize';
import { useDirtyFormGuard } from '@/hooks/useDirtyFormGuard';
import { formatSmartDate, formatCurrency } from '@/lib/formatters';
import { humanizeError } from '@/lib/humanizeError';

const REFUND_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'original_method', label: 'Original Payment Method' },
] as const;

type RefundMethodValue = (typeof REFUND_METHODS)[number]['value'];

const refundFormSchema = z.object({
  refundAmount: z.number().positive('Refund amount must be greater than zero'),
  refundMethod: z.enum(['cash', 'original_method'] as const),
  notes: z.string().max(500).optional(),
});

type RefundFormValues = z.infer<typeof refundFormSchema>;

export interface RefundCompletionData {
  refundAmount: number;
  refundMethod: string;
  originalOrderNumber: string;
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  notes?: string;
}

interface POSRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onRefundComplete?: (data: RefundCompletionData) => void;
  shiftId?: string;
}

export function POSRefundDialog({
  open,
  onOpenChange,
  onSuccess,
  onRefundComplete,
  shiftId,
}: POSRefundDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  // Order search state
  const [orderSearch, setOrderSearch] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Fetch order by order_number when search is submitted
  const {
    data: foundOrder,
    isLoading: isSearching,
    error: searchError,
  } = useQuery({
    queryKey: [...queryKeys.orders.all, 'pos-refund-lookup', searchSubmitted, tenantId],
    queryFn: async () => {
      if (!tenantId || !searchSubmitted) return null;

      const { data, error } = await supabase
        .from('unified_orders')
        .select(`
          id, order_number, order_type, status, total_amount,
          payment_method, payment_status, subtotal, tax_amount, discount_amount,
          tenant_id, created_at,
          unified_order_items (
            id, product_id, product_name, sku, quantity, unit_price, total_price
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('order_number', searchSubmitted.trim())
        .maybeSingle();

      if (error) {
        logger.error('POS refund order lookup failed', error, { component: 'POSRefundDialog' });
        throw error;
      }

      return data as (Pick<
        UnifiedOrder,
        'id' | 'order_number' | 'order_type' | 'status' | 'total_amount' |
        'payment_method' | 'payment_status' | 'subtotal' | 'tax_amount' |
        'discount_amount' | 'tenant_id' | 'created_at'
      > & { unified_order_items: UnifiedOrderItem[] }) | null;
    },
    enabled: !!tenantId && !!searchSubmitted,
  });

  const orderItems = useMemo(() => foundOrder?.unified_order_items ?? [], [foundOrder?.unified_order_items]);

  // Calculate refund amount from selected items
  const selectedRefundTotal = useMemo(() => {
    return orderItems
      .filter((item) => selectedItems.has(item.id))
      .reduce((sum, item) => sum + item.total_price, 0);
  }, [orderItems, selectedItems]);

  // Form
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RefundFormValues>({
    resolver: zodResolver(refundFormSchema),
    defaultValues: {
      refundAmount: 0,
      refundMethod: 'cash',
      notes: '',
    },
  });

  const currentRefundAmount = watch('refundAmount');

  // Update refund amount when selected items change
  const handleItemToggle = (itemId: string, checked: boolean) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      // Calculate total from new selection
      const total = orderItems
        .filter((item) => next.has(item.id))
        .reduce((sum, item) => sum + item.total_price, 0);
      setValue('refundAmount', total);
      return next;
    });
  };

  // Select/deselect all items
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(orderItems.map((item) => item.id));
      setSelectedItems(allIds);
      setValue('refundAmount', foundOrder?.total_amount ?? 0);
    } else {
      setSelectedItems(new Set());
      setValue('refundAmount', 0);
    }
  };

  // Handle order search
  const handleSearch = () => {
    if (orderSearch.trim()) {
      setSearchSubmitted(orderSearch.trim());
      setSelectedItems(new Set());
      reset({ refundAmount: 0, refundMethod: 'cash', notes: '' });
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Validation
  const canSubmit = useMemo(() => {
    if (!foundOrder) return false;
    if (foundOrder.payment_status === 'unpaid') return false;
    if (foundOrder.status === 'refunded') return false;
    if (selectedItems.size === 0) return false;
    if (currentRefundAmount <= 0) return false;
    if (currentRefundAmount > foundOrder.total_amount) return false;
    return true;
  }, [foundOrder, selectedItems, currentRefundAmount]);

  // Reset dialog state
  const resetDialog = () => {
    setOrderSearch('');
    setSearchSubmitted('');
    setSelectedItems(new Set());
    reset({ refundAmount: 0, refundMethod: 'cash', notes: '' });
  };

  // Dirty state: order found and items selected or form modified
  const isDirty = selectedItems.size > 0 || currentRefundAmount > 0;

  const handleClose = useCallback(() => {
    resetDialog();
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetDialog is a stable function that only calls setState and reset
  }, [onOpenChange]);

  const { guardedOnOpenChange, dialogContentProps, DiscardAlert } = useDirtyFormGuard(isDirty, handleClose);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      guardedOnOpenChange(false);
      return;
    }
    if (!newOpen) {
      resetDialog();
    }
    onOpenChange(newOpen);
  };

  // POS refund mutation
  const refundMutation = useMutation({
    mutationFn: async (values: RefundFormValues) => {
      if (!foundOrder || !tenantId) throw new Error('Missing order or tenant');

      const refundedItemIds = orderItems
        .filter((item) => selectedItems.has(item.id))
        .map((item) => item.id);

      // Create a negative transaction record (refund) in pos_transactions
      const refundClient = supabase as unknown as {
        from: (table: string) => ReturnType<typeof supabase.from>;
      };

      const resolvedMethod = values.refundMethod === 'original_method'
        ? (foundOrder.payment_method || 'cash')
        : 'cash';

      const { error: refundError } = await refundClient
        .from('pos_transactions')
        .insert({
          tenant_id: tenantId,
          order_id: foundOrder.id,
          transaction_type: 'refund',
          amount: -values.refundAmount,
          payment_method: resolvedMethod,
          shift_id: shiftId || null,
          notes: values.notes ? sanitizeTextareaInput(values.notes, 500) : null,
          refunded_items: refundedItemIds,
          created_at: new Date().toISOString(),
        });

      if (refundError) {
        logger.error('POS refund creation failed', refundError, { component: 'POSRefundDialog' });
        throw refundError;
      }

      // Restore stock for returned items (increment stock_quantity)
      const itemsToRestore = orderItems.filter((item) => selectedItems.has(item.id));
      for (const item of itemsToRestore) {
        if (!item.product_id) continue;
        try {
          const { data: product } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (product) {
            await supabase
              .from('products')
              .update({
                stock_quantity: (product.stock_quantity ?? 0) + item.quantity,
              })
              .eq('id', item.product_id)
              .eq('tenant_id', tenantId);
          }
        } catch (stockErr) {
          logger.error('Stock restore failed for item', stockErr, {
            component: 'POSRefundDialog',
            productId: item.product_id,
          });
          // Don't block refund for stock restore failure
        }
      }

      // Update order status if full refund
      if (values.refundAmount >= foundOrder.total_amount) {
        await supabase
          .from('unified_orders')
          .update({ status: 'refunded', payment_status: 'refunded' })
          .eq('id', foundOrder.id)
          .eq('tenant_id', tenantId);
      }

      // Return data for onSuccess callback (receipt printing)
      return {
        refundAmount: values.refundAmount,
        refundMethod: resolvedMethod,
        originalOrderNumber: foundOrder.order_number,
        items: itemsToRestore.map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
          price: item.unit_price,
          subtotal: item.total_price,
        })),
        notes: values.notes || undefined,
      } satisfies RefundCompletionData;
    },
    onSuccess: (data) => {
      // Invalidate affected queries
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.transactions(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

      toast.success('Refund processed', {
        description: `${formatCurrency(data.refundAmount)} refunded for order ${data.originalOrderNumber}`,
      });

      onRefundComplete?.(data);
      handleOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => {
      logger.error('POS refund failed', err, { component: 'POSRefundDialog' });
      toast.error('Refund failed', { description: humanizeError(err) });
    },
  });

  // Submit refund
  const onSubmit = (values: RefundFormValues) => {
    refundMutation.mutate(values);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" {...dialogContentProps}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            POS Refund / Return
          </DialogTitle>
          <DialogDescription>
            Search for a previous transaction to process a return.
          </DialogDescription>
        </DialogHeader>

        {/* Order Search */}
        <div className="space-y-2">
          <Label htmlFor="refund-order-search">Order Number</Label>
          <div className="flex gap-2">
            <Input
              id="refund-order-search"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Enter order number (e.g., ORD-001)"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSearch}
              disabled={!orderSearch.trim() || isSearching}
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Search Results */}
        {isSearching && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {searchSubmitted && !isSearching && !foundOrder && !searchError && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No order found with number &quot;{searchSubmitted}&quot;.
            </AlertDescription>
          </Alert>
        )}

        {searchError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error searching for order. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {foundOrder && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Order Summary */}
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Order</span>
                <span className="font-medium">{foundOrder.order_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-semibold">{formatCurrency(foundOrder.total_amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline">{foundOrder.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payment</span>
                <Badge variant="outline">{foundOrder.payment_method || 'N/A'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="text-sm">
                  {formatSmartDate(foundOrder.created_at)}
                </span>
              </div>
            </div>

            {foundOrder.status === 'refunded' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>This order has already been refunded.</AlertDescription>
              </Alert>
            )}

            {foundOrder.payment_status === 'unpaid' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Cannot refund an unpaid order.</AlertDescription>
              </Alert>
            )}

            {/* Items to Refund */}
            {orderItems.length > 0 && foundOrder.status !== 'refunded' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select Items to Return</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all-refund"
                      checked={selectedItems.size === orderItems.length && orderItems.length > 0}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                    <Label htmlFor="select-all-refund" className="text-sm cursor-pointer">
                      Select All
                    </Label>
                  </div>
                </div>

                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {orderItems.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={(checked) => handleItemToggle(item.id, !!checked)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.product_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.quantity} x {formatCurrency(item.unit_price)}
                        </div>
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(item.total_price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Refund Amount */}
            <div className="space-y-2">
              <Label htmlFor="pos-refund-amount">Refund Amount <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              <Controller
                name="refundAmount"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    id="pos-refund-amount"
                    value={field.value?.toString() ?? ''}
                    onValueChange={(val) => field.onChange(val ?? 0)}
                    placeholder="0.00"
                    className={errors.refundAmount ? 'border-destructive' : ''}
                  />
                )}
              />
              {errors.refundAmount && (
                <p className="text-sm text-destructive">{errors.refundAmount.message}</p>
              )}
              {selectedItems.size > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                  ({formatCurrency(selectedRefundTotal)})
                </p>
              )}
            </div>

            {/* Refund Method */}
            <div className="space-y-2">
              <Label htmlFor="pos-refund-method">Refund Method <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              <Controller
                name="refundMethod"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val as RefundMethodValue)}
                  >
                    <SelectTrigger id="pos-refund-method">
                      <SelectValue placeholder="Select refund method" />
                    </SelectTrigger>
                    <SelectContent>
                      {REFUND_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.refundMethod && (
                <p className="text-sm text-destructive">{errors.refundMethod.message}</p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="pos-refund-notes">Notes (Optional)</Label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    id="pos-refund-notes"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Reason for return..."
                    rows={2}
                  />
                )}
              />
              {errors.notes && (
                <p className="text-sm text-destructive">{errors.notes.message}</p>
              )}
            </div>

            {/* Refund Summary */}
            {currentRefundAmount > 0 && (
              <Alert>
                <AlertDescription className="flex items-center justify-between">
                  <span className="font-medium">Refund Total:</span>
                  <span className="text-lg font-bold">{formatCurrency(currentRefundAmount)}</span>
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => guardedOnOpenChange(false)}
                disabled={refundMutation.isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit || refundMutation.isPending}
                className="flex-1"
              >
                {refundMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Process Refund (${formatCurrency(currentRefundAmount)})`
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
    <DiscardAlert />
    </>
  );
}
