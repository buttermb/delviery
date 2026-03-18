import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { motion } from "framer-motion";

interface PlanCardProps {
  plan: {
    name: string;
    display_name: string;
    description?: string;
    price_monthly: number;
    price_yearly?: number;
    features?: string[];
    limits?: Record<string, number>;
    active?: boolean;
  };
  currentPlan?: string;
  onSelect?: (planName: string) => void;
  showYearly?: boolean;
}

export function PlanCard({ plan, currentPlan, onSelect, showYearly = false }: PlanCardProps) {
  const isCurrentPlan = currentPlan === plan.name;
  const price = showYearly && plan.price_yearly ? plan.price_yearly / 12 : plan.price_monthly;
  const displayPrice = showYearly && plan.price_yearly ? plan.price_yearly : plan.price_monthly;

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.6
      }
    }
  };

  const featureVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (index: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: index * 0.1,
        duration: 0.4
      }
    })
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      whileHover={{ 
        y: -8,
        transition: { duration: 0.3 }
      }}
      className="h-full"
    >
      <Card className={`h-full transition-shadow duration-300 hover:shadow-xl ${isCurrentPlan ? "border-primary ring-2 ring-primary" : ""}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{plan.display_name}</CardTitle>
            {isCurrentPlan && <Badge variant="default">Current Plan</Badge>}
          </div>
          {plan.description && (
            <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{formatCurrency(displayPrice)}</span>
              <span className="text-muted-foreground">/{showYearly ? "year" : "month"}</span>
            </div>
            {showYearly && plan.price_yearly && (
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(price)}/month billed annually
              </p>
            )}
          </div>

          {plan.features && plan.features.length > 0 && (
            <ul className="space-y-2">
              {plan.features.map((feature, index) => (
                <motion.li 
                  key={index} 
                  custom={index}
                  variants={featureVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="flex items-center gap-2 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{feature.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                </motion.li>
              ))}
            </ul>
          )}

          {plan.limits && (
            <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
              {Object.entries(plan.limits).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize">{key.replace(/_/g, " ")}:</span>
                  <span className="font-medium">
                    {value === -1 ? "Unlimited" : value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full"
            variant={isCurrentPlan ? "outline" : "default"}
            disabled={isCurrentPlan}
            onClick={() => onSelect?.(plan.name)}
          >
            {isCurrentPlan ? "Current Plan" : "Select Plan"}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

