import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
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
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Plus from "lucide-react/dist/esm/icons/plus";
import Minus from "lucide-react/dist/esm/icons/minus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Package from "lucide-react/dist/esm/icons/package";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { queryKeys } from '@/lib/queryKeys';
import { isOrderEditable, getEditRestrictionMessage } from '@/lib/utils/orderEditability';
import { useDirtyFormGuard } from '@/hooks/useDirtyFormGuard';

/**
 * Represents an editable order item
 */
interface EditableOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
}

/**
 * Order interface with required fields for editing
 */
interface Order {
  id: string;
  status: string;
  tracking_code?: string;
  total_amount: number;
  delivery_address?: string;
  delivery_notes?: string;
  customer_notes?: string;
  created_at: string;
  order_items?: Array<{
    id?: string;
    product_name?: string;
    quantity?: number;
    price?: number;
    products?: { name: string; image_url?: string } | null;
  }>;
  // Allow additional properties
  [key: string]: unknown;
}

interface OrderEditModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /**
   * The table name to update (defaults to 'orders')
   * Pass 'menu_orders' for disposable menu orders
   */
  orderTable?: 'orders' | 'menu_orders' | 'wholesale_orders';
}

/**
 * OrderEditModal - Modal for modifying order items before confirmation
 *
 * Allows editing of:
 * - Item quantities and prices
 * - Delivery address and notes
 * - Customer notes
 *
 * Respects order editability based on status (cannot edit shipped/delivered/cancelled orders)
 */
export function OrderEditModal({
  order,
  open,
  onOpenChange,
  onSuccess,
  orderTable = 'orders',
}: OrderEditModalProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [items, setItems] = useState<EditableOrderItem[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const modalOpenMarkRef = useRef<number | null>(null);

  // Check if order can be edited
  const canEdit = order ? isOrderEditable(order.status) : false;
  const editRestrictionMessage = order ? getEditRestrictionMessage(order.status) : null;

  // Track initial values for dirty state comparison
  const initialSnapshot = useRef('');

  // Reset form when order changes or dialog opens
  useEffect(() => {
    if (open && order) {
      modalOpenMarkRef.current = performance.now();
      // Map order items to editable format
      const editableItems: EditableOrderItem[] = (order.order_items ?? []).map((item, index) => ({
        id: item.id || `temp-${index}`,
        product_name: item.product_name || item.products?.name || 'Unknown Product',
        quantity: item.quantity ?? 0,
        price: item.price ?? 0,
      }));
      setItems(editableItems);
      setDeliveryAddress(order.delivery_address ?? '');
      setDeliveryNotes(order.delivery_notes ?? '');
      setCustomerNotes(order.customer_notes ?? '');
      // Capture initial snapshot for dirty detection
      initialSnapshot.current = JSON.stringify({
        items: editableItems,
        deliveryAddress: order.delivery_address ?? '',
        deliveryNotes: order.delivery_notes ?? '',
        customerNotes: order.customer_notes ?? '',
      });
    }
    if (!open) {
      setItems([]);
      setDeliveryAddress('');
      setDeliveryNotes('');
      setCustomerNotes('');
      setIsSubmitting(false);
      initialSnapshot.current = '';
    }
  }, [open, order]);

  useEffect(() => {
    if (!open || !order || items.length === 0 || modalOpenMarkRef.current === null) return;
    const raf = requestAnimationFrame(() => {
      const duration = performance.now() - modalOpenMarkRef.current!;
      performance.mark('order-edit-modal-interactive');
      if (import.meta.env.DEV) {
        logger.debug('[perf] order edit modal interactive', {
          orderId: order.id,
          durationMs: Math.round(duration),
        });
      }
      modalOpenMarkRef.current = null;
    });
    return () => cancelAnimationFrame(raf);
  }, [open, order, items.length]);

  const currentSnapshot = useMemo(() => JSON.stringify({
    items,
    deliveryAddress,
    deliveryNotes,
    customerNotes,
  }), [items, deliveryAddress, deliveryNotes, customerNotes]);

  // Dirty state detection
  const isDirty = open && initialSnapshot.current !== '' && currentSnapshot !== initialSnapshot.current;

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const { guardedOnOpenChange, dialogContentProps, DiscardAlert } = useDirtyFormGuard(isDirty, handleClose);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Item handlers
  const handleUpdateItem = (
    itemId: string,
    field: 'quantity' | 'price',
    value: number
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    if (items.length <= 1) {
      toast.error('Order must have at least one item');
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!order) return;

    if (!canEdit) {
      toast.error(editRestrictionMessage || 'Order cannot be edited');
      return;
    }

    if (items.length === 0) {
      toast.error('Order must have at least one item');
      return;
    }

    // Validate item quantities
    const invalidItems = items.filter((item) => item.quantity <= 0);
    if (invalidItems.length > 0) {
      toast.error('All items must have a quantity greater than 0');
      return;
    }

    setIsSubmitting(true);

    try {
      // Update order details based on table type
      if (orderTable === 'orders') {
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            delivery_address: deliveryAddress,
            customer_notes: customerNotes,
            total_amount: subtotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        if (orderError) throw orderError;

        // Update order items - delete and re-insert
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', order.id);

        if (deleteError) throw deleteError;

        // Insert updated items
        const { error: insertError } = await supabase
          .from('order_items')
          .insert(
            items.map((item) => ({
              order_id: order.id,
              product_id: item.id.startsWith('temp-') ? null : item.id,
              product_name: item.product_name,
              quantity: item.quantity,
              price: item.price,
            }))
          );

        if (insertError) throw insertError;

        // Invalidate order queries
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      } else if (orderTable === 'menu_orders') {
        // For menu_orders, items are stored in order_data JSON
        const orderData = {
          items: items.map((item) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price_per_unit: item.price,
          })),
        };

        const { error: orderError } = await supabase
          .from('menu_orders')
          .update({
            delivery_address: deliveryAddress,
            special_instructions: deliveryNotes,
            customer_notes: customerNotes,
            total_amount: subtotal,
            order_data: orderData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        if (orderError) throw orderError;

        // Invalidate menu order queries
        queryClient.invalidateQueries({ queryKey: queryKeys.menuOrders.all });
      } else if (orderTable === 'wholesale_orders') {
        const { error: orderError } = await supabase
          .from('wholesale_orders')
          .update({
            delivery_address: deliveryAddress,
            delivery_notes: deliveryNotes,
            total_amount: subtotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        if (orderError) throw orderError;

        // Update wholesale order items
        const { error: deleteError } = await supabase
          .from('wholesale_order_items')
          .delete()
          .eq('order_id', order.id);

        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase
          .from('wholesale_order_items')
          .insert(
            items.map((item) => ({
              order_id: order.id,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_price: item.price,
              subtotal: item.quantity * item.price,
            }))
          );

        if (insertError) throw insertError;

        // Invalidate wholesale order queries
        queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
      }

      toast.success('Order updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to update order', error, { component: 'OrderEditModal' });
      toast.error('Failed to update order', { description: humanizeError(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" {...dialogContentProps}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Order {order.tracking_code ? `#${order.tracking_code}` : `#${order.id.slice(0, 8)}`}
          </DialogTitle>
          <DialogDescription>
            Modify order items and delivery details before confirmation
          </DialogDescription>
        </DialogHeader>

        {/* Edit Restriction Warning */}
        {!canEdit && editRestrictionMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{editRestrictionMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6 py-4">
          {/* Current Status */}
          <div>
            <Label className="text-muted-foreground">Current Status</Label>
            <div className="mt-1">
              <Badge
                variant={
                  order.status === 'pending'
                    ? 'default'
                    : order.status === 'confirmed'
                    ? 'outline'
                    : order.status === 'delivered' || order.status === 'completed'
                    ? 'secondary'
                    : 'destructive'
                }
              >
                {order.status}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Order Items */}
          <div className="space-y-3">
            <Label>Order Items</Label>
            {items.map((item) => (
              <Card key={item.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.product_name}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          disabled={!canEdit}
                          onClick={() =>
                            handleUpdateItem(
                              item.id,
                              'quantity',
                              Math.max(1, item.quantity - 1)
                            )
                          }
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(
                              item.id,
                              'quantity',
                              Math.max(1, Number(e.target.value))
                            )
                          }
                          aria-label={`Quantity for ${item.product_name || 'item'}`}
                          className="h-7 w-16 text-center"
                          min={1}
                          disabled={!canEdit}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          disabled={!canEdit}
                          onClick={() =>
                            handleUpdateItem(item.id, 'quantity', item.quantity + 1)
                          }
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground">@</div>
                      {/* Price Input */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={item.price}
                          onChange={(e) =>
                            handleUpdateItem(
                              item.id,
                              'price',
                              Math.max(0, Number(e.target.value))
                            )
                          }
                          aria-label={`Price for ${item.product_name || 'item'}`}
                          className="h-7 w-20"
                          step="0.01"
                          min={0}
                          disabled={!canEdit}
                        />
                        <span className="text-xs text-muted-foreground">each</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-semibold">
                      {formatCurrency(item.quantity * item.price)}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive mt-1"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={!canEdit || items.length <= 1}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No items in this order
              </div>
            )}

            {/* Totals */}
            <div className="flex justify-between items-center pt-2 border-t">
              <div className="text-sm text-muted-foreground">
                Total: {totalItems} item{totalItems !== 1 ? 's' : ''}
              </div>
              <div className="text-lg font-semibold font-mono">
                {formatCurrency(subtotal)}
              </div>
            </div>
          </div>

          <Separator />

          {/* Delivery Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delivery-address">Delivery Address</Label>
              <Input
                id="delivery-address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter delivery address..."
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery-notes">Delivery Notes</Label>
              <Textarea
                id="delivery-notes"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Special instructions for delivery..."
                rows={2}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-notes">Customer Notes</Label>
              <Textarea
                id="customer-notes"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Notes from customer..."
                rows={2}
                disabled={!canEdit}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => guardedOnOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !canEdit}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <DiscardAlert />
    </>
  );
}
