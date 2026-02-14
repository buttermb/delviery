/**
 * Auto Reorder Suggestions Widget
 *
 * Dashboard widget showing products that need reordering based on:
 * - Current stock vs low_stock_threshold
 * - Sales velocity (average daily sales)
 * - Estimated days of stock remaining
 *
 * Uses useAutoReorder hook for data fetching and provides
 * one-click purchase order creation.
 */

import { useState } from 'react';
import { useAutoReorder, useCreateReorderPO, type ReorderSuggestion } from '@/hooks/useAutoReorder';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { formatCurrency } from '@/utils/formatters';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import Package from 'lucide-react/dist/esm/icons/package';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

export function AutoReorderSuggestionsWidget() {
  const { navigateToAdmin } = useTenantNavigation();
  const {
    suggestions,
    criticalCount,
    highCount,
    totalEstimatedCost,
    isLoading,
    error,
  } = useAutoReorder();
  const createPOMutation = useCreateReorderPO();
  const [creatingPoFor, setCreatingPoFor] = useState<string | null>(null);

  const handleCreatePO = async (suggestion: ReorderSuggestion) => {
    setCreatingPoFor(suggestion.id);
    try {
      await createPOMutation.mutateAsync(suggestion);
    } finally {
      setCreatingPoFor(null);
    }
  };

  const handleViewProduct = (productId: string) => {
    navigateToAdmin(`products/${productId}`);
  };

  const handleViewPurchaseOrders = () => {
    navigateToAdmin('purchase-orders');
  };

  const getPriorityBadge = (priority: ReorderSuggestion['priority']) => {
    switch (priority) {
      case 'critical':
        return (
          <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
            Critical
          </Badge>
        );
      case 'high':
        return (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500 text-amber-600">
            High
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-yellow-500 text-yellow-600">
            Medium
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            Low
          </Badge>
        );
    }
  };

  const getPriorityIcon = (priority: ReorderSuggestion['priority']) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-500 shrink-0" />;
      default:
        return <Package className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-2">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold">Reorder Suggestions</h3>
        </div>
        <div className="text-center py-6 text-muted-foreground text-sm">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive opacity-50" />
          Unable to load suggestions
        </div>
      </Card>
    );
  }

  // Display first 5 suggestions
  const displayedSuggestions = suggestions.slice(0, 5);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-amber-500" />
          Reorder Suggestions
        </h3>
        {suggestions.length > 0 && (
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} critical
              </Badge>
            )}
            {highCount > 0 && (
              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                {highCount} high
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {suggestions.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Total Items</p>
            <p className="text-lg font-bold">{suggestions.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Est. Reorder Cost</p>
            <p className="text-lg font-bold">{formatCurrency(totalEstimatedCost)}</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {displayedSuggestions.length > 0 ? (
          <TooltipProvider>
            {displayedSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getPriorityIcon(suggestion.priority)}
                  <div className="min-w-0 flex-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleViewProduct(suggestion.productId)}
                          className="text-sm font-medium truncate block text-left hover:underline max-w-[180px]"
                        >
                          {suggestion.productName}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{suggestion.productName}</p>
                        <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {suggestion.currentStock} units
                        {suggestion.salesVelocity.daysOfStockRemaining < 999 && (
                          <> · ~{suggestion.salesVelocity.daysOfStockRemaining}d left</>
                        )}
                      </span>
                      {getPriorityBadge(suggestion.priority)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
                        +{suggestion.suggestedQuantity}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Suggested order: {suggestion.suggestedQuantity} units</p>
                      {suggestion.estimatedCost > 0 && (
                        <p className="text-xs">Est. {formatCurrency(suggestion.estimatedCost)}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreatePO(suggestion)}
                    disabled={
                      creatingPoFor === suggestion.id ||
                      createPOMutation.isPending ||
                      !suggestion.vendorId
                    }
                  >
                    {creatingPoFor === suggestion.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">PO</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </TooltipProvider>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            All products are well-stocked
          </div>
        )}
      </div>

      {suggestions.length > 5 && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          +{suggestions.length - 5} more items need reordering
        </p>
      )}

      {suggestions.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4"
          onClick={handleViewPurchaseOrders}
        >
          View Purchase Orders
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </Card>
  );
}
