import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  DollarSign,
  Package,
  AlertCircle,
  Truck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cleanProductName } from '@/utils/productName';
import { formatDistanceToNow } from 'date-fns';

interface OrderApprovalDialogProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OrderApprovalDialog = ({ order, open, onOpenChange }: OrderApprovalDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const queryClient = useQueryClient();

  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const totalQuantity = orderItems.reduce((sum: number, item: any) => 
    sum + (item.quantity || 0), 0
  );

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      // Update order status
      const { error: updateError } = await supabase
        .from('menu_orders')
        .update({ 
          status: 'confirmed',
          approved_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // TODO: Create wholesale_order and deduct from inventory
      // This would integrate with the existing wholesale system

      toast.success('Order approved successfully');
      queryClient.invalidateQueries({ queryKey: ['menu-orders'] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to approve order', {
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('menu_orders')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason,
          rejected_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      toast.success('Order rejected');
      queryClient.invalidateQueries({ queryKey: ['menu-orders'] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to reject order', {
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Order #{order.id.slice(0, 8)}</DialogTitle>
            <Badge variant={order.status === 'pending' ? 'default' : order.status === 'confirmed' ? 'outline' : 'destructive'}>
              {order.status}
            </Badge>
          </div>
          <DialogDescription>
            Placed {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <div>
            <h3 className="font-semibold mb-3">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4 bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{order.contact_name || 'Anonymous'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium">{order.contact_phone || 'N/A'}</p>
                </div>
              </div>
              {order.delivery_address && (
                <div className="col-span-2 flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground">Delivery Address</p>
                    <p className="font-medium">{order.delivery_address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Details */}
          <div>
            <h3 className="font-semibold mb-3">Order Details</h3>
            <div className="space-y-3">
              {orderItems.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-muted/30 rounded-lg p-3">
                  <div>
                    <p className="font-medium">{cleanProductName(item.product_name || 'Product')}</p>
                    <p className="text-sm text-muted-foreground">
                      ${item.price_per_unit}/lb × {item.quantity} lbs
                    </p>
                  </div>
                  <p className="font-bold text-primary">
                    ${((item.price_per_unit || 0) * (item.quantity || 0)).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal ({totalQuantity} lbs)</span>
                <span>${order.total_amount?.toLocaleString() || '0'}</span>
              </div>
              {order.delivery_method === 'delivery' && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Delivery Fee</span>
                  <span>$200</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">${order.total_amount?.toLocaleString() || '0'}</span>
              </div>
            </div>
          </div>

          {/* Delivery & Payment Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Delivery Method</p>
              </div>
              <p className="text-lg font-semibold">
                {order.delivery_method === 'delivery' ? 'Delivery' : 'Pickup'}
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Payment Method</p>
              </div>
              <p className="text-lg font-semibold">
                {order.payment_method === 'cash' ? 'Cash' :
                 order.payment_method === 'crypto' ? 'Crypto' : 'Credit'}
              </p>
            </div>
          </div>

          {/* Urgency */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Urgency</p>
            </div>
            <p className="text-lg font-semibold">
              {order.urgency === 'asap' ? 'ASAP (Today/Tomorrow)' :
               order.urgency === 'this_week' ? 'This Week' :
               order.specific_date ? new Date(order.specific_date).toLocaleDateString() : 'Not specified'}
            </p>
          </div>

          {/* Notes */}
          {order.notes && (
            <div>
              <Label className="mb-2 block">Customer Notes</Label>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Rejection Form */}
          {showRejectionForm && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <Label htmlFor="rejection-reason" className="mb-2 block">
                  Rejection Reason *
                </Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this order is being rejected..."
                  rows={3}
                />
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          {order.status === 'pending' && !showRejectionForm && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowRejectionForm(true)}
                disabled={isProcessing}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isProcessing}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Order
              </Button>
            </>
          )}
          
          {showRejectionForm && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectionForm(false);
                  setRejectionReason('');
                }}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isProcessing || !rejectionReason.trim()}
              >
                Confirm Rejection
              </Button>
            </>
          )}
          
          {order.status !== 'pending' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
