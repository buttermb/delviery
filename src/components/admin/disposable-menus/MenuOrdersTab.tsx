import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, DollarSign, Package, Clock, Eye } from 'lucide-react';
import { format } from 'date-fns';

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
}

export const MenuOrdersTab = ({ orders, isLoading }: MenuOrdersTabProps) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-semibold mb-1">
                {order.whitelist?.customer_name || 'Unknown Customer'}
              </div>
              <div className="text-sm text-muted-foreground">
                {order.whitelist?.customer_phone}
              </div>
            </div>
            <Badge className={getStatusColor(order.status)}>
              {order.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">
                ${parseFloat(order.total_amount).toFixed(2)}
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
              <span>{format(new Date(order.created_at), 'MMM dd, HH:mm')}</span>
            </div>
            <div>
              <Button variant="outline" size="sm">
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
      ))}
    </div>
  );
};
