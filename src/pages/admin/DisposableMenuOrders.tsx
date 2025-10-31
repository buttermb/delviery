import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMenuOrders } from '@/hooks/useDisposableMenus';
import { OrderReviewCard } from '@/components/admin/disposable-menus/OrderReviewCard';
import { OrderApprovalDialog } from '@/components/admin/disposable-menus/OrderApprovalDialog';
import { Package, Search, Filter, ShoppingBag, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DisposableMenuOrders = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { data: orders, isLoading } = useMenuOrders();

  const filteredOrders = orders?.filter((order: any) => {
    const matchesSearch = 
      order.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.contact_phone?.includes(searchQuery) ||
      order.id?.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getOrderStats = () => {
    if (!orders) return { pending: 0, confirmed: 0, rejected: 0, total: 0 };
    
    return {
      pending: orders.filter((o: any) => o.status === 'pending').length,
      confirmed: orders.filter((o: any) => o.status === 'confirmed').length,
      rejected: orders.filter((o: any) => o.status === 'rejected').length,
      total: orders.length
    };
  };

  const stats = getOrderStats();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-8 w-8" />
            Menu Orders
          </h1>
          <p className="text-muted-foreground">
            Review and approve orders from disposable menus
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/disposable-menus')}>
          Back to Menus
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Confirmed</p>
              <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, phone, or order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </Card>

      {/* Orders Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All Orders ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Confirmed ({stats.confirmed})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({stats.rejected})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4 mt-6">
          {isLoading ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading orders...</p>
            </Card>
          ) : filteredOrders && filteredOrders.length > 0 ? (
            filteredOrders.map((order: any) => (
              <OrderReviewCard
                key={order.id}
                order={order}
                onReview={() => setSelectedOrder(order)}
              />
            ))
          ) : (
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery 
                  ? 'No orders match your search' 
                  : `No ${statusFilter === 'all' ? '' : statusFilter} orders found`}
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Order Review Dialog */}
      {selectedOrder && (
        <OrderApprovalDialog
          order={selectedOrder}
          open={!!selectedOrder}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
        />
      )}
    </div>
  );
};

export default DisposableMenuOrders;
