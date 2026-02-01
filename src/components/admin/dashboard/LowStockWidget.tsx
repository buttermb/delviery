/**
 * Low Stock Widget
 * Displays products below their low stock threshold with a reorder button.
 */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Package,
  ArrowRight,
  ShoppingCart,
  Loader2,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLowStockAlerts, LowStockProduct } from '@/hooks/useLowStockAlerts';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

export function LowStockWidget() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { products, isLoading, totalAlerts } = useLowStockAlerts();
  const { createPurchaseOrder } = usePurchaseOrders();
  const [creatingPoFor, setCreatingPoFor] = useState<string | null>(null);

  const getFullPath = (href: string) => {
    if (href.startsWith('/admin') && tenantSlug) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  // Display top 5 products, prioritized by alert level
  const displayProducts = useMemo(() => {
    return products
      .sort((a, b) => {
        const levelPriority = { out_of_stock: 0, critical: 1, warning: 2 };
        return levelPriority[a.alertLevel] - levelPriority[b.alertLevel];
      })
      .slice(0, 5);
  }, [products]);

  const handleReorder = async (product: LowStockProduct) => {
    setCreatingPoFor(product.id);
    try {
      // Calculate suggested order quantity: enough to reach 2x threshold
      const orderQuantity = Math.max(
        product.lowStockThreshold * 2 - product.availableQuantity,
        product.lowStockThreshold
      );

      await createPurchaseOrder.mutateAsync({
        supplier_id: '', // Will be selected in PO form
        notes: `Low stock reorder: ${product.name} is at ${product.availableQuantity} units (threshold: ${product.lowStockThreshold} units)`,
        items: [
          {
            product_id: product.id,
            quantity_lbs: orderQuantity,
            unit_cost: 0,
          },
        ],
      });

      toast.success('Purchase order created');
      logger.info('Purchase order created from low stock widget', {
        component: 'LowStockWidget',
        productId: product.id,
        orderQuantity,
      });
    } catch (error) {
      logger.error('Failed to create PO from low stock widget', error as Error, {
        component: 'LowStockWidget',
      });
      toast.error('Failed to create purchase order');
    } finally {
      setCreatingPoFor(null);
    }
  };

  const getBadgeVariant = (alertLevel: LowStockProduct['alertLevel']) => {
    switch (alertLevel) {
      case 'out_of_stock':
        return 'destructive';
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getAlertLabel = (alertLevel: LowStockProduct['alertLevel']) => {
    switch (alertLevel) {
      case 'out_of_stock':
        return 'Out of Stock';
      case 'critical':
        return 'Critical';
      case 'warning':
        return 'Low';
      default:
        return 'Low';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-2">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Low Stock Products
        </h3>
        {totalAlerts > 0 && (
          <Badge variant="destructive">{totalAlerts}</Badge>
        )}
      </div>

      <div className="space-y-2">
        {displayProducts.length > 0 ? (
          displayProducts.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {product.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {product.availableQuantity} / {product.lowStockThreshold} units
                    </span>
                    <Badge
                      variant={getBadgeVariant(product.alertLevel)}
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      {getAlertLabel(product.alertLevel)}
                    </Badge>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="shrink-0 ml-2"
                onClick={() => handleReorder(product)}
                disabled={creatingPoFor === product.id || createPurchaseOrder.isPending}
              >
                {creatingPoFor === product.id ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <ShoppingCart className="h-3 w-3 mr-1" />
                )}
                Reorder
              </Button>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            All products above stock threshold
          </div>
        )}
      </div>

      {displayProducts.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4"
          onClick={() => navigate(getFullPath('/admin/inventory-hub'))}
        >
          View All Inventory
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </Card>
  );
}
