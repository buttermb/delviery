import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Truck, MapPin, Clock, CheckCircle2, XCircle, 
  Navigation, Phone, User, Package, Search
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { format } from 'date-fns';

interface Delivery {
  id: string;
  order_id: string;
  courier_id: string | null;
  address: string;
  status: string;
  scheduled_at: string;
  delivered_at: string | null;
  proof_photo_url: string | null;
  signature_url: string | null;
  orders: {
    id: string;
    total_amount: number;
    user_id: string;
  };
  couriers: {
    full_name: string;
    phone: string;
    vehicle_type: string;
  } | null;
}

export default function DeliveryManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load deliveries
      const response: any = await (supabase as any)
        .from('orders')
        .select(`
          id,
          user_id,
          total_amount,
          status,
          delivery_address,
          delivery_scheduled_at,
          delivery_completed_at,
          courier_id,
          couriers(full_name, phone, vehicle_type)
        `)
        .in('status', ['pending', 'confirmed', 'out_for_delivery', 'delivered'])
        .order('delivery_scheduled_at', { ascending: false });

      const { data: deliveryData } = response;
      
      // Map to Delivery interface
      const mappedDeliveries: Delivery[] = (deliveryData || []).map((d: any) => ({
        id: d.id,
        order_id: d.id,
        courier_id: d.courier_id,
        address: d.delivery_address || 'N/A',
        status: d.status,
        scheduled_at: d.delivery_scheduled_at || new Date().toISOString(),
        delivered_at: d.delivery_completed_at,
        proof_photo_url: null,
        signature_url: null,
        orders: {
          id: d.id,
          total_amount: d.total_amount || 0,
          user_id: d.user_id
        },
        couriers: d.couriers
      }));

      setDeliveries(mappedDeliveries);

      // Load couriers
      const courierResponse: any = await (supabase as any)
        .from('couriers')
        .select('id, full_name, phone, vehicle_type, is_online')
        .eq('is_active', true);

      const { data: courierData } = courierResponse;
      setCouriers(courierData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: 'Error loading deliveries', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const assignCourier = async (deliveryId: string, courierId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('orders')
        .update({ courier_id: courierId, status: 'confirmed' })
        .eq('id', deliveryId);

      if (error) throw error;

      toast({ title: 'Courier assigned successfully' });
      loadData();
    } catch (error) {
      console.error('Error assigning courier:', error);
      toast({ title: 'Error assigning courier', variant: 'destructive' });
    }
  };

  const updateDeliveryStatus = async (deliveryId: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === 'delivered') {
        updates.delivery_completed_at = new Date().toISOString();
      }

      const { error } = await (supabase as any)
        .from('orders')
        .update(updates)
        .eq('id', deliveryId);

      if (error) throw error;

      toast({ title: 'Status updated successfully' });
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Error updating status', variant: 'destructive' });
    }
  };

  const filteredDeliveries = deliveries.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (searchQuery && !d.address.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'confirmed': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'out_for_delivery': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'delivered': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle2 className="w-4 h-4" />;
      case 'out_for_delivery': return <Truck className="w-4 h-4" />;
      case 'delivered': return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const stats = {
    scheduled: deliveries.filter(d => d.status === 'pending' || d.status === 'confirmed').length,
    inProgress: deliveries.filter(d => d.status === 'out_for_delivery').length,
    completed: deliveries.filter(d => d.status === 'delivered').length,
    onlineCouriers: couriers.filter(c => c.is_online).length
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <SEOHead title="Delivery Management | Admin" description="Manage deliveries and couriers" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Delivery Management</h1>
          <p className="text-sm text-muted-foreground">Manage deliveries and assign couriers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/order-management')}>
            View All Orders
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{stats.scheduled}</p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Truck className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground">Out for Delivery</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.onlineCouriers}</p>
                <p className="text-xs text-muted-foreground">Couriers Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Deliveries List */}
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Delivery Queue</TabsTrigger>
          <TabsTrigger value="active">Active Deliveries</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          {filteredDeliveries
            .filter(d => d.status === 'pending' || d.status === 'confirmed')
            .map(delivery => (
              <Card key={delivery.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-semibold">Order #{delivery.order_id.slice(0, 8)}</h3>
                        <Badge className={getStatusColor(delivery.status)}>
                          {getStatusIcon(delivery.status)}
                          <span className="ml-1">{delivery.status.replace('_', ' ')}</span>
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium">Delivery Address</p>
                            <p className="text-sm text-muted-foreground">{delivery.address}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium">Scheduled</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(delivery.scheduled_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Package className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium">Order Total</p>
                            <p className="text-sm text-muted-foreground">
                              ${delivery.orders.total_amount?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {delivery.couriers && (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <User className="w-4 h-4" />
                          <span className="font-medium">{delivery.couriers.full_name}</span>
                          <span className="text-muted-foreground">({delivery.couriers.vehicle_type})</span>
                          <Phone className="w-3 h-3 ml-2" />
                          <span className="text-muted-foreground">{delivery.couriers.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {!delivery.courier_id ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <User className="w-4 h-4 mr-2" />
                              Assign Courier
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Assign Courier</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                              {couriers.map(courier => (
                                <div
                                  key={courier.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:border-primary cursor-pointer"
                                  onClick={() => {
                                    assignCourier(delivery.id, courier.id);
                                  }}
                                >
                                  <div>
                                    <p className="font-medium">{courier.full_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {courier.vehicle_type} • {courier.phone}
                                    </p>
                                  </div>
                                  {courier.is_online && (
                                    <Badge variant="default">Online</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => updateDeliveryStatus(delivery.id, 'out_for_delivery')}
                        >
                          <Truck className="w-4 h-4 mr-2" />
                          Start Delivery
                        </Button>
                      )}
                      <Button size="sm" variant="outline">
                        <Navigation className="w-4 h-4 mr-2" />
                        Route
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {filteredDeliveries
            .filter(d => d.status === 'out_for_delivery')
            .map(delivery => (
              <Card key={delivery.id} className="border-purple-500/50">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-semibold">Order #{delivery.order_id.slice(0, 8)}</h3>
                        <Badge className={getStatusColor(delivery.status)}>
                          {getStatusIcon(delivery.status)}
                          <span className="ml-1">Out for Delivery</span>
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium">Delivery Address</p>
                            <p className="text-sm text-muted-foreground">{delivery.address}</p>
                          </div>
                        </div>

                        {delivery.couriers && (
                          <div className="flex items-start gap-2">
                            <User className="w-4 h-4 text-muted-foreground mt-1" />
                            <div>
                              <p className="text-sm font-medium">{delivery.couriers.full_name}</p>
                              <p className="text-sm text-muted-foreground">{delivery.couriers.phone}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateDeliveryStatus(delivery.id, 'delivered')}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Mark Delivered
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(`/admin/delivery-tracking/${delivery.id}`)}
                      >
                        <Navigation className="w-4 h-4 mr-2" />
                        Track Live
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {filteredDeliveries
            .filter(d => d.status === 'delivered')
            .slice(0, 20)
            .map(delivery => (
              <Card key={delivery.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">Order #{delivery.order_id.slice(0, 8)}</h3>
                        <Badge className={getStatusColor(delivery.status)}>
                          {getStatusIcon(delivery.status)}
                          <span className="ml-1">Delivered</span>
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{delivery.address}</span>
                        {delivery.delivered_at && (
                          <span>Delivered: {format(new Date(delivery.delivered_at), 'MMM d, h:mm a')}</span>
                        )}
                        {delivery.couriers && (
                          <span>By: {delivery.couriers.full_name}</span>
                        )}
                      </div>
                    </div>

                    <Button size="sm" variant="outline">
                      View Proof
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      {filteredDeliveries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No deliveries found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
