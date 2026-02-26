import { logger } from '@/lib/logger';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useState, useEffect } from 'react';
import { useCourier } from '@/contexts/CourierContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { RoleIndicator } from '@/components/courier/RoleIndicator';
import { ArrowLeft, Package, MapPin, Truck, Building2 } from 'lucide-react';
import { format } from 'date-fns';

interface DeliveryRecord {
  id: string;
  order_number: string;
  customer_name?: string | null;
  client_name?: string;
  delivery_address: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  delivered_at: string | null;
  tip_amount?: number | null;
  type: 'courier' | 'runner';
}

type StatusFilter = 'all' | 'delivered' | 'cancelled' | 'failed';

export default function CourierHistoryPage() {
  const { courier, role } = useCourier();
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const navigate = useNavigate();

  useEffect(() => {
    if (courier) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadHistory is defined below; only run when courier/role/statusFilter change
  }, [courier, role, statusFilter]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const allRecords: DeliveryRecord[] = [];

      if (role === 'courier') {
        let query = supabase
          .from('orders')
          .select('*')
          .eq('courier_id', courier?.id)
          .order('created_at', { ascending: false });

        if (statusFilter === 'delivered') {
          query = query.eq('status', 'delivered');
        } else if (statusFilter === 'cancelled') {
          query = query.eq('status', 'cancelled');
        } else if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        } else {
          query = query.in('status', ['delivered', 'cancelled']);
        }

        const { data, error } = await query;
        if (error) throw error;

        data?.forEach((order) => {
          allRecords.push({
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customer_name,
            delivery_address: order.delivery_address,
            total_amount: order.total_amount,
            status: order.status,
            created_at: order.created_at,
            delivered_at: order.delivered_at,
            tip_amount: order.tip_amount,
            type: 'courier',
          });
        });
      } else {
        let query = supabase
          .from('wholesale_deliveries')
          .select(`
            *,
            order:order_id (
              order_number,
              total_amount,
              delivery_address,
              client:client_id (business_name)
            )
          `)
          .eq('runner_id', courier?.id)
          .order('created_at', { ascending: false });

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        } else {
          query = query.in('status', ['delivered', 'failed']);
        }

        const { data, error } = await query;
        if (error) throw error;

        data?.forEach((delivery) => {
          allRecords.push({
            id: delivery.id,
            order_number: delivery.order?.order_number || 'N/A',
            client_name: delivery.order?.client?.business_name,
            delivery_address: delivery.order?.delivery_address,
            total_amount: 5.00, // Flat delivery fee
            status: delivery.status,
            created_at: delivery.created_at,
            delivered_at: delivery.delivered_at,
            type: 'runner',
          });
        });
      }

      // Sort by date
      allRecords.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRecords(allRecords);
    } catch (error) {
      logger.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const counts = {
    all: records.length,
    delivered: records.filter((r) => r.status === 'delivered').length,
    cancelled: records.filter((r) => r.status === 'cancelled').length,
    failed: records.filter((r) => r.status === 'failed').length,
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courier/dashboard')} aria-label="Back to courier dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Delivery History</h1>
            <RoleIndicator role={role} />
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Status Filter Tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="all">
              All ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="delivered">
              Delivered ({counts.delivered})
            </TabsTrigger>
            <TabsTrigger value="cancelled">
              Cancelled ({counts.cancelled})
            </TabsTrigger>
            {role === 'runner' && (
              <TabsTrigger value="failed">
                Failed ({counts.failed})
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <EnhancedLoadingState variant="list" count={5} message="Loading history..." />
            ) : records.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                {role === 'courier' ? (
                  <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                ) : (
                  <Truck className="mx-auto h-12 w-12 text-muted-foreground/50" />
                )}
                <p className="text-muted-foreground">
                  {statusFilter === 'all'
                    ? 'No delivery history yet'
                    : `No ${statusFilter} deliveries`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((record) => (
                  <Card key={record.id} className="border-2">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {record.type === 'courier' ? (
                                <Package className="h-4 w-4 text-primary" />
                              ) : (
                                <Truck className="h-4 w-4 text-primary" />
                              )}
                              <h3 className="font-semibold">
                                {record.type === 'courier' ? 'Order' : 'Delivery'} #{record.order_number}
                              </h3>
                              <Badge variant={getStatusBadgeVariant(record.status)}>
                                {record.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              {record.type === 'runner' && <Building2 className="h-3 w-3" />}
                              {record.customer_name || record.client_name}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-primary">
                              ${record.total_amount.toFixed(2)}
                            </div>
                            {record.type === 'courier' && record.tip_amount && record.tip_amount > 0 && (
                              <div className="text-sm text-green-600">
                                +${record.tip_amount.toFixed(2)} tip
                              </div>
                            )}
                            {record.type === 'runner' && (
                              <div className="text-sm text-muted-foreground">
                                Delivery fee
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{record.delivery_address}</span>
                        </div>

                        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                          <span>
                            {record.delivered_at
                              ? format(new Date(record.delivered_at), 'MMM dd, yyyy h:mm a')
                              : format(new Date(record.created_at), 'MMM dd, yyyy h:mm a')}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/courier/delivery/${record.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
