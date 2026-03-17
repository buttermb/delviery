/**
 * Wholesale Quick Reorder Component
 * One-click reorder from past orders
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShoppingCart } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from '@/lib/queryKeys';
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/formatters";

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity_lbs: number;
  unit_price: number;
}

interface WholesaleQuickReorderProps {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  items: OrderItem[];
  totalAmount: number;
}

export function WholesaleQuickReorder({
  orderId,
  orderNumber,
  orderDate,
  items,
  totalAmount,
}: WholesaleQuickReorderProps) {
  const queryClient = useQueryClient();

  const reorderMutation = useMutation({
    mutationFn: async () => {
      // Get original order details
      const { data: originalOrder, error: fetchError } = await supabase
        .from('marketplace_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // Create new order with same items
      const { data: newOrder, error: createError } = await supabase
        .from('marketplace_orders')
        .insert({
          buyer_profile_id: originalOrder.buyer_profile_id,
          seller_profile_id: originalOrder.seller_profile_id,
          total_amount: totalAmount,
          status: 'pending',
          payment_status: 'pending',
          order_type: 'reorder',
          notes: `Reorder from order #${orderNumber}`,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: newOrder.id,
        product_id: item.product_id,
        quantity_lbs: item.quantity_lbs,
        unit_price: item.unit_price,
        total_price: item.quantity_lbs * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('marketplace_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return newOrder;
    },
    onSuccess: (newOrder) => {
      toast.success('Order duplicated successfully', {
        description: `New order #${newOrder.id} created`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceOrders.all });
    },
    onError: (error) => {
      logger.error('Failed to reorder', { error, orderId });
      toast.error('Failed to create reorder');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Quick Reorder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 p-4 bg-muted rounded-lg">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Original Order</span>
            <Badge variant="outline">#{orderNumber}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Date</span>
            <span className="text-sm">{formatSmartDate(orderDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Items</span>
            <span className="text-sm">{items.length} products</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-sm">Items to Reorder</h4>
          <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between p-2 bg-background rounded border">
                <span>{item.product_name}</span>
                <span className="text-muted-foreground">
                  {item.quantity_lbs} lbs × {formatCurrency(item.unit_price)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => reorderMutation.mutate()}
          disabled={reorderMutation.isPending}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {reorderMutation.isPending ? 'Creating Order...' : 'Reorder All Items'}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          This will create a new order with the same items. Prices will be updated to current rates.
        </p>
      </CardContent>
    </Card>
  );
}
