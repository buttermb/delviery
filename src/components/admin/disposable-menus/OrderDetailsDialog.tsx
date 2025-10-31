import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingBag, 
  User, 
  Phone, 
  Mail, 
  MapPin,
  Package,
  Clock,
  DollarSign,
  FileText,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { OrderStatusBadge } from './OrderStatusBadge';
import { useSendNotification } from '@/hooks/useNotifications';

interface OrderDetailsDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const OrderDetailsDialog = ({
  order,
  open,
  onOpenChange,
  onUpdate
}: OrderDetailsDialogProps) => {
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState(order.status);
  const [notes, setNotes] = useState('');
  const sendNotification = useSendNotification();

  const handleUpdateStatus = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('menu_orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      // Send notification if status changed
      if (newStatus !== order.status) {
        const eventMap: any = {
          'pending': 'order_placed',
          'processing': 'order_processing',
          'completed': 'order_completed',
          'cancelled': 'order_cancelled'
        };

        const event = eventMap[newStatus];
        if (event) {
          sendNotification.mutate({ orderId: order.id, event });
        }
      }

      toast({
        title: 'Order Updated',
        description: `Order status changed to ${newStatus}`,
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message,
      });
    } finally {
      setUpdating(false);
    }
  };

  const totalAmount = parseFloat(String(order.total_amount || 0));
  
  // Extract items from order_data JSON
  const orderItems = order.order_data && typeof order.order_data === 'object' && 'items' in order.order_data 
    ? (order.order_data as any).items 
    : [];
  
  const itemsTotal = orderItems.reduce((sum: number, item: any) => 
    sum + (parseFloat(item.price || item.price_per_unit || 0) * (item.quantity || 0)), 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Order Details
          </DialogTitle>
          <DialogDescription>
            Order placed {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-12rem)]">
          <div className="space-y-6 pr-4">
            {/* Status and Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Current Status</Label>
                <OrderStatusBadge status={order.status} />
              </div>

              <div className="space-y-2">
                <Label>Update Status</Label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Add Note (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal notes about this order..."
                  rows={3}
                />
              </div>

              {newStatus !== order.status && (
                <Button 
                  onClick={handleUpdateStatus} 
                  disabled={updating}
                  className="w-full"
                >
                  {updating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Update Order Status
                    </>
                  )}
                </Button>
              )}
            </div>

            <Separator />

            {/* Customer Information */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {order.whitelist?.customer_name || 'Not provided'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{order.whitelist?.customer_phone || order.contact_phone || 'Not provided'}</span>
                </div>
                {order.whitelist?.customer_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{order.whitelist.customer_email}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Order Items */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Order Items ({orderItems.length})
              </h3>
              <div className="space-y-2">
                {orderItems.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No items in this order
                  </div>
                ) : (
                  orderItems.map((item: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{item.name || item.product_name}</div>
                          {item.weight && (
                            <div className="text-sm text-muted-foreground">
                              Weight: {item.weight}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            ${((parseFloat(item.price || item.price_per_unit || 0)) * (item.quantity || 0)).toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.quantity} x ${parseFloat(item.price || item.price_per_unit || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Order Summary */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Order Summary
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${itemsTotal.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-xl">${totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Delivery Information */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Delivery Information
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Method:</span>{' '}
                  <Badge variant="outline">{order.delivery_method || 'Not specified'}</Badge>
                </div>
                {order.special_instructions && (
                  <div>
                    <span className="text-muted-foreground">Special Instructions:</span>
                    <p className="mt-1 p-2 bg-muted rounded text-sm">
                      {order.special_instructions}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Menu Information */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Menu Information
              </h3>
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Menu:</span>
                  <span className="font-medium">{order.menu?.name || 'Unknown'}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Timestamps */}
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>Created: {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm:ss')}</span>
              </div>
              {order.updated_at && order.updated_at !== order.created_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>Updated: {format(new Date(order.updated_at), 'MMM dd, yyyy HH:mm:ss')}</span>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
