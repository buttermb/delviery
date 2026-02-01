/**
 * ProductStockLevelInput - Stock level display with low stock threshold setting
 *
 * A form input component that displays current stock levels with visual indicators
 * and allows setting the low stock alert threshold. Used in product forms and
 * inventory management to configure when alerts should trigger.
 *
 * Features:
 * - Visual stock status indicators (out of stock, critical, warning, healthy)
 * - Low stock threshold input with validation
 * - Real-time status preview based on current stock vs threshold
 * - Help text explaining the feature
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FieldHelp, fieldHelpTexts } from '@/components/ui/field-help';
import { AlertTriangle, AlertCircle, CheckCircle2, XCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

type StockStatus = 'out_of_stock' | 'critical' | 'warning' | 'healthy';

interface ProductStockLevelInputProps {
  /** Current stock quantity */
  stockQuantity: number;
  /** Current low stock threshold value */
  lowStockThreshold: number;
  /** Callback when threshold changes */
  onThresholdChange: (threshold: number) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Optional label for the threshold input */
  label?: string;
  /** Show the stock status card preview */
  showPreview?: boolean;
  /** Optional class name for the container */
  className?: string;
  /** Minimum allowed threshold value */
  minThreshold?: number;
  /** Maximum allowed threshold value */
  maxThreshold?: number;
}

function getStockStatus(quantity: number, threshold: number): StockStatus {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= threshold * 0.25) return 'critical';
  if (quantity <= threshold) return 'warning';
  return 'healthy';
}

const statusConfig: Record<StockStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
  description: string;
}> = {
  out_of_stock: {
    label: 'Out of Stock',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
    icon: XCircle,
    description: 'Product is unavailable for sale',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: AlertCircle,
    description: 'Stock is critically low (below 25% of threshold)',
  },
  warning: {
    label: 'Low Stock',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
    description: 'Stock is below threshold - consider reordering',
  },
  healthy: {
    label: 'In Stock',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    icon: CheckCircle2,
    description: 'Stock levels are healthy',
  },
};

export function ProductStockLevelInput({
  stockQuantity,
  lowStockThreshold,
  onThresholdChange,
  disabled = false,
  label = 'Low Stock Alert Threshold',
  showPreview = true,
  className,
  minThreshold = 0,
  maxThreshold = 99999,
}: ProductStockLevelInputProps) {
  const [inputValue, setInputValue] = useState(lowStockThreshold.toString());

  // Sync input value when prop changes
  useEffect(() => {
    setInputValue(lowStockThreshold.toString());
  }, [lowStockThreshold]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= minThreshold && numValue <= maxThreshold) {
      onThresholdChange(numValue);
    }
  }, [onThresholdChange, minThreshold, maxThreshold]);

  const handleBlur = useCallback(() => {
    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue) || numValue < minThreshold) {
      setInputValue(minThreshold.toString());
      onThresholdChange(minThreshold);
    } else if (numValue > maxThreshold) {
      setInputValue(maxThreshold.toString());
      onThresholdChange(maxThreshold);
    }
  }, [inputValue, minThreshold, maxThreshold, onThresholdChange]);

  const status = useMemo(
    () => getStockStatus(stockQuantity, lowStockThreshold),
    [stockQuantity, lowStockThreshold]
  );

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Threshold Input */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="low-stock-threshold" className="text-sm font-medium">
            {label}
          </Label>
          <FieldHelp
            tooltip={fieldHelpTexts.lowStockAlert.tooltip}
            example={fieldHelpTexts.lowStockAlert.example}
            variant="info"
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-[140px]">
            <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="low-stock-threshold"
              type="number"
              min={minThreshold}
              max={maxThreshold}
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleBlur}
              disabled={disabled}
              className="pl-9"
              placeholder="10"
            />
          </div>
          <span className="text-sm text-muted-foreground">units</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Alerts trigger when stock falls at or below this level
        </p>
      </div>

      {/* Stock Status Preview */}
      {showPreview && (
        <Card className={cn('border', config.borderColor, config.bgColor)}>
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className={cn('p-1.5 rounded-full', config.bgColor)}>
                <StatusIcon className={cn('h-4 w-4', config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">Current Status:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-medium text-xs',
                      config.color,
                      config.bgColor,
                      config.borderColor
                    )}
                  >
                    {config.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {config.description}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span>
                    <span className="text-muted-foreground">Stock:</span>{' '}
                    <span className="font-mono font-medium">{stockQuantity}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Threshold:</span>{' '}
                    <span className="font-mono font-medium">{lowStockThreshold}</span>
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Compact version for table rows or inline editing
 */
interface CompactStockLevelInputProps {
  stockQuantity: number;
  lowStockThreshold: number;
  onThresholdChange: (threshold: number) => void;
  disabled?: boolean;
  className?: string;
}

export function CompactStockLevelInput({
  stockQuantity,
  lowStockThreshold,
  onThresholdChange,
  disabled = false,
  className,
}: CompactStockLevelInputProps) {
  const [inputValue, setInputValue] = useState(lowStockThreshold.toString());

  useEffect(() => {
    setInputValue(lowStockThreshold.toString());
  }, [lowStockThreshold]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      onThresholdChange(numValue);
    }
  };

  const handleBlur = () => {
    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue) || numValue < 0) {
      setInputValue('0');
      onThresholdChange(0);
    }
  };

  const status = getStockStatus(stockQuantity, lowStockThreshold);
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('p-1 rounded', config.bgColor)}>
        <StatusIcon className={cn('h-3.5 w-3.5', config.color)} />
      </div>
      <Input
        type="number"
        min={0}
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        className="w-20 h-8 text-sm"
        aria-label="Low stock threshold"
      />
    </div>
  );
}

/**
 * Read-only status badge for display purposes
 */
interface StockStatusBadgeProps {
  stockQuantity: number;
  lowStockThreshold: number;
  showQuantity?: boolean;
  className?: string;
}

export function StockStatusBadge({
  stockQuantity,
  lowStockThreshold,
  showQuantity = true,
  className,
}: StockStatusBadgeProps) {
  const status = getStockStatus(stockQuantity, lowStockThreshold);
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium gap-1.5',
        config.color,
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <StatusIcon className="h-3 w-3" />
      {showQuantity ? `${stockQuantity} units` : config.label}
    </Badge>
  );
}

/**
 * Export helper to calculate stock status from values
 */
export { getStockStatus, type StockStatus };
