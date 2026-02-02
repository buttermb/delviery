/**
 * Available Couriers List for Customer Portal
 * Shows all active couriers for the tenant (read-only view for customers)
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import Truck from "lucide-react/dist/esm/icons/truck";
import Star from "lucide-react/dist/esm/icons/star";
import Users from "lucide-react/dist/esm/icons/users";

interface Courier {
  id: string;
  full_name: string;
  vehicle_type: string;
  rating?: number;
  total_deliveries?: number;
  is_online: boolean;
}

export function AvailableCouriers() {
  const { tenant } = useCustomerAuth();

  // Fetch couriers for this tenant
  const { data: couriers, isLoading } = useQuery({
    queryKey: ['available-couriers', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, vehicle_type, rating, total_deliveries, is_online')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('is_online', { ascending: false })
        .order('rating', { ascending: false });

      if (error) throw error;
      return (data || []) as Courier[];
    },
    enabled: !!tenant?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const onlineCouriers = couriers?.filter((c) => c.is_online) || [];
  const offlineCouriers = couriers?.filter((c) => !c.is_online) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Our Delivery Team
          </CardTitle>
          <Badge variant="secondary">
            {onlineCouriers.length} Online
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!couriers || couriers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No couriers available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Online Couriers */}
            {onlineCouriers.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  Online Now
                </h4>
                {onlineCouriers.map((courier) => (
                  <div
                    key={courier.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {courier.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{courier.full_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Truck className="h-3 w-3" />
                        <span className="capitalize">{courier.vehicle_type}</span>
                      </div>
                    </div>

                    {courier.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{courier.rating.toFixed(1)}</span>
                      </div>
                    )}

                    <Badge variant="default" className="text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1" />
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Offline Couriers */}
            {offlineCouriers.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-gray-400" />
                  Available Team
                </h4>
                {offlineCouriers.map((courier) => (
                  <div
                    key={courier.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card opacity-75"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                        {courier.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{courier.full_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Truck className="h-3 w-3" />
                        <span className="capitalize">{courier.vehicle_type}</span>
                      </div>
                    </div>

                    {courier.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{courier.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
