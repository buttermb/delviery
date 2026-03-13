/**
 * Task 343: Wire delivery driver assignment panel
 * Panel for assigning drivers/couriers to pending deliveries
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Truck, Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

interface DeliveryDriverAssignmentPanelProps {
  orderId: string;
  currentCourierId?: string;
  onAssign?: () => void;
}

export function DeliveryDriverAssignmentPanel({
  orderId,
  currentCourierId,
  onAssign,
}: DeliveryDriverAssignmentPanelProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [selectedCourier, setSelectedCourier] = useState(currentCourierId || '');

  // Fetch available couriers
  const { data: couriers } = useQuery({
    queryKey: queryKeys.couriers.list(tenant?.id || ''),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('couriers')
        .select('id, name, phone, is_available, current_deliveries')
        .eq('tenant_id', tenant.id)
        .eq('is_available', true)
        .order('name');

      if (error) {
        logger.error('Failed to fetch couriers', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch order details
  const { data: order } = useQuery({
    queryKey: queryKeys.orders.detail(tenant?.id || '', orderId),
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, delivery_address, delivery_borough, status')
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch order', error);
        throw error;
      }
      return data;
    },
    enabled: !!tenant?.id && !!orderId,
  });

  const assignMutation = useMutation({
    mutationFn: async (courierId: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      // Check if delivery record exists
      const { data: existingDelivery } = await supabase
        .from('deliveries')
        .select('id')
        .eq('order_id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (existingDelivery) {
        // Update existing delivery
        const { error } = await supabase
          .from('deliveries')
          .update({
            courier_id: courierId,
            estimated_pickup_time: new Date().toISOString(),
          })
          .eq('id', existingDelivery.id)
          .eq('tenant_id', tenant.id);

        if (error) throw error;
      } else {
        // Create new delivery record
        const { error } = await supabase
          .from('deliveries')
          .insert({
            order_id: orderId,
            courier_id: courierId,
            tenant_id: tenant.id,
            pickup_lat: 40.7128, // Default - should be set from actual location
            pickup_lng: -74.0060,
            dropoff_lat: 40.7128, // Default - should be geocoded from address
            dropoff_lng: -74.0060,
            estimated_pickup_time: new Date().toISOString(),
          });

        if (error) throw error;
      }

      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'assigned' })
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      toast.success('Driver assigned successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id || '', orderId) });
      onAssign?.();
    },
    onError: (error) => {
      logger.error('Failed to assign driver', error);
      toast.error('Failed to assign driver');
    },
  });

  const handleAssign = () => {
    if (!selectedCourier) {
      toast.error('Please select a driver');
      return;
    }
    assignMutation.mutate(selectedCourier);
  };

  if (!order) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-5 w-5" />
          Assign Driver
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Delivery to:</span>
            <span className="font-medium">{order.delivery_borough}</span>
          </div>
          <p className="text-sm text-muted-foreground pl-6">{order.delivery_address}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Select Driver</label>
          <Select value={selectedCourier} onValueChange={setSelectedCourier}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a driver..." />
            </SelectTrigger>
            <SelectContent>
              {couriers?.map((courier) => (
                <SelectItem key={courier.id} value={courier.id}>
                  <div className="flex items-center justify-between gap-4">
                    <span>{courier.name}</span>
                    <div className="flex items-center gap-2">
                      {courier.current_deliveries > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {courier.current_deliveries} active
                        </Badge>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {couriers && couriers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No available drivers at the moment
          </p>
        )}

        <Button
          onClick={handleAssign}
          disabled={!selectedCourier || assignMutation.isPending}
          className="w-full"
        >
          {assignMutation.isPending ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Assigning...
            </>
          ) : (
            <>
              <User className="h-4 w-4 mr-2" />
              Assign Driver
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
