/**
 * Courier Tracking Component for Customer Portal
 * Shows assigned courier details and live location for customer orders
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Phone, Star, Truck, MapPin, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CourierInfo {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  rating?: number;
  total_deliveries?: number;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
}

interface CourierTrackingProps {
  orderId: string;
}

export function CourierTracking({ orderId }: CourierTrackingProps) {
  const { tenant } = useCustomerAuth();

  // Fetch order with courier details
  const { data: orderData, isLoading } = useQuery({
    queryKey: ['order-courier', orderId, tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      const { data, error } = await supabase
        .from('wholesale_orders')
        .select(`
          id,
          status,
          runner_id,
          assigned_at,
          delivered_at,
          couriers!runner_id (
            id,
            full_name,
            phone,
            vehicle_type,
            vehicle_make,
            vehicle_model,
            vehicle_plate,
            rating,
            total_deliveries,
            is_online,
            current_lat,
            current_lng
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orderId && !!tenant?.id,
    refetchInterval: 10000, // Refetch every 10 seconds for live tracking
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orderData?.runner_id || !orderData.couriers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Courier Assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No courier assigned yet</p>
            <p className="text-sm mt-1">Your order will be assigned soon</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const courier = orderData.couriers as unknown as CourierInfo;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Your Courier
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Courier Profile */}
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-primary/10 text-primary">
              {courier.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{courier.full_name}</h3>
              {courier.is_online && (
                <Badge variant="default" className="gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  Online
                </Badge>
              )}
            </div>

            {/* Rating */}
            {courier.rating && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{courier.rating.toFixed(1)}</span>
                </div>
                {courier.total_deliveries && (
                  <span className="text-sm text-muted-foreground">
                    ({courier.total_deliveries} deliveries)
                  </span>
                )}
              </div>
            )}

            {/* Vehicle Info */}
            {courier.vehicle_make && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Truck className="h-4 w-4" />
                <span>
                  {courier.vehicle_make} {courier.vehicle_model}
                  {courier.vehicle_plate && ` • ${courier.vehicle_plate}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Contact Button */}
        <div className="pt-2">
          <a
            href={`tel:${courier.phone}`}
            className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Phone className="h-4 w-4" />
            Call Courier
          </a>
        </div>

        {/* Accepted Time */}
        {orderData.assigned_at && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
            <Clock className="h-4 w-4" />
            <span>
              Accepted{' '}
              {formatDistanceToNow(new Date(orderData.assigned_at), {
                addSuffix: true,
              })}
            </span>
          </div>
        )}

        {/* Location Status */}
        {courier.is_online && courier.current_lat && courier.current_lng && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-green-500" />
            <span>Location tracking active</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
