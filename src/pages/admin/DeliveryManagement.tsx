import { logger } from '@/lib/logger';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Truck, Clock, CheckCircle2, XCircle,
  User, Package
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { CourierAvailabilityPanel } from '@/components/admin/fulfillment/CourierAvailabilityPanel';
import { AssignToFleetDialog } from '@/components/admin/fulfillment/AssignToFleetDialog';
import { formatCurrency, formatPhoneNumber, formatSmartDate } from '@/lib/formatters';

interface DeliveryRow {
  id: string;
  user_id: string | null;
  total_amount: number | null;
  status: string;
  delivery_address: string | null;
  delivery_scheduled_at: string | null;
  delivery_completed_at: string | null;
  courier_id: string | null;
  couriers: {
    full_name: string;
    phone: string;
    vehicle_type: string;
  } | null;
}

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
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fleetDialogOpen, setFleetDialogOpen] = useState(false);
  const [selectedDeliveryForFleet, setSelectedDeliveryForFleet] = useState<{
    id: string;
    orderNumber: string;
    address: string;
  } | null>(null);

  // Fetch Deliveries
  const { data: deliveries = [], isLoading: loadingDeliveries, refetch } = useQuery({
    queryKey: queryKeys.deliveries.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const response: { data: DeliveryRow[] | null; error: { message: string } | null } = await (supabase as unknown as Record<string, CallableFunction>)
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
        .eq('tenant_id', tenant.id)
        .in('status', ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'])
        .order('delivery_scheduled_at', { ascending: false });

      if (response.error) throw response.error;

      return (response.data || []).map((d) => ({
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
    },
    enabled: !!tenant?.id,
  });

  // Fetch Couriers
  const { data: couriers = [] } = useQuery({
    queryKey: queryKeys.couriers.list({ tenantId: tenant?.id, active: true }),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, phone, vehicle_type, is_online')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const loading = loadingDeliveries;

  const assignCourier = async (deliveryId: string, courierId: string) => {
    if (!tenant) return;
    try {
      const { error } = await (supabase as unknown as Record<string, CallableFunction>)
        .from('orders')
        .update({ courier_id: courierId, status: 'confirmed' })
        .eq('id', deliveryId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      toast.success('Courier assigned successfully');
      refetch();
    } catch (error) {
      logger.error('Error assigning courier:', error as Error);
      toast.error('Error assigning courier');
    }
  };

  const updateDeliveryStatus = async (deliveryId: string, status: string) => {
    if (!tenant) return;
    try {
      const updates: Record<string, string> = { status };
      if (status === 'delivered') {
        updates.delivery_completed_at = new Date().toISOString();
      }

      const { error } = await (supabase as unknown as Record<string, CallableFunction>)
        .from('orders')
        .update(updates)
        .eq('id', deliveryId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      toast.success('Status updated successfully');
      refetch();
    } catch (error) {
      logger.error('Error updating status:', error as Error);
      toast.error('Error updating status');
    }
  };

  const filteredDeliveries = useMemo(() => deliveries.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (searchQuery && !d.address.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  }), [deliveries, statusFilter, searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-500/10 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-700';
      case 'confirmed': return 'bg-accent/10 text-accent-foreground border-accent/20';
      case 'out_for_delivery': return 'bg-primary/10 text-primary border-primary/20';
      case 'delivered': return 'bg-primary/10 text-primary border-primary/20';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground border-muted';
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

  const stats = useMemo(() => ({
    scheduled: deliveries.filter(d => d.status === 'pending' || d.status === 'confirmed').length,
    inProgress: deliveries.filter(d => d.status === 'out_for_delivery').length,
    completed: deliveries.filter(d => d.status === 'delivered').length,
    onlineCouriers: couriers.filter(c => c.is_online).length
  }), [deliveries, couriers]);

  // --- COLUMNS FOR TABS ---

  const commonColumns: ResponsiveColumn<Delivery>[] = [
    {
      header: 'Order',
      cell: (d) => <span className="font-mono font-medium">#{d.order_id.slice(0, 8)}</span>
    },
    {
      header: 'Address',
      accessorKey: 'address',
      className: 'max-w-[200px] truncate'
    },
    {
      header: 'Total',
      cell: (d) => formatCurrency(d.orders.total_amount)
    }
  ];

  const queueColumns: ResponsiveColumn<Delivery>[] = [
    ...commonColumns,
    {
      header: 'Scheduled',
      cell: (d) => formatSmartDate(d.scheduled_at, { includeTime: true })
    },
    {
      header: 'Status',
      cell: (d) => (
        <Badge variant="outline" className={getStatusColor(d.status)}>
          {getStatusIcon(d.status)}
          <span className="ml-1 capitalize">{d.status.replace('_', ' ')}</span>
        </Badge>
      )
    },
    {
      header: 'Courier',
      cell: (d) => d.couriers ? (
        <div className="flex flex-col text-sm">
          <span>{d.couriers.full_name}</span>
          <span className="text-muted-foreground text-xs">{formatPhoneNumber(d.couriers.phone)}</span>
        </div>
      ) : <span className="text-muted-foreground italic">Unassigned</span>
    },
    {
      header: 'Actions',
      cell: (d) => (
        <div className="flex gap-2 justify-end">
          {!d.courier_id ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                onClick={() => {
                  setSelectedDeliveryForFleet({
                    id: d.id,
                    orderNumber: d.order_id.slice(0, 8),
                    address: d.address,
                  });
                  setFleetDialogOpen(true);
                }}
              >
                <Truck className="w-4 h-4 mr-2" />
                Fleet
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <User className="w-4 h-4 mr-2" />
                    Courier
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Courier</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    {couriers.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        No couriers available
                      </div>
                    ) : (
                      couriers.map(courier => (
                        <div
                          key={courier.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:border-primary cursor-pointer"
                          onClick={() => assignCourier(d.id, courier.id)}
                        >
                          <div>
                            <p className="font-medium">{courier.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {courier.vehicle_type} • {formatPhoneNumber(courier.phone)}
                            </p>
                          </div>
                          {courier.is_online && (
                            <Badge variant="default">Online</Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => updateDeliveryStatus(d.id, 'out_for_delivery')}
            >
              Start Delivery
            </Button>
          )}
        </div>
      )
    }
  ];

  const activeColumns: ResponsiveColumn<Delivery>[] = [
    ...commonColumns,
    {
      header: 'Courier',
      cell: (d) => d.couriers ? (
        <div className="flex flex-col text-sm">
          <span>{d.couriers.full_name}</span>
          <span className="text-muted-foreground text-xs">{formatPhoneNumber(d.couriers.phone)}</span>
        </div>
      ) : '-'
    },
    {
      header: 'Actions',
      cell: (d) => (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            onClick={() => updateDeliveryStatus(d.id, 'delivered')}
          >
            Mark Delivered
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigateToAdmin(`delivery-tracking/${d.id}`)}
          >
            Track Live
          </Button>
        </div>
      )
    }
  ];

  const completedColumns: ResponsiveColumn<Delivery>[] = [
    ...commonColumns,
    {
      header: 'Delivered At',
      cell: (d) => d.delivered_at ? formatSmartDate(d.delivered_at, { includeTime: true }) : '-'
    },
    {
      header: 'Courier',
      cell: (d) => d.couriers?.full_name || '-'
    },
    {
      header: 'Actions',
      cell: () => (
        <Button size="sm" variant="outline">
          View Proof
        </Button>
      )
    }
  ];

  // Mobile Renderer
  const renderMobileCard = (d: Delivery, type: 'queue' | 'active' | 'completed') => (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold">#{d.order_id.slice(0, 8)}</h3>
            <Badge variant="outline" className={getStatusColor(d.status)}>
              {d.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm">{d.address}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3" /> {formatCurrency(d.orders.total_amount)}
        </div>
        {d.couriers && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" /> {d.couriers.full_name}
          </div>
        )}
      </div>

      <div className="pt-2 border-t flex gap-2 justify-end">
        {/* Reuse action buttons logic roughly or simplify */}
        {type === 'queue' && (
          !d.courier_id ? (
            <Button size="sm" variant="outline" className="w-full">Assign</Button>
          ) : (
            <Button size="sm" className="w-full" onClick={() => updateDeliveryStatus(d.id, 'out_for_delivery')}>Start</Button>
          )
        )}
        {type === 'active' && (
          <Button size="sm" className="w-full" onClick={() => updateDeliveryStatus(d.id, 'delivered')}>Mark Delivered</Button>
        )}
        {type === 'completed' && (
          <Button size="sm" variant="outline" className="w-full">View Proof</Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background p-4">
      <SEOHead title="Delivery Management | Admin" description="Manage deliveries and couriers" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Delivery Management</h1>
          <p className="text-sm text-muted-foreground">Manage deliveries and assign couriers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigateToAdmin('order-management')}>
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

      {/* Courier Availability Panel */}
      <CourierAvailabilityPanel
        maxCouriers={4}
        className="mb-6"
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <SearchInput
                placeholder="Search by address..."
                onSearch={setSearchQuery}
                defaultValue={searchQuery}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
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
          <ResponsiveTable
            columns={queueColumns}
            data={filteredDeliveries.filter(d => d.status === 'pending' || d.status === 'confirmed')}
            isLoading={loading}
            keyExtractor={(d) => d.id}
            emptyState={{
              icon: Package,
              title: "No deliveries in queue",
              description: "New orders will appear here.",
              compact: true
            }}
            mobileRenderer={(d) => renderMobileCard(d, 'queue')}
          />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <ResponsiveTable
            columns={activeColumns}
            data={filteredDeliveries.filter(d => d.status === 'out_for_delivery')}
            isLoading={loading}
            keyExtractor={(d) => d.id}
            emptyState={{
              icon: Truck,
              title: "No active deliveries",
              description: "Start a delivery from the queue to see it here.",
              compact: true
            }}
            mobileRenderer={(d) => renderMobileCard(d, 'active')}
          />
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <ResponsiveTable
            columns={completedColumns}
            data={filteredDeliveries.filter(d => d.status === 'delivered').slice(0, 20)}
            isLoading={loading}
            keyExtractor={(d) => d.id}
            emptyState={{
              icon: CheckCircle2,
              title: "No completed deliveries",
              description: "Delivered orders will appear here.",
              compact: true
            }}
            mobileRenderer={(d) => renderMobileCard(d, 'completed')}
          />
        </TabsContent>
      </Tabs>

      {/* Fleet Assignment Dialog */}
      {selectedDeliveryForFleet && (
        <AssignToFleetDialog
          open={fleetDialogOpen}
          onOpenChange={(open) => {
            setFleetDialogOpen(open);
            if (!open) setSelectedDeliveryForFleet(null);
          }}
          orderId={selectedDeliveryForFleet.id}
          orderNumber={selectedDeliveryForFleet.orderNumber}
          isWholesale={false}
          deliveryAddress={selectedDeliveryForFleet.address}
        />
      )}
    </div>
  );
}
