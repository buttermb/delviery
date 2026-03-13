/**
 * Wholesale Minimum Order Enforcement Component
 * Prevents checkout if minimum order value is not met
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Progress } from "@/components/ui/progress";

interface WholesaleMinimumOrderEnforcementProps {
  currentOrderValue: number;
  minimumOrderValue: number;
  showProgress?: boolean;
}

export function WholesaleMinimumOrderEnforcement({
  currentOrderValue,
  minimumOrderValue,
  showProgress = true,
}: WholesaleMinimumOrderEnforcementProps) {
  const meetsMinimum = currentOrderValue >= minimumOrderValue;
  const remaining = minimumOrderValue - currentOrderValue;
  const progress = (currentOrderValue / minimumOrderValue) * 100;

  if (meetsMinimum) {
    return (
      <Alert className="bg-success/10 border-success/20">
        <ShoppingCart className="h-4 w-4 text-success" />
        <AlertDescription className="text-success">
          Minimum order value met. You're ready to checkout!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Minimum order value: {formatCurrency(minimumOrderValue)}
          <br />
          Add {formatCurrency(remaining)} more to proceed to checkout
        </AlertDescription>
      </Alert>

      {showProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress to minimum</span>
            <span className="font-medium">{Math.min(progress, 100).toFixed(0)}%</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(currentOrderValue)}</span>
            <span>{formatCurrency(minimumOrderValue)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
