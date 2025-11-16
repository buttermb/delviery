import { useState } from "react";
import { Gift, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const FloatingDiscountWidget = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return undefined;
  };

  const hasUsedDiscount = getCookie("discount_code_used") || getCookie("floating_widget_dismissed");

  if (isDismissed || hasUsedDiscount) return null;

  const handleGetCode = () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }

    setShowCode(true);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `discount_code_used=true; expires=${expires}; path=/; SameSite=Lax`;
    toast.success("Welcome! Your code is ready");
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText("FIRST10FREE");
    toast.success("Code copied!");
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `floating_widget_dismissed=true; expires=${expires}; path=/; SameSite=Lax`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="fixed bottom-6 right-6 z-40"
      >
        {!isExpanded ? (
          <button
            onClick={() => setIsExpanded(true)}
            className="relative group"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
              <Gift className="w-8 h-8 text-white animate-pulse" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-destructive text-white text-xs font-bold flex items-center justify-center animate-pulse">
              10%
            </div>
          </button>
        ) : (
          <Card className="w-80 p-6 shadow-2xl relative">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                <Gift className="w-6 h-6 text-primary" />
              </div>
              
              <div>
                <h3 className="font-bold text-lg mb-1">Member Benefits</h3>
                <p className="text-sm text-muted-foreground">Get 10% off your first order</p>
              </div>

              {!showCode ? (
                <div className="space-y-3">
                  <Input
                    type="email"
                    placeholder="Your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleGetCode()}
                  />
                  <Button onClick={handleGetCode} className="w-full">
                    Get Code
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary tracking-wider">
                      FIRST10FREE
                    </div>
                  </div>
                  <Button onClick={handleCopyCode} variant="outline" className="w-full">
                    Copy Code
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Free shipping • Exclusive offers
              </p>
            </div>
          </Card>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingDiscountWidget;
