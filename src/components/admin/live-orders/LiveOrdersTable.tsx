/**
 * Live Orders Table View
 * Table with columns: Order #, Customer, Phone, Items, Total, Payment, Fulfillment, Status, Time, Actions
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import {
  Clock,
  CreditCard,
  Banknote,
  Truck,
  Store,
  MoreHorizontal,
  Package,
  ChevronRight,
} from 'lucide-react';
import type { LiveOrder } from '@/components/admin/live-orders/LiveOrdersKanban';
import { LiveOrderStatusBadge } from '@/components/admin/live-orders/LiveOrderStatusBadge';

interface LiveOrdersTableProps {
  orders: LiveOrder[];
  onStatusChange: (orderId: string, newStatus: string, source: 'menu' | 'app') => void;
  isLoading?: boolean;
}

const NEXT_STATUS_MAP: Record<string, { status: string; label: string }[]> = {
  pending: [{ status: 'confirmed', label: 'Confirm' }],
  confirmed: [{ status: 'preparing', label: 'Start Preparing' }],
  preparing: [{ status: 'ready_for_pickup', label: 'Mark Ready' }],
  ready_for_pickup: [
    { status: 'in_transit', label: 'Out for Delivery' },
    { status: 'delivered', label: 'Mark Delivered' },
  ],
  in_transit: [{ status: 'delivered', label: 'Mark Delivered' }],
};

/** Calculate relative time */
function getRelativeTime(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const hours = Math.floor(diffMins / 60);
  if (hours < 24) return `${hours}h ${diffMins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Determine fulfillment type from order */
function getFulfillmentType(order: LiveOrder): 'delivery' | 'pickup' {
  if (order.order_type) {
    const type = order.order_type.toLowerCase();
    if (type.includes('pickup') || type.includes('collect')) return 'pickup';
  }
  if (!order.delivery_address) return 'pickup';
  return 'delivery';
}

function LoadingSkeleton() {
  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900">
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
    </div>
  );
}

export function LiveOrdersTable({ orders, onStatusChange, isLoading }: LiveOrdersTableProps) {
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
    <div className="rounded-lg border bg-white dark:bg-zinc-900">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Order #</TableHead>
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
            const fulfillment = getFulfillmentType(order);
            const source = order.source ?? 'app';
            const nextActions = NEXT_STATUS_MAP[order.status] ?? [];

            return (
              <TableRow key={order.id}>
                {/* 1. Order # */}
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm">
                      #{order.order_number}
                    </span>
                    {order.source === 'menu' && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                        Menu
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* 2. Customer */}
                <TableCell className="max-w-[140px] truncate text-sm">
                  {order.customer_name || 'Guest'}
                </TableCell>

                {/* 3. Phone */}
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {order.customer_phone || '—'}
                </TableCell>

                {/* 4. Items count */}
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1 text-sm">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    {order.items_count ?? 0}
                  </span>
                </TableCell>

                {/* 5. Total */}
                <TableCell className="text-right font-medium text-sm whitespace-nowrap">
                  {formatCurrency(order.total_amount ?? 0)}
                </TableCell>

                {/* 6. Payment */}
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    {order.payment_method?.toLowerCase().includes('card') || order.payment_status === 'paid' ? (
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {order.payment_method || 'Cash'}
                  </span>
                </TableCell>

                {/* 7. Fulfillment */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      fulfillment === 'delivery'
                        ? 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/30'
                        : 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:bg-orange-900/30'
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

                {/* 8. Status badge */}
                <TableCell>
                  <LiveOrderStatusBadge status={order.status} />
                </TableCell>

                {/* 9. Time */}
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {getRelativeTime(order.created_at)}
                  </span>
                </TableCell>

                {/* 10. Actions */}
                <TableCell className="text-right">
                  {nextActions.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {nextActions.map((action) => (
                          <DropdownMenuItem
                            key={action.status}
                            onClick={() => onStatusChange(order.id, action.status, source)}
                          >
                            <ChevronRight className="h-4 w-4 mr-2" />
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
