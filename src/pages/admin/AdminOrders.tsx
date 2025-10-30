import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, AlertTriangle, MapPin, Clock, Check, X } from 'lucide-react';
import { getNeighborhoodFromZip, getRiskColor, getRiskLabel, getRiskTextColor } from '@/utils/neighborhoods';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
import { OrderMap } from '@/components/admin/OrderMap';
import { CourierDispatchPanel } from '@/components/admin/CourierDispatchPanel';
import { useETATracking } from '@/hooks/useETATracking';
import { formatStatus } from '@/utils/stringHelpers';
import CopyButton from '@/components/CopyButton';
import { BetterEmptyState } from '@/components/BetterEmptyState';
import { Package } from 'lucide-react';

interface Order {
  id: string;
  tracking_code: string;
  status: string;
  total_amount: number;
  created_at: string;
  delivered_at?: string;
  delivery_address: string;
  delivery_borough: string;
  customer_name?: string;
  customer_phone?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  merchants?: {
    business_name: string;
    address: string;
    phone: string;
  };
  addresses?: {
    street: string;
    city: string;
    state: string;
    zip_code: string;
  };
  couriers?: {
    full_name: string;
    phone: string;
    email: string;
    current_lat?: number;
    current_lng?: number;
  };
  order_items?: Array<{
    quantity: number;
    price: number;
    products: {
      name: string;
      image_url?: string;
    };
  }>;
}

const statusOptions = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-purple-100 text-purple-700' },
  { value: 'preparing', label: 'Preparing', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-blue-100 text-blue-700' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' }
];

export default function AdminOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  const { orders, loading, error: ordersError, refetch } = useRealtimeOrders({
    statusFilter: statusFilter === 'all' ? undefined : [statusFilter]
  });

  // Show error toast if orders fail to load
  useEffect(() => {
    if (ordersError && !loading) {
      toast({
        title: "Error loading orders",
        description: ordersError.message || "Failed to load orders. Please try refreshing.",
        variant: "destructive",
      });
    }
  }, [ordersError, loading]);

  const { eta } = useETATracking(selectedOrder?.id || null);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!confirm(`Change order status to "${formatStatus(newStatus)}"`)) return;

    setUpdating(true);
    try {
      const { error } = await supabase.functions.invoke('update-order-status', {
        body: {
          orderId,
          status: newStatus,
          message: `Status updated to ${formatStatus(newStatus)}`
        }
      });

      if (error) {
        console.error("Function error, trying direct update:", error);
        // Fallback to direct update
        const { error: directError } = await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', orderId);
        
        if (directError) throw directError;
      }
      if (error) throw error;

      toast({
        title: '✓ Status updated',
        description: `Order status changed to ${formatStatus(newStatus)}`
      });

      await refetch();
      
      if (selectedOrder?.id === orderId) {
        setShowDetailModal(false);
        setSelectedOrder(null);
      }
    } catch (error: any) {
      toast({
        title: 'Failed to update status',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUpdating(false);
    }
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    if (selectedOrders.size === 0) return;
    const count = selectedOrders.size;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .in('id', Array.from(selectedOrders));
      
      if (error) throw error;
      
      toast({
        title: `✓ ${count} order(s) updated`,
        description: `Status changed to ${formatStatus(newStatus)}`
      });
      
      setSelectedOrders(new Set());
      await refetch();
    } catch (error: any) {
      toast({
        title: 'Bulk update failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const safeStatus = status || 'pending';
    const statusConfig = statusOptions.find(s => s.value === safeStatus);
    return (
      <Badge className={statusConfig?.color || 'bg-gray-100'}>
        {statusConfig?.label || formatStatus(safeStatus)}
      </Badge>
    );
  };

  const filteredOrders = orders.filter(order => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      order.tracking_code?.toLowerCase().includes(search) ||
      order.merchants?.business_name?.toLowerCase().includes(search) ||
      order.addresses?.street?.toLowerCase().includes(search) ||
      order.couriers?.full_name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Order Management</h1>
        <p className="text-muted-foreground">Monitor and manage all orders with full status control</p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl shadow p-4 mb-6 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className="whitespace-nowrap"
          >
            All Orders ({orders.length})
          </Button>
          {statusOptions.map(status => {
            const count = orders.filter(o => o.status === status.value).length;
            return (
              <Button
                key={status.value}
                variant={statusFilter === status.value ? 'default' : 'outline'}
                onClick={() => setStatusFilter(status.value)}
                className="whitespace-nowrap"
              >
                {status.label} ({count})
              </Button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Search by order #, merchant, address, courier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Button onClick={refetch} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => setShowMap(!showMap)} 
            variant="outline"
          >
            {showMap ? 'Hide Map' : 'Show Map'}
          </Button>
        </div>
      </div>

      {/* Live Map */}
      {showMap && (
        <div className="mb-6">
          <OrderMap
            orders={filteredOrders.filter(o => o.dropoff_lat && o.dropoff_lng).map(o => ({
              id: o.id,
              tracking_code: o.tracking_code,
              status: o.status,
              delivery_address: o.delivery_address || o.addresses?.street || '',
              dropoff_lat: o.dropoff_lat,
              dropoff_lng: o.dropoff_lng,
              courier: o.couriers ? {
                full_name: o.couriers.full_name,
                current_lat: (o.couriers as any).current_lat,
                current_lng: (o.couriers as any).current_lng
              } : undefined
            }))}
            selectedOrderId={selectedOrder?.id}
            onOrderSelect={(orderId) => {
              const order = orders.find(o => o.id === orderId);
              if (order) {
                setSelectedOrder(order);
                setShowDetailModal(true);
              }
            }}
          />
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedOrders.size > 0 && (
        <div className="bg-primary text-primary-foreground p-4 rounded-lg flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold">{selectedOrders.size} order(s) selected</span>
          </div>
          <div className="flex gap-2">
            {statusOptions.map(option => (
              <Button
                key={option.value}
                variant="secondary"
                size="sm"
                onClick={() => bulkUpdateStatus(option.value)}
                disabled={updating}
              >
                Set as {option.label}
              </Button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedOrders(new Set())}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-card rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-6 py-4 w-12">
                  <Checkbox
                    checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
                      } else {
                        setSelectedOrders(new Set());
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase">Order #</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase">Customer</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase">Merchant</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase">Courier</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase">Total</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map(order => {
                const neighborhood = order.addresses?.zip_code ? getNeighborhoodFromZip(order.addresses.zip_code) : null;
                return (
                <tr key={order.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4">
                    <Checkbox
                      checked={selectedOrders.has(order.id)}
                      onCheckedChange={(checked) => {
                        const newSet = new Set(selectedOrders);
                        if (checked) {
                          newSet.add(order.id);
                        } else {
                          newSet.delete(order.id);
                        }
                        setSelectedOrders(newSet);
                      }}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {neighborhood && (
                        <div className={`w-10 h-10 ${getRiskColor(neighborhood.risk)} rounded flex flex-col items-center justify-center text-white flex-shrink-0`}>
                          <div className="text-sm font-bold">{neighborhood.risk}</div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{order.tracking_code}</p>
                        {order.tracking_code && <CopyButton text={order.tracking_code} label="Tracking Code" size="icon" showLabel={false} />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {order.customer_name && (
                      <p className="text-sm font-medium">{order.customer_name}</p>
                    )}
                    {order.customer_phone && (
                      <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                    )}
                    <p className="text-sm">{order.addresses?.street || order.delivery_address}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.addresses?.city || 'New York'}, {order.addresses?.state || order.delivery_borough}
                    </p>
                    {neighborhood && (
                      <div className={`text-xs font-semibold mt-1 flex items-center gap-1 ${getRiskTextColor(neighborhood.risk)}`}>
                        <AlertTriangle className="w-3 h-3" />
                        {neighborhood.name} - {getRiskLabel(neighborhood.risk)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{order.merchants?.business_name}</p>
                    <p className="text-xs text-muted-foreground">{order.merchants?.address}</p>
                  </td>
                  <td className="px-6 py-4">
                    {order.couriers ? (
                      <>
                        <p className="text-sm">{order.couriers.full_name}</p>
                        <p className="text-xs text-muted-foreground">{order.couriers.phone}</p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold">${parseFloat(order.total_amount.toString()).toFixed(2)}</p>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowDetailModal(true);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        View & Update
                      </Button>

                      {/* Quick status changes */}
                      {order.status === 'confirmed' && (
                        <Button
                          onClick={() => updateOrderStatus(order.id, 'preparing')}
                          variant="outline"
                          size="sm"
                          className="text-yellow-600"
                        >
                          → Start Preparing
                        </Button>
                      )}
                      {order.status === 'preparing' && (
                        <Button
                          onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}
                          variant="outline"
                          size="sm"
                          className="text-blue-600"
                        >
                          → En Route
                        </Button>
                      )}
                      {order.status === 'out_for_delivery' && (
                        <Button
                          onClick={() => updateOrderStatus(order.id, 'delivered')}
                          variant="outline"
                          size="sm"
                          className="text-green-600"
                        >
                          → Delivered
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <BetterEmptyState
            icon={Package}
            title={searchTerm ? "No matching orders" : "No orders yet"}
            description={searchTerm ? "Try adjusting your filters or search term" : "Orders will appear here when customers place them."}
            action={searchTerm ? {
              label: "Clear Filters",
              onClick: () => setSearchTerm("")
            } : undefined}
          />
        )}
      </div>

      {/* Order Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (() => {
            const neighborhood = selectedOrder.addresses?.zip_code ? getNeighborhoodFromZip(selectedOrder.addresses.zip_code) : null;
            return (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-3">
                  {neighborhood && (
                    <div className={`w-12 h-12 ${getRiskColor(neighborhood.risk)} rounded-lg flex flex-col items-center justify-center text-white flex-shrink-0`}>
                      <div className="text-xl font-bold">{neighborhood.risk}</div>
                      <div className="text-[10px]">/10</div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    Order #{selectedOrder.tracking_code}
                    {selectedOrder.tracking_code && (
                      <CopyButton text={selectedOrder.tracking_code} label="Tracking Code" size="icon" showLabel={false} />
                    )}
                  </div>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Detailed order information including risk, address and items
                </DialogDescription>
                <p className="text-sm text-muted-foreground">
                  Created: {new Date(selectedOrder.created_at).toLocaleString()}
                </p>
              </DialogHeader>

              <div className="space-y-6">
                {/* Status Control */}
                <div>
                  <h3 className="font-bold mb-3">Change Status:</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map(status => (
                      <Button
                        key={status.value}
                        onClick={() => updateOrderStatus(selectedOrder.id, status.value)}
                        disabled={updating || selectedOrder.status === status.value}
                        variant={selectedOrder.status === status.value ? 'default' : 'outline'}
                        className="justify-start"
                      >
                        {updating ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {status.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Order Details */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold mb-2">Merchant:</h3>
                    <p className="text-lg">{selectedOrder.merchants?.business_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.merchants?.address}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.merchants?.phone}</p>
                  </div>

                  <div>
                    <h3 className="font-bold mb-2">Customer & Delivery:</h3>
                    {selectedOrder.customer_name && (
                      <p className="text-lg font-semibold">{selectedOrder.customer_name}</p>
                    )}
                    {selectedOrder.customer_phone && (
                      <p className="text-sm text-muted-foreground mb-2">📞 {selectedOrder.customer_phone}</p>
                    )}
                    <p className="text-lg">{selectedOrder.addresses?.street || selectedOrder.delivery_address}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedOrder.addresses?.city || 'New York'}, {selectedOrder.addresses?.state || selectedOrder.delivery_borough} {selectedOrder.addresses?.zip_code}
                    </p>

                    {/* ETA Display */}
                    {eta && selectedOrder.status !== 'delivered' && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 text-blue-700">
                          <Clock className="h-4 w-4" />
                          <span className="font-semibold">ETA: {eta.eta_minutes} minutes</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          Distance: {eta.distance_miles} miles
                        </p>
                      </div>
                    )}

                    {neighborhood && (
                      <div className="mt-3 p-3 rounded-lg border-2" style={{ borderColor: `hsl(var(--${neighborhood.risk <= 3 ? 'success' : neighborhood.risk <= 6 ? 'warning' : 'destructive'}))` }}>
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 ${getRiskColor(neighborhood.risk)} rounded flex items-center justify-center text-white`}>
                            <div className="text-xl font-bold">{neighborhood.risk}</div>
                          </div>
                          <div>
                            <div className="font-semibold">{neighborhood.name}</div>
                            <div className={`text-sm font-semibold ${getRiskTextColor(neighborhood.risk)}`}>
                              {getRiskLabel(neighborhood.risk)} Delivery Zone
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedOrder.couriers && (
                    <div>
                      <h3 className="font-bold mb-2">Courier:</h3>
                      <p className="text-lg">{selectedOrder.couriers.full_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedOrder.couriers.phone}</p>
                      <p className="text-sm text-muted-foreground">{selectedOrder.couriers.email}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold mb-2">Order Items ({selectedOrder.order_items?.length}):</h3>
                    <div className="space-y-2">
                      {selectedOrder.order_items?.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                          {item.products.image_url && (
                            <img 
                              src={item.products.image_url} 
                              alt={item.products.name}
                              className="w-12 h-12 rounded object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-semibold">
                              {item.quantity}x {item.products.name}
                            </p>
                          </div>
                          <p className="font-semibold">${parseFloat(item.price.toString()).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      <span>${parseFloat(selectedOrder.total_amount.toString()).toFixed(2)}</span>
                    </div>
                    {selectedOrder.delivered_at && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Delivered: {new Date(selectedOrder.delivered_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )})()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
