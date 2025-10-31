import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface HighValueCartNoticeProps {
  cartTotal: number;
  onCreateAccount?: () => void;
}

const HighValueCartNotice = ({ cartTotal, onCreateAccount }: HighValueCartNoticeProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-bold text-lg mb-1">Premium Order Detected</h3>
              <p className="text-sm text-muted-foreground">
                Your cart value of ${cartTotal.toFixed(2)} qualifies you for exclusive member benefits
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Save ${(cartTotal * 0.1).toFixed(2)} today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Free shipping forever</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Priority support</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Early product access</span>
              </div>
            </div>

            {onCreateAccount && (
              <Button onClick={onCreateAccount} className="w-full sm:w-auto" variant="default">
                <TrendingUp className="w-4 h-4 mr-2" />
                Unlock Benefits Now
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default HighValueCartNotice;
