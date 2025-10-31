import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ShoppingCart, Percent } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface CartAbandonmentPopupProps {
  cartItems: any[];
  onCheckout: () => void;
}

const CartAbandonmentPopup = ({ cartItems, onCheckout }: CartAbandonmentPopupProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Premium approach: Only trigger after 60 seconds of inactivity on cart page
    if (cartItems.length === 0) return;

    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };

    const exitIntentShown = getCookie("exit_intent_shown");
    if (exitIntentShown) return;

    // Show after 60 seconds of inactivity (premium timing)
    const timer = setTimeout(() => {
      setIsOpen(true);
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `exit_intent_shown=true; expires=${expires}; path=/; SameSite=Lax`;
    }, 60000); // 60 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [cartItems]);

  const handleCheckout = () => {
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `exit_intent_shown=true; expires=${expires}; path=/; SameSite=Lax`;
    setIsOpen(false);
    onCheckout();
  };

  const handleClose = () => {
    setIsOpen(false);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `exit_intent_shown=true; expires=${expires}; path=/; SameSite=Lax`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText("SAVE5NOW");
    toast.success("Code copied! Use at checkout");
  };

  const cartTotal = cartItems.reduce((sum, item) => {
    const price = item.products?.price || 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Special Discount Offer</DialogTitle>
        <DialogDescription className="sr-only">Complete your order now with an exclusive 5% discount</DialogDescription>
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-all hover:rotate-90"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="bg-gradient-to-br from-primary via-primary/90 to-accent p-8 text-center text-white">
          <div className="animate-bounce mb-4">
            <ShoppingCart className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-3xl font-bold mb-2">Wait! Don't Leave Yet!</h2>
          <div className="inline-block bg-white text-primary px-6 py-3 rounded-full text-2xl font-black my-4 shadow-elegant">
            EXTRA 5% OFF
          </div>
          <p className="text-white/90">Complete your order now and save!</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gradient-to-r from-destructive/10 to-primary/10 border-2 border-dashed border-primary rounded-lg p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Percent className="w-4 h-4" />
              <span>Your exclusive code:</span>
            </div>
            <div className="text-3xl font-black text-primary tracking-wider">
              SAVE5NOW
            </div>
            <Button onClick={handleCopyCode} variant="outline" size="sm" className="w-full">
              Copy Code
            </Button>
          </div>

          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Cart Total:</span>
              <span className="font-semibold">${cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-primary">
              <span>Your Savings (5%):</span>
              <span className="font-semibold">-${(cartTotal * 0.05).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>New Total:</span>
              <span>${(cartTotal * 0.95).toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Button onClick={handleCheckout} variant="hero" className="w-full h-12 text-lg font-bold">
              Complete My Order
            </Button>
            <Button onClick={handleClose} variant="ghost" className="w-full">
              Continue Shopping
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            ✓ Free Delivery • ✓ 30-Minute Guarantee • ✓ 21+ Only
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CartAbandonmentPopup;
