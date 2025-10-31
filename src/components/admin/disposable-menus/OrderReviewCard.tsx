import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Phone, MapPin, Package, Calendar, DollarSign, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cleanProductName } from '@/utils/productName';

interface OrderReviewCardProps {
  order: any;
  onReview: () => void;
}

export const OrderReviewCard = ({ order, onReview }: OrderReviewCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'confirmed':
        return 'outline';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'asap':
        return <Badge variant="destructive">ASAP</Badge>;
      case 'this_week':
        return <Badge variant="default">This Week</Badge>;
      case 'specific_date':
        return <Badge variant="outline">Scheduled</Badge>;
      default:
        return null;
    }
  };

  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const totalQuantity = orderItems.reduce((sum: number, item: any) => 
    sum + (item.quantity || 0), 0
  );

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Order #{order.id.slice(0, 8)}</h3>
              <Badge variant={getStatusColor(order.status)}>
                {order.status}
              </Badge>
              {order.urgency && getUrgencyBadge(order.urgency)}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </p>
          </div>
          <Button onClick={onReview}>
            <Eye className="h-4 w-4 mr-2" />
            Review Order
          </Button>
        </div>

        {/* Customer Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{order.contact_name || 'Anonymous'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{order.contact_phone || 'N/A'}</span>
            </div>
            {order.delivery_address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">{order.delivery_address}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>{totalQuantity} lbs total</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold text-primary">
                ${order.total_amount?.toLocaleString() || '0'}
              </span>
            </div>
            {order.specific_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(order.specific_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Order Items Preview */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Order Items:</p>
          <div className="space-y-1">
            {orderItems.slice(0, 3).map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {cleanProductName(item.product_name || 'Product')} × {item.quantity} lbs
                </span>
                <span>${((item.price_per_unit || 0) * (item.quantity || 0)).toLocaleString()}</span>
              </div>
            ))}
            {orderItems.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{orderItems.length - 3} more items
              </p>
            )}
          </div>
        </div>

        {/* Delivery Method & Payment */}
        <div className="flex gap-4 text-sm">
          <Badge variant="outline">
            {order.delivery_method === 'delivery' ? '🚚 Delivery' : '📦 Pickup'}
          </Badge>
          <Badge variant="outline">
            {order.payment_method === 'cash' ? '💵 Cash' : 
             order.payment_method === 'crypto' ? '₿ Crypto' : '💳 Credit'}
          </Badge>
        </div>
      </div>
    </Card>
  );
};
