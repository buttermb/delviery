import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeliveryTimeline } from '@/components/courier/DeliveryTimeline';
import { useDeliveryStatus } from '@/hooks/useDeliveryStatus';
import { useCourier } from '@/contexts/CourierContext';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Package,
  Navigation,
  Building2,
  DollarSign,
} from 'lucide-react';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
}

interface DeliveryData {
  status: string;
  order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  delivery_borough?: string;
  special_instructions?: string;
  total_amount?: number;
  created_at?: string;
  accepted_at?: string;
  courier_picked_up_at?: string;
  delivered_at?: string;
  assigned_at?: string;
  picked_up_at?: string;
  order_items?: OrderItem[];
  order?: {
    order_number?: string;
    total_amount?: number;
    delivery_address?: string;
    delivery_instructions?: string;
    client?: {
      business_name?: string;
      contact_name?: string;
      phone?: string;
    };
  };
  [key: string]: unknown;
}

export default function UnifiedActiveDeliveryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useCourier();
  const [data, setData] = useState<DeliveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const { updateStatus, updating } = useDeliveryStatus();

  useEffect(() => {
    loadData();

    const table = role === 'courier' ? 'orders' : 'wholesale_deliveries';
    const channel = supabase
      .channel(`${table}-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `id=eq.${id}`,
        },
        () => loadData()
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Delivery subscription error', { status, id, table, component: 'UnifiedActiveDeliveryPage' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData is defined below; only run when id/role change
  }, [id, role]);

  const loadData = async () => {
    try {
      if (role === 'courier') {
        const { data: orderData, error } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (id, product_name, quantity, price)
          `)
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        setData(orderData);
      } else {
        const { data: deliveryData, error } = await supabase
          .from('wholesale_deliveries')
          .select(`
            *,
            order:order_id (
              order_number,
              total_amount,
              delivery_address,
              delivery_instructions,
              client:client_id (
                business_name,
                contact_name,
                phone
              )
            )
          `)
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        setData(deliveryData);
      }
    } catch (error) {
      logger.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    // Extract tenantId for isolation check
    const tenantId = role === 'courier' ? data?.tenant_id : data?.seller_tenant_id;

    const success = await updateStatus(id!, newStatus, role, tenantId as string);
    if (success && newStatus === 'delivered') {
      navigate('/courier/dashboard');
    }
  };

  const openNavigation = () => {
    const address = role === 'courier'
      ? data?.delivery_address
      : data?.order?.delivery_address;

    if (address) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Delivery not found</p>
          <Button onClick={() => navigate('/courier/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const isCourier = role === 'courier';
  const currentStatus = isCourier ? data.status : data.status;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courier/dashboard')} aria-label="Back to courier dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">
              {isCourier ? `Order #${data.order_number}` : `Delivery #${data.order?.order_number}`}
            </h1>
            <Badge variant="outline" className="mt-1">{currentStatus}</Badge>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6 pb-40">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isCourier ? <Package className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
              {isCourier ? 'Customer Information' : 'Client Information'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold">
                {isCourier ? data.customer_name : data.order?.client?.business_name}
              </p>
              {!isCourier && data.order?.client?.contact_name && (
                <p className="text-sm text-muted-foreground">Contact: {data.order.client.contact_name}</p>
              )}
              <a
                href={`tel:${isCourier ? data.customer_phone : data.order?.client?.phone}`}
                className="text-sm text-primary flex items-center gap-2 mt-1"
              >
                <Phone className="h-4 w-4" />
                {isCourier ? data.customer_phone : data.order?.client?.phone}
              </a>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">
                  {isCourier ? data.delivery_address : data.order?.delivery_address}
                </p>
                {isCourier && data.delivery_borough && (
                  <p className="text-sm text-muted-foreground">{data.delivery_borough}</p>
                )}
              </div>
            </div>
            {((isCourier && data.special_instructions) ||
              (!isCourier && data.order?.delivery_instructions)) && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium text-muted-foreground">Special Instructions:</p>
                  <p className="text-sm mt-1">
                    {isCourier ? data.special_instructions : data.order?.delivery_instructions}
                  </p>
                </div>
              )}
          </CardContent>
        </Card>

        {/* Order Details */}
        {isCourier && data.order_items && (
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-semibold">${item.price.toFixed(2)}</p>
                  </div>
                ))}
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span className="text-primary">${data.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Runner Collection Amount */}
        {!isCourier && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Collection Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">Total Amount</p>
                <p className="text-4xl font-bold text-primary">
                  ${data.order?.total_amount?.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">Collect from client</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <DeliveryTimeline
          events={
            isCourier
              ? [
                { label: 'Order Created', timestamp: data.created_at, icon: 'clock', completed: true },
                { label: 'Accepted', timestamp: data.accepted_at, icon: 'check', completed: !!data.accepted_at },
                { label: 'Picked Up', timestamp: data.courier_picked_up_at, icon: 'package', completed: !!data.courier_picked_up_at },
                { label: 'Delivered', timestamp: data.delivered_at, icon: 'navigation', completed: !!data.delivered_at },
              ]
              : [
                { label: 'Assigned', timestamp: data.assigned_at, icon: 'clock', completed: true },
                { label: 'Picked Up', timestamp: data.picked_up_at, icon: 'package', completed: !!data.picked_up_at },
                { label: 'In Transit', timestamp: data.picked_up_at, icon: 'navigation', completed: data.status === 'in_transit' || data.status === 'delivered' },
                { label: 'Delivered', timestamp: data.delivered_at, icon: 'check', completed: !!data.delivered_at },
              ]
          }
        />

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t space-y-3 z-40 safe-area-bottom shadow-lg">
          <Button onClick={openNavigation} className="w-full gap-2" size="lg">
            <Navigation className="h-5 w-5" />
            Navigate to Address
          </Button>

          {currentStatus === 'accepted' && isCourier && (
            <Button
              onClick={() => handleStatusUpdate('picked_up')}
              disabled={updating}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {updating ? 'Updating...' : 'Mark as Picked Up'}
            </Button>
          )}

          {currentStatus === 'assigned' && !isCourier && (
            <Button
              onClick={() => handleStatusUpdate('picked_up')}
              disabled={updating}
              variant="outline"
              className="w-full"
              size="lg"
            >
              {updating ? 'Updating...' : 'Confirm Pickup'}
            </Button>
          )}

          {(currentStatus === 'picked_up' || currentStatus === 'in_transit') && (
            <Button
              onClick={() => handleStatusUpdate('delivered')}
              disabled={updating}
              variant="default"
              className="w-full"
              size="lg"
            >
              {updating ? 'Updating...' : 'Mark as Delivered'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
