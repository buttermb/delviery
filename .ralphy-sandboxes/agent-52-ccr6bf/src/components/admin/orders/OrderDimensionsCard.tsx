/**
 * Order Dimensions Card Component
 * Displays aggregated weight and dimensions for delivery planning
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Package from "lucide-react/dist/esm/icons/package";
import Scale from "lucide-react/dist/esm/icons/scale";
import Ruler from "lucide-react/dist/esm/icons/ruler";
import { cn } from '@/lib/utils';

interface ProductDimensions {
  product_id: string;
  product_name: string;
  quantity: number;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

interface OrderDimensionsCardProps {
  /** Array of products with their dimensions and quantities */
  items: ProductDimensions[];
  /** Optional CSS class name */
  className?: string;
  /** Whether to show compact view */
  compact?: boolean;
}

/**
 * Displays order shipping dimensions summary for delivery planning.
 * Shows total weight, largest item dimensions, and items without dimensions.
 */
export function OrderDimensionsCard({
  items,
  className,
  compact = false,
}: OrderDimensionsCardProps) {
  const stats = useMemo(() => {
    let totalWeight = 0;
    let maxVolume = 0;
    let largestItem: ProductDimensions | null = null;
    const itemsWithWeight: ProductDimensions[] = [];
    const itemsWithDimensions: ProductDimensions[] = [];
    const itemsWithoutDimensions: ProductDimensions[] = [];

    for (const item of items) {
      const hasWeight = typeof item.weight_kg === 'number' && item.weight_kg > 0;
      const hasDimensions =
        typeof item.length_cm === 'number' &&
        typeof item.width_cm === 'number' &&
        typeof item.height_cm === 'number' &&
        item.length_cm > 0 &&
        item.width_cm > 0 &&
        item.height_cm > 0;

      if (hasWeight) {
        totalWeight += (item.weight_kg as number) * item.quantity;
        itemsWithWeight.push(item);
      }

      if (hasDimensions) {
        const volume =
          (item.length_cm as number) *
          (item.width_cm as number) *
          (item.height_cm as number);
        itemsWithDimensions.push(item);

        if (volume > maxVolume) {
          maxVolume = volume;
          largestItem = item;
        }
      }

      if (!hasWeight && !hasDimensions) {
        itemsWithoutDimensions.push(item);
      }
    }

    return {
      totalWeight,
      largestItem,
      maxVolume,
      itemsWithWeight: itemsWithWeight.length,
      itemsWithDimensions: itemsWithDimensions.length,
      itemsWithoutDimensions,
      totalItems: items.length,
    };
  }, [items]);

  const formatWeight = (kg: number) => {
    if (kg >= 1) {
      return `${kg.toFixed(2)} kg`;
    }
    return `${(kg * 1000).toFixed(0)} g`;
  };

  const formatVolume = (volumeCm3: number) => {
    if (volumeCm3 >= 1000) {
      return `${(volumeCm3 / 1000).toFixed(1)} L`;
    }
    return `${volumeCm3.toFixed(0)} cm³`;
  };

  // Don't show if no items have dimensions
  if (stats.itemsWithWeight === 0 && stats.itemsWithDimensions === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-4 text-sm', className)}>
        {stats.totalWeight > 0 && (
          <div className="flex items-center gap-1.5">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatWeight(stats.totalWeight)}</span>
          </div>
        )}
        {stats.largestItem && (
          <div className="flex items-center gap-1.5">
            <Ruler className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {stats.largestItem.length_cm}×{stats.largestItem.width_cm}×
              {stats.largestItem.height_cm} cm
            </span>
          </div>
        )}
        {stats.itemsWithoutDimensions.length > 0 && (
          <Badge variant="outline" className="text-yellow-600 border-yellow-300">
            {stats.itemsWithoutDimensions.length} item(s) missing dimensions
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          Shipping Dimensions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Weight */}
        {stats.totalWeight > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Scale className="h-4 w-4" />
              <span>Total Weight</span>
            </div>
            <span className="font-semibold">{formatWeight(stats.totalWeight)}</span>
          </div>
        )}

        {/* Largest Item */}
        {stats.largestItem && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Ruler className="h-4 w-4" />
              <span>Largest Item</span>
            </div>
            <div className="text-right">
              <div className="font-semibold">
                {stats.largestItem.length_cm}×{stats.largestItem.width_cm}×
                {stats.largestItem.height_cm} cm
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.largestItem.product_name} ({formatVolume(stats.maxVolume)})
              </div>
            </div>
          </div>
        )}

        {/* Coverage */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Dimension coverage</span>
            <span>
              {stats.itemsWithWeight + stats.itemsWithDimensions} / {stats.totalItems} items
            </span>
          </div>
        </div>

        {/* Missing Dimensions Warning */}
        {stats.itemsWithoutDimensions.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
              {stats.itemsWithoutDimensions.length} item(s) missing dimensions:
            </p>
            <ul className="mt-1 text-xs text-yellow-700 dark:text-yellow-300 space-y-0.5">
              {stats.itemsWithoutDimensions.slice(0, 3).map((item) => (
                <li key={item.product_id}>• {item.product_name}</li>
              ))}
              {stats.itemsWithoutDimensions.length > 3 && (
                <li>• +{stats.itemsWithoutDimensions.length - 3} more</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
