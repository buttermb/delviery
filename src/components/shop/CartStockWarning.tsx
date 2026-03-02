/**
 * Cart Stock Warning Component
 * Shows stock warnings for cart items and checks if checkout should be blocked
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Ban, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
}

interface CartStockWarningProps {
  productId: string;
  requestedQuantity: number;
  className?: string;
  variant?: 'badge' | 'inline' | 'minimal';
}

interface CartStockCheckResult {
  hasInsufficientStock: boolean;
  insufficientItems: Array<{
    productId: string;
    name: string;
    requested: number;
    available: number;
  }>;
}

// Hook to check stock for multiple cart items
export function useCartStockCheck(cartItems: CartItem[]) {
  return useQuery({
    queryKey: queryKeys.cartStockCheck.byItems(cartItems.map(i => `${i.productId}:${i.quantity}`).join(',')),
    queryFn: async (): Promise<CartStockCheckResult> => {
      if (cartItems.length === 0) {
        return { hasInsufficientStock: false, insufficientItems: [] };
      }

      const productIds = cartItems.map(item => item.productId);
      
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity, available_quantity')
        .in('id', productIds);

      if (error) {
        logger.error('Error checking cart stock', error);
        return { hasInsufficientStock: false, insufficientItems: [] };
      }

      const insufficientItems: CartStockCheckResult['insufficientItems'] = [];

      for (const item of cartItems) {
        const product = products?.find(p => p.id === item.productId);
        if (product) {
          const available = product.available_quantity ?? product.stock_quantity ?? 0;
          if (available < item.quantity) {
            insufficientItems.push({
              productId: item.productId,
              name: item.name,
              requested: item.quantity,
              available,
            });
          }
        }
      }

      return {
        hasInsufficientStock: insufficientItems.length > 0,
        insufficientItems,
      };
    },
    enabled: cartItems.length > 0,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

// Single item stock warning for cart display
export function CartItemStockWarning({ 
  productId, 
  requestedQuantity, 
  className,
  variant = 'minimal'
}: CartStockWarningProps) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.productStock.byProduct(productId),
    queryFn: async () => {
      const { data: product, error } = await supabase
        .from('products')
        .select('stock_quantity, available_quantity')
        .eq('id', productId)
        .maybeSingle();

      if (error) throw error;
      return product?.available_quantity ?? product?.stock_quantity ?? 0;
    },
    staleTime: 30000,
  });

  if (isLoading) {
    return null;
  }

  const available = data ?? 0;
  const isOutOfStock = available <= 0;
  const isLowStock = available > 0 && available <= 5;
  const isInsufficient = available < requestedQuantity && available > 0;

  if (!isOutOfStock && !isLowStock && !isInsufficient) {
    return null;
  }

  if (variant === 'minimal') {
    if (isOutOfStock) {
      return (
        <span className={cn("text-xs text-destructive flex items-center gap-1", className)}>
          <Ban className="w-3 h-3" />
          Out of stock
        </span>
      );
    }
    if (isInsufficient) {
      return (
        <span className={cn("text-xs text-warning flex items-center gap-1", className)}>
          <AlertTriangle className="w-3 h-3" />
          Only {available} left
        </span>
      );
    }
    if (isLowStock) {
      return (
        <span className={cn("text-xs text-warning flex items-center gap-1", className)}>
          <Package className="w-3 h-3" />
          Low stock
        </span>
      );
    }
  }

  if (variant === 'badge') {
    if (isOutOfStock) {
      return (
        <Badge variant="destructive" className={cn("text-xs", className)}>
          <Ban className="w-3 h-3 mr-1" />
          Out of Stock
        </Badge>
      );
    }
    if (isInsufficient) {
      return (
        <Badge variant="outline" className={cn("text-xs border-warning text-warning", className)}>
          <AlertTriangle className="w-3 h-3 mr-1" />
          Only {available} available
        </Badge>
      );
    }
  }

  return null;
}

// Summary component for cart page
export function CartStockSummary({ 
  cartItems,
  className,
}: { 
  cartItems: CartItem[];
  className?: string;
}) {
  const { data, isLoading } = useCartStockCheck(cartItems);

  if (isLoading || !data?.hasInsufficientStock) {
    return null;
  }

  return (
    <div className={cn(
      "p-4 rounded-lg border border-warning/50 bg-warning/10",
      className
    )}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-warning">
            Some items have limited stock
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {data.insufficientItems.map(item => (
              <li key={item.productId}>
                <strong>{item.name}</strong>: Only {item.available} available (you have {item.requested})
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Please adjust quantities before checkout.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CartItemStockWarning;