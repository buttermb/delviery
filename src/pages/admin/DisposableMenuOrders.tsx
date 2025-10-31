import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMenuOrders } from '@/hooks/useDisposableMenus';
import { format } from 'date-fns';
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
  TrendingUp
} from 'lucide-react';
import { exportOrders } from '@/utils/exportHelpers';
import { showSuccessToast } from '@/utils/toastHelpers';
import { OrderDetailsDialog } from '@/components/admin/disposable-menus/OrderDetailsDialog';
import { OrderStatusBadge } from '@/components/admin/disposable-menus/OrderStatusBadge';

const DisposableMenuOrders = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'cancelled'>('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: orders, isLoading } = useMenuOrders();

  // Filter orders
  const filteredOrders = orders?.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.whitelist?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.contact_phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.menu?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Calculate stats
  const stats = {
    total: orders?.length || 0,
    pending: orders?.filter(o => o.status === 'pending').length || 0,
    processing: orders?.filter(o => o.status === 'confirmed').length || 0,
    completed: orders?.filter(o => o.status === 'confirmed').length || 0,
    cancelled: orders?.filter(o => o.status === 'rejected').length || 0,
    totalRevenue: orders?.reduce((sum, o) => sum + parseFloat(String(o.total_amount || 0)), 0) || 0,
    avgOrderValue: orders && orders.length > 0 
      ? orders.reduce((sum, o) => sum + parseFloat(String(o.total_amount || 0)), 0) / orders.length 
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

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/admin/disposable-menus'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Menus
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Order Management</h1>
            <p className="text-muted-foreground">
              Manage and track all orders from disposable menus
            </p>
          </div>
        </div>
        <Button onClick={handleExportAll} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export All
        </Button>
      </div>

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
              <div className="text-center py-12 text-muted-foreground">
                Loading orders...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>No orders found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleViewOrder(order)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">
                            {order.whitelist?.customer_name || order.contact_phone || 'Unknown Customer'}
                          </h3>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="h-3 w-3" />
                            <span>{order.menu?.name || 'Unknown Menu'}</span>
                          </div>
                          <div>
                            {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold mb-1">
                          ${parseFloat(String(order.total_amount || 0)).toFixed(2)}
                        </div>
                        <Button size="sm" variant="ghost" onClick={(e) => {
                          e.stopPropagation();
                          handleViewOrder(order);
                        }}>
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>

                    {/* Order Items Preview */}
                    {order.order_data && typeof order.order_data === 'object' && 'items' in order.order_data && Array.isArray((order.order_data as any).items) && (order.order_data as any).items.length > 0 && (
                      <div className="pt-3 border-t">
                        <div className="text-xs text-muted-foreground mb-2">
                          {(order.order_data as any).items.length} item(s)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(order.order_data as any).items.slice(0, 3).map((item: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {item.quantity}x {item.name || item.product_name}
                            </Badge>
                          ))}
                          {(order.order_data as any).items.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{(order.order_data as any).items.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      {selectedOrder && (
        <OrderDetailsDialog
          order={selectedOrder}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          onUpdate={() => {
            // Refetch orders after update
            setDetailsOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default DisposableMenuOrders;
