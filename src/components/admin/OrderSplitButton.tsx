/**
 * OrderSplitButton - Button to trigger order splitting into multiple shipments
 * Can be used standalone or integrated into order action menus
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Split from "lucide-react/dist/esm/icons/split";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { OrderSplitDialog } from './OrderSplitDialog';
import type { OrderItem } from '@/hooks/useOrderSplit';

interface OrderData {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string;
  delivery_borough: string;
  delivery_notes: string | null;
  payment_method: string;
  payment_status: string | null;
  tenant_id: string | null;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number | null;
  tip_amount: number | null;
  total_amount: number;
  status?: string;
}

interface OrderSplitButtonProps {
  /** Order data - if provided, uses this directly */
  order?: OrderData;
  /** Order ID - if provided without order data, fetches the order */
  orderId?: string;
  /** Callback when split is successful */
  onSuccess?: (newOrderIds: string[]) => void;
  /** Button variant */
  variant?: 'default' | 'ghost' | 'outline' | 'secondary' | 'destructive';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Show label text */
  showLabel?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function OrderSplitButton({
  order: providedOrder,
  orderId,
  onSuccess,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
  disabled = false,
  className,
}: OrderSplitButtonProps) {
  const { tenant } = useTenantAdminAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState<OrderData | null>(providedOrder || null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Update order when providedOrder changes
  useEffect(() => {
    if (providedOrder) {
      setOrder(providedOrder);
    }
  }, [providedOrder]);

  const fetchOrderData = useCallback(async () => {
    const targetOrderId = orderId || providedOrder?.id;
    if (!targetOrderId || !tenant?.id) return;

    setIsLoading(true);
    try {
      // Fetch order if not provided
      if (!providedOrder) {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('id, order_number, customer_id, customer_name, customer_phone, delivery_address, delivery_borough, delivery_notes, payment_method, payment_status, tenant_id, subtotal, delivery_fee, discount_amount, tip_amount, total_amount, status')
          .eq('id', targetOrderId)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (orderError) throw orderError;
        if (!orderData) {
          toast.error('Order not found');
          return;
        }

        setOrder(orderData as OrderData);
      }

      // Fetch order items
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, product_name, quantity, price')
        .eq('order_id', targetOrderId);

      if (itemsError) throw itemsError;

      setOrderItems(items ?? []);
      setIsDialogOpen(true);
    } catch (error) {
      logger.error('Failed to fetch order data for split', error instanceof Error ? error : new Error('Unknown error'), {
        component: 'OrderSplitButton',
        orderId: targetOrderId,
      });
      toast.error('Failed to load order data', { description: humanizeError(error) });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, providedOrder, tenant?.id]);

  const handleClick = async () => {
    // Check if order can be split
    if (order?.status === 'split') {
      toast.error('This order has already been split');
      return;
    }

    if (order?.status === 'delivered' || order?.status === 'cancelled') {
      toast.error(`Cannot split ${order.status} orders`);
      return;
    }

    await fetchOrderData();
  };

  const handleSuccess = (newOrderIds: string[]) => {
    setIsDialogOpen(false);
    onSuccess?.(newOrderIds);
  };

  const isButtonDisabled = disabled || isLoading || !tenant?.id;

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isButtonDisabled}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Split className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="ml-1">
          {isLoading ? 'Loading...' : 'Split Order'}
        </span>
      )}
    </Button>
  );

  return (
    <>
      {!showLabel ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>
              <p>Split into multiple shipments</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      {order && (
        <OrderSplitDialog
          order={order}
          orderItems={orderItems}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
