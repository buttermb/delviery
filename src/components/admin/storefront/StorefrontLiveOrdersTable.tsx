/**
 * Storefront Live Orders Table
 * Table view for live orders with all required columns:
 * Order #, Customer, Phone, Items, Total, Payment, Fulfillment, Status, Time, Actions
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
  Clock,
  CreditCard,
  Banknote,
  Truck,
  Store,
  MoreHorizontal,
  Eye,
  Phone,
  MessageSquare,
  Mail,
  Send,
  Package,
  XCircle,
} from 'lucide-react';
import type { LiveOrder } from '@/pages/admin/storefront/StorefrontLiveOrders';
import { getValidNextStatuses } from '@/pages/admin/storefront/StorefrontLiveOrders';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  preparing: 'bg-blue-100 text-blue-800 border-blue-200',
  ready: 'bg-green-100 text-green-800 border-green-200',
  out_for_delivery: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-gray-100 text-gray-600 border-gray-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

interface StorefrontLiveOrdersTableProps {
  orders: LiveOrder[];
  onStatusChange: (orderId: string, newStatus: string) => void;
  onViewDetails: (orderId: string) => void;
  isLoading?: boolean;
  updatingOrderId?: string | null;
  telegramLink?: string | null;
}

/** Derive payment method from order fields */
function getPaymentMethod(order: LiveOrder): { label: string; icon: 'card' | 'cash' } {
  if (order.stripe_payment_intent_id || order.payment_status === 'paid') {
    return { label: 'Card', icon: 'card' };
  }
  if (order.payment_terms) {
    const terms = order.payment_terms.toLowerCase();
    if (terms.includes('card') || terms.includes('stripe')) {
      return { label: 'Card', icon: 'card' };
    }
  }
  return { label: 'Cash', icon: 'cash' };
}

/** Determine fulfillment type */
function getFulfillmentType(order: LiveOrder): 'delivery' | 'pickup' {
  if (order.shipping_method) {
    const method = order.shipping_method.toLowerCase();
    if (method.includes('pickup') || method.includes('collect')) return 'pickup';
    return 'delivery';
  }
  if (!order.delivery_address) return 'pickup';
  return 'delivery';
}

/** Calculate relative time */
function getRelativeTime(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const hours = Math.floor(diffMins / 60);
  if (hours < 24) return `${hours}h ${diffMins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Extract item names from the items array */
function getItemNames(items: unknown[]): string[] {
  return items.map((item) => {
    const i = item as Record<string, unknown>;
    const name = (i.name || i.product_name || 'Item') as string;
    const qty = (i.quantity || 1) as number;
    return qty > 1 ? `${name} x${qty}` : name;
  });
}

function LoadingSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableHead key={i}>
              <Skeleton className="h-4 w-16" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 10 }).map((_, j) => (
              <TableCell key={j}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function StorefrontLiveOrdersTable({
  orders,
  onStatusChange,
  onViewDetails,
  isLoading,
  updatingOrderId,
  telegramLink,
}: StorefrontLiveOrdersTableProps) {
  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [orders]
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Order #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-center">Items</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Fulfillment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="text-right w-[60px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const itemNames = getItemNames(items);
            const orderTotal = order.total || order.total_amount || 0;
            const payment = getPaymentMethod(order);
            const fulfillment = getFulfillmentType(order);
            const isUpdating = updatingOrderId === order.id;
            const validActions = getValidNextStatuses(order.status, fulfillment);

            return (
              <TableRow
                key={order.id}
                className={cn(isUpdating && 'opacity-60')}
              >
                {/* 1. Order # */}
                <TableCell>
                  <button
                    onClick={() => onViewDetails(order.id)}
                    className="font-semibold text-primary hover:underline cursor-pointer"
                  >
                    #{order.order_number}
                  </button>
                </TableCell>

                {/* 2. Customer name */}
                <TableCell className="max-w-[140px] truncate">
                  {order.customer_name || 'Guest'}
                </TableCell>

                {/* 3. Phone */}
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {order.customer_phone || '—'}
                </TableCell>

                {/* 4. Items count (with tooltip) */}
                <TableCell className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 cursor-default">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        {items.length}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[250px]">
                      {itemNames.length > 0 ? (
                        <ul className="text-xs space-y-0.5">
                          {itemNames.map((name, idx) => (
                            <li key={idx}>{name}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs">No items</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>

                {/* 5. Total */}
                <TableCell className="text-right font-medium whitespace-nowrap">
                  {formatCurrency(orderTotal)}
                </TableCell>

                {/* 6. Payment method */}
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    {payment.icon === 'card' ? (
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {payment.label}
                  </span>
                </TableCell>

                {/* 7. Fulfillment */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      fulfillment === 'delivery'
                        ? 'border-blue-300 text-blue-700 bg-blue-50'
                        : 'border-orange-300 text-orange-700 bg-orange-50'
                    )}
                  >
                    {fulfillment === 'delivery' ? (
                      <>
                        <Truck className="h-3 w-3 mr-1" />
                        Delivery
                      </>
                    ) : (
                      <>
                        <Store className="h-3 w-3 mr-1" />
                        Pickup
                      </>
                    )}
                  </Badge>
                </TableCell>

                {/* 8. Status */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-medium',
                      STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {STATUS_LABELS[order.status] || order.status}
                  </Badge>
                </TableCell>

                {/* 9. Time */}
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {getRelativeTime(order.created_at)}
                  </span>
                </TableCell>

                {/* 10. Actions dropdown */}
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={isUpdating}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Status actions — only valid next statuses */}
                      {validActions.map((action) => (
                        <DropdownMenuItem
                          key={action.status}
                          onClick={() => onStatusChange(order.id, action.status)}
                          className={cn(
                            action.variant === 'destructive' && 'text-destructive focus:text-destructive'
                          )}
                        >
                          {action.variant === 'destructive' ? (
                            <XCircle className="h-4 w-4 mr-2" />
                          ) : (
                            <span
                              className={cn(
                                'inline-block h-2 w-2 rounded-full mr-2',
                                STATUS_COLORS[action.status]?.split(' ')[0] || 'bg-gray-300'
                              )}
                            />
                          )}
                          {action.label}
                        </DropdownMenuItem>
                      ))}

                      {validActions.length > 0 && <DropdownMenuSeparator />}

                      {/* View Details */}
                      <DropdownMenuItem onClick={() => onViewDetails(order.id)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>

                      {/* Contact shortcuts */}
                      {order.customer_phone && (
                        <DropdownMenuItem asChild>
                          <a href={`tel:${order.customer_phone}`}>
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </a>
                        </DropdownMenuItem>
                      )}
                      {order.customer_phone && (
                        <DropdownMenuItem asChild>
                          <a href={`sms:${order.customer_phone}`}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            SMS
                          </a>
                        </DropdownMenuItem>
                      )}
                      {order.customer_email && (
                        <DropdownMenuItem asChild>
                          <a href={`mailto:${order.customer_email}`}>
                            <Mail className="h-4 w-4 mr-2" />
                            Email
                          </a>
                        </DropdownMenuItem>
                      )}
                      {telegramLink && (
                        <DropdownMenuItem asChild>
                          <a href={telegramLink} target="_blank" rel="noopener noreferrer">
                            <Send className="h-4 w-4 mr-2" />
                            Telegram
                          </a>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
