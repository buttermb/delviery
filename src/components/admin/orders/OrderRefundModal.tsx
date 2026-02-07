import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import Package from "lucide-react/dist/esm/icons/package";
import { toast } from 'sonner';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { invalidateOnEvent } from '@/lib/invalidation';
import { unifiedOrdersKeys, type UnifiedOrder, type UnifiedOrderItem } from '@/hooks/useUnifiedOrders';
import { sanitizeTextareaInput } from '@/lib/utils/sanitize';

type RefundType = 'full' | 'partial';
type RefundReason = 'customer_request' | 'duplicate' | 'fraudulent' | 'product_issue' | 'shipping_issue' | 'other';
type RefundMethod = 'original_payment' | 'store_credit' | 'cash' | 'check';

interface OrderRefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: UnifiedOrder | null;
  onSuccess?: () => void;
}

interface RefundInput {
  orderId: string;
  refundType: RefundType;
  amount: number;
  reason: RefundReason;
  refundMethod: RefundMethod;
  notes: string | null;
  restoreInventory: boolean;
  lineItems?: { itemId: string; quantity: number; amount: number }[];
}

const REFUND_REASONS: { value: RefundReason; label: string }[] = [
  { value: 'customer_request', label: 'Customer Request' },
  { value: 'duplicate', label: 'Duplicate Order' },
  { value: 'fraudulent', label: 'Fraudulent Order' },
  { value: 'product_issue', label: 'Product Issue / Defective' },
  { value: 'shipping_issue', label: 'Shipping / Delivery Issue' },
  { value: 'other', label: 'Other' },
];

const REFUND_METHODS: { value: RefundMethod; label: string }[] = [
  { value: 'original_payment', label: 'Original Payment Method' },
  { value: 'store_credit', label: 'Store Credit' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
];

export function OrderRefundModal({
  open,
  onOpenChange,
  order,
  onSuccess,
}: OrderRefundModalProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Form state
  const [refundType, setRefundType] = useState<RefundType>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [reason, setReason] = useState<RefundReason>('customer_request');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('original_payment');
  const [notes, setNotes] = useState('');
  const [restoreInventory, setRestoreInventory] = useState(true);

  // Calculate refund amount based on type
  const refundAmount = useMemo(() => {
    if (!order) return 0;
    if (refundType === 'full') return order.total_amount;
    const parsed = parseFloat(partialAmount);
    return isNaN(parsed) ? 0 : parsed;
  }, [order, refundType, partialAmount]);

  // Validation
  const validation = useMemo(() => {
    if (!order) return { valid: false, error: 'No order selected' };

    if (refundType === 'partial') {
      const numAmount = parseFloat(partialAmount);
      if (!partialAmount || isNaN(numAmount)) {
        return { valid: false, error: null };
      }
      if (numAmount <= 0) {
        return { valid: false, error: 'Refund amount must be greater than zero' };
      }
      if (numAmount > order.total_amount) {
        return {
          valid: false,
          error: `Refund amount ($${numAmount.toFixed(2)}) cannot exceed order total ($${order.total_amount.toFixed(2)})`,
        };
      }
    }

    if (!reason) {
      return { valid: false, error: 'Please select a refund reason' };
    }

    return { valid: true, error: null };
  }, [order, refundType, partialAmount, reason]);

  // Reset form when modal opens/closes or order changes
  const resetForm = () => {
    setRefundType('full');
    setPartialAmount('');
    setReason('customer_request');
    setRefundMethod('original_payment');
    setNotes('');
    setRestoreInventory(true);
  };

  // Handle modal close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Refund mutation
  const processRefund = useMutation({
    mutationFn: async (input: RefundInput) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Update order status to refunded and store refund metadata
      const { data: updatedOrder, error: updateError } = await supabase
        .from('unified_orders')
        .update({
          status: 'refunded',
          payment_status: input.refundType === 'full' ? 'refunded' : 'partial',
          metadata: {
            ...(order?.metadata || {}),
            refund: {
              type: input.refundType,
              amount: input.amount,
              reason: input.reason,
              method: input.refundMethod,
              notes: input.notes,
              restoreInventory: input.restoreInventory,
              processedAt: new Date().toISOString(),
              lineItems: input.lineItems,
            },
          },
        })
        .eq('id', input.orderId)
        .eq('tenant_id', tenant.id)
        .select()
        .single();

      if (updateError) {
        logger.error('Failed to update order for refund', { error: updateError });
        throw updateError;
      }

      // If restoring inventory, that would typically be handled by a database trigger
      // or a separate edge function. For now, we mark intent in metadata.

      return updatedOrder;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: unifiedOrdersKeys.lists() });
      await queryClient.cancelQueries({ queryKey: unifiedOrdersKeys.detail(input.orderId) });

      const previousLists = queryClient.getQueriesData<UnifiedOrder[]>({
        queryKey: unifiedOrdersKeys.lists(),
      });
      const previousDetail = queryClient.getQueryData<UnifiedOrder>(
        unifiedOrdersKeys.detail(input.orderId)
      );

      // Optimistic update
      const optimisticFields: Partial<UnifiedOrder> = {
        status: 'refunded',
        payment_status: input.refundType === 'full' ? 'refunded' : 'partial',
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueriesData<UnifiedOrder[]>(
        { queryKey: unifiedOrdersKeys.lists() },
        (old) =>
          old?.map((o) =>
            o.id === input.orderId ? { ...o, ...optimisticFields } : o
          )
      );

      if (previousDetail) {
        queryClient.setQueryData<UnifiedOrder>(
          unifiedOrdersKeys.detail(input.orderId),
          { ...previousDetail, ...optimisticFields }
        );
      }

      return { previousLists, previousDetail, orderId: input.orderId };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail && context.orderId) {
        queryClient.setQueryData(
          unifiedOrdersKeys.detail(context.orderId),
          context.previousDetail
        );
      }
      const message =
        error instanceof Error ? error.message : 'Failed to process refund';
      logger.error('Failed to process refund', error, { component: 'OrderRefundModal' });
      toast.error('Refund failed', { description: message });
    },
    onSuccess: (data) => {
      toast.success('Refund processed successfully', {
        description: `$${refundAmount.toFixed(2)} refunded for order ${order?.order_number}`,
      });

      // Cross-panel invalidation
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'REFUND_PROCESSED', tenant.id, {
          orderId: data.id,
          customerId: data.customer_id || undefined,
        });
      }

      handleOpenChange(false);
      onSuccess?.();
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: unifiedOrdersKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: unifiedOrdersKeys.detail(variables.orderId),
      });
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!order || !validation.valid) return;

    processRefund.mutate({
      orderId: order.id,
      refundType,
      amount: refundAmount,
      reason,
      refundMethod,
      notes: notes ? sanitizeTextareaInput(notes, 500) : null,
      restoreInventory,
    });
  };

  if (!order) return null;

  const orderItems = order.items || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Process Refund
          </DialogTitle>
          <DialogDescription>
            Refund order {order.order_number}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Summary */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Order Total</span>
              <span className="text-lg font-semibold">
                ${order.total_amount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Status</span>
              <Badge variant="outline">{order.status}</Badge>
            </div>
            {orderItems.length > 0 && (
              <>
                <Separator className="my-2" />
                <div className="text-sm text-muted-foreground">
                  {orderItems.length} item{orderItems.length !== 1 ? 's' : ''}
                </div>
              </>
            )}
          </div>

          {/* Refund Type Selection */}
          <div className="space-y-3">
            <Label>Refund Type</Label>
            <RadioGroup
              value={refundType}
              onValueChange={(value) => setRefundType(value as RefundType)}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="full"
                  id="refund-full"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="refund-full"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <DollarSign className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Full Refund</span>
                  <span className="text-xs text-muted-foreground">
                    ${order.total_amount.toFixed(2)}
                  </span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="partial"
                  id="refund-partial"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="refund-partial"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <DollarSign className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Partial Refund</span>
                  <span className="text-xs text-muted-foreground">Custom amount</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Partial Amount Input */}
          {refundType === 'partial' && (
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={order.total_amount}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="0.00"
                  className={`pl-9 ${validation.error ? 'border-destructive' : ''}`}
                  required
                />
              </div>
              {validation.error && (
                <div className="flex items-center gap-1.5 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{validation.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Refund Reason */}
          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason for Refund</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as RefundReason)}
            >
              <SelectTrigger id="refund-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Refund Method */}
          <div className="space-y-2">
            <Label htmlFor="refund-method">Refund Method</Label>
            <Select
              value={refundMethod}
              onValueChange={(value) => setRefundMethod(value as RefundMethod)}
            >
              <SelectTrigger id="refund-method">
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
          </div>

          {/* Restore Inventory Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="restore-inventory"
              checked={restoreInventory}
              onChange={(e) => setRestoreInventory(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="restore-inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Restore inventory for refunded items
            </Label>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="refund-notes">Notes (Optional)</Label>
            <Textarea
              id="refund-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this refund..."
              rows={3}
            />
          </div>

          {/* Refund Summary */}
          <Alert>
            <AlertDescription className="flex items-center justify-between">
              <span className="font-medium">Refund Amount:</span>
              <span className="text-lg font-bold">
                ${refundAmount.toFixed(2)}
              </span>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={processRefund.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!validation.valid || processRefund.isPending}
              className="flex-1"
            >
              {processRefund.isPending
                ? 'Processing...'
                : `Process ${refundType === 'full' ? 'Full' : 'Partial'} Refund`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
