/**
 * Auto Reorder Suggestions Widget
 * Shows products at or below their reorder point with a Create PO button.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Package from "lucide-react/dist/esm/icons/package";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface ReorderSuggestion {
  id: string;
  product_name: string;
  quantity_lbs: number;
  reorder_point: number;
  warehouse_location: string;
  cost_per_lb: number | null;
  deficit: number;
  severity: 'critical' | 'warning';
}

export function AutoReorderSuggestionsWidget() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { account } = useAccount();
  const { createPurchaseOrder } = usePurchaseOrders();
  const [creatingPoFor, setCreatingPoFor] = useState<string | null>(null);

  const getFullPath = (href: string) => {
    if (href.startsWith('/admin') && tenantSlug) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const { data: suggestions, isLoading } = useQuery({
    queryKey: [...queryKeys.inventory.alerts(), 'reorder-suggestions', account?.id],
    queryFn: async (): Promise<ReorderSuggestion[]> => {
      if (!account?.id) return [];

      const { data, error } = await supabase
        .from('wholesale_inventory')
        .select('id, product_name, quantity_lbs, reorder_point, warehouse_location, cost_per_lb')
        .eq('tenant_id', account.id)
        .order('quantity_lbs', { ascending: true })
        .limit(10);

      if (error) {
        logger.error('Failed to fetch reorder suggestions', error, {
          component: 'AutoReorderSuggestionsWidget',
        });
        throw error;
      }

      if (!data) return [];

      // Filter to only products at or below reorder point
      return data
        .filter((item) => item.quantity_lbs <= item.reorder_point)
        .map((item) => {
          const deficit = item.reorder_point - item.quantity_lbs;
          const ratio = item.quantity_lbs / item.reorder_point;
          return {
            id: item.id,
            product_name: item.product_name,
            quantity_lbs: item.quantity_lbs,
            reorder_point: item.reorder_point,
            warehouse_location: item.warehouse_location,
            cost_per_lb: item.cost_per_lb,
            deficit,
            severity: ratio < 0.25 ? 'critical' as const : 'warning' as const,
          };
        })
        .sort((a, b) => {
          // Critical items first, then by deficit descending
          if (a.severity !== b.severity) {
            return a.severity === 'critical' ? -1 : 1;
          }
          return b.deficit - a.deficit;
        })
        .slice(0, 5);
    },
    enabled: !!account?.id,
    staleTime: 30000,
  });

  const handleCreatePO = async (suggestion: ReorderSuggestion) => {
    setCreatingPoFor(suggestion.id);
    try {
      // Calculate suggested order quantity: enough to reach 2x reorder point
      const orderQuantity = Math.max(
        suggestion.reorder_point * 2 - suggestion.quantity_lbs,
        suggestion.reorder_point
      );

      await createPurchaseOrder.mutateAsync({
        supplier_id: '', // Will be selected in PO form
        notes: `Auto-reorder suggestion: ${suggestion.product_name} is at ${suggestion.quantity_lbs} lbs (reorder point: ${suggestion.reorder_point} lbs)`,
        items: [
          {
            product_id: suggestion.id,
            quantity_lbs: orderQuantity,
            unit_cost: suggestion.cost_per_lb || 0,
          },
        ],
      });

      logger.info('Purchase order created from reorder suggestion', {
        component: 'AutoReorderSuggestionsWidget',
        productId: suggestion.id,
        orderQuantity,
      });
    } catch (error) {
      logger.error('Failed to create PO from reorder suggestion', error as Error, {
        component: 'AutoReorderSuggestionsWidget',
      });
      toast.error('Failed to create purchase order');
    } finally {
      setCreatingPoFor(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-2">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-8 w-24 rounded-md" />
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
          <TrendingDown className="h-5 w-5 text-amber-500" />
          Reorder Suggestions
        </h3>
        {suggestions && suggestions.length > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            {suggestions.length} {suggestions.length === 1 ? 'item' : 'items'}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {suggestions && suggestions.length > 0 ? (
          suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {suggestion.product_name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {suggestion.quantity_lbs.toFixed(1)} / {suggestion.reorder_point} lbs
                    </span>
                    <Badge
                      variant={suggestion.severity === 'critical' ? 'destructive' : 'outline'}
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      {suggestion.severity === 'critical' ? 'Critical' : 'Low'}
                    </Badge>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="shrink-0 ml-2"
                onClick={() => handleCreatePO(suggestion)}
                disabled={creatingPoFor === suggestion.id || createPurchaseOrder.isPending}
              >
                {creatingPoFor === suggestion.id ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <ShoppingCart className="h-3 w-3 mr-1" />
                )}
                Create PO
              </Button>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            All products above reorder point
          </div>
        )}
      </div>

      {suggestions && suggestions.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4"
          onClick={() => navigate(getFullPath('/admin/purchase-orders'))}
        >
          View All Purchase Orders
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </Card>
  );
}
