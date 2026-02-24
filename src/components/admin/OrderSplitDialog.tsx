/**
 * OrderSplitDialog - Dialog for splitting an order into multiple shipments
 * Allows users to allocate order items across different shipments
 */
import { useState, useEffect, useMemo } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Package from "lucide-react/dist/esm/icons/package";
import Split from "lucide-react/dist/esm/icons/split";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { useOrderSplit, type OrderItem, type ShipmentAllocation } from '@/hooks/useOrderSplit';
import { cn } from '@/lib/utils';

interface OrderData {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string;
  delivery_borough: string;
  delivery_notes: string | null;
  payment_method: string;
  payment_status: string | null;
  tenant_id: string | null;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number | null;
  tip_amount: number | null;
  total_amount: number;
}

interface OrderSplitDialogProps {
  order: OrderData;
  orderItems: OrderItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newOrderIds: string[]) => void;
}

interface ItemAllocation {
  itemId: string;
  productId: string;
  productName: string;
  totalQuantity: number;
  price: number;
  allocations: Record<number, number>; // shipmentIndex -> quantity
}

const SHIPMENT_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
];

export function OrderSplitDialog({
  order,
  orderItems,
  open,
  onOpenChange,
  onSuccess,
}: OrderSplitDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const { splitOrder, isLoading, reset } = useOrderSplit({
    tenantId: tenant?.id,
    onSuccess,
  });

  const [numberOfShipments, setNumberOfShipments] = useState(2);
  const [itemAllocations, setItemAllocations] = useState<ItemAllocation[]>([]);

  // Initialize allocations when dialog opens or items change
  useEffect(() => {
    if (open && orderItems.length > 0) {
      setItemAllocations(
        orderItems.map((item) => ({
          itemId: item.id,
          productId: item.product_id,
          productName: item.product_name,
          totalQuantity: item.quantity,
          price: item.price,
          allocations: { 0: item.quantity }, // Default all to first shipment
        }))
      );
      setNumberOfShipments(2);
    }
  }, [open, orderItems]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  // Calculate shipment summaries
  const shipmentSummaries = useMemo(() => {
    const summaries: Array<{
      index: number;
      items: number;
      quantity: number;
      subtotal: number;
    }> = [];

    for (let i = 0; i < numberOfShipments; i++) {
      let itemCount = 0;
      let totalQuantity = 0;
      let subtotal = 0;

      for (const allocation of itemAllocations) {
        const qty = allocation.allocations[i] || 0;
        if (qty > 0) {
          itemCount++;
          totalQuantity += qty;
          subtotal += qty * allocation.price;
        }
      }

      summaries.push({
        index: i,
        items: itemCount,
        quantity: totalQuantity,
        subtotal,
      });
    }

    return summaries;
  }, [itemAllocations, numberOfShipments]);

  // Check if all items are properly allocated
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    for (const allocation of itemAllocations) {
      const totalAllocated = Object.values(allocation.allocations).reduce((sum, qty) => sum + qty, 0);
      if (totalAllocated !== allocation.totalQuantity) {
        errors.push(`${allocation.productName}: allocated ${totalAllocated} of ${allocation.totalQuantity}`);
      }
    }

    const emptyShipments = shipmentSummaries.filter((s) => s.items === 0);
    if (emptyShipments.length > 0) {
      errors.push(`${emptyShipments.length} shipment(s) have no items`);
    }

    const nonEmptyShipments = shipmentSummaries.filter((s) => s.items > 0);
    if (nonEmptyShipments.length < 2) {
      errors.push('Must have at least 2 shipments with items');
    }

    return errors;
  }, [itemAllocations, shipmentSummaries]);

  const handleAllocationChange = (itemId: string, shipmentIndex: number, value: string) => {
    const newQty = parseInt(value, 10) || 0;

    setItemAllocations((prev) =>
      prev.map((allocation) => {
        if (allocation.itemId !== itemId) return allocation;

        const newAllocations = { ...allocation.allocations };
        newAllocations[shipmentIndex] = Math.max(0, Math.min(newQty, allocation.totalQuantity));

        // Ensure total doesn't exceed original quantity
        const total = Object.values(newAllocations).reduce((sum, qty) => sum + qty, 0);
        if (total > allocation.totalQuantity) {
          // Reduce other allocations proportionally
          const excess = total - allocation.totalQuantity;
          let remaining = excess;
          for (let i = 0; i < numberOfShipments && remaining > 0; i++) {
            if (i !== shipmentIndex && newAllocations[i] > 0) {
              const reduction = Math.min(newAllocations[i], remaining);
              newAllocations[i] -= reduction;
              remaining -= reduction;
            }
          }
        }

        return { ...allocation, allocations: newAllocations };
      })
    );
  };

  const handleAutoDistribute = () => {
    setItemAllocations((prev) =>
      prev.map((allocation) => {
        const qtyPerShipment = Math.floor(allocation.totalQuantity / numberOfShipments);
        const remainder = allocation.totalQuantity % numberOfShipments;

        const newAllocations: Record<number, number> = {};
        for (let i = 0; i < numberOfShipments; i++) {
          newAllocations[i] = qtyPerShipment + (i < remainder ? 1 : 0);
        }

        return { ...allocation, allocations: newAllocations };
      })
    );
  };

  const handleSplit = async () => {
    if (validationErrors.length > 0) return;

    // Build shipment allocations
    const allocations: ShipmentAllocation[] = [];
    for (let i = 0; i < numberOfShipments; i++) {
      const items = itemAllocations
        .filter((alloc) => (alloc.allocations[i] || 0) > 0)
        .map((alloc) => ({
          itemId: alloc.itemId,
          productId: alloc.productId,
          productName: alloc.productName,
          quantity: alloc.allocations[i] || 0,
          price: alloc.price,
        }));

      allocations.push({ shipmentIndex: i, items });
    }

    try {
      await splitOrder(order, allocations);
      onOpenChange(false);
    } catch {
      // Error is handled in the hook
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5" />
            Split Order #{order.order_number || order.id.slice(0, 8)}
          </DialogTitle>
          <DialogDescription>
            Allocate items across multiple shipments. Each shipment will become a separate order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Number of Shipments */}
          <div className="flex items-center gap-4">
            <Label htmlFor="shipments">Number of Shipments</Label>
            <Select
              value={String(numberOfShipments)}
              onValueChange={(val) => setNumberOfShipments(parseInt(val, 10))}
            >
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleAutoDistribute}>
              Auto-Distribute
            </Button>
          </div>

          {/* Shipment Summaries */}
          <div className="flex gap-2 flex-wrap">
            {shipmentSummaries.map((summary, index) => (
              <Badge
                key={index}
                variant="outline"
                className={cn('py-1 px-3', SHIPMENT_COLORS[index % SHIPMENT_COLORS.length])}
              >
                Shipment {index + 1}: {summary.items} items, {formatCurrency(summary.subtotal)}
              </Badge>
            ))}
          </div>

          <Separator />

          {/* Items Allocation Table */}
          <ScrollArea className="flex-1 border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Product</TableHead>
                  <TableHead className="w-[80px] text-center">Total Qty</TableHead>
                  <TableHead className="w-[80px] text-right">Price</TableHead>
                  {Array.from({ length: numberOfShipments }, (_, i) => (
                    <TableHead
                      key={i}
                      className={cn(
                        'w-[100px] text-center',
                        SHIPMENT_COLORS[i % SHIPMENT_COLORS.length]
                      )}
                    >
                      Shipment {i + 1}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemAllocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3 + numberOfShipments} className="text-center py-8">
                      <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No items to allocate</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  itemAllocations.map((allocation) => {
                    const totalAllocated = Object.values(allocation.allocations).reduce(
                      (sum, qty) => sum + qty,
                      0
                    );
                    const hasError = totalAllocated !== allocation.totalQuantity;

                    return (
                      <TableRow key={allocation.itemId} className={cn(hasError && 'bg-destructive/10')}>
                        <TableCell className="font-medium">{allocation.productName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={hasError ? 'destructive' : 'secondary'}>
                            {totalAllocated} / {allocation.totalQuantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(allocation.price)}</TableCell>
                        {Array.from({ length: numberOfShipments }, (_, i) => (
                          <TableCell key={i} className="text-center">
                            <Input
                              type="number"
                              min={0}
                              max={allocation.totalQuantity}
                              value={allocation.allocations[i] || 0}
                              onChange={(e) =>
                                handleAllocationChange(allocation.itemId, i, e.target.value)
                              }
                              className="w-16 h-8 text-center mx-auto"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
                <AlertTriangle className="h-4 w-4" />
                Please fix the following issues:
              </div>
              <ul className="text-sm text-destructive/80 list-disc list-inside">
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSplit}
            disabled={isLoading || validationErrors.length > 0}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Split into {shipmentSummaries.filter((s) => s.items > 0).length} Shipments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
