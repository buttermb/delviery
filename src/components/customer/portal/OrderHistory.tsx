import { useMemo } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { PortalOrder } from '@/types/portal';

export interface OrderHistoryProps {
  orders: PortalOrder[];
}

export function OrderHistory({ orders }: OrderHistoryProps) {
  const isMobile = useIsMobile();

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'rejected':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  if (sortedOrders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
        <p>No orders found</p>
      </div>
    );
  }

  // Mobile: Card layout
  if (isMobile) {
    return (
      <div className="space-y-4">
        {sortedOrders.map((order) => (
          <Card key={order.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">Order #{order.id.slice(0, 8)}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
                <Badge className={getStatusColor(order.status)}>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(order.status)}
                    {order.status}
                  </span>
                </Badge>
              </div>
              {order.items && order.items.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {order.items.length} item(s)
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t">
                <div>
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-lg font-bold">
                    ${order.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                {order.converted_to_invoice_id && (
                  <Badge variant="outline" className="text-xs">
                    Converted to Invoice
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedOrders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">#{order.id.slice(0, 8)}</TableCell>
              <TableCell>{format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}</TableCell>
              <TableCell>{order.items?.length || 0} item(s)</TableCell>
              <TableCell className="font-semibold">
                ${order.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(order.status)}>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(order.status)}
                    {order.status}
                  </span>
                </Badge>
              </TableCell>
              <TableCell>
                {order.converted_to_invoice_id ? (
                  <Badge variant="outline" className="text-xs">
                    Converted to Invoice
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

