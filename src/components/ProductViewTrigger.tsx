import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Gift } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getViewedProductsCount } from "@/hooks/useProductViewTracking";

interface ProductViewTriggerProps {
  onJoinNow?: () => void;
}

const ProductViewTrigger = ({ onJoinNow }: ProductViewTriggerProps) => {
  const [show, setShow] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    const checkViews = () => {
      const count = getViewedProductsCount();
      setViewCount(count);
      
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return undefined;
      };

      const hasShownTrigger = getCookie("view_trigger_shown");
      
      if (count >= 3 && !hasShownTrigger) {
        setShow(true);
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `view_trigger_shown=true; expires=${expires}; path=/; SameSite=Lax`;
      }
    };

    checkViews();
    const interval = setInterval(checkViews, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 right-6 z-30 max-w-sm"
        >
          <Card className="p-4 shadow-2xl border-2 border-primary/20 bg-background">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Eye className="w-5 h-5 text-primary" />
              </div>
              
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="font-bold text-sm">Found what you like?</h4>
                  <p className="text-xs text-muted-foreground">
                    You've viewed {viewCount} products. Members save 10% on everything.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={onJoinNow} size="sm" className="flex-1">
                    <Gift className="w-3 h-3 mr-1" />
                    Save 10%
                  </Button>
                  <Button onClick={handleDismiss} size="sm" variant="ghost">
                    Later
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProductViewTrigger;
