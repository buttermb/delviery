import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, MoreHorizontal, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AssignToFleetDialog } from '@/components/admin/AssignToFleetDialog';
import { OrderLink } from '@/components/admin/cross-links';
import { LiveOrderStatusBadge } from '@/components/admin/live-orders/LiveOrderStatusBadge';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { formatCurrency } from '@/lib/formatters';
import { type LiveOrder } from '@/components/admin/live-orders/LiveOrdersKanban';

interface LiveOrdersListViewProps {
  orders: LiveOrder[];
  onStatusChange: (orderId: string, newStatus: string, source: 'menu' | 'app') => void;
  isLoading?: boolean;
}

const getNextStatus = (current: string): string | null => {
  switch (current) {
    case 'pending': return 'confirmed';
    case 'confirmed': return 'preparing';
    case 'preparing': return 'ready_for_pickup';
    case 'ready_for_pickup': return 'in_transit';
    case 'in_transit': return 'delivered';
    default: return null;
  }
};

function OrderRow({ order, onStatusChange }: { order: LiveOrder; onStatusChange: LiveOrdersListViewProps['onStatusChange'] }) {
  const [fleetDialogOpen, setFleetDialogOpen] = useState(false);
  const { isEnabled } = useTenantFeatureToggles();
  const deliveryEnabled = isEnabled('delivery_tracking');
  const nextStatus = getNextStatus(order.status);
  const showAssignToFleet = (order.status === 'ready_for_pickup' || order.status === 'ready') && !order.courier_id;

  return (
    <>
      <TableRow className="hover:bg-muted/50">
        <TableCell className="font-medium">
          <OrderLink orderId={order.id} orderNumber={`#${order.order_number}`} />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <LiveOrderStatusBadge status={order.status} />
            {order.source === 'menu' && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1">Menu</Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {order.menu_title || 'App Order'}
        </TableCell>
        <TableCell className="text-right font-medium">
          {order.total_amount != null ? formatCurrency(order.total_amount) : '-'}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            {showAssignToFleet && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        onClick={() => setFleetDialogOpen(true)}
                        disabled={!deliveryEnabled}
                      >
                        <Truck className="h-3 w-3" />
                        Fleet
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!deliveryEnabled && (
                    <TooltipContent>Enable Delivery Tracking in Settings</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
            {nextStatus && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => onStatusChange(order.id, nextStatus, order.source || 'app')}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Order actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onStatusChange(order.id, 'rejected', order.source || 'app')}>
                  Reject Order
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(order.id, 'cancelled', order.source || 'app')}>
                  Cancel Order
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <AssignToFleetDialog
        open={fleetDialogOpen}
        onOpenChange={setFleetDialogOpen}
        orderId={order.id}
        orderNumber={order.order_number}
        isWholesale={false}
        deliveryAddress={order.delivery_address}
      />
    </>
  );
}

export function LiveOrdersListView({ orders, onStatusChange, isLoading }: LiveOrdersListViewProps) {
  if (isLoading) {
    return <div className="text-center py-10">Loading orders...</div>;
  }

  return (
    <div className="rounded-lg border bg-white dark:bg-zinc-900">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="text-right w-[180px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} onStatusChange={onStatusChange} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
