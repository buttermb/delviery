import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface StickyOrderSummaryProps {
  cartItems: any[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  isProcessing: boolean;
  onCheckout: () => void;
}

export function StickyOrderSummary({
  cartItems,
  subtotal,
  deliveryFee,
  discount,
  total,
  isProcessing,
  onCheckout
}: StickyOrderSummaryProps) {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "lg:sticky transition-all duration-300",
        isSticky ? "top-20" : "top-4"
      )}
    >
      <Card className={cn(
        "border-2 transition-all duration-300",
        isSticky && "shadow-2xl shadow-primary/10"
      )}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cart Items Preview */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {cartItems.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  {item.quantity}x {item.products?.name}
                </span>
                <span className="font-semibold">
                  ${(item.quantity * (item.products?.price || 0)).toFixed(2)}
                </span>
              </motion.div>
            ))}
          </div>

          <Separator />

          {/* Pricing Breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span className={cn(
                "font-semibold",
                deliveryFee === 0 && "text-green-600"
              )}>
                {deliveryFee === 0 ? "FREE" : `$${deliveryFee.toFixed(2)}`}
              </span>
            </div>

            {discount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between text-sm"
              >
                <span className="text-green-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Discount
                </span>
                <span className="font-semibold text-green-600">
                  -${discount.toFixed(2)}
                </span>
              </motion.div>
            )}

            <Separator />

            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <motion.span
                key={total}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-primary"
              >
                ${total.toFixed(2)}
              </motion.span>
            </div>
          </div>

          {/* Free Shipping Progress */}
          {subtotal < 100 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Add ${(100 - subtotal).toFixed(2)} for free delivery</span>
                <span>{Math.round((subtotal / 100) * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((subtotal / 100) * 100, 100)}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-primary to-primary/80"
                />
              </div>
            </motion.div>
          )}

          {/* Checkout Button */}
          <Button
            onClick={onCheckout}
            disabled={isProcessing}
            size="lg"
            className="w-full gap-2 text-lg"
          >
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Processing...
                </motion.div>
              ) : (
                <motion.div
                  key="checkout"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Lock className="w-5 h-5" />
                  Complete Order
                </motion.div>
              )}
            </AnimatePresence>
          </Button>

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <Badge variant="outline" className="text-xs">
              🔒 Secure
            </Badge>
            <Badge variant="outline" className="text-xs">
              ✅ Licensed
            </Badge>
            <Badge variant="outline" className="text-xs">
              🚚 Fast
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
