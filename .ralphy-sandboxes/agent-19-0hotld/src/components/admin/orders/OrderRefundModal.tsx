import { useState, useMemo, useEffect, useCallback } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
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
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";

import type { UnifiedOrder } from '@/hooks/useUnifiedOrders';
import {
  useOrderRefund,
  type RefundType,
  type RefundReason,
  type RefundMethod,
} from '@/hooks/useOrderRefund';
import { sanitizeTextareaInput } from '@/lib/utils/sanitize';
import { useDirtyFormGuard } from '@/hooks/useDirtyFormGuard';
import { formatCurrency } from '@/lib/formatters';

interface OrderRefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: UnifiedOrder | null;
  onSuccess?: () => void;
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
  // Use the refund hook with full inventory restore logic
  const { refundOrderAsync, isRefunding } = useOrderRefund();

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

    // Cannot refund already refunded orders
    if (order.status === 'refunded') {
      return { valid: false, error: 'Order has already been refunded' };
    }

    // Cannot refund unpaid orders
    if (order.payment_status === 'unpaid') {
      return { valid: false, error: 'Cannot refund an unpaid order' };
    }

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
          error: `Refund amount (${formatCurrency(numAmount)}) cannot exceed order total (${formatCurrency(order.total_amount)})`,
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

  // Reset form when modal opens with fresh data or order changes
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, order?.id]);

  // Dirty state: user has modified any field from initial defaults
  const isDirty = refundType !== 'full' || partialAmount !== '' || reason !== 'customer_request' || refundMethod !== 'original_payment' || notes !== '' || !restoreInventory;

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange]);

  const { guardedOnOpenChange, dialogContentProps, DiscardAlert } = useDirtyFormGuard(isDirty, handleClose);

  // Handle modal close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (isDirty) {
        guardedOnOpenChange(false);
        return;
      }
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!order || !validation.valid) return;

    try {
      await refundOrderAsync({
        orderId: order.id,
        refundType,
        amount: refundAmount,
        reason,
        refundMethod,
        notes: notes ? sanitizeTextareaInput(notes, 500) : null,
        restoreInventory,
      });

      handleOpenChange(false);
      onSuccess?.();
    } catch {
      // Error is already handled by the useOrderRefund hook's onError callback
    }
  };

  if (!order) return null;

  const orderItems = order.items ?? [];

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="sm:max-w-lg" {...dialogContentProps}>
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
                {formatCurrency(order.total_amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Status</span>
              <Badge variant="outline">{order.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payment Status</span>
              <Badge variant="outline">{order.payment_status}</Badge>
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
                    {formatCurrency(order.total_amount)}
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
              <CurrencyInput
                id="refund-amount"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder="0.00"
                className={validation.error ? 'border-destructive' : ''}
                required
              />
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
              className="h-4 w-4 rounded border-gray-300 text-primary focus-visible:ring-primary"
            />
            <Label htmlFor="restore-inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Restore inventory for refunded items
            </Label>
          </div>

          {restoreInventory && orderItems.length > 0 && (
            <Alert className="bg-blue-50 border-blue-200">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Inventory will be restored for {orderItems.length} item{orderItems.length !== 1 ? 's' : ''} and logged to inventory history.
              </AlertDescription>
            </Alert>
          )}

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
                {formatCurrency(refundAmount)}
              </span>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => guardedOnOpenChange(false)}
              disabled={isRefunding}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!validation.valid || isRefunding}
              className="flex-1"
            >
              {isRefunding
                ? 'Processing...'
                : `Process ${refundType === 'full' ? 'Full' : 'Partial'} Refund`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <DiscardAlert />
    </>
  );
}
