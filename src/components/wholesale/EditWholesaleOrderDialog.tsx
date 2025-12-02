import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Plus, Minus, Trash2, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useWholesaleCouriers } from '@/hooks/useWholesaleData';

interface OrderItem {
  id: string;
  product_name: string;
  quantity_lbs: number;
  unit_price: number;
}

interface WholesaleOrder {
  id: string;
  order_number: string;
  client_id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  delivery_address: string;
  delivery_notes?: string;
  runner_id?: string;
  created_at: string;
  client?: {
    business_name: string;
    contact_name: string;
  };
  courier?: {
    full_name: string;
    vehicle_type?: string;
    status?: string;
  };
  items?: OrderItem[];
}

interface EditWholesaleOrderDialogProps {
  order: WholesaleOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditWholesaleOrderDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: EditWholesaleOrderDialogProps) {
  const queryClient = useQueryClient();
  const { data: couriers = [] } = useWholesaleCouriers();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [items, setItems] = useState<OrderItem[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [runnerId, setRunnerId] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  // Reset form when order changes
  useEffect(() => {
    if (order) {
      setItems(order.items || []);
      setDeliveryAddress(order.delivery_address || '');
      setDeliveryNotes(order.delivery_notes || '');
      setRunnerId(order.runner_id || '');
      setStatus(order.status);
      setPaymentStatus(order.payment_status);
    }
  }, [order]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.quantity_lbs * item.unit_price, 0);
  const totalWeight = items.reduce((sum, item) => sum + item.quantity_lbs, 0);

  // Item handlers
  const handleUpdateItem = (itemId: string, field: 'quantity_lbs' | 'unit_price', value: number) => {
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

    if (items.length === 0) {
      toast.error('Order must have at least one item');
      return;
    }

    setIsSubmitting(true);

    try {
      // Update order details
      const { error: orderError } = await supabase
        .from('wholesale_orders')
        .update({
          delivery_address: deliveryAddress,
          delivery_notes: deliveryNotes,
          runner_id: runnerId || null,
          status,
          payment_status: paymentStatus,
          total_amount: subtotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Update order items
      // First, delete existing items
      const { error: deleteError } = await supabase
        .from('wholesale_order_items')
        .delete()
        .eq('order_id', order.id);

      if (deleteError) throw deleteError;

      // Insert updated items
      // @ts-ignore - quantity/subtotal fields mismatch with Supabase types
      const { error: insertError } = await supabase
        .from('wholesale_order_items')
        .insert(
          items.map((item) => ({
            order_id: order.id,
            product_name: item.product_name,
            quantity_lbs: item.quantity_lbs,
            unit_price: item.unit_price,
          })) as any
        );

      if (insertError) throw insertError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });

      toast.success('Order updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to update order', error, { component: 'EditWholesaleOrderDialog' });
      toast.error('Failed to update order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Edit Order #{order.order_number}
          </DialogTitle>
          <DialogDescription>
            Modify order details, items, and delivery information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Client Info (Read-only) */}
          <div>
            <Label className="text-muted-foreground">Client</Label>
            <div className="mt-1 p-3 bg-muted rounded-lg">
              <p className="font-medium">{order.client?.business_name || 'Unknown Client'}</p>
              <p className="text-sm text-muted-foreground">{order.client?.contact_name}</p>
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Order Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
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
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            handleUpdateItem(item.id, 'quantity_lbs', Math.max(1, item.quantity_lbs - 1))
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          value={item.quantity_lbs}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'quantity_lbs', Math.max(1, Number(e.target.value)))
                          }
                          className="h-7 w-16 text-center"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            handleUpdateItem(item.id, 'quantity_lbs', item.quantity_lbs + 1)
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground">lbs</span>
                      </div>
                      <div className="text-sm text-muted-foreground">@</div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleUpdateItem(item.id, 'unit_price', Math.max(0, Number(e.target.value)))
                          }
                          className="h-7 w-20"
                          step="0.01"
                        />
                        <span className="text-xs text-muted-foreground">/lb</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-semibold">
                      {formatCurrency(item.quantity_lbs * item.unit_price)}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive mt-1"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {/* Totals */}
            <div className="flex justify-between items-center pt-2 border-t">
              <div className="text-sm text-muted-foreground">
                Total: {totalWeight} lbs
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
              <Label>Assign Courier</Label>
              <Select value={runnerId} onValueChange={setRunnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a courier..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {couriers.map((courier: any) => (
                    <SelectItem key={courier.id} value={courier.id}>
                      <div className="flex items-center gap-2">
                        <span>{courier.full_name}</span>
                        {courier.vehicle_type && (
                          <span className="text-xs text-muted-foreground">({courier.vehicle_type})</span>
                        )}
                        {courier.status && (
                          <Badge 
                            variant={courier.status === 'available' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {courier.status}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Delivery Address</Label>
              <Input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter delivery address..."
              />
            </div>

            <div className="space-y-2">
              <Label>Delivery Notes</Label>
              <Textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Special instructions for delivery..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
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
      </DialogContent>
    </Dialog>
  );
}

export default EditWholesaleOrderDialog;

