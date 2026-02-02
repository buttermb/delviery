/**
 * LowStockBanner Component
 *
 * Dismissible alert banner that shows when products are low on stock or out of stock.
 * Displays severity-based styling and a count of affected products.
 * Integrates with the useLowStockAlerts hook.
 */

import { useState, useCallback, useMemo } from 'react';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Package from "lucide-react/dist/esm/icons/package";
import X from "lucide-react/dist/esm/icons/x";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLowStockAlerts } from '@/hooks/useLowStockAlerts';

export interface LowStockBannerProps {
  className?: string;
  onViewDetails?: () => void;
}

export function LowStockBanner({ className, onViewDetails }: LowStockBannerProps) {
  const {
    products,
    outOfStockCount,
    criticalCount,
    warningCount,
    totalAlerts,
    isLoading,
  } = useLowStockAlerts();

  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  const severity = useMemo(() => {
    if (outOfStockCount > 0) return 'danger';
    if (criticalCount > 0) return 'critical';
    if (warningCount > 0) return 'warning';
    return 'info';
  }, [outOfStockCount, criticalCount, warningCount]);

  const styles = useMemo(() => {
    switch (severity) {
      case 'danger':
        return {
          variant: 'destructive' as const,
          iconColor: 'text-red-500',
          bgColor: 'bg-red-500/5',
          borderColor: 'border-red-500/20',
        };
      case 'critical':
        return {
          variant: 'default' as const,
          iconColor: 'text-orange-500',
          bgColor: 'bg-orange-500/5',
          borderColor: 'border-orange-500/20',
        };
      case 'warning':
        return {
          variant: 'default' as const,
          iconColor: 'text-amber-500',
          bgColor: 'bg-amber-500/5',
          borderColor: 'border-amber-500/20',
        };
      default:
        return {
          variant: 'default' as const,
          iconColor: 'text-blue-500',
          bgColor: 'bg-blue-500/5',
          borderColor: 'border-blue-500/20',
        };
    }
  }, [severity]);

  const description = useMemo(() => {
    const parts: string[] = [];
    if (outOfStockCount > 0) {
      parts.push(`${outOfStockCount} out of stock`);
    }
    if (criticalCount > 0) {
      parts.push(`${criticalCount} critically low`);
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} below threshold`);
    }
    return parts.join(', ') + '.';
  }, [outOfStockCount, criticalCount, warningCount]);

  const title = useMemo(() => {
    if (outOfStockCount > 0) return 'Products Out of Stock';
    if (criticalCount > 0) return 'Critical Stock Levels';
    return 'Low Stock Warning';
  }, [outOfStockCount, criticalCount]);

  // Don't render if loading, dismissed, or no alerts
  if (isLoading || isDismissed || totalAlerts === 0) {
    return null;
  }

  return (
    <Alert
      variant={styles.variant}
      className={`${styles.bgColor} ${styles.borderColor} ${className ?? ''}`}
      data-testid="low-stock-banner"
      data-severity={severity}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${styles.iconColor}`}>
          {severity === 'danger' ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <AlertTitle className="text-sm font-semibold mb-1">
            {title}
            <Badge variant="secondary" className="ml-2 text-xs">
              {totalAlerts} {totalAlerts === 1 ? 'product' : 'products'}
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            {description}
            {products.length > 0 && products.length <= 3 && (
              <span className="ml-1">
                ({products.map((p) => p.name).join(', ')})
              </span>
            )}
          </AlertDescription>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onViewDetails && (
            <Button
              size="sm"
              variant={severity === 'danger' ? 'default' : 'outline'}
              onClick={onViewDetails}
              data-testid="low-stock-view-details"
            >
              <Package className="h-4 w-4 mr-1" />
              View Inventory
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 w-8 p-0"
            data-testid="low-stock-dismiss"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}
