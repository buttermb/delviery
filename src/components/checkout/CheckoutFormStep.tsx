import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CheckoutFormStepProps {
  stepNumber: number;
  title: string;
  children: React.ReactNode;
  isComplete?: boolean;
  icon?: React.ReactNode;
}

export function CheckoutFormStep({ 
  stepNumber, 
  title, 
  children, 
  isComplete,
  icon 
}: CheckoutFormStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "border-2 transition-all duration-300",
        isComplete && "border-green-500 bg-green-50/50 dark:bg-green-950/20"
      )}>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="text-base md:text-lg flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                isComplete 
                  ? "bg-green-500 text-white" 
                  : "bg-primary text-primary-foreground"
              )}
            >
              {isComplete ? "✓" : stepNumber}
            </motion.div>
            {icon && <span className="text-xl">{icon}</span>}
            <span className="text-sm md:text-base">{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
