import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Truck, MapPin, Clock, DollarSign } from 'lucide-react';
import { calculateDistance } from '@/utils/geofenceHelper';

interface Courier {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  current_lat?: number;
  current_lng?: number;
  is_online: boolean;
  rating: number;
}

interface CourierDispatchPanelProps {
  orderId: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  onAssigned?: () => void;
}

export const CourierDispatchPanel = ({
  orderId,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  onAssigned
}: CourierDispatchPanelProps) => {
  const { tenant } = useTenantAdminAuth();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (tenant?.id) {
      fetchAvailableCouriers();
    }
  }, [tenant?.id]);

  const fetchAvailableCouriers = async () => {
    if (!tenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('*')
        .eq('tenant_id', tenant.id) // Filter by tenant for multi-tenant isolation
        .eq('is_online', true)
        .eq('is_active', true);

      if (error) throw error;

      // Calculate distance for each courier and sort by proximity
      const couriersWithDistance = (data || []).map(courier => ({
        ...courier,
        distance: courier.current_lat && courier.current_lng
          ? calculateDistance(pickupLat, pickupLng, courier.current_lat, courier.current_lng)
          : 999
      })).sort((a, b) => a.distance - b.distance);

      setCouriers(couriersWithDistance);
    } catch (error) {
      logger.error('Error fetching couriers', error instanceof Error ? error : new Error(String(error)), { component: 'CourierDispatchPanel' });
    } finally {
      setLoading(false);
    }
  };

  const assignCourier = async (courierId: string) => {
    setAssigning(courierId);
    try {
      const { data, error } = await supabase.functions.invoke('assign-courier', {
        body: {
          orderId,
          courierId,
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng
        }
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to assign courier';
        throw new Error(errorMessage);
      }

      toast({
        title: '✓ Courier Assigned',
        description: `${data?.courier?.full_name || 'Courier'} has been assigned to this order`
      });

      onAssigned?.();
    } catch (error: unknown) {
      logger.error('Assign courier error', error instanceof Error ? error : new Error(String(error)), { component: 'CourierDispatchPanel', orderId, courierId });
      toast({
        title: 'Assignment Failed',
        description: error instanceof Error ? error.message : 'Unable to assign courier',
        variant: 'destructive'
      });
    } finally {
      setAssigning(null);
    }
  };

  const autoAssignNearest = async () => {
    if (couriers.length === 0) return;
    
    const nearest = couriers[0];
    await assignCourier(nearest.id);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Assign Courier</CardTitle>
          <Button 
            onClick={autoAssignNearest}
            disabled={loading || couriers.length === 0}
            size="sm"
          >
            Auto-Assign Nearest
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading couriers...</p>
        ) : couriers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No available couriers online</p>
        ) : (
          <div className="space-y-3">
            {couriers.slice(0, 5).map(courier => (
              <div 
                key={courier.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{courier.full_name}</p>
                    <Badge variant="outline" className="text-xs">
                      ⭐ {courier.rating.toFixed(1)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      {courier.vehicle_type}
                    </span>
                    {courier.current_lat && courier.current_lng && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {calculateDistance(
                          pickupLat,
                          pickupLng,
                          courier.current_lat,
                          courier.current_lng
                        ).toFixed(1)} mi away
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => assignCourier(courier.id)}
                  disabled={assigning !== null}
                  size="sm"
                >
                  {assigning === courier.id ? 'Assigning...' : 'Assign'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
