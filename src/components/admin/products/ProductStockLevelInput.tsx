/**
 * ProductStockLevelInput - Combined stock quantity and low stock threshold input
 *
 * Features:
 * - Stock quantity input with validation
 * - Low stock threshold setting
 * - Visual status indicator (out of stock, low stock, ok)
 * - Helper text explaining the threshold behavior
 */

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertTriangle, Package, Bell } from 'lucide-react';

export interface StockLevelValue {
  quantity: string;
  lowStockThreshold: string;
}

interface ProductStockLevelInputProps {
  value: StockLevelValue;
  onChange: (value: StockLevelValue) => void;
  disabled?: boolean;
  showQuantityInput?: boolean;
  className?: string;
}

type StockStatus = 'out' | 'critical' | 'low' | 'ok';

function getStockStatus(quantity: number, threshold: number): StockStatus {
  if (quantity === 0) return 'out';
  if (quantity <= threshold * 0.5) return 'critical';
  if (quantity <= threshold) return 'low';
  return 'ok';
}

function getStatusConfig(status: StockStatus) {
  switch (status) {
    case 'out':
      return {
        label: 'Out of Stock',
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        borderColor: 'border-destructive/50',
        icon: AlertTriangle,
      };
    case 'critical':
      return {
        label: 'Critical',
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        borderColor: 'border-destructive/30',
        icon: AlertTriangle,
      };
    case 'low':
      return {
        label: 'Low Stock',
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        borderColor: 'border-warning/30',
        icon: Bell,
      };
    case 'ok':
      return {
        label: 'In Stock',
        color: 'text-success',
        bgColor: 'bg-success/10',
        borderColor: 'border-success/30',
        icon: Package,
      };
  }
}

export function ProductStockLevelInput({
  value,
  onChange,
  disabled = false,
  showQuantityInput = true,
  className,
}: ProductStockLevelInputProps) {
  const quantity = parseInt(value.quantity, 10) || 0;
  const threshold = parseInt(value.lowStockThreshold, 10) || 0;

  const status = getStockStatus(quantity, threshold);
  const statusConfig = getStatusConfig(status);
  const StatusIcon = statusConfig.icon;

  const handleQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Allow empty string or valid non-negative numbers
    if (newValue === '' || (parseInt(newValue, 10) >= 0 && !isNaN(parseInt(newValue, 10)))) {
      onChange({
        ...value,
        quantity: newValue,
      });
    }
  }, [value, onChange]);

  const handleThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Allow empty string or valid non-negative numbers
    if (newValue === '' || (parseInt(newValue, 10) >= 0 && !isNaN(parseInt(newValue, 10)))) {
      onChange({
        ...value,
        lowStockThreshold: newValue,
      });
    }
  }, [value, onChange]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Stock Status Indicator */}
      {showQuantityInput && value.quantity !== '' && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md border text-sm",
            statusConfig.bgColor,
            statusConfig.borderColor
          )}
        >
          <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
          <span className={cn("font-medium", statusConfig.color)}>
            {statusConfig.label}
          </span>
          {status !== 'ok' && threshold > 0 && (
            <span className="text-muted-foreground ml-auto text-xs">
              {quantity} / {threshold} threshold
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Stock Quantity Input */}
        {showQuantityInput && (
          <div className="space-y-2">
            <Label htmlFor="stock-quantity">Stock Quantity</Label>
            <Input
              id="stock-quantity"
              type="number"
              min="0"
              value={value.quantity}
              onChange={handleQuantityChange}
              placeholder="0"
              disabled={disabled}
              className={cn(
                status === 'out' && "border-destructive focus-visible:ring-destructive",
                status === 'critical' && "border-destructive/50",
                status === 'low' && "border-warning/50"
              )}
            />
            <p className="text-xs text-muted-foreground">
              Current available inventory
            </p>
          </div>
        )}

        {/* Low Stock Threshold Input */}
        <div className="space-y-2">
          <Label htmlFor="low-stock-threshold">Low Stock Alert Threshold</Label>
          <div className="relative">
            <Bell className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="low-stock-threshold"
              type="number"
              min="0"
              value={value.lowStockThreshold}
              onChange={handleThresholdChange}
              placeholder="10"
              disabled={disabled}
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Alert when stock falls below this level
          </p>
        </div>
      </div>

      {/* Threshold explanation */}
      {threshold > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md space-y-1">
          <p className="font-medium">Stock Alert Levels:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>
              <span className="text-warning font-medium">Warning</span>: Stock at or below {threshold} units
            </li>
            <li>
              <span className="text-destructive font-medium">Critical</span>: Stock at or below {Math.floor(threshold * 0.5)} units
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
