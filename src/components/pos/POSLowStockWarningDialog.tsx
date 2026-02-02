/**
 * POS Low Stock Warning Dialog
 *
 * Displays a warning dialog after a POS sale when items have fallen
 * below their low stock threshold. Shows severity levels and restock actions.
 */

import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Ban from "lucide-react/dist/esm/icons/ban";
import Package from "lucide-react/dist/esm/icons/package";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';

export interface LowStockWarningItem {
  product_id: string;
  product_name: string;
  previous_stock: number;
  new_stock: number;
  threshold: number;
  alert_level: 'out_of_stock' | 'critical' | 'warning';
}

interface POSLowStockWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warnings: LowStockWarningItem[];
  transactionNumber?: string;
}

export function POSLowStockWarningDialog({
  open,
  onOpenChange,
  warnings,
  transactionNumber,
}: POSLowStockWarningDialogProps) {
  const { navigateToAdmin } = useTenantNavigation();

  if (warnings.length === 0) return null;

  const outOfStockCount = warnings.filter(w => w.alert_level === 'out_of_stock').length;
  const criticalCount = warnings.filter(w => w.alert_level === 'critical').length;
  const warningCount = warnings.filter(w => w.alert_level === 'warning').length;

  const getAlertIcon = (level: LowStockWarningItem['alert_level']) => {
    switch (level) {
      case 'out_of_stock':
        return <Ban className="h-4 w-4 text-red-500" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <Package className="h-4 w-4 text-amber-500" />;
    }
  };

  const getAlertStyles = (level: LowStockWarningItem['alert_level']) => {
    switch (level) {
      case 'out_of_stock':
        return 'border-red-500 bg-red-50 dark:bg-red-950/30';
      case 'critical':
        return 'border-red-400 bg-red-50 dark:bg-red-950/20';
      case 'warning':
        return 'border-amber-400 bg-amber-50 dark:bg-amber-950/20';
    }
  };

  const getBadgeVariant = (level: LowStockWarningItem['alert_level']) => {
    switch (level) {
      case 'out_of_stock':
        return 'destructive';
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
    }
  };

  const getAlertLabel = (level: LowStockWarningItem['alert_level']) => {
    switch (level) {
      case 'out_of_stock':
        return 'Out of Stock';
      case 'critical':
        return 'Critical';
      case 'warning':
        return 'Low Stock';
    }
  };

  const handleGoToAlerts = () => {
    onOpenChange(false);
    navigateToAdmin('stock-alerts');
  };

  const handleGoToInventory = () => {
    onOpenChange(false);
    navigateToAdmin('inventory');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Low Stock Warning
          </DialogTitle>
          <DialogDescription>
            {transactionNumber && (
              <span className="font-medium">Transaction {transactionNumber} complete. </span>
            )}
            {warnings.length === 1 ? (
              '1 item is now low on stock.'
            ) : (
              `${warnings.length} items are now low on stock.`
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          {outOfStockCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <Ban className="h-3 w-3" />
              {outOfStockCount} Out of Stock
            </Badge>
          )}
          {criticalCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {criticalCount} Critical
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 border-amber-200">
              <Package className="h-3 w-3" />
              {warningCount} Warning
            </Badge>
          )}
        </div>

        {/* Warning items list */}
        <ScrollArea className="max-h-[300px] pr-3">
          <div className="space-y-2">
            {warnings
              .sort((a, b) => {
                // Sort by severity: out_of_stock > critical > warning
                const order = { out_of_stock: 0, critical: 1, warning: 2 };
                return order[a.alert_level] - order[b.alert_level];
              })
              .map((warning) => (
                <div
                  key={warning.product_id}
                  className={cn(
                    'flex items-center justify-between p-3 border rounded-lg',
                    getAlertStyles(warning.alert_level)
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getAlertIcon(warning.alert_level)}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{warning.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="line-through text-muted-foreground/60">
                          {warning.previous_stock}
                        </span>
                        {' → '}
                        <span className={cn(
                          'font-semibold',
                          warning.new_stock <= 0 ? 'text-red-600' : 'text-amber-600'
                        )}>
                          {warning.new_stock}
                        </span>
                        <span className="text-muted-foreground/60">
                          {' '}(threshold: {warning.threshold})
                        </span>
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={getBadgeVariant(warning.alert_level)}
                    className={cn(
                      'text-xs flex-shrink-0',
                      warning.alert_level === 'warning' && 'bg-amber-100 text-amber-800 border-amber-200'
                    )}
                  >
                    {getAlertLabel(warning.alert_level)}
                  </Badge>
                </div>
              ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="sm:flex-1"
          >
            Dismiss
          </Button>
          <Button
            variant="secondary"
            onClick={handleGoToInventory}
            className="sm:flex-1 gap-2"
          >
            <Package className="h-4 w-4" />
            View Inventory
          </Button>
          <Button
            onClick={handleGoToAlerts}
            className="sm:flex-1 gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Stock Alerts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
