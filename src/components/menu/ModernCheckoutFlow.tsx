import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { useMenuCart } from '@/contexts/MenuCartContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronRight, ChevronLeft, ShoppingBag, Truck, CreditCard, FileCheck, Star } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ModernCheckoutFlowProps {
  open: boolean;
  onClose: () => void;
  menuId: string;
  whitelistEntryId?: string;
}

type CheckoutStep = 'review' | 'contact' | 'delivery' | 'payment' | 'legal' | 'confirm';

export function ModernCheckoutFlow({ open, onClose, menuId, whitelistEntryId }: ModernCheckoutFlowProps) {
  const { items, totalAmount, clearCart, updateQuantity, removeItem } = useMenuCart();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('review');
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryState: '',
    deliveryZip: '',
    deliveryMethod: 'standard',
    deliveryTime: '',
    paymentMethod: 'cash',
    notes: '',
    promoCode: '',
    tip: 0,
  });

  // Legal confirmations
  const [confirmations, setConfirmations] = useState({
    ageVerified: false,
    termsAccepted: false,
    privacyAccepted: false,
  });

  // Load saved data from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('guestCheckoutData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse saved checkout data');
      }
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    const dataToSave = {
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      contactEmail: formData.contactEmail,
      deliveryAddress: formData.deliveryAddress,
      deliveryCity: formData.deliveryCity,
      deliveryState: formData.deliveryState,
      deliveryZip: formData.deliveryZip,
    };
    localStorage.setItem('guestCheckoutData', JSON.stringify(dataToSave));
  }, [formData]);

  const steps: { id: CheckoutStep; label: string; icon: any }[] = [
    { id: 'review', label: 'Review', icon: ShoppingBag },
    { id: 'contact', label: 'Contact', icon: FileCheck },
    { id: 'delivery', label: 'Delivery', icon: Truck },
    { id: 'payment', label: 'Payment', icon: CreditCard },
    { id: 'legal', label: 'Legal', icon: FileCheck },
    { id: 'confirm', label: 'Confirm', icon: Check },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 'review':
        return items.length > 0;
      case 'contact':
        return formData.contactName && formData.contactPhone && formData.contactEmail;
      case 'delivery':
        return formData.deliveryAddress && formData.deliveryCity && formData.deliveryState && formData.deliveryZip;
      case 'payment':
        return formData.paymentMethod;
      case 'legal':
        return confirmations.ageVerified && confirmations.termsAccepted && confirmations.privacyAccepted;
      case 'confirm':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please complete all required fields',
      });
      return;
    }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleSubmitOrder = async () => {
    if (!canProceed()) {
      toast({
        variant: 'destructive',
        title: 'Cannot Place Order',
        description: 'Please complete all required confirmations',
      });
      return;
    }

    setLoading(true);

    try {
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

      const { data: order, error: orderError } = await supabase
        .from('menu_orders')
        .insert({
          menu_id: menuId,
          access_whitelist_id: whitelistEntryId || null,
          order_data: orderData,
          total_amount: totalAmount + formData.tip,
          contact_phone: formData.contactPhone,
          delivery_address: `${formData.deliveryAddress}, ${formData.deliveryCity}, ${formData.deliveryState} ${formData.deliveryZip}`,
          customer_notes: formData.notes,
          status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setOrderNumber(order.id);
      setOrderConfirmed(true);
      clearCart();

      // Send notification
      supabase.functions.invoke('notify-order-placed', {
        body: { orderId: order.id },
      }).catch(err => console.error('Notification error:', err));

      toast({
        title: 'Order Placed Successfully! 🎉',
        description: `Order #${order.id.slice(0, 8)} has been confirmed`,
      });
    } catch (error: any) {
      console.error('Order submission error:', error);
      toast({
        variant: 'destructive',
        title: 'Order Failed',
        description: error.message || 'Failed to place order',
      });
    } finally {
      setLoading(false);
    }
  };

  const finalTotal = totalAmount + formData.tip;

  if (orderConfirmed) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <div className="text-center space-y-6 py-8">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-6">
                <Check className="h-16 w-16 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Order Confirmed!</h2>
              <p className="text-muted-foreground">
                Your order has been successfully placed
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-6 py-2">
              Order #{orderNumber.slice(0, 8)}
            </Badge>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>✉️ Confirmation email sent to {formData.contactEmail}</p>
              <p>📱 We'll contact you at {formData.contactPhone}</p>
            </div>
            <Button onClick={onClose} className="w-full" size="lg">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} />
          <div className="flex justify-between text-xs text-muted-foreground">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = idx === currentStepIndex;
              const isComplete = idx < currentStepIndex;
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-1 ${isActive ? 'text-primary font-semibold' : ''} ${isComplete ? 'text-primary' : ''}`}
                >
                  <StepIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 'review' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Order Review</h3>
              {items.map((item) => (
                <Card key={item.productId} className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                      <p className="font-semibold w-20 text-right">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeItem(item.productId)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {currentStep === 'contact' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Contact Information</h3>
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
            </div>
          )}

          {currentStep === 'delivery' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Delivery Information</h3>
              <div className="space-y-2">
                <Label htmlFor="deliveryAddress">Street Address *</Label>
                <Input
                  id="deliveryAddress"
                  required
                  value={formData.deliveryAddress}
                  onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                  placeholder="123 Main St, Apt 4B"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deliveryCity">City *</Label>
                  <Input
                    id="deliveryCity"
                    required
                    value={formData.deliveryCity}
                    onChange={(e) => setFormData({ ...formData, deliveryCity: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryState">State *</Label>
                  <Input
                    id="deliveryState"
                    required
                    value={formData.deliveryState}
                    onChange={(e) => setFormData({ ...formData, deliveryState: e.target.value })}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryZip">ZIP Code *</Label>
                  <Input
                    id="deliveryZip"
                    required
                    value={formData.deliveryZip}
                    onChange={(e) => setFormData({ ...formData, deliveryZip: e.target.value })}
                    placeholder="12345"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryMethod">Delivery Method</Label>
                <select
                  id="deliveryMethod"
                  value={formData.deliveryMethod}
                  onChange={(e) => setFormData({ ...formData, deliveryMethod: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border bg-background"
                >
                  <option value="standard">Standard Delivery (2-3 days)</option>
                  <option value="express">Express Delivery (Next day)</option>
                  <option value="pickup">Store Pickup</option>
                </select>
              </div>
            </div>
          )}

          {currentStep === 'payment' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Payment Method</h3>
              <div className="space-y-2">
                <Label>Select Payment Method</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['cash', 'venmo', 'zelle', 'paypal'].map((method) => (
                    <button
                      key={method}
                      onClick={() => setFormData({ ...formData, paymentMethod: method })}
                      className={`p-4 border rounded-lg text-left transition-all ${
                        formData.paymentMethod === method
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium capitalize">{method}</p>
                      <p className="text-sm text-muted-foreground">
                        {method === 'cash' && 'Pay on delivery'}
                        {method === 'venmo' && 'Digital payment'}
                        {method === 'zelle' && 'Bank transfer'}
                        {method === 'paypal' && 'Online payment'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tip">Add a Tip (Optional)</Label>
                <div className="flex gap-2">
                  {[0, 5, 10, 15].map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant={formData.tip === amount ? 'default' : 'outline'}
                      onClick={() => setFormData({ ...formData, tip: amount })}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Order Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special instructions..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {currentStep === 'legal' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-lg">Legal Confirmations</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <Checkbox
                    id="ageVerified"
                    checked={confirmations.ageVerified}
                    onCheckedChange={(checked) =>
                      setConfirmations({ ...confirmations, ageVerified: !!checked })
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor="ageVerified" className="font-semibold cursor-pointer">
                      Age Verification (Required)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      I confirm that I am 21 years of age or older
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <Checkbox
                    id="termsAccepted"
                    checked={confirmations.termsAccepted}
                    onCheckedChange={(checked) =>
                      setConfirmations({ ...confirmations, termsAccepted: !!checked })
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor="termsAccepted" className="font-semibold cursor-pointer">
                      Terms & Conditions (Required)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      I agree to the terms and conditions of sale
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <Checkbox
                    id="privacyAccepted"
                    checked={confirmations.privacyAccepted}
                    onCheckedChange={(checked) =>
                      setConfirmations({ ...confirmations, privacyAccepted: !!checked })
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor="privacyAccepted" className="font-semibold cursor-pointer">
                      Privacy Policy (Required)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      I acknowledge the privacy policy and data handling practices
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'confirm' && (
            <div className="space-y-6">
              <h3 className="font-semibold text-lg">Review Your Order</h3>
              <div className="bg-muted p-4 rounded-lg space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-medium">{formData.contactName}</p>
                  <p className="text-sm">{formData.contactEmail}</p>
                  <p className="text-sm">{formData.contactPhone}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Delivery</p>
                  <p className="text-sm">{formData.deliveryAddress}</p>
                  <p className="text-sm">
                    {formData.deliveryCity}, {formData.deliveryState} {formData.deliveryZip}
                  </p>
                  <p className="text-sm capitalize">{formData.deliveryMethod} delivery</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Payment</p>
                  <p className="text-sm capitalize">{formData.paymentMethod}</p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                  {formData.tip > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Tip</span>
                      <span>${formData.tip.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">${finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={currentStepIndex === 0 ? onClose : handleBack}
            disabled={loading}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </Button>
          {currentStep === 'confirm' ? (
            <Button onClick={handleSubmitOrder} disabled={loading || !canProceed()} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Placing Order...
                </>
              ) : (
                <>
                  Place Order - ${finalTotal.toFixed(2)}
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()} className="flex-1">
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
