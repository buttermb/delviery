/**
 * OrderQuickViewModal - Quick view dialog for order details
 * Shows key order information: status, customer, items, total, and delivery info
 */

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days";
import Package from "lucide-react/dist/esm/icons/package";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import User from "lucide-react/dist/esm/icons/user";
import Truck from "lucide-react/dist/esm/icons/truck";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { getStatusColor } from '@/lib/utils/statusColors';
import { cn } from '@/lib/utils';
import { QuickViewModal } from './QuickViewModal';

interface OrderItemData {
  product_name?: string;
  quantity?: number;
  price?: number;
}

interface OrderQuickViewData {
  id: string;
  order_number?: string;
  status: string;
  total_amount?: number;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  delivery_address?: string;
  delivery_borough?: string;
  items?: OrderItemData[];
  payment_status?: string;
  tracking_code?: string;
  eta_minutes?: number;
  courier_name?: string;
}

interface OrderQuickViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderQuickViewData | null;
  onViewFullDetails?: () => void;
}

export function OrderQuickViewModal({
  open,
  onOpenChange,
  order,
  onViewFullDetails,
}: OrderQuickViewModalProps) {
  if (!order) return null;

  const itemCount = order.items?.length || 0;
  const displayItems = order.items?.slice(0, 4) || [];
  const orderLabel = order.order_number || `#${order.id.slice(0, 8)}`;

  return (
    <QuickViewModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Order ${orderLabel}`}
      description={`Placed ${formatSmartDate(order.created_at)}`}
      onViewFullDetails={onViewFullDetails}
    >
      {/* Status & Date Row */}
      <div className="flex items-center justify-between">
        <Badge
          variant="outline"
          className={cn('text-xs', getStatusColor(order.status))}
        >
          {order.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </Badge>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatSmartDate(order.created_at)}
        </div>
      </div>

      {/* Customer Info */}
      {order.customer_name && (
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <span className="font-medium">{order.customer_name}</span>
            {order.customer_email && (
              <span className="text-muted-foreground text-xs ml-1.5">
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
          <span className="line-clamp-2">
            {order.delivery_address}
            {order.delivery_borough && `, ${order.delivery_borough}`}
          </span>
        </div>
      )}

      {/* Courier */}
      {order.courier_name && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Truck className="h-4 w-4 flex-shrink-0" />
          <span>{order.courier_name}</span>
          {order.eta_minutes != null && (
            <span className="text-xs">({order.eta_minutes} min ETA)</span>
          )}
        </div>
      )}

      <Separator />

      {/* Order Items */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </div>

        {displayItems.length > 0 && (
          <div className="space-y-1.5 pl-5">
            {displayItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="truncate flex-1 text-muted-foreground">
                  {item.quantity ?? 1}x {item.product_name || 'Unknown product'}
                </span>
                {item.price != null && (
                  <span className="ml-2 font-medium">
                    {formatCurrency((item.quantity ?? 1) * item.price)}
                  </span>
                )}
              </div>
            ))}
            {itemCount > 4 && (
              <div className="text-xs text-muted-foreground">
                +{itemCount - 4} more item{itemCount - 4 !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Total & Payment */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          {order.payment_status && (
            <Badge
              variant="outline"
              className={cn('text-xs', getStatusColor(order.payment_status))}
            >
              {order.payment_status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </Badge>
          )}
        </div>
        <span className="text-base font-semibold">
          {formatCurrency(order.total_amount || 0)}
        </span>
      </div>

      {/* Tracking Code */}
      {order.tracking_code && (
        <div className="text-xs text-muted-foreground">
          Tracking: <span className="font-mono">{order.tracking_code}</span>
        </div>
      )}
    </QuickViewModal>
  );
}
