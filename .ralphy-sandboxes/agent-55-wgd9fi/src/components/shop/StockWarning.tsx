/**
 * Stock Warning Component
 * Shows low stock and out of stock warnings with real-time data
 */

import { AlertTriangle, Ban, Package, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProductStock } from '@/hooks/useInventoryCheck';

interface StockWarningProps {
  // Either provide productId for real-time lookup
  productId?: string;
  // Or provide available directly
  available?: number;
  requested?: number;
  className?: string;
  variant?: 'badge' | 'inline' | 'card';
}

export function StockWarning({ 
  productId,
  available: providedAvailable, 
  requested = 1, 
  className,
  variant = 'badge'
}: StockWarningProps) {
  // Use real-time stock if productId is provided
  const { data: stockData, isLoading } = useProductStock(productId);
  
  // Use fetched or provided available
  const available = productId 
    ? (stockData?.available ?? 0) 
    : (providedAvailable ?? 0);
  
  // Show loading state for real-time lookup
  if (productId && isLoading) {
    if (variant === 'inline') {
      return (
        <div className={cn("flex items-center gap-1.5 text-muted-foreground text-sm", className)}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking stock...</span>
        </div>
      );
    }
    return null;
  }
  
  const isOutOfStock = available <= 0;
  const isLowStock = available > 0 && available <= 5;
  const isInsufficient = available < requested && available > 0;

  if (!isOutOfStock && !isLowStock && !isInsufficient) {
    return null;
  }

  if (variant === 'badge') {
    if (isOutOfStock) {
      return (
        <Badge variant="destructive" className={cn("gap-1", className)}>
          <Ban className="w-3 h-3" />
          Out of Stock
        </Badge>
      );
    }

    if (isInsufficient) {
      return (
        <Badge variant="destructive" className={cn("gap-1", className)}>
          <AlertTriangle className="w-3 h-3" />
          Only {available} left
        </Badge>
      );
    }

    if (isLowStock) {
      return (
        <Badge variant="secondary" className={cn("gap-1 bg-amber-100 text-amber-800 border-amber-200", className)}>
          <AlertTriangle className="w-3 h-3" />
          Low Stock - {available} left
        </Badge>
      );
    }
  }

  if (variant === 'inline') {
    if (isOutOfStock) {
      return (
        <div className={cn("flex items-center gap-1.5 text-destructive text-sm", className)}>
          <Ban className="w-4 h-4" />
          <span>Out of stock</span>
        </div>
      );
    }

    if (isInsufficient) {
      return (
        <div className={cn("flex items-center gap-1.5 text-destructive text-sm", className)}>
          <AlertTriangle className="w-4 h-4" />
          <span>Only {available} available</span>
        </div>
      );
    }

    if (isLowStock) {
      return (
        <div className={cn("flex items-center gap-1.5 text-amber-600 text-sm", className)}>
          <AlertTriangle className="w-4 h-4" />
          <span>Low stock - only {available} left</span>
        </div>
      );
    }
  }

  if (variant === 'card') {
    if (isOutOfStock) {
      return (
        <div className={cn("flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg", className)}>
          <Ban className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800 text-sm">Out of Stock</p>
            <p className="text-red-600 text-xs">This item is currently unavailable</p>
          </div>
        </div>
      );
    }

    if (isLowStock) {
      return (
        <div className={cn("flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg", className)}>
          <Package className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 text-sm">Low Stock</p>
            <p className="text-amber-600 text-xs">Only {available} left - order soon!</p>
          </div>
        </div>
      );
    }
  }

  return null;
}

export default StockWarning;
