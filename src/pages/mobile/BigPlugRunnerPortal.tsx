/**
 * 🚗 BIG PLUG CRM - Mobile Runner Portal
 * Simplified interface for runners/drivers
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Truck, Navigation, Phone, CheckCircle2, 
  AlertCircle, MapPin, DollarSign, Package
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

export function BigPlugRunnerPortal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [runnerId, setRunnerId] = useState('');

  // Get runner ID from auth or params
  // In production, this would come from runner login
  const { data: runner } = useQuery({
    queryKey: ['runner-info', runnerId],
    queryFn: async () => {
      if (!runnerId) return null;
      const { data } = await supabase
        .from('wholesale_runners')
        .select('*')
        .eq('id', runnerId)
        .single();
      return data;
    },
    enabled: !!runnerId,
  });

  // Active deliveries
  const { data: activeDeliveries } = useQuery({
    queryKey: ['runner-active-deliveries', runnerId],
    queryFn: async () => {
      if (!runnerId) return [];
      const { data } = await supabase
        .from('wholesale_deliveries')
        .select(`
          *,
          orders:wholesale_orders(
            order_number,
            total_amount,
            delivery_address,
            wholesale_clients(business_name, phone)
          )
        `)
        .eq('runner_id', runnerId)
        .in('status', ['assigned', 'picked_up', 'in_transit'])
        .order('scheduled_pickup_time', { ascending: true });

      return data || [];
    },
    enabled: !!runnerId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Today's stats
  const { data: todayStats } = useQuery({
    queryKey: ['runner-today-stats', runnerId],
    queryFn: async () => {
      if (!runnerId) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: deliveries } = await supabase
        .from('wholesale_deliveries')
        .select('total_value, collection_amount, status')
        .eq('runner_id', runnerId)
        .gte('created_at', today.toISOString());

      const completed = deliveries?.filter(d => d.status === 'delivered' || d.status === 'completed') || [];
      const delivered = completed.reduce((sum, d) => sum + Number(d.total_value || 0), 0);
      const collected = completed.reduce((sum, d) => sum + Number(d.collection_amount || 0), 0);

      return {
        completed: completed.length,
        delivered,
        collected,
      };
    },
    enabled: !!runnerId,
  });

  // Mark delivery complete
  const markComplete = useMutation({
    mutationFn: async ({ deliveryId, collected }: { deliveryId: string; collected: number }) => {
      const { error } = await supabase
        .from('wholesale_deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          collection_amount: collected,
        })
        .eq('id', deliveryId);

      if (error) throw error;

      // Update order status
      const { data: delivery } = await supabase
        .from('wholesale_deliveries')
        .select('order_id')
        .eq('id', deliveryId)
        .single();

      if (delivery?.order_id) {
        await supabase
          .from('wholesale_orders')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('id', delivery.order_id);
      }

      // If collected payment, update client balance
      if (collected > 0 && delivery) {
        const { data: order } = await supabase
          .from('wholesale_orders')
          .select('client_id')
          .eq('id', delivery.order_id)
          .single();

        if (order?.client_id) {
          const { data: client } = await supabase
            .from('wholesale_clients')
            .select('outstanding_balance')
            .eq('id', order.client_id)
            .single();

          if (client) {
            const newBalance = Math.max(0, Number(client.outstanding_balance || 0) - collected);
            await supabase
              .from('wholesale_clients')
              .update({ outstanding_balance: newBalance })
              .eq('id', order.client_id);
          }
        }
      }
    },
    onSuccess: () => {
      showSuccessToast('Delivery marked complete');
      queryClient.invalidateQueries({ queryKey: ['runner-active-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['runner-today-stats'] });
    },
    onError: (error: any) => {
      showErrorToast(error.message || 'Failed to complete delivery');
    },
  });

  if (!runnerId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Runner Login</h2>
          <p className="text-muted-foreground mb-4">Enter your runner ID to access the portal</p>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Runner ID"
              value={runnerId}
              onChange={(e) => setRunnerId(e.target.value)}
              className="w-full p-3 border rounded-md"
            />
            <Button className="w-full" onClick={() => {
              if (runnerId) {
                // In production, validate runner ID
                setRunnerId(runnerId);
              }
            }}>
              Access Portal
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const activeDelivery = activeDeliveries?.[0];

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">🚗 Runner #{runner?.id?.slice(-4) || 'N/A'}</h1>
            <p className="text-sm text-muted-foreground">{runner?.full_name || 'Runner'}</p>
          </div>
          <Button variant="ghost" size="sm">
            <Phone className="h-4 w-4" />
          </Button>
        </div>

        {/* Today's Stats */}
        {todayStats && (
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-bold">{todayStats.completed}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">${(todayStats.delivered / 1000).toFixed(0)}k</div>
              <div className="text-xs text-muted-foreground">Delivered</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">${(todayStats.collected / 1000).toFixed(0)}k</div>
              <div className="text-xs text-muted-foreground">Collected</div>
            </div>
          </div>
        )}
      </div>

      {/* Active Delivery */}
      {activeDelivery ? (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-lg font-semibold">🔴 ACTIVE</h2>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Delivery</div>
              <div className="font-semibold">
                #{activeDelivery.orders?.order_number || 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">To</div>
              <div className="font-semibold">
                {activeDelivery.orders?.wholesale_clients?.business_name || 'Unknown'}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {activeDelivery.orders?.delivery_address || 'N/A'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t">
              <div>
                <div className="text-sm text-muted-foreground">Load</div>
                <div className="font-semibold">
                  {Number(activeDelivery.total_weight || 0).toFixed(1)} lbs
                </div>
                <div className="text-xs text-muted-foreground">
                  ${Number(activeDelivery.total_value || 0).toLocaleString()} value
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Collect</div>
                <div className="font-semibold text-green-600">
                  ${Number(activeDelivery.collection_amount || 0).toLocaleString()}
                </div>
                {Number(activeDelivery.collection_amount || 0) > 0 && (
                  <div className="text-xs text-orange-600">⚠️ Must collect before delivery</div>
                )}
              </div>
            </div>

            {activeDelivery.scheduled_pickup_time && (
              <div>
                <div className="text-sm text-muted-foreground">ETA</div>
                <div className="font-semibold">
                  {format(new Date(activeDelivery.scheduled_pickup_time), 'h:mm a')}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                const phone = activeDelivery.orders?.wholesale_clients?.phone;
                if (phone) {
                  window.location.href = `tel:${phone}`;
                }
              }}
            >
              <Phone className="h-4 w-4 mr-2" />
              Call Client
            </Button>
            <Button
              variant="outline"
              className="flex-1"
            >
              <Navigation className="h-4 w-4 mr-2" />
              Navigate
            </Button>
          </div>

          <div className="mt-4 pt-4 border-t">
            <DeliveryCompleteDialog
              delivery={activeDelivery}
              onComplete={(collected) => {
                markComplete.mutate({
                  deliveryId: activeDelivery.id,
                  collected: parseFloat(collected) || 0,
                });
              }}
            />
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-semibold mb-2">No Active Deliveries</h3>
          <p className="text-muted-foreground">You're all caught up! New deliveries will appear here.</p>
        </Card>
      )}

      {/* Next Up (if multiple) */}
      {activeDeliveries && activeDeliveries.length > 1 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">NEXT UP</h3>
          {activeDeliveries.slice(1).map((delivery: any) => (
            <div key={delivery.id} className="p-3 border rounded-lg mb-2">
              <div className="font-medium">
                #{delivery.orders?.order_number || 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">
                {delivery.orders?.wholesale_clients?.business_name || 'Unknown'}
              </div>
              <div className="text-sm">
                {Number(delivery.total_weight || 0).toFixed(1)} lbs • ${Number(delivery.total_value || 0).toLocaleString()}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function DeliveryCompleteDialog({ delivery, onComplete }: { delivery: any; onComplete: (collected: string) => void }) {
  const [showDialog, setShowDialog] = useState(false);
  const [collectedAmount, setCollectedAmount] = useState('');
  const [needsCollection] = useState(Number(delivery.collection_amount || 0) > 0);

  const handleComplete = () => {
    if (needsCollection && !collectedAmount) {
      showErrorToast('Enter collection amount');
      return;
    }
    onComplete(collectedAmount || '0');
    setShowDialog(false);
    setCollectedAmount('');
  };

  return (
    <>
      <Button
        className="w-full"
        onClick={() => setShowDialog(true)}
      >
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Mark Delivered
      </Button>

      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Complete Delivery</h3>

            {needsCollection && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200">
                <div className="font-semibold mb-2">💰 Collection Required</div>
                <div className="text-sm">
                  Must collect: ${Number(delivery.collection_amount || 0).toLocaleString()}
                </div>
                <input
                  type="number"
                  placeholder="Amount collected"
                  value={collectedAmount}
                  onChange={(e) => setCollectedAmount(e.target.value)}
                  className="w-full mt-2 p-2 border rounded-md"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleComplete}>
                Complete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

