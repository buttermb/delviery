/**
 * StockAdjustment
 *
 * Modal for manually adjusting product stock. Used from product detail and inventory list.
 * Fields: adjustment type (add/remove/set), quantity, reason (restock, damaged, correction, audit), notes.
 * On submit: updates stock_quantity and logs to inventory_history.
 * Invalidates product and inventory queries.
 *
 * Task 100: Create product stock adjustment modal
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up';
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down';
import Replace from 'lucide-react/dist/esm/icons/replace';
import Package from 'lucide-react/dist/esm/icons/package';

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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { invalidateOnEvent } from '@/lib/invalidation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

type AdjustmentType = 'add' | 'remove' | 'set';

interface AdjustmentReason {
  value: string;
  label: string;
  icon: string;
}

const ADJUSTMENT_REASONS: AdjustmentReason[] = [
  { value: 'restock', label: 'Restock', icon: '' },
  { value: 'damaged', label: 'Damaged', icon: '' },
  { value: 'correction', label: 'Count Correction', icon: '' },
  { value: 'audit', label: 'Audit Adjustment', icon: '' },
  { value: 'expired', label: 'Expired', icon: '' },
  { value: 'theft', label: 'Theft/Loss', icon: '' },
  { value: 'transfer', label: 'Transfer', icon: '' },
  { value: 'other', label: 'Other', icon: '' },
];

type ReasonValue = (typeof ADJUSTMENT_REASONS)[number]['value'] | '';

export interface StockAdjustmentProps {
  /** Product ID to adjust stock for */
  productId: string;
  /** Product name for display */
  productName: string;
  /** Current stock quantity */
  currentQuantity: number;
  /** Optional SKU for display */
  sku?: string | null;
  /** Controls dialog visibility */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback after successful adjustment */
  onComplete?: () => void;
}

interface AdjustmentPayload {
  type: AdjustmentType;
  quantity: number;
  reason: string;
  notes: string;
}

/**
 * Map adjustment reason to inventory history change_type
 */
function getChangeType(adjustType: AdjustmentType, reason: string): string {
  const reasonToChangeType: Record<string, string> = {
    restock: 'stock_in',
    damaged: 'disposal',
    theft: 'disposal',
    expired: 'disposal',
    transfer: 'transfer',
    correction: 'adjustment',
    audit: 'adjustment',
  };

  if (reasonToChangeType[reason]) {
    return reasonToChangeType[reason];
  }

  if (adjustType === 'add') return 'stock_in';
  if (adjustType === 'remove') return 'stock_out';
  return 'adjustment';
}

/**
 * StockAdjustment Component
 *
 * Modal for manually adjusting product stock levels with full audit trail.
 */
export function StockAdjustment({
  productId,
  productName,
  currentQuantity,
  sku,
  open,
  onOpenChange,
  onComplete,
}: StockAdjustmentProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<ReasonValue>('');
  const [notes, setNotes] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAdjustmentType('add');
      setQuantity('');
      setReason('');
      setNotes('');
    }
  }, [open]);

  const parsedQuantity = parseFloat(quantity) || 0;

  // Calculate preview of new quantity and change
  const preview = useMemo(() => {
    if (parsedQuantity < 0 || (adjustmentType !== 'set' && parsedQuantity <= 0)) {
      return { newQuantity: currentQuantity, change: 0, warning: null };
    }

    let newQuantity: number;
    let change: number;

    switch (adjustmentType) {
      case 'add':
        newQuantity = currentQuantity + parsedQuantity;
        change = parsedQuantity;
        break;
      case 'remove':
        newQuantity = Math.max(0, currentQuantity - parsedQuantity);
        change = -Math.min(parsedQuantity, currentQuantity);
        break;
      case 'set':
        newQuantity = parsedQuantity;
        change = parsedQuantity - currentQuantity;
        break;
    }

    const warning =
      adjustmentType === 'remove' && parsedQuantity > currentQuantity
        ? 'Quantity will be set to 0 (cannot go below zero)'
        : null;

    return { newQuantity, change, warning };
  }, [adjustmentType, parsedQuantity, currentQuantity]);

  // Mutation to perform the stock adjustment
  const adjustmentMutation = useMutation({
    mutationFn: async (payload: AdjustmentPayload) => {
      if (!tenant?.id) {
        throw new Error('No tenant context available');
      }

      const { newQuantity, change: changeAmount } = preview;

      // Update the product's stock_quantity
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_quantity: newQuantity,
          available_quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (updateError) {
        logger.error('Failed to update product stock', updateError, {
          component: 'StockAdjustment',
          productId,
          tenantId: tenant.id,
        });
        throw updateError;
      }

      // Log to inventory_history for audit trail
      const historyEntry = {
        tenant_id: tenant.id,
        product_id: productId,
        change_type: getChangeType(payload.type, payload.reason),
        previous_quantity: currentQuantity,
        new_quantity: newQuantity,
        change_amount: changeAmount,
        reference_type: 'manual',
        reason: payload.reason,
        notes: payload.notes || null,
        performed_by: admin?.id || null,
        metadata: {
          adjustment_type: payload.type,
          source: 'stock_adjustment_modal',
          sku: sku || null,
        },
      };

      // Use type assertion for dynamic table access
      const { error: historyError } = await supabase
        .from('inventory_history')
        .insert(historyEntry);

      if (historyError) {
        // Log but don't fail the operation - stock was already updated
        logger.error('Failed to record inventory history', historyError, {
          component: 'StockAdjustment',
          productId,
          tenantId: tenant.id,
        });
      }

      return { newQuantity, changeAmount };
    },
    onSuccess: ({ newQuantity }) => {
      showSuccessToast(
        'Stock Adjusted',
        `${productName} now has ${newQuantity.toFixed(2)} units`
      );

      // Invalidate related queries
      if (tenant?.id) {
        // Cross-panel invalidation for inventory events
        invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id, {
          productId,
        });

        // Invalidate product queries
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.all,
        });

        // Invalidate inventory queries
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventory.all,
        });

        // Invalidate inventory history
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventory.history({ tenantId: tenant.id, productId }),
        });
      }

      onOpenChange(false);
      onComplete?.();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to adjust stock';
      logger.error('Stock adjustment failed', error, {
        component: 'StockAdjustment',
        productId,
      });
      showErrorToast('Adjustment Failed', message);
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (parsedQuantity < 0 || !reason) return;
      // For add/remove, quantity must be > 0; for set, allow 0 (zero out stock)
      if (adjustmentType !== 'set' && parsedQuantity <= 0) return;

      adjustmentMutation.mutate({
        type: adjustmentType,
        quantity: parsedQuantity,
        reason,
        notes,
      });
    },
    [adjustmentMutation, adjustmentType, parsedQuantity, reason, notes]
  );

  const handleClose = useCallback(() => {
    if (!adjustmentMutation.isPending) {
      onOpenChange(false);
    }
  }, [adjustmentMutation.isPending, onOpenChange]);

  const getAdjustmentIcon = () => {
    switch (adjustmentType) {
      case 'add':
        return <ArrowUp className="h-4 w-4 text-emerald-500" />;
      case 'remove':
        return <ArrowDown className="h-4 w-4 text-destructive" />;
      case 'set':
        return <Replace className="h-4 w-4 text-blue-500" />;
    }
  };

  const isFormValid = (adjustmentType === 'set' ? parsedQuantity >= 0 : parsedQuantity > 0) && reason !== '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Adjust Stock
          </DialogTitle>
          <DialogDescription>
            Adjust inventory for <strong>{productName}</strong>
            {sku && <span className="text-muted-foreground"> ({sku})</span>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Quantity Display */}
          <div className="space-y-1">
            <Label>Current Quantity</Label>
            <div className="p-3 bg-muted rounded-md">
              <span className="font-mono text-lg font-bold">
                {currentQuantity.toFixed(2)}
              </span>
              <span className="text-muted-foreground ml-1">units</span>
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label htmlFor="adjustment-type">Adjustment Type *</Label>
            <Select
              value={adjustmentType}
              onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}
            >
              <SelectTrigger id="adjustment-type">
                <SelectValue placeholder="Select adjustment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">
                  <span className="flex items-center gap-2">
                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                    Add Stock
                  </span>
                </SelectItem>
                <SelectItem value="remove">
                  <span className="flex items-center gap-2">
                    <ArrowDown className="h-3 w-3 text-destructive" />
                    Remove Stock
                  </span>
                </SelectItem>
                <SelectItem value="set">
                  <span className="flex items-center gap-2">
                    <Replace className="h-3 w-3 text-blue-500" />
                    Set to Amount
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              {adjustmentType === 'set' ? 'New Quantity' : 'Quantity'} *
            </Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              min={adjustmentType === 'set' ? '0' : '0.01'}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Preview of change */}
          {(parsedQuantity > 0 || (adjustmentType === 'set' && parsedQuantity === 0 && quantity !== '')) && (
            <div className="p-3 border rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                {getAdjustmentIcon()}
                <span>Preview Change</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current:</span>
                <span className="font-mono">{currentQuantity.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Change:</span>
                <Badge
                  variant={
                    preview.change > 0
                      ? 'default'
                      : preview.change < 0
                        ? 'destructive'
                        : 'secondary'
                  }
                  className="font-mono"
                >
                  {preview.change > 0 ? '+' : ''}
                  {preview.change.toFixed(2)}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm border-t pt-2">
                <span className="font-medium">New Quantity:</span>
                <span className="font-mono font-bold text-lg">
                  {preview.newQuantity.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Warning for negative stock */}
          {preview.warning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{preview.warning}</AlertDescription>
            </Alert>
          )}

          {/* Reason Selection */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Select
              value={reason || undefined}
              onValueChange={(v) => setReason(v as ReasonValue)}
            >
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <span>{option.icon}</span>
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details about this adjustment..."
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={adjustmentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || adjustmentMutation.isPending}
              variant={adjustmentType === 'remove' ? 'destructive' : 'default'}
            >
              {adjustmentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adjusting...
                </>
              ) : (
                'Adjust Stock'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default StockAdjustment;
