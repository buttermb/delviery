/**
 * ProductMarginBadge Component
 * Displays product margin percentage with visual alerts for low margins.
 * Used in product list and product detail pages.
 */

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";

interface ProductMarginBadgeProps {
  costPrice: number | null | undefined;
  sellingPrice: number | null | undefined;
  marginThreshold?: number; // Default 20%
  showAmount?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Calculates margin percentage: ((price - cost) / price) * 100
 */
function calculateMargin(cost: number | null | undefined, price: number | null | undefined): number | null {
  if (!cost || !price || price === 0) return null;
  return ((price - cost) / price) * 100;
}

/**
 * Calculates margin amount: price - cost
 */
function calculateMarginAmount(cost: number | null | undefined, price: number | null | undefined): number | null {
  if (cost === null || cost === undefined || price === null || price === undefined) return null;
  return price - cost;
}

export function ProductMarginBadge({
  costPrice,
  sellingPrice,
  marginThreshold = 20,
  showAmount = false,
  size = "md",
  className,
}: ProductMarginBadgeProps) {
  const margin = calculateMargin(costPrice, sellingPrice);
  const marginAmount = calculateMarginAmount(costPrice, sellingPrice);

  // If no margin can be calculated, show a placeholder
  if (margin === null) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        —
      </Badge>
    );
  }

  const isLowMargin = margin < marginThreshold;
  const isNegativeMargin = margin < 0;
  const _isHealthyMargin = margin >= marginThreshold;

  // Determine badge variant and icon
  let variant: "default" | "destructive" | "outline" | "secondary" = "default";
  let Icon = TrendingUp;
  let colorClass = "text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 dark:text-green-400";

  if (isNegativeMargin) {
    variant = "destructive";
    Icon = AlertTriangle;
    colorClass = "text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-400";
  } else if (isLowMargin) {
    variant = "outline";
    Icon = TrendingDown;
    colorClass = "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400";
  }

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const tooltipContent = (
    <div className="text-sm space-y-1">
      <div className="font-medium">Profit Margin</div>
      <div>Cost: ${costPrice?.toFixed(2) ?? "—"}</div>
      <div>Price: ${sellingPrice?.toFixed(2) ?? "—"}</div>
      <div>Margin: {margin.toFixed(1)}%</div>
      {marginAmount !== null && (
        <div>Profit: ${marginAmount.toFixed(2)}</div>
      )}
      {isLowMargin && !isNegativeMargin && (
        <div className="text-amber-500 pt-1 border-t">
          Below {marginThreshold}% threshold
        </div>
      )}
      {isNegativeMargin && (
        <div className="text-red-500 pt-1 border-t">
          Selling at a loss!
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className={cn(
              sizeClasses[size],
              colorClass,
              "font-mono flex items-center gap-1 cursor-help",
              className
            )}
          >
            <Icon className={iconSizes[size]} />
            <span>{margin.toFixed(1)}%</span>
            {showAmount && marginAmount !== null && (
              <span className="text-muted-foreground">
                (${marginAmount.toFixed(2)})
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Hook-friendly margin calculation utilities
 */
export function useMarginCalculation(
  costPrice: number | null | undefined,
  sellingPrice: number | null | undefined,
  threshold = 20
) {
  const margin = calculateMargin(costPrice, sellingPrice);
  const marginAmount = calculateMarginAmount(costPrice, sellingPrice);

  return {
    margin,
    marginAmount,
    isLowMargin: margin !== null && margin < threshold,
    isNegativeMargin: margin !== null && margin < 0,
    isHealthyMargin: margin !== null && margin >= threshold,
    hasMargin: margin !== null,
  };
}
