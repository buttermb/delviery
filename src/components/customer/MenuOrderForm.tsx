import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, CreditCard, Truck, Package, Calendar } from 'lucide-react';
import { CartItem } from './MenuCart';
import { cleanProductName } from '@/utils/productName';

interface MenuOrderFormProps {
  items: CartItem[];
  onBack: () => void;
  onSubmit: (orderData: OrderData) => Promise<void>;
  isSubmitting: boolean;
}

export interface OrderData {
  delivery_method: 'delivery' | 'pickup';
  payment_method: 'cash' | 'credit' | 'crypto';
  urgency: 'asap' | 'this_week' | 'specific_date';
  specific_date?: string;
  contact_name: string;
  contact_phone: string;
  delivery_address?: string;
  notes?: string;
}

export const MenuOrderForm = ({
  items,
  onBack,
  onSubmit,
  isSubmitting
}: MenuOrderFormProps) => {
  const [formData, setFormData] = useState<OrderData>({
    delivery_method: 'delivery',
    payment_method: 'cash',
    urgency: 'asap',
    contact_name: '',
    contact_phone: '',
    delivery_address: '',
    notes: ''
  });

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = formData.delivery_method === 'delivery' ? 200 : 0;
  const finalTotal = totalAmount + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.contact_name || !formData.contact_phone) {
      return;
    }

    if (formData.delivery_method === 'delivery' && !formData.delivery_address) {
      return;
    }

    await onSubmit(formData);
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Place Order</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Summary */}
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Order Summary</h2>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.product_id} className="flex justify-between text-sm">
                  <span>{cleanProductName(item.name)} × {item.quantity} lbs</span>
                  <span className="font-medium">${(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              <Separator className="my-3" />
              <div className="flex justify-between text-sm">
                <span>Subtotal ({totalQuantity} lbs)</span>
                <span className="font-medium">${totalAmount.toLocaleString()}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Delivery Fee</span>
                  <span>+${deliveryFee}</span>
                </div>
              )}
              <Separator className="my-3" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">${finalTotal.toLocaleString()}</span>
              </div>
            </div>
          </Card>

          {/* Delivery Method */}
          <Card className="p-6">
            <Label className="text-base font-semibold mb-4 block">Delivery Method</Label>
            <RadioGroup
              value={formData.delivery_method}
              onValueChange={(value: string) => setFormData({ ...formData, delivery_method: value as 'delivery' | 'pickup' })}
            >
              <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="delivery" id="delivery" />
                <Label htmlFor="delivery" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    <span className="font-medium">Delivery</span>
                    <Badge variant="secondary">+$200</Badge>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="pickup" id="pickup" />
                <Label htmlFor="pickup" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Pickup</span>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </Card>

          {/* Payment Method */}
          <Card className="p-6">
            <Label className="text-base font-semibold mb-4 block">Payment Method</Label>
            <RadioGroup
              value={formData.payment_method}
              onValueChange={(value: string) => setFormData({ ...formData, payment_method: value as 'cash' | 'credit' | 'crypto' })}
            >
              <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="font-medium">Cash on {formData.delivery_method === 'delivery' ? 'Delivery' : 'Pickup'}</span>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="credit" id="credit" />
                <Label htmlFor="credit" className="flex-1 cursor-pointer">
                  <span className="font-medium">Credit (if approved)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="crypto" id="crypto" />
                <Label htmlFor="crypto" className="flex-1 cursor-pointer">
                  <span className="font-medium">Cryptocurrency</span>
                </Label>
              </div>
            </RadioGroup>
          </Card>

          {/* Urgency */}
          <Card className="p-6">
            <Label className="text-base font-semibold mb-4 block">When do you need it?</Label>
            <RadioGroup
              value={formData.urgency}
              onValueChange={(value: string) => setFormData({ ...formData, urgency: value as 'asap' | 'this_week' | 'specific_date' })}
            >
              <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="asap" id="asap" />
                <Label htmlFor="asap" className="flex-1 cursor-pointer">
                  <span className="font-medium">ASAP (today/tomorrow)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="this_week" id="this_week" />
                <Label htmlFor="this_week" className="flex-1 cursor-pointer">
                  <span className="font-medium">This week</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="specific_date" id="specific_date" />
                <Label htmlFor="specific_date" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">Specific date</span>
                  </div>
                </Label>
              </div>
            </RadioGroup>
            {formData.urgency === 'specific_date' && (
              <Input
                type="date"
                value={formData.specific_date}
                onChange={(e) => setFormData({ ...formData, specific_date: e.target.value })}
                className="mt-3"
                min={new Date().toISOString().split('T')[0]}
              />
            )}
          </Card>

          {/* Contact Info */}
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Contact Information</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  required
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  required
                  placeholder="555-1234"
                />
              </div>
            </div>
          </Card>

          {/* Delivery Address */}
          {formData.delivery_method === 'delivery' && (
            <Card className="p-6">
              <Label htmlFor="address" className="text-base font-semibold mb-4 block flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Delivery Address *
              </Label>
              <Textarea
                id="address"
                value={formData.delivery_address}
                onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                required={formData.delivery_method === 'delivery'}
                placeholder="Enter delivery address or location details"
                rows={3}
              />
            </Card>
          )}

          {/* Notes */}
          <Card className="p-6">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any special instructions or requests"
              rows={3}
            />
          </Card>

          {/* Submit */}
          <div className="sticky bottom-0 bg-background pt-4 pb-6 border-t">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting Order...' : `Submit Order - $${finalTotal.toLocaleString()}`}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-3">
              Your order will be reviewed and confirmed within 1 hour
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
