import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, ShoppingBag, Check } from "lucide-react";

interface GuestCheckoutOptionProps {
  onGuestCheckout: () => void;
  onSignup: () => void;
  cartTotal?: number;
  borough?: string;
  memberDeliveryFee?: number;
  guestDeliveryFee?: number;
}

const GuestCheckoutOption = ({ 
  onGuestCheckout, 
  onSignup, 
  cartTotal = 0,
  borough = "",
  memberDeliveryFee = 0,
  guestDeliveryFee = 0 
}: GuestCheckoutOptionProps) => {
  // Calculate accurate savings
  const firstOrderDiscount = cartTotal * 0.1; // 10% off subtotal
  const deliveryFeeSavings = guestDeliveryFee - memberDeliveryFee; // Difference in delivery fees
  const totalSavings = firstOrderDiscount + deliveryFeeSavings;
  
  const memberTotal = cartTotal + memberDeliveryFee - firstOrderDiscount;
  const guestTotal = cartTotal + guestDeliveryFee;
  
  const boroughName = borough ? borough.charAt(0).toUpperCase() + borough.slice(1) : "";

  return (
    <div className="grid md:grid-cols-2 gap-6 mb-8">
      {/* Signup Option - Premium Benefits */}
      <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background hover:border-primary/50 transition-colors">
        <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-white px-4 py-1.5 text-xs font-bold rounded-bl-lg">
          RECOMMENDED
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Become a Member</h3>
              {cartTotal > 0 && totalSavings > 0 && (
                <p className="text-lg font-bold text-primary">Save ${totalSavings.toFixed(2)} today</p>
              )}
            </div>
          </div>
          
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-start gap-2.5">
              <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <span><strong>10% off</strong> THIS order (${firstOrderDiscount.toFixed(2)} discount)</span>
            </li>
            {/* Only show delivery fee savings when cart is under $100 and there's actual savings */}
            {cartTotal < 100 && deliveryFeeSavings > 0 && (
              <li className="flex items-start gap-2.5">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span><strong>Lower delivery fee</strong> (${memberDeliveryFee.toFixed(2)} vs ${guestDeliveryFee.toFixed(2)})</span>
              </li>
            )}
            <li className="flex items-start gap-2.5">
              <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <span><strong>FREE delivery</strong> on orders $100+</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <span><strong>Track orders</strong> in real-time</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <span><strong>Faster checkout</strong> next time</span>
            </li>
          </ul>

          {cartTotal > 0 && totalSavings > 0 && (
            <div className="p-3 bg-primary/10 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Your Total Today:</span>
                <span className="font-bold text-primary">${memberTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Guest Price:</span>
                <span className="line-through">${guestTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <Button onClick={onSignup} className="w-full h-12 text-base font-bold" size="lg">
            Create Account & Save {totalSavings > 0 ? `$${totalSavings.toFixed(2)}` : '10%'}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Takes 30 seconds • No credit card required
          </p>
        </div>
      </Card>

      {/* Guest Checkout - Simple Option */}
      <Card className="p-6 space-y-4 border-2 hover:border-muted-foreground/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <ShoppingBag className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-xl text-muted-foreground">Guest Checkout</h3>
            <p className="text-sm text-muted-foreground">Quick one-time purchase</p>
          </div>
        </div>
        
        <ul className="space-y-2.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2.5">
            <div className="w-5 h-5 flex-shrink-0 mt-0.5">•</div>
            <span>No account needed</span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="w-5 h-5 flex-shrink-0 mt-0.5">•</div>
            <span>Track order via email link</span>
          </li>
          <li className="flex items-start gap-2.5">
            <div className="w-5 h-5 flex-shrink-0 mt-0.5">•</div>
            <span>Standard checkout process</span>
          </li>
          <li className="flex items-start gap-2.5 opacity-50">
            <div className="w-5 h-5 flex-shrink-0 mt-0.5">✗</div>
            <span>No member discounts</span>
          </li>
          <li className="flex items-start gap-2.5 opacity-50">
            <div className="w-5 h-5 flex-shrink-0 mt-0.5">✗</div>
            <span>No free shipping</span>
          </li>
        </ul>

        <Button onClick={onGuestCheckout} variant="outline" className="w-full h-12 text-base font-bold" size="lg">
          Continue as Guest
        </Button>
      </Card>
    </div>
  );
};

export default GuestCheckoutOption;
