/**
 * Order Kanban Board for Disposable Menu Orders
 * Drag-and-drop style status management with quick actions
 */
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle, XCircle, Clock, Package, DollarSign, 
  User, Phone, RefreshCw, Eye, FileText, ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMenuOrders } from '@/hooks/useDisposableMenus';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { format } from 'date-fns';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { OrderDetailsDialog } from './OrderDetailsDialog';
import { ConvertToInvoiceDialog } from './ConvertToInvoiceDialog';
import { cn } from '@/lib/utils';

interface OrderKanbanProps {
  onViewDetails?: (order: any) => void;
}

const COLUMNS = [
  { 
    id: 'pending', 
    label: 'Pending Review', 
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
    dotColor: 'bg-yellow-500',
    statuses: ['pending']
  },
  { 
    id: 'confirmed', 
    label: 'Confirmed', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-500',
    statuses: ['confirmed', 'processing']
  },
  { 
    id: 'completed', 
    label: 'Completed', 
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    dotColor: 'bg-emerald-500',
    statuses: ['completed', 'delivered']
  },
];

export function OrderKanban({ onViewDetails }: OrderKanbanProps) {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading, refetch } = useMenuOrders();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [convertOrder, setConvertOrder] = useState<any>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Group orders by column
  const ordersByColumn = useMemo(() => {
    const grouped: Record<string, any[]> = {
      pending: [],
      confirmed: [],
      completed: [],
    };

    orders.forEach((order: any) => {
      const column = COLUMNS.find(c => c.statuses.includes(order.status));
      if (column) {
        grouped[column.id].push(order);
      } else {
        // Default to pending for unknown statuses
        grouped.pending.push(order);
      }
    });

    return grouped;
  }, [orders]);

  // Calculate stats
  const stats = useMemo(() => ({
    total: orders.length,
    pending: ordersByColumn.pending.length,
    confirmed: ordersByColumn.confirmed.length,
    completed: ordersByColumn.completed.length,
    revenue: orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0),
  }), [orders, ordersByColumn]);

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      const { error } = await supabase
        .from('menu_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      showSuccessToast('Status Updated', `Order marked as ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['menu-orders'] });
    } catch (error) {
      showErrorToast('Update Failed', 'Could not update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Quick approve action
  const approveOrder = (orderId: string) => updateOrderStatus(orderId, 'confirmed');
  const rejectOrder = (orderId: string) => updateOrderStatus(orderId, 'rejected');
  const completeOrder = (orderId: string) => updateOrderStatus(orderId, 'completed');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-96" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Orders</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-full bg-yellow-500/10">
            <Clock className="h-4 w-4 text-yellow-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-full bg-blue-500/10">
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">{stats.confirmed}</div>
            <div className="text-xs text-muted-foreground">Confirmed</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-full bg-emerald-500/10">
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.revenue)}</div>
            <div className="text-xs text-muted-foreground">Revenue</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-center">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </Card>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((column) => (
          <div key={column.id} className="space-y-3">
            {/* Column Header */}
            <div className="flex items-center justify-between">
              <h3 className={cn("font-semibold flex items-center gap-2", column.color)}>
                <div className={cn("w-2 h-2 rounded-full", column.dotColor)} />
                {column.label}
                <Badge variant="secondary" className="ml-1">
                  {ordersByColumn[column.id].length}
                </Badge>
              </h3>
            </div>

            {/* Column Content */}
            <div className={cn(
              "space-y-2 min-h-[300px] p-3 rounded-lg border-2 border-dashed",
              column.bgColor, "border-transparent"
            )}>
              {ordersByColumn[column.id].length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No orders here
                </div>
              ) : (
                ordersByColumn[column.id].map((order: any) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    columnId={column.id}
                    isUpdating={updatingOrderId === order.id}
                    onApprove={() => approveOrder(order.id)}
                    onReject={() => rejectOrder(order.id)}
                    onComplete={() => completeOrder(order.id)}
                    onViewDetails={() => {
                      setSelectedOrder(order);
                      setDetailsOpen(true);
                    }}
                    onConvertToInvoice={() => setConvertOrder(order)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dialogs */}
      {selectedOrder && (
        <OrderDetailsDialog
          order={selectedOrder}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}

      {convertOrder && (
        <ConvertToInvoiceDialog
          order={convertOrder}
          open={!!convertOrder}
          onOpenChange={(open) => !open && setConvertOrder(null)}
        />
      )}
    </div>
  );
}

// Individual Order Card Component
interface OrderCardProps {
  order: any;
  columnId: string;
  isUpdating: boolean;
  onApprove: () => void;
  onReject: () => void;
  onComplete: () => void;
  onViewDetails: () => void;
  onConvertToInvoice: () => void;
}

function OrderCard({
  order,
  columnId,
  isUpdating,
  onApprove,
  onReject,
  onComplete,
  onViewDetails,
  onConvertToInvoice,
}: OrderCardProps) {
  const customerName = order.whitelist?.customer_name || order.contact_phone || 'Unknown Customer';
  const menuName = order.menu?.name || 'Menu';
  const total = Number(order.total_amount || 0);
  const itemCount = order.items?.length || 0;
  const createdAt = order.created_at ? format(new Date(order.created_at), 'MMM d, h:mm a') : '';

  return (
    <Card className={cn(
      "p-3 transition-all",
      isUpdating && "opacity-50 pointer-events-none",
      "hover:shadow-md cursor-pointer"
    )}>
      <div className="space-y-3">
        {/* Customer Info */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {customerName}
            </div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {menuName}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold text-emerald-600">{formatCurrency(total)}</div>
            <div className="text-xs text-muted-foreground">{itemCount} items</div>
          </div>
        </div>

        {/* Time */}
        <div className="text-xs text-muted-foreground">
          {createdAt}
        </div>

        {/* Actions based on column */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {columnId === 'pending' && (
            <>
              <Button
                size="sm"
                variant="default"
                className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700"
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
                disabled={isUpdating}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 px-3"
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                disabled={isUpdating}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {columnId === 'confirmed' && (
            <>
              <Button
                size="sm"
                variant="default"
                className="flex-1 h-8"
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
                disabled={isUpdating}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Complete
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3"
                onClick={(e) => { e.stopPropagation(); onConvertToInvoice(); }}
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {columnId === 'completed' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8"
                onClick={(e) => { e.stopPropagation(); onConvertToInvoice(); }}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Invoice
              </Button>
            </>
          )}

          {/* View Details Button - always shown */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default OrderKanban;

