import { useState, useEffect } from 'react';
import { X, Gift, Truck, Zap, Shield, Package, Activity, Heart, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { analytics } from '@/utils/analytics';

interface SignUpIncentivePopupProps {
  cartTotal: number;
  onSignUp: (email: string) => void;
  onContinueAsGuest: () => void;
  onClose: () => void;
  isVisible: boolean;
}

export default function SignUpIncentivePopup({ 
  cartTotal, 
  onSignUp, 
  onContinueAsGuest,
  onClose,
  isVisible 
}: SignUpIncentivePopupProps) {
  const [email, setEmail] = useState('');
  const discountAmount = (cartTotal * 0.1).toFixed(2);
  
  // Dynamic delivery fee based on cart total
  const currentDeliveryFee = cartTotal >= 100 ? 0 : (cartTotal >= 50 ? 10 : 15);
  const shippingFee = cartTotal >= 100 ? 0 : currentDeliveryFee;
  const totalSavings = (parseFloat(discountAmount) + shippingFee).toFixed(2);

  useEffect(() => {
    if (isVisible) {
      analytics.trackPopupViewed(cartTotal, 0, parseFloat(discountAmount));
      
      // Handle ESC key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          analytics.trackPopupDismissed(cartTotal, 'esc_key');
          onClose();
        }
      };
      
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isVisible, cartTotal, discountAmount, onClose]);

  if (!isVisible) return null;

  const handleSignUp = () => {
    if (!email.includes('@')) {
      return;
    }
    analytics.trackPopupSignup(email, cartTotal, parseFloat(totalSavings));
    onSignUp(email);
  };

  const handleGuestCheckout = () => {
    analytics.trackPopupGuestCheckout(cartTotal, parseFloat(totalSavings));
    onContinueAsGuest();
  };

  const handleClose = () => {
    analytics.trackPopupDismissed(cartTotal, 'close_button');
    onClose();
  };

  const handleBackdropClick = () => {
    analytics.trackPopupDismissed(cartTotal, 'backdrop_click');
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={handleBackdropClick}
      />
      
      {/* Popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className={cn(
            "bg-background rounded-3xl shadow-2xl w-full max-w-md",
            "p-6 md:p-8 pointer-events-auto animate-scale-in",
            "max-h-[90vh] overflow-y-auto"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Close Button */}
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors touch-target"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-4 rounded-full">
              <Gift className="w-12 h-12 text-primary" />
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
            Save ${totalSavings} Today! 🎉
          </h2>
          
          <p className="text-muted-foreground text-center mb-6">
            Create an account to unlock your discount
          </p>

          {/* Benefits - Dynamic based on cart total */}
          <div className="space-y-3 mb-6 bg-muted/50 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-primary p-1.5 rounded-full flex-shrink-0">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm">
                ✓ <strong>10% off THIS order</strong> (${discountAmount} discount)
              </span>
            </div>
            
            {/* Show delivery fee comparison only when it makes sense */}
            {cartTotal < 100 && (
              <div className="flex items-center gap-3">
                <div className="bg-primary p-1.5 rounded-full flex-shrink-0">
                  <Truck className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-sm">
                  🚚 <strong>Lower delivery fee</strong> ($0.00 vs ${currentDeliveryFee.toFixed(2)})
                </span>
              </div>
            )}
            
            {cartTotal < 100 && (
              <div className="flex items-center gap-3">
                <div className="bg-primary p-1.5 rounded-full flex-shrink-0">
                  <Package className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-sm">
                  📦 <strong>FREE delivery</strong> on orders $100+
                </span>
              </div>
            )}
            
            {cartTotal >= 100 && (
              <div className="flex items-center gap-3">
                <div className="bg-primary p-1.5 rounded-full flex-shrink-0">
                  <Zap className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-sm">
                  ⚡ <strong>Priority delivery</strong> notifications
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="bg-primary p-1.5 rounded-full flex-shrink-0">
                <Activity className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm">
                📦 <strong>Track orders</strong> in real-time
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-primary p-1.5 rounded-full flex-shrink-0">
                <Heart className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm">
                💾 <strong>Save favorites</strong> for faster reordering
              </span>
            </div>
            
            {cartTotal >= 100 && (
              <div className="flex items-center gap-3">
                <div className="bg-primary p-1.5 rounded-full flex-shrink-0">
                  <Gift className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-sm">
                  🎁 <strong>Early access</strong> to new strains
                </span>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="bg-primary p-1.5 rounded-full flex-shrink-0">
                <Clock className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm">
                ⏱️ <strong>Faster checkout</strong> next time
              </span>
            </div>
          </div>

          {/* Email Input */}
          <div className="space-y-2 mb-4">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 text-base"
              autoComplete="email"
              inputMode="email"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && email.includes('@')) {
                  handleSignUp();
                }
              }}
            />
          </div>

          {/* Primary CTA */}
          <Button
            onClick={handleSignUp}
            disabled={!email.includes('@')}
            variant="hero"
            size="lg"
            className="w-full h-14 mb-3 text-base font-semibold"
          >
            Sign Up & Save ${totalSavings}
          </Button>

          {/* Secondary CTA */}
          <button
            onClick={handleGuestCheckout}
            className="w-full text-muted-foreground text-sm hover:text-foreground transition-colors py-3"
          >
            No thanks, I'll pay full price
          </button>

          {/* Trust Signal */}
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>Your info is secure. Unsubscribe anytime.</span>
          </div>
        </div>
      </div>
    </>
  );
}
