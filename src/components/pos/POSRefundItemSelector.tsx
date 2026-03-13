import { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Package from 'lucide-react/dist/esm/icons/package';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import { formatCurrency } from '@/lib/formatters';
import type { UnifiedOrder, UnifiedOrderItem } from '@/hooks/useUnifiedOrders';

type OrderWithItems = Pick<
  UnifiedOrder,
  'id' | 'order_number' | 'order_type' | 'status' | 'total_amount' |
  'payment_method' | 'payment_status' | 'subtotal' | 'tax_amount' |
  'discount_amount' | 'tenant_id' | 'created_at'
> & { unified_order_items: UnifiedOrderItem[] };

interface POSRefundItemSelectorProps {
  order: OrderWithItems;
  selectedItems: Set<string>;
  onItemsChange: (selectedItems: Set<string>) => void;
  onProceed: () => void;
}

export function POSRefundItemSelector({
  order,
  selectedItems,
  onItemsChange,
  onProceed,
}: POSRefundItemSelectorProps) {
  const orderItems = useMemo(() => order.unified_order_items ?? [], [order.unified_order_items]);

  // Calculate refund amount from selected items
  const selectedRefundTotal = useMemo(() => {
    return orderItems
      .filter((item) => selectedItems.has(item.id))
      .reduce((sum, item) => sum + item.total_price, 0);
  }, [orderItems, selectedItems]);

  const handleItemToggle = (itemId: string, checked: boolean) => {
    const next = new Set(selectedItems);
    if (checked) {
      next.add(itemId);
    } else {
      next.delete(itemId);
    }
    onItemsChange(next);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(orderItems.map((item) => item.id));
      onItemsChange(allIds);
    } else {
      onItemsChange(new Set());
    }
  };

  const canProceed = useMemo(() => {
    if (order.payment_status === 'unpaid') return false;
    if (order.status === 'refunded') return false;
    if (selectedItems.size === 0) return false;
    if (selectedRefundTotal <= 0) return false;
    if (selectedRefundTotal > order.total_amount) return false;
    return true;
  }, [order, selectedItems, selectedRefundTotal]);

  return (
    <div className="space-y-4">
      {order.status === 'refunded' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>This order has already been refunded.</AlertDescription>
        </Alert>
      )}

      {order.payment_status === 'unpaid' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Cannot refund an unpaid order.</AlertDescription>
        </Alert>
      )}

      {/* Items to Refund */}
      {orderItems.length > 0 && order.status !== 'refunded' && (
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

          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
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

          {selectedItems.size > 0 && (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                </span>
                <span className="font-bold text-lg">{formatCurrency(selectedRefundTotal)}</span>
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={onProceed}
            disabled={!canProceed}
            className="w-full"
          >
            Proceed to Refund ({formatCurrency(selectedRefundTotal)})
          </Button>
        </div>
      )}

      {orderItems.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>This order has no items to refund.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
