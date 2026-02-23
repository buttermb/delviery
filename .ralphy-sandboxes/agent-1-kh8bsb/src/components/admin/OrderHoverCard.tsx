/**
 * Order Hover Card
 * Quick preview of order details on hover
 */

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Package, CreditCard, User, MapPin, Clock } from 'lucide-react';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { getStatusColor } from '@/lib/utils/statusColors';
import { cn } from '@/lib/utils';

interface OrderItem {
  product_name?: string;
  quantity?: number;
  unit_price?: number;
}

interface OrderHoverCardProps {
  order: {
    id: string;
    order_number?: string;
    status: string;
    total_amount?: number;
    created_at: string;
    customer_name?: string;
    customer_email?: string;
    delivery_address?: string;
    items?: OrderItem[];
    payment_status?: string;
    estimated_delivery?: string;
  };
  children: React.ReactNode;
}

export function OrderHoverCard({ order, children }: OrderHoverCardProps) {
  const itemCount = order.items?.length || 0;
  const itemsPreview = order.items?.slice(0, 3) || [];

  return (
    <HoverCard openDelay={400}>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer inline-block">
          {children}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">
                {order.order_number || `Order #${order.id.slice(0, 8)}`}
              </h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {formatSmartDate(order.created_at)}
              </div>
            </div>
            <Badge 
              variant="outline" 
              className={cn('text-xs', getStatusColor(order.status))}
            >
              {order.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Badge>
          </div>

          {/* Customer Info */}
          {order.customer_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="font-medium">{order.customer_name}</span>
                {order.customer_email && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    ({order.customer_email})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Delivery Address */}
          {order.delivery_address && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{order.delivery_address}</span>
            </div>
          )}

          {/* Items Preview */}
          {itemCount > 0 && (
            <div className="border-t pt-2 mt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Package className="h-3 w-3" />
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </div>
              <div className="space-y-1">
                {itemsPreview.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="truncate flex-1">
                      {item.quantity}x {item.product_name || 'Unknown product'}
                    </span>
                    {item.unit_price !== undefined && (
                      <span className="text-muted-foreground ml-2">
                        {formatCurrency((item.quantity || 1) * item.unit_price)}
                      </span>
                    )}
                  </div>
                ))}
                {itemCount > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{itemCount - 3} more item{itemCount - 3 !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer with totals */}
          <div className="flex items-center justify-between border-t pt-2 mt-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {order.payment_status && (
                <Badge 
                  variant="outline" 
                  className={cn('text-xs', getStatusColor(order.payment_status))}
                >
                  {order.payment_status}
                </Badge>
              )}
            </div>
            <span className="text-sm font-semibold">
              {formatCurrency(order.total_amount || 0)}
            </span>
          </div>

          {/* Estimated Delivery */}
          {order.estimated_delivery && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Est. delivery: {formatSmartDate(order.estimated_delivery)}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
