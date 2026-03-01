import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMenuOrders } from '@/hooks/useDisposableMenus';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { usePagination } from '@/hooks/usePagination';
import { StandardPagination } from '@/components/shared/StandardPagination';
import {
  ShoppingBag,
  Search,
  Download,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  ArrowLeft,
  Package,
  TrendingUp,
  FileText,
  ClipboardList
} from 'lucide-react';
import { exportOrders } from '@/utils/exportHelpers';
import { showSuccessToast } from '@/utils/toastHelpers';
import { OrderDetailsDialog } from '@/components/admin/disposable-menus/OrderDetailsDialog';
import { OrderStatusBadge } from '@/components/admin/disposable-menus/OrderStatusBadge';
import { ConvertToInvoiceDialog } from '@/components/admin/disposable-menus/ConvertToInvoiceDialog';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { LastUpdated } from '@/components/shared/LastUpdated';
import CopyButton from '@/components/CopyButton';
import { formatSmartDate } from '@/lib/formatters';

interface OrderDataItems {
  items?: Array<{ quantity: number; name?: string; product_name?: string }>;
}

interface MenuOrder {
  id: string;
  menu_id: string;
  tenant_id: string;
  contact_phone: string | null;
  status: string;
  total_amount: number | null;
  order_data: OrderDataItems | null;
  created_at: string;
  converted_to_invoice_id: string | null;
  menu: { name: string } | null;
  [key: string]: unknown;
}

const DisposableMenuOrders = () => {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'cancelled'>('all');
  const [selectedOrder, setSelectedOrder] = useState<MenuOrder | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [convertOrder, setConvertOrder] = useState<MenuOrder | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Pass tenantId for proper tenant isolation
  const { data: orders, isLoading, refetch } = useMenuOrders(undefined, tenant?.id);

  const handleRefresh = async () => {
    await refetch();
    setLastUpdated(new Date());
  };

  // Filter orders
  const filteredOrders = orders?.filter(order => {
    const matchesSearch = searchQuery === '' ||
      order.contact_phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.menu?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) ?? [];

  // Pagination
  const {
    paginatedItems: paginatedOrders,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    goToPage,
    changePageSize,
  } = usePagination(filteredOrders, {
    defaultPageSize: 25,
    persistInUrl: true,
    urlKey: 'menuOrders',
  });

  // Calculate stats - Fixed: processing should use 'processing', completed should use 'completed'/'delivered'
  const stats = {
    total: orders?.length ?? 0,
    pending: orders?.filter(o => o.status === 'pending').length ?? 0,
    processing: orders?.filter(o => o.status === 'processing' || o.status === 'preparing').length ?? 0,
    completed: orders?.filter(o => o.status === 'completed' || o.status === 'delivered').length ?? 0,
    cancelled: orders?.filter(o => o.status === 'cancelled' || o.status === 'rejected').length ?? 0,
    totalRevenue: orders?.reduce((sum, o) => sum + parseFloat(String(o.total_amount ?? 0)), 0) ?? 0,
    avgOrderValue: orders && orders.length > 0
      ? orders.reduce((sum, o) => sum + parseFloat(String(o.total_amount ?? 0)), 0) / orders.length
      : 0
  };

  const handleExportAll = () => {
    if (!orders || orders.length === 0) return;
    const ordersWithMenuName = orders.map(order => ({
      ...order,
      menu_name: order.menu?.name || 'N/A'
    }));
    exportOrders(ordersWithMenuName);
    showSuccessToast('Export Complete', 'All orders exported to CSV');
  };

  const handleViewOrder = (order: MenuOrder) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToAdmin('disposable-menus')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Menus
          </Button>
          <div>
            <h1 className="text-xl font-bold">Order Management</h1>
            <LastUpdated 
              date={lastUpdated} 
              onRefresh={handleRefresh} 
              isLoading={isLoading} 
              className="mt-1" 
            />
          </div>
        </div>
        <Button onClick={handleExportAll} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export All
        </Button>
      </div>

      {/* Empty state when zero orders */}
      {!isLoading && (!orders || orders.length === 0) ? (
        <EnhancedEmptyState
          icon={ClipboardList}
          title="No menu orders yet"
          description="Orders appear here when customers order from your disposable menus"
        />
      ) : (
      <>
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processing}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Cancelled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cancelled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Avg Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.avgOrderValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search by customer, phone, or menu"
                placeholder="Search by customer, phone, or menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('pending')}
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === 'processing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('processing')}
              >
                Processing
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
              >
                Completed
              </Button>
              <Button
                variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('cancelled')}
              >
                Cancelled
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Orders ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              // Skeleton loading state
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-6 w-16 ml-auto" />
                        <div className="flex gap-2 justify-end">
                          <Skeleton className="h-8 w-20" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <EnhancedEmptyState
                icon={ClipboardList}
                title="No orders found"
                description="No orders match your current filters."
                compact
              />
            ) : (
              <div className="space-y-3">
                {paginatedOrders.map((order: MenuOrder) => (
                  <div
                    key={order.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => handleViewOrder(order)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold flex items-center gap-2">
                            {order.contact_phone || 'Unknown Customer'}
                            <CopyButton 
                              text={order.id} 
                              label="Order ID" 
                              showLabel={false} 
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" 
                            />
                          </h3>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="h-3 w-3" />
                            <span>{order.menu?.name || 'Unknown Menu'}</span>
                          </div>
                          <div>
                            {formatSmartDate(order.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold mb-1">
                          ${parseFloat(String(order.total_amount ?? 0)).toFixed(2)}
                        </div>
                        <div className="flex gap-2 justify-end">
                          {!order.converted_to_invoice_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConvertOrder(order);
                                setConvertDialogOpen(true);
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Convert
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={(e) => {
                            e.stopPropagation();
                            handleViewOrder(order);
                          }}>
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Order Items Preview */}
                    {(() => {
                      const orderItems = (order.order_data && typeof order.order_data === 'object' && 'items' in order.order_data)
                        ? (order.order_data as unknown as OrderDataItems).items
                        : undefined;
                      return orderItems && orderItems.length > 0 && (
                        <div className="pt-3 border-t">
                          <div className="text-xs text-muted-foreground mb-2">
                            {orderItems.length} item(s)
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {orderItems.slice(0, 3).map((item, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {item.quantity}x {item.name || item.product_name}
                              </Badge>
                            ))}
                            {orderItems.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{orderItems.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <StandardPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
          />
        </CardContent>
      </Card>
      </>
      )}

      {/* Order Details Dialog */}
      {selectedOrder && (
        <OrderDetailsDialog
          order={selectedOrder as any}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          onUpdate={() => {
            // Refetch orders after update
            setDetailsOpen(false);
          }}
        />
      )}

      {/* Convert to Invoice Dialog */}
      {convertOrder && (
        <ConvertToInvoiceDialog
          order={convertOrder}
          open={convertDialogOpen}
          onOpenChange={(open) => {
            setConvertDialogOpen(open);
            if (!open) setConvertOrder(null);
          }}
          onSuccess={() => {
            // Orders will be refetched via query invalidation
            setConvertDialogOpen(false);
            setConvertOrder(null);
          }}
        />
      )}
    </div>
  );
};

export default DisposableMenuOrders;
