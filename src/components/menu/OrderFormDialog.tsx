import { logger } from '@/lib/logger';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useMenuCart } from '@/contexts/MenuCartContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface OrderFormDialogProps {
  open: boolean;
  onClose: () => void;
  menuId: string;
  whitelistEntryId?: string;
}

export function OrderFormDialog({ open, onClose, menuId, whitelistEntryId }: OrderFormDialogProps) {
  const { items, totalAmount, clearCart } = useMenuCart();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    deliveryAddress: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cart is empty',
        description: 'Please add items to your cart before placing an order.',
      });
      return;
    }

    setLoading(true);

    try {
      // Prepare order data
      const orderData = {
        items: items.map(item => ({
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
        })),
        contact_name: formData.contactName,
        contact_email: formData.contactEmail,
      };

      // Insert order
      const { data: order, error: orderError } = await supabase
        .from('menu_orders')
        .insert({
          menu_id: menuId,
          access_whitelist_id: whitelistEntryId || null,
          order_data: orderData,
          total_amount: totalAmount,
          contact_phone: formData.contactPhone,
          delivery_address: formData.deliveryAddress,
          customer_notes: formData.notes,
          status: 'pending',
        } as any)
        .select()
        .maybeSingle();

      if (orderError) throw orderError;

      // Send order notifications (fire-and-forget, but still check for errors)
      supabase.functions.invoke('notify-order-placed', {
        body: { orderId: order.id },
      }).then(({ data, error }) => {
        if (error) {
          logger.error('Notification error', error, { component: 'OrderFormDialog', orderId: order.id });
          return;
        }
        // Check for error in response body (some edge functions return 200 with error)
        if (data && typeof data === 'object' && 'error' in data && data.error) {
          logger.error('Notification returned error in response', new Error(String(data.error)), { component: 'OrderFormDialog', orderId: order.id });
        }
      }).catch((err: unknown) => {
        logger.error('Notification error', err instanceof Error ? err : new Error(String(err)), { component: 'OrderFormDialog', orderId: order.id });
      });

      // Clear cart and close
      clearCart();
      onClose();

      toast({
        title: 'Order Placed Successfully',
        description: 'Your order has been submitted. We\'ll contact you shortly.',
      });
    } catch (error: unknown) {
      logger.error('Order submission error', error instanceof Error ? error : new Error(String(error)), { component: 'OrderFormDialog', menuId });
      toast({
        variant: 'destructive',
        title: 'Order Failed',
        description: error instanceof Error ? error.message : 'Failed to place order. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h3 className="font-semibold">Order Summary</h3>
            <div className="space-y-1 text-sm">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between">
                  <span>{item.productName} × {item.quantity}</span>
                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t flex justify-between font-semibold">
              <span>Total:</span>
              <span className="text-primary">${totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Full Name *</Label>
                <Input
                  id="contactName"
                  required
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone Number *</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  required
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email Address *</Label>
              <Input
                id="contactEmail"
                type="email"
                required
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryAddress">Delivery Address *</Label>
              <Textarea
                id="deliveryAddress"
                required
                value={formData.deliveryAddress}
                onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                placeholder="123 Main St, Apt 4B, City, State 12345"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Order Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special instructions or requests..."
                rows={3}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Placing Order...
                </>
              ) : (
                `Place Order - $${totalAmount.toFixed(2)}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
