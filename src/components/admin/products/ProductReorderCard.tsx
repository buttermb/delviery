/**
 * Product Reorder Card Component
 *
 * Displays reorder suggestion for a product on the product detail page.
 * Shows sales velocity, suggested quantity, and provides one-click
 * purchase order creation.
 */

import { useMemo } from 'react';
import { useProductReorder, useCreateReorderPO } from '@/hooks/useAutoReorder';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Package from 'lucide-react/dist/esm/icons/package';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

interface ProductReorderCardProps {
  productId: string | undefined;
}

export function ProductReorderCard({ productId }: ProductReorderCardProps) {
  const { navigateToAdmin } = useTenantNavigation();
  const { suggestion, isLoading, error } = useProductReorder(productId);
  const createPOMutation = useCreateReorderPO();

  const priorityConfig = useMemo(() => {
    if (!suggestion) return null;

    const configs = {
      critical: {
        variant: 'destructive' as const,
        bgClass: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
        icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
        label: 'Critical',
      },
      high: {
        variant: 'destructive' as const,
        bgClass: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800',
        icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
        label: 'High Priority',
      },
      medium: {
        variant: 'outline' as const,
        bgClass: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
        icon: <Clock className="h-5 w-5 text-yellow-600" />,
        label: 'Medium',
      },
      low: {
        variant: 'secondary' as const,
        bgClass: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800',
        icon: <TrendingUp className="h-5 w-5 text-blue-600" />,
        label: 'Low',
      },
    };

    return configs[suggestion.priority];
  }, [suggestion]);

  const handleCreatePO = () => {
    if (suggestion) {
      createPOMutation.mutate(suggestion);
    }
  };

  const handleViewPOs = () => {
    navigateToAdmin('purchase-orders');
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Reorder Suggestion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Unable to load reorder suggestions: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // No suggestion needed
  if (!suggestion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Reorder Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Package className="h-8 w-8" />
            <div>
              <p className="font-medium text-foreground">Stock levels are healthy</p>
              <p className="text-sm">No reorder needed at this time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={priorityConfig?.bgClass}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {priorityConfig?.icon}
            Reorder Suggestion
          </CardTitle>
          <Badge variant={priorityConfig?.variant}>
            {priorityConfig?.label}
          </Badge>
        </div>
        <CardDescription>{suggestion.reason}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Stock</p>
            <p className="text-xl font-bold">{suggestion.currentStock}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Daily Sales</p>
            <p className="text-xl font-bold">{suggestion.salesVelocity.dailyAverage}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Days Remaining</p>
            <p className="text-xl font-bold">
              {suggestion.salesVelocity.daysOfStockRemaining > 999
                ? '999+'
                : suggestion.salesVelocity.daysOfStockRemaining}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Weekly Sales</p>
            <p className="text-xl font-bold">{suggestion.salesVelocity.weeklyTotal}</p>
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-lg border bg-background p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Suggested Reorder</p>
              <p className="text-2xl font-bold">{suggestion.suggestedQuantity} units</p>
              {suggestion.estimatedCost > 0 && (
                <p className="text-sm text-muted-foreground">
                  Est. cost: {formatCurrency(suggestion.estimatedCost)}
                </p>
              )}
            </div>
            <div className="text-right">
              {suggestion.vendorName ? (
                <>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium">{suggestion.vendorName}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No vendor assigned</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {suggestion.vendorId ? (
            <Button
              onClick={handleCreatePO}
              disabled={createPOMutation.isPending}
              className="flex-1"
            >
              {createPOMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating PO...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Create Purchase Order
                </>
              )}
            </Button>
          ) : (
            <Button variant="outline" disabled className="flex-1">
              No vendor - Cannot create PO
            </Button>
          )}
          <Button variant="outline" onClick={handleViewPOs}>
            View POs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
