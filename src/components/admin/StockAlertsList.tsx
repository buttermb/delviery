/**
 * StockAlertsList Component
 *
 * Reusable component for displaying low stock and out of stock alerts.
 * Used in StockAlertsPage and can be integrated into dashboards/widgets.
 *
 * Features:
 * - Separates out-of-stock and low-stock items
 * - Displays alert level badges (critical, warning)
 * - Supports actions like Quick Restock and Acknowledge
 * - Responsive design with mobile optimization
 * - Empty states for each category
 * - Loading states
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  AlertCircle,
  PackageX,
  PackagePlus,
  CheckCheck,
  RefreshCw,
  Package
} from 'lucide-react';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { LowStockProduct } from '@/hooks/useLowStockAlerts';
import { cn } from '@/lib/utils';

export interface StockAlertsListProps {
  /** Array of low stock products from useLowStockAlerts hook */
  products: LowStockProduct[];
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: Error | null;
  /** Refetch function */
  refetch?: () => void;
  /** Callback for quick restock action */
  onQuickRestock?: (product: LowStockProduct) => void;
  /** Callback for acknowledge action */
  onAcknowledge?: (productId: string) => void;
  /** Show action buttons */
  showActions?: boolean;
  /** Compact mode (no tabs, stacked layout) */
  compact?: boolean;
  /** Custom className for wrapper */
  className?: string;
  /** Show refresh button */
  showRefresh?: boolean;
}

export function StockAlertsList({
  products = [],
  isLoading = false,
  error = null,
  refetch,
  onQuickRestock,
  onAcknowledge,
  showActions = true,
  compact = false,
  className,
  showRefresh = true,
}: StockAlertsListProps) {
  // Categorize products
  const categorizedProducts = useMemo(() => {
    const outOfStock = products.filter(p => p.alertLevel === 'out_of_stock');
    const critical = products.filter(p => p.alertLevel === 'critical');
    const warning = products.filter(p => p.alertLevel === 'warning');

    return {
      outOfStock,
      critical,
      warning,
      lowStock: [...critical, ...warning], // Combined low stock (not out of stock)
    };
  }, [products]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          {showRefresh && <Skeleton className="h-9 w-24" />}
        </div>
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <EnhancedEmptyState
            icon={AlertTriangle}
            title="Error Loading Alerts"
            description={error.message || 'Failed to load stock alerts'}
            primaryAction={
              refetch
                ? {
                    label: 'Retry',
                    onClick: refetch,
                    icon: RefreshCw,
                  }
                : undefined
            }
            compact
          />
        </CardContent>
      </Card>
    );
  }

  // Render alert item
  const renderAlertItem = (product: LowStockProduct) => {
    const isOutOfStock = product.alertLevel === 'out_of_stock';
    const isCritical = product.alertLevel === 'critical';

    const borderColor = isOutOfStock
      ? 'border-destructive'
      : isCritical
      ? 'border-red-500'
      : 'border-yellow-500';

    const bgColor = isOutOfStock
      ? 'bg-destructive/5 dark:bg-destructive/10'
      : isCritical
      ? 'bg-red-50 dark:bg-red-950'
      : 'bg-yellow-50 dark:bg-yellow-950';

    const iconColor = isOutOfStock
      ? 'text-destructive'
      : isCritical
      ? 'text-red-500'
      : 'text-yellow-500';

    return (
      <div
        key={product.id}
        className={cn(
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4',
          'p-3 sm:p-4 border rounded-lg transition-all',
          borderColor,
          bgColor
        )}
      >
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          {isOutOfStock ? (
            <PackageX className={cn('h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0', iconColor)} />
          ) : (
            <AlertTriangle className={cn('h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0', iconColor)} />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm sm:text-base truncate">{product.name}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {product.category && (
                <span className="mr-2">
                  <Badge variant="outline" className="text-xs mr-1">{product.category}</Badge>
                </span>
              )}
              Current: <span className="font-semibold">{product.availableQuantity}</span>
              {' | '}
              Threshold: {product.lowStockThreshold}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Badge
            variant={isOutOfStock ? 'destructive' : isCritical ? 'destructive' : 'secondary'}
            className="text-xs sm:text-sm flex-shrink-0"
          >
            {isOutOfStock ? 'Out of Stock' : product.alertLevel}
          </Badge>

          {showActions && (
            <>
              {/* Quick Restock Button */}
              {onQuickRestock && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuickRestock(product)}
                  className="gap-1 text-xs h-8 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border-emerald-800 dark:text-emerald-300"
                >
                  <PackagePlus className="h-3 w-3" />
                  Restock
                </Button>
              )}

              {/* Acknowledge Button */}
              {onAcknowledge && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAcknowledge(product.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  title="Acknowledge alert"
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Empty state component
  const EmptyAlertsList = ({ type }: { type: 'out_of_stock' | 'low_stock' | 'all' }) => {
    const config = {
      out_of_stock: {
        icon: PackageX,
        title: 'No Out of Stock Items',
        description: 'Great! All products are currently in stock.',
      },
      low_stock: {
        icon: AlertTriangle,
        title: 'No Low Stock Items',
        description: 'All stock levels are above threshold.',
      },
      all: {
        icon: Package,
        title: 'All Stock Levels Healthy',
        description: 'No low stock or out of stock items detected. Great job keeping inventory stocked!',
      },
    };

    const { icon, title, description } = config[type];

    return (
      <EnhancedEmptyState
        icon={icon}
        title={title}
        description={description}
        compact
      />
    );
  };

  // Compact mode - stacked layout
  if (compact) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Out of Stock Section */}
        {categorizedProducts.outOfStock.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PackageX className="h-4 w-4 text-destructive" />
                Out of Stock ({categorizedProducts.outOfStock.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categorizedProducts.outOfStock.map(renderAlertItem)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Low Stock Section */}
        {categorizedProducts.lowStock.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Low Stock ({categorizedProducts.lowStock.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categorizedProducts.lowStock.map(renderAlertItem)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state if no alerts */}
        {products.length === 0 && (
          <Card>
            <CardContent className="py-8">
              <EmptyAlertsList type="all" />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Full mode - tabbed layout
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg sm:text-xl">Stock Alerts</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Monitor inventory levels and take action
          </CardDescription>
        </div>
        {showRefresh && refetch && (
          <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              All ({products.length})
            </TabsTrigger>
            <TabsTrigger value="out_of_stock" className="text-xs sm:text-sm">
              <PackageX className="h-3 w-3 mr-1" />
              Out ({categorizedProducts.outOfStock.length})
            </TabsTrigger>
            <TabsTrigger value="low_stock" className="text-xs sm:text-sm">
              <AlertCircle className="h-3 w-3 mr-1" />
              Low ({categorizedProducts.lowStock.length})
            </TabsTrigger>
          </TabsList>

          {/* All Alerts Tab */}
          <TabsContent value="all" className="mt-4 space-y-3">
            {products.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {products.map(renderAlertItem)}
              </div>
            ) : (
              <EmptyAlertsList type="all" />
            )}
          </TabsContent>

          {/* Out of Stock Tab */}
          <TabsContent value="out_of_stock" className="mt-4 space-y-3">
            {categorizedProducts.outOfStock.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {categorizedProducts.outOfStock.map(renderAlertItem)}
              </div>
            ) : (
              <EmptyAlertsList type="out_of_stock" />
            )}
          </TabsContent>

          {/* Low Stock Tab */}
          <TabsContent value="low_stock" className="mt-4 space-y-3">
            {categorizedProducts.lowStock.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {categorizedProducts.lowStock.map(renderAlertItem)}
              </div>
            ) : (
              <EmptyAlertsList type="low_stock" />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default StockAlertsList;
