import { useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Package from "lucide-react/dist/esm/icons/package";
import Clock from "lucide-react/dist/esm/icons/clock";
import Eye from "lucide-react/dist/esm/icons/eye";
import { format } from 'date-fns';
import { StatusDropdown, MENU_ORDER_STATUSES } from '@/components/admin/StatusDropdown';
import { QuickMessageButton } from '@/components/admin/QuickMessageButton';
import { OrderRowContextMenu, useOrderContextActions } from '@/components/admin/OrderRowContextMenu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { logger } from '@/lib/logger';

interface Order {
  id: string;
  status: string;
  total_amount: number | string;
  created_at: string;
  customer_notes?: string | null;
  order_data?: string | null;
  whitelist?: {
    customer_name?: string;
    customer_phone?: string;
  } | null;
}

interface MenuOrdersTabProps {
  orders: Order[];
  isLoading: boolean;
  onOrderUpdate?: () => void;
}

export const MenuOrdersTab = ({ orders, isLoading, onOrderUpdate }: MenuOrdersTabProps) => {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const handleStatusChange = useCallback(async (orderId: string, newStatus: string) => {
    const updates: Record<string, unknown> = {
      status: newStatus as any,
      updated_at: new Date().toISOString()
    };

    // Add timestamp fields based on status
    if (newStatus === 'delivered' || newStatus === 'completed') {
      updates.delivered_at = new Date().toISOString();
    } else if (newStatus === 'cancelled' || newStatus === 'rejected') {
      updates.cancelled_at = new Date().toISOString();
      // Release inventory for cancelled/rejected menu orders
      try {
        await supabase.rpc('release_order_inventory', {
          p_order_id: orderId,
          p_order_type: 'menu'
        });
      } catch (invError) {
        logger.warn('Failed to release inventory', invError);
      }
    }

    const { error } = await supabase
      .from('menu_orders')
      .update(updates)
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update status');
      throw error;
    }

    toast.success(`Order status updated to ${newStatus}`);
    onOrderUpdate?.();
  }, [onOrderUpdate]);

  const { handleAction } = useOrderContextActions({
    onView: (orderId) => {
      // Open order details dialog or navigate
      toast.info(`Viewing order ${orderId.slice(0, 8)}...`);
    },
    onEdit: (orderId) => {
      toast.info(`Editing order ${orderId.slice(0, 8)}...`);
    },
    onStatusChange: handleStatusChange,
    onSendUpdate: (orderId) => {
      const order = orders.find(o => o.id === orderId);
      if (order?.whitelist?.customer_phone) {
        toast.info(`Sending update to ${order.whitelist.customer_name || 'customer'}...`);
      }
    },
    onCancel: async (orderId) => {
      await handleStatusChange(orderId, 'cancelled');
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No orders yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Orders will appear here when customers place them
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <OrderRowContextMenu
          key={order.id}
          orderId={order.id}
          currentStatus={order.status}
          onAction={(action, data) => handleAction(order.id, action, data)}
          showInvoiceAction={false}
          showPrintAction={false}
        >
          <Card className="p-4 cursor-context-menu hover:border-primary/20 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-semibold mb-1">
                    {order.whitelist?.customer_name || 'Unknown Customer'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {order.whitelist?.customer_phone}
                  </div>
                </div>
                {/* Quick Message Button */}
                <QuickMessageButton
                  recipientName={order.whitelist?.customer_name || 'Customer'}
                  recipientPhone={order.whitelist?.customer_phone}
                  variant="icon"
                  size="sm"
                />
              </div>
              {/* Inline Status Dropdown */}
              <StatusDropdown
                currentStatus={order.status}
                statuses={MENU_ORDER_STATUSES}
                onStatusChange={(status) => handleStatusChange(order.id, status)}
                size="sm"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">
                  ${parseFloat(String(order.total_amount)).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>
                  {order.order_data ? JSON.parse(order.order_data as string).length : 0} items
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{format(new Date(String(order.created_at)), 'MMM dd, HH:mm')}</span>
              </div>
              <div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleAction(order.id, 'view')}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Details
                </Button>
              </div>
            </div>

            {order.customer_notes && (
              <div className="bg-muted/50 p-3 rounded text-sm">
                <div className="text-xs text-muted-foreground mb-1">Customer Notes:</div>
                {order.customer_notes}
              </div>
            )}
          </Card>
        </OrderRowContextMenu>
      ))}
    </div>
  );
};
