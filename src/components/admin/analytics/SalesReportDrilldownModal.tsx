import { useMemo } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DrilldownFilter } from '@/hooks/useSalesReportDrilldown';

interface OrderWithItems {
  id: string;
  created_at: string;
  status: string;
  total?: string | number;
  total_amount?: string | number;
  customer_name?: string;
  order_items?: Array<{
    product_name: string;
    quantity: number;
    price: number;
  }>;
  [key: string]: unknown;
}

interface SalesReportDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: DrilldownFilter | null;
  orders: OrderWithItems[];
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'delivered':
    case 'completed':
      return 'default';
    case 'pending':
    case 'confirmed':
      return 'secondary';
    case 'cancelled':
    case 'rejected':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getOrderTotal(order: OrderWithItems): number {
  return parseFloat(
    (order.total_amount ?? order.total ?? 0).toString()
  );
}

export function SalesReportDrilldownModal({
  open,
  onOpenChange,
  filter,
  orders,
}: SalesReportDrilldownModalProps) {
  const filteredOrders = useMemo(() => {
    if (!filter || !orders.length) return [];

    return orders.filter((order) => {
      switch (filter.type) {
        case 'date': {
          const orderDate = format(parseISO(order.created_at), 'yyyy-MM-dd');
          return orderDate === filter.value;
        }
        case 'status': {
          return (order.status || 'unknown') === filter.value;
        }
        case 'product': {
          if (!order.order_items || !Array.isArray(order.order_items)) return false;
          return order.order_items.some(
            (item) => item.product_name === filter.value
          );
        }
        default:
          return false;
      }
    });
  }, [filter, orders]);

  const totalRevenue = useMemo(
    () => filteredOrders.reduce((sum, order) => sum + getOrderTotal(order), 0),
    [filteredOrders]
  );

  const description = useMemo(() => {
    if (!filter) return '';
    switch (filter.type) {
      case 'date':
        return `Orders placed on ${filter.label}`;
      case 'status':
        return `Orders with status "${filter.label}"`;
      case 'product':
        return `Orders containing "${filter.label}"`;
      default:
        return '';
    }
  }, [filter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Order Details — {filter?.label ?? ''}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm text-muted-foreground border-b pb-3">
          <span>
            <strong className="text-foreground">{filteredOrders.length}</strong> orders
          </span>
          <span>
            <strong className="text-foreground">${totalRevenue.toFixed(2)}</strong> total revenue
          </span>
        </div>

        <ScrollArea className="max-h-[400px]">
          {filteredOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(order.created_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.order_items && Array.isArray(order.order_items)
                        ? order.order_items
                            .map((item) => `${item.product_name} (x${item.quantity})`)
                            .join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${getOrderTotal(order).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No orders found for this segment.
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
