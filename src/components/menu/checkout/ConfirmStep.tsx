import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ShoppingCart, User, ArrowLeft,
  Loader2, Check, Truck, Store,
  CheckCircle, ChevronDown, Edit2,
} from 'lucide-react';
import { useMenuCartStore } from '@/stores/menuCartStore';
import { formatWeight } from '@/utils/productHelpers';
import { cn } from '@/lib/utils';
import type { CheckoutStep, PaymentMethod } from './types';
import { DELIVERY_METHODS } from './types';

export function ConfirmStep({
  formData,
  onSubmit,
  onBack,
  onEdit,
  isSubmitting,
  paymentMethods
}: {
  formData: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    deliveryMethod: string;
    address: string;
    city: string;
    zipCode: string;
    paymentMethod: string;
    notes: string;
  };
  onSubmit: () => void;
  onBack: () => void;
  onEdit: (step: CheckoutStep) => void;
  isSubmitting: boolean;
  paymentMethods: PaymentMethod[];
}) {
  const cartItems = useMenuCartStore((state) => state.items);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const getItemCount = useMenuCartStore((state) => state.getItemCount);

  const [agreed, setAgreed] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const totalAmount = getTotal();
  const totalItems = getItemCount();
  const serviceFee = totalAmount * 0.05;
  const finalTotal = totalAmount + serviceFee;

  const deliveryLabel = DELIVERY_METHODS.find(m => m.id === formData.deliveryMethod)?.label;
  const paymentMethod = paymentMethods.find(m => m.id === formData.paymentMethod);

  const canSubmit = agreed && ageVerified;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="text-center mb-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold">Review Your Order</h2>
          <p className="text-sm text-muted-foreground">Make sure everything looks good</p>
        </div>

        {/* Order Summary */}
        <Collapsible
          open={expandedSection === 'items'}
          onOpenChange={() => setExpandedSection(expandedSection === 'items' ? null : 'items')}
        >
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <CardTitle className="text-sm">Items ({totalItems})</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">${finalTotal.toFixed(2)}</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", expandedSection === 'items' && "rotate-180")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-3 px-4 space-y-2">
                {cartItems.map((item) => (
                  <div key={`${item.productId}-${item.weight}`} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.productName}
                      {item.weight && ` (${formatWeight(item.weight)})`}
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Service fee</span>
                    <span>${serviceFee.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Contact Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Contact</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit('details')} className="h-7 text-xs">
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
            <div className="text-sm space-y-1">
              <div>{formData.firstName} {formData.lastName}</div>
              <div className="text-muted-foreground">{formData.phone}</div>
              {formData.email && <div className="text-muted-foreground">{formData.email}</div>}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {formData.deliveryMethod === 'delivery' ? (
                  <Truck className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Store className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium text-sm">{deliveryLabel}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit('location')} className="h-7 text-xs">
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
            {formData.deliveryMethod === 'delivery' && formData.address && (
              <div className="text-sm text-muted-foreground">
                {formData.address}
                {formData.city && `, ${formData.city}`}
                {formData.zipCode && ` ${formData.zipCode}`}
              </div>
            )}
            {formData.notes && (
              <div className="text-xs text-muted-foreground mt-2 italic">
                "{formData.notes}"
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {paymentMethod && <paymentMethod.icon className="h-4 w-4 text-muted-foreground" />}
                <span className="font-medium text-sm">Payment</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit('payment')} className="h-7 text-xs">
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {paymentMethod?.label} - {paymentMethod?.description}
            </div>
          </CardContent>
        </Card>

        {/* Age verification */}
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <Checkbox
            id="ageVerify"
            checked={ageVerified}
            onCheckedChange={(checked) => setAgeVerified(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="ageVerify" className="text-sm cursor-pointer">
            <span className="font-medium">I confirm I am 21 years of age or older</span>
            <span className="text-muted-foreground block text-xs mt-0.5">
              Required for all orders
            </span>
          </label>
        </div>

        {/* Terms agreement */}
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5"
          />
          <label htmlFor="terms" className="text-xs text-muted-foreground cursor-pointer">
            I agree to the terms of service and understand that this order is for personal use only.
            Providing false information may result in order cancellation.
          </label>
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="border-t bg-card px-4 py-4 space-y-3">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Total</span>
          <span className="text-primary">${finalTotal.toFixed(2)}</span>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} disabled={isSubmitting} className="h-14 px-6" aria-label="Go back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting}
            className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Placing Order...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Place Order
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
