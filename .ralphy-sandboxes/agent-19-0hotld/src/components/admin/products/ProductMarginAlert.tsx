/**
 * ProductMarginAlert Component
 * Displays a prominent alert banner when product margin is below threshold.
 * Shows in both product list and product detail pages.
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";

interface ProductMarginAlertProps {
  costPrice: number | null | undefined;
  wholesalePrice: number | null | undefined;
  retailPrice?: number | null | undefined;
  marginThreshold?: number; // Default 20%
  productName?: string;
  onAdjustPrice?: () => void;
  className?: string;
}

/**
 * Calculates margin percentage: ((price - cost) / price) * 100
 */
function calculateMargin(cost: number | null | undefined, price: number | null | undefined): number | null {
  if (!cost || !price || price === 0) return null;
  return ((price - cost) / price) * 100;
}

export function ProductMarginAlert({
  costPrice,
  wholesalePrice,
  retailPrice,
  marginThreshold = 20,
  productName,
  onAdjustPrice,
  className,
}: ProductMarginAlertProps) {
  const wholesaleMargin = calculateMargin(costPrice, wholesalePrice);
  const retailMargin = calculateMargin(costPrice, retailPrice);

  // Check if any margin is concerning
  const isWholesaleLow = wholesaleMargin !== null && wholesaleMargin < marginThreshold;
  const isWholesaleNegative = wholesaleMargin !== null && wholesaleMargin < 0;
  const isRetailLow = retailMargin !== null && retailMargin < marginThreshold;
  const isRetailNegative = retailMargin !== null && retailMargin < 0;

  // Only show alert if there's a margin issue
  const hasIssue = isWholesaleLow || isRetailLow;
  const hasCriticalIssue = isWholesaleNegative || isRetailNegative;

  if (!hasIssue) {
    return null;
  }

  // Calculate suggested prices to meet threshold
  const suggestedWholesalePrice = costPrice && marginThreshold > 0
    ? costPrice / (1 - marginThreshold / 100)
    : null;

  const suggestedRetailPrice = costPrice && marginThreshold > 0
    ? costPrice / (1 - marginThreshold / 100)
    : null;

  return (
    <Alert
      variant={hasCriticalIssue ? "destructive" : "default"}
      className={className}
    >
      {hasCriticalIssue ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      )}
      <AlertTitle className="flex items-center gap-2">
        {hasCriticalIssue ? "Negative Margin Alert" : "Low Margin Warning"}
        {productName && (
          <span className="font-normal text-muted-foreground">— {productName}</span>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          {isWholesaleLow && wholesaleMargin !== null && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>
                Wholesale margin: <strong className={isWholesaleNegative ? "text-destructive" : "text-amber-600"}>
                  {wholesaleMargin.toFixed(1)}%
                </strong>
                {suggestedWholesalePrice && (
                  <span className="text-muted-foreground text-xs ml-1">
                    (raise to {formatCurrency(suggestedWholesalePrice)} for {marginThreshold}%)
                  </span>
                )}
              </span>
            </div>
          )}
          {isRetailLow && retailMargin !== null && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>
                Retail margin: <strong className={isRetailNegative ? "text-destructive" : "text-amber-600"}>
                  {retailMargin.toFixed(1)}%
                </strong>
                {suggestedRetailPrice && (
                  <span className="text-muted-foreground text-xs ml-1">
                    (raise to {formatCurrency(suggestedRetailPrice)} for {marginThreshold}%)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Cost per unit: {costPrice ? formatCurrency(costPrice) : "—"} |
          Threshold: {marginThreshold}%
        </div>

        {onAdjustPrice && (
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={onAdjustPrice}>
              <DollarSign className="h-4 w-4 mr-2" />
              Adjust Pricing
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
