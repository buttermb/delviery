/**
 * POReceiving
 *
 * Full workflow for receiving a purchase order delivery.
 * - Scan or enter products received
 * - Compare received quantities vs ordered
 * - Flag discrepancies (over/under delivery)
 * - On confirm receive, increment inventory for each item
 * - Log to inventory_history with reason "restock" and reference_id = PO id
 * - Update PO status to "received"
 *
 * Task 157: Create purchase order receiving workflow
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Package from 'lucide-react/dist/esm/icons/package';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Barcode from 'lucide-react/dist/esm/icons/barcode';
import Search from 'lucide-react/dist/esm/icons/search';
import Minus from 'lucide-react/dist/esm/icons/minus';
import Plus from 'lucide-react/dist/esm/icons/plus';
import X from 'lucide-react/dist/esm/icons/x';
import Truck from 'lucide-react/dist/esm/icons/truck';

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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import type { Database } from '@/integrations/supabase/types';

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];

interface _ReceivedQuantity {
  itemId: string;
  ordered: number;
  received: number;
  productId: string | null;
  productName: string;
  sku: string | null;
}

interface DiscrepancyInfo {
  itemId: string;
  productName: string;
  ordered: number;
  received: number;
  difference: number;
  type: 'over' | 'under' | 'match';
}

export interface POReceivingProps {
  /** Controls dialog visibility */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Purchase order to receive */
  purchaseOrder: PurchaseOrder | null;
  /** Callback after successful receiving */
  onSuccess?: () => void;
}

/**
 * POReceiving Component
 *
 * Comprehensive workflow for receiving purchase order deliveries with
 * barcode scanning, quantity tracking, discrepancy flagging, and inventory updates.
 */
export function POReceiving({
  open,
  onOpenChange,
  purchaseOrder,
  onSuccess,
}: POReceivingProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Form state
  const [receivedDate, setReceivedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showDiscrepancyWarning, setShowDiscrepancyWarning] = useState(false);

  // Fetch PO items with product details
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: queryKeys.purchaseOrders.items(purchaseOrder?.id ?? ''),
    queryFn: async () => {
      if (!purchaseOrder?.id) return [];

      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          *,
          product:products(id, name, sku, barcode, stock_quantity)
        `)
        .eq('purchase_order_id', purchaseOrder.id)
        .order('created_at', { ascending: true }) as unknown as { data: unknown[] | null; error: { message: string } | null };

      if (error) {
        logger.error('Failed to fetch PO items', error, { component: 'POReceiving' });
        return [];
      }

      return (data ?? []) as (PurchaseOrderItem & {
        product: { id: string; name: string; sku: string | null; barcode: string | null; stock_quantity: number } | null;
      })[];
    },
    enabled: open && !!purchaseOrder?.id,
  });

  // Initialize quantities when dialog opens
  useEffect(() => {
    if (open && items) {
      const initialQuantities: Record<string, number> = {};
      items.forEach((item) => {
        // Default to ordered quantity
        initialQuantities[item.id] = item.quantity ?? 0;
      });
      setQuantities(initialQuantities);
      setReceivedDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setBarcodeInput('');
      setShowDiscrepancyWarning(false);
    }
  }, [open, items]);

  // Calculate discrepancies
  const discrepancies = useMemo((): DiscrepancyInfo[] => {
    if (!items) return [];

    return items.map((item) => {
      const ordered = item.quantity ?? 0;
      const received = quantities[item.id] ?? 0;
      const difference = received - ordered;

      let type: 'over' | 'under' | 'match' = 'match';
      if (difference > 0) type = 'over';
      else if (difference < 0) type = 'under';

      return {
        itemId: item.id,
        productName: item.product?.name || item.product_name || 'Unknown Product',
        ordered,
        received,
        difference,
        type,
      };
    });
  }, [items, quantities]);

  const hasDiscrepancies = discrepancies.some((d) => d.type !== 'match');

  // Handle barcode scan
  const handleBarcodeScan = useCallback(() => {
    if (!barcodeInput.trim() || !items) return;

    const scannedBarcode = barcodeInput.trim();
    const matchingItem = items.find(
      (item) =>
        item.product?.barcode === scannedBarcode ||
        item.product?.sku === scannedBarcode
    );

    if (matchingItem) {
      // Increment the received quantity by 1
      setQuantities((prev) => ({
        ...prev,
        [matchingItem.id]: (prev[matchingItem.id] ?? 0) + 1,
      }));
      logger.debug('Barcode matched', { barcode: scannedBarcode, itemId: matchingItem.id }, 'POReceiving');
    } else {
      showErrorToast('Barcode Not Found', `No item found matching barcode: ${scannedBarcode}`);
    }

    setBarcodeInput('');
  }, [barcodeInput, items]);

  // Handle quantity change
  const handleQuantityChange = useCallback((itemId: string, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, value),
    }));
  }, []);

  // Increment/decrement helpers
  const incrementQuantity = useCallback((itemId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] ?? 0) + 1,
    }));
  }, []);

  const decrementQuantity = useCallback((itemId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] ?? 0) - 1),
    }));
  }, []);

  // Reset item to ordered quantity
  const resetToOrdered = useCallback((itemId: string, ordered: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: ordered,
    }));
  }, []);

  // Receive mutation
  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!purchaseOrder?.id || !tenant?.id || !items) {
        throw new Error('Missing required data');
      }

      logger.info('Starting PO receiving', {
        component: 'POReceiving',
        poId: purchaseOrder.id,
        itemCount: items.length,
      });

      // Process each item
      for (const item of items) {
        const receivedQty = quantities[item.id] ?? 0;
        const productId = item.product_id;

        // Update PO item with received quantity
        const { error: updateItemError } = await supabase
          .from('purchase_order_items')
          .update({
            quantity_received: receivedQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (updateItemError) {
          logger.error('Failed to update PO item', updateItemError, {
            component: 'POReceiving',
            itemId: item.id,
          });
          throw new Error(`Failed to update item: ${item.product_name || 'Unknown'}`);
        }

        // Update product inventory
        if (productId) {
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock_quantity, available_quantity')
            .eq('id', productId)
            .eq('tenant_id', tenant.id)
            .maybeSingle();

          if (productError) {
            logger.error('Failed to fetch product for stock update', productError, {
              component: 'POReceiving',
              productId,
            });
          }

          if (product && !productError) {
            const previousQuantity = product.stock_quantity ?? 0;
            const newQuantity = previousQuantity + receivedQty;

            const { error: stockError } = await supabase
              .from('products')
              .update({
                stock_quantity: newQuantity,
                available_quantity: newQuantity,
                updated_at: new Date().toISOString(),
              })
              .eq('id', productId)
              .eq('tenant_id', tenant.id);

            if (stockError) {
              logger.error('Failed to update product stock', stockError, {
                component: 'POReceiving',
                productId,
              });
            } else {
              logger.info('Updated product stock', {
                component: 'POReceiving',
                productId,
                previousQuantity,
                addedQuantity: receivedQty,
                newQuantity,
              });
            }

            // Log to inventory_history
            const historyEntry = {
              tenant_id: tenant.id,
              product_id: productId,
              change_type: 'stock_in',
              previous_quantity: previousQuantity,
              new_quantity: newQuantity,
              change_amount: receivedQty,
              reference_type: 'purchase_order',
              reference_id: purchaseOrder.id,
              reason: 'restock',
              notes: `Received from PO ${purchaseOrder.po_number}`,
              performed_by: admin?.id || null,
              metadata: {
                po_number: purchaseOrder.po_number,
                po_item_id: item.id,
                ordered_quantity: item.quantity,
                received_quantity: receivedQty,
                source: 'po_receiving_workflow',
              },
            };

            // Use type assertion for dynamic table access
            const { error: historyError } = await supabase
              .from('inventory_history')
              .insert(historyEntry);

            if (historyError) {
              // Log but don't fail - inventory was already updated
              logger.error('Failed to record inventory history', historyError, {
                component: 'POReceiving',
                productId,
              });
            }
          }
        }
      }

      // Update PO status to received
      const { error: updatePOError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'received',
          received_date: receivedDate || new Date().toISOString().split('T')[0],
          notes: notes ? `${purchaseOrder.notes ?? ''}\n\nReceiving Notes: ${notes}` : purchaseOrder.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchaseOrder.id)
        .eq('tenant_id', tenant.id);

      if (updatePOError) {
        logger.error('Failed to update PO status', updatePOError, {
          component: 'POReceiving',
          poId: purchaseOrder.id,
        });
        throw new Error('Failed to update purchase order status');
      }

      // Log discrepancies if any
      if (hasDiscrepancies) {
        const discrepancyDetails = discrepancies
          .filter((d) => d.type !== 'match')
          .map((d) => `${d.productName}: ordered ${d.ordered}, received ${d.received} (${d.difference > 0 ? '+' : ''}${d.difference})`)
          .join('; ');

        logger.info('PO received with discrepancies', {
          component: 'POReceiving',
          poId: purchaseOrder.id,
          discrepancies: discrepancyDetails,
        });
      }

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(purchaseOrder?.id ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

      showSuccessToast(
        'Purchase Order Received',
        `${purchaseOrder?.po_number} has been received and inventory updated`
      );

      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to receive purchase order';
      logger.error('PO receiving failed', error, { component: 'POReceiving' });
      showErrorToast('Receiving Failed', message);
    },
  });

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (hasDiscrepancies && !showDiscrepancyWarning) {
      setShowDiscrepancyWarning(true);
      return;
    }
    receiveMutation.mutate();
  }, [hasDiscrepancies, showDiscrepancyWarning, receiveMutation]);

  // Handle close
  const handleClose = useCallback(() => {
    if (!receiveMutation.isPending) {
      onOpenChange(false);
    }
  }, [receiveMutation.isPending, onOpenChange]);

  const isLoading = receiveMutation.isPending || itemsLoading;

  // Calculate totals
  const totalOrdered = items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 0;
  const totalReceived = Object.values(quantities).reduce((sum, qty) => sum + qty, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Receive Purchase Order: {purchaseOrder?.po_number}
          </DialogTitle>
          <DialogDescription>
            Scan or enter received quantities for each item. Discrepancies will be flagged for review.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Barcode Scanner Input */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Barcode className="h-4 w-4" />
                  Quick Scan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Scan barcode or enter SKU..."
                      aria-label="Scan barcode or enter SKU"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleBarcodeScan();
                        }
                      }}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <Button onClick={handleBarcodeScan} variant="secondary">
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Press Enter after scanning to automatically add to quantity
                </p>
              </CardContent>
            </Card>

            {/* Items Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Items ({items?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {itemsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : items && items.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Ordered</TableHead>
                        <TableHead className="text-center">Received</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const ordered = item.quantity ?? 0;
                        const received = quantities[item.id] ?? 0;
                        const diff = received - ordered;
                        const discrepancy = discrepancies.find((d) => d.itemId === item.id);

                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {item.product?.name || item.product_name || 'Unknown Product'}
                                </div>
                                {item.product?.sku && (
                                  <div className="text-xs text-muted-foreground">
                                    SKU: {item.product.sku}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {ordered}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => decrementQuantity(item.id)}
                                  disabled={received <= 0}
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={received}
                                  onChange={(e) =>
                                    handleQuantityChange(item.id, parseFloat(e.target.value) || 0)
                                  }
                                  aria-label={`Received quantity for ${item.product_name || 'item'}`}
                                  className="w-20 text-center font-mono h-8"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => incrementQuantity(item.id)}
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {discrepancy?.type === 'match' ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Match
                                </Badge>
                              ) : discrepancy?.type === 'under' ? (
                                <Badge variant="destructive">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Short {Math.abs(diff)}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Over +{diff}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => resetToOrdered(item.id, ordered)}
                                className="text-xs"
                              >
                                Reset
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No items found in this purchase order
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Total Ordered</Label>
                    <div className="text-2xl font-bold font-mono">{totalOrdered}</div>
                  </div>
                  <div>
                    <Label>Total Received</Label>
                    <div className={`text-2xl font-bold font-mono ${totalReceived !== totalOrdered ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {totalReceived}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Discrepancy Warning */}
            {showDiscrepancyWarning && hasDiscrepancies && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Discrepancies Detected</AlertTitle>
                <AlertDescription>
                  <div className="mt-2">
                    The following items have quantity discrepancies:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {discrepancies
                        .filter((d) => d.type !== 'match')
                        .map((d) => (
                          <li key={d.itemId}>
                            <strong>{d.productName}</strong>: ordered {d.ordered}, received {d.received}{' '}
                            ({d.difference > 0 ? '+' : ''}{d.difference})
                          </li>
                        ))}
                    </ul>
                  </div>
                  <p className="mt-3 text-sm">
                    Click &quot;Confirm Receipt&quot; again to proceed with these discrepancies.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Receiving Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="received_date">Received Date</Label>
                <Input
                  id="received_date"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Receiving Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about the received items (damages, shortages, etc.)"
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !items?.length}
            className={hasDiscrepancies && showDiscrepancyWarning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Receiving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {hasDiscrepancies && showDiscrepancyWarning ? 'Confirm with Discrepancies' : 'Confirm Receipt'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default POReceiving;
