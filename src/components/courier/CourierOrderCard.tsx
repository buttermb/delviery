import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, DollarSign, Clock, Package } from 'lucide-react';
import { formatStatus } from '@/utils/stringHelpers';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  delivery_borough: string;
  tip_amount?: number;
  customer_name?: string;
  addresses?: {
    street: string;
    apartment?: string;
  };
  order_items?: Array<{
    product_name: string;
    quantity: number;
  }>;
}

interface CourierOrderCardProps {
  order: Order;
  onAccept?: (orderId: string) => void;
  onAction?: (orderId: string, action: string) => void;
  isActive?: boolean;
  showEarnings?: boolean;
  commissionRate?: number;
}

export const CourierOrderCard = memo(({
  order,
  onAccept,
  onAction,
  isActive = false,
  showEarnings = true,
  commissionRate = 30
}: CourierOrderCardProps) => {
  const baseCommission = (order.total_amount || 0) * (commissionRate / 100);
  const tipAmount = order.tip_amount || 0;
  const totalEarnings = baseCommission + tipAmount;
  const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <Card className={`p-4 space-y-3 transition-all ${isActive ? 'border-primary border-2' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-lg">#{order.order_number}</h3>
          <Badge variant={isActive ? 'default' : 'secondary'} className="mt-1">
            {formatStatus(order.status)}
          </Badge>
        </div>
        {showEarnings && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">You earn</div>
            <div className="text-2xl font-black text-primary">
              ${totalEarnings.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Customer & Location */}
      <div className="space-y-2">
        {order.customer_name && (
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium">{order.customer_name}</span>
          </div>
        )}
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{order.addresses?.street}</div>
            {order.addresses?.apartment && (
              <div className="text-muted-foreground">Apt {order.addresses.apartment}</div>
            )}
            <div className="text-muted-foreground">{order.delivery_borough}</div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      {order.order_items && order.order_items.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-2 text-sm">
          <div className="font-semibold mb-1">{itemCount} item{itemCount !== 1 ? 's' : ''}</div>
          <div className="space-y-1">
            {order.order_items.slice(0, 2).map((item, idx) => (
              <div key={idx} className="text-muted-foreground">
                {item.quantity}x {item.product_name}
              </div>
            ))}
            {order.order_items.length > 2 && (
              <div className="text-muted-foreground italic">
                +{order.order_items.length - 2} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Earnings Breakdown */}
      {showEarnings && (
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Base:</span>
            <span className="font-semibold">${baseCommission.toFixed(2)}</span>
          </div>
          {tipAmount > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-green-600" />
              <span className="text-muted-foreground">Tip:</span>
              <span className="font-semibold text-green-600">${tipAmount.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {onAccept && (
        <button
          onClick={() => onAccept(order.id)}
          className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg hover:bg-primary/90 active:scale-95 transition-all touch-manipulation"
          aria-label={`Accept order ${order.order_number}`}
        >
          Accept Order • ${totalEarnings.toFixed(2)}
        </button>
      )}
    </Card>
  );
});

CourierOrderCard.displayName = 'CourierOrderCard';
