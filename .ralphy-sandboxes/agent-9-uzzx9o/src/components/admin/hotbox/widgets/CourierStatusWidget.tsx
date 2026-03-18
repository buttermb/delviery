/**
 * Courier Status Widget for Hotbox Dashboard
 *
 * Shows a real-time overview of courier availability:
 * - Available: Online, active, verified, and no active deliveries
 * - Busy: Currently handling a delivery (in_transit or assigned)
 * - Offline: Active but not currently online
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import Users from "lucide-react/dist/esm/icons/users";
import UserCheck from "lucide-react/dist/esm/icons/user-check";
import Truck from "lucide-react/dist/esm/icons/truck";
import Clock from "lucide-react/dist/esm/icons/clock";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import { queryKeys } from '@/lib/queryKeys';

interface Courier {
  id: string;
  full_name: string;
  is_online: boolean;
  is_active: boolean;
  age_verified: boolean;
  current_lat: number | null;
  current_lng: number | null;
}

interface CourierWithStatus extends Courier {
  status: 'available' | 'busy' | 'offline';
  hasLocation: boolean;
}

export function CourierStatusWidget() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.hotbox.courierStatus(tenant?.id),
    queryFn: async (): Promise<{ couriers: CourierWithStatus[]; counts: { available: number; busy: number; offline: number } }> => {
      if (!tenant?.id) return { couriers: [], counts: { available: 0, busy: 0, offline: 0 } };

      try {
        // Fetch all active couriers (cast to any to bypass deep type issues)
        const { data: couriersData, error: couriersError } = await supabase
          .from('couriers')
          .select('id, full_name, is_online, is_active, age_verified, current_lat, current_lng')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true);

        if (couriersError) throw couriersError;

        const couriers = (couriersData ?? []) as Courier[];

        // Get all couriers with active deliveries (assigned or in_transit)
        const { data: activeDeliveries, error: deliveriesError } = await supabase
          .from('deliveries')
          .select('courier_id')
          .eq('tenant_id', tenant.id)
          .in('status', ['assigned', 'in_transit', 'picked_up']);

        if (deliveriesError) throw deliveriesError;

        // Create a Set of busy courier IDs
        const busyCourierIds = new Set(
          (activeDeliveries ?? [])
            .map(d => d.courier_id)
            .filter((id): id is string => id !== null)
        );

        // Categorize couriers
        const couriersWithStatus: CourierWithStatus[] = couriers.map(courier => {
          const isVerified = courier.age_verified;
          const isOnline = courier.is_online;
          const isBusy = busyCourierIds.has(courier.id);
          const hasLocation = courier.current_lat !== null && courier.current_lng !== null;

          let status: 'available' | 'busy' | 'offline';
          if (!isOnline || !isVerified) {
            status = 'offline';
          } else if (isBusy) {
            status = 'busy';
          } else {
            status = 'available';
          }

          return {
            ...courier,
            status,
            hasLocation,
          };
        });

        // Calculate counts
        const counts = {
          available: couriersWithStatus.filter(c => c.status === 'available').length,
          busy: couriersWithStatus.filter(c => c.status === 'busy').length,
          offline: couriersWithStatus.filter(c => c.status === 'offline').length,
        };

        return { couriers: couriersWithStatus, counts };
      } catch (err) {
        logger.error('Failed to fetch courier status', err);
        return { couriers: [], counts: { available: 0, busy: 0, offline: 0 } };
      }
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { couriers = [], counts = { available: 0, busy: 0, offline: 0 } } = data || {};

  // Get top couriers to display (prioritize available, then busy)
  const displayCouriers = useMemo(() => {
    const sorted = [...couriers].sort((a, b) => {
      const order = { available: 0, busy: 1, offline: 2 };
      return order[a.status] - order[b.status];
    });
    return sorted.slice(0, 5);
  }, [couriers]);

  const handleViewAll = () => {
    navigate(`/${tenantSlug}/admin/couriers`);
  };

  const handleManageDeliveries = () => {
    navigate(`/${tenantSlug}/admin/fulfillment-hub?tab=pending`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Users className="h-5 w-5" />
            COURIER STATUS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-24 rounded-full" />
              ))}
            </div>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCouriers = couriers.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Users className="h-5 w-5" />
            COURIER STATUS
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {totalCouriers} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status summary pills */}
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200">
            <UserCheck className="h-3 w-3 mr-1" />
            {counts.available} Available
          </Badge>
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200">
            <Truck className="h-3 w-3 mr-1" />
            {counts.busy} Busy
          </Badge>
          <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400 hover:bg-gray-200">
            <Clock className="h-3 w-3 mr-1" />
            {counts.offline} Offline
          </Badge>
        </div>

        {/* Courier list */}
        {displayCouriers.length > 0 ? (
          <div className="space-y-2">
            {displayCouriers.map((courier) => {
              const statusConfig = {
                available: {
                  dotColor: 'bg-emerald-500',
                  label: 'Available',
                  textColor: 'text-emerald-600 dark:text-emerald-400',
                },
                busy: {
                  dotColor: 'bg-purple-500',
                  label: 'On Delivery',
                  textColor: 'text-purple-600 dark:text-purple-400',
                },
                offline: {
                  dotColor: 'bg-gray-400',
                  label: 'Offline',
                  textColor: 'text-gray-500 dark:text-gray-400',
                },
              }[courier.status];

              return (
                <div
                  key={courier.id}
                  className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {courier.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900',
                          statusConfig.dotColor,
                          courier.status === 'available' && 'animate-pulse'
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {courier.full_name || 'Unknown'}
                      </div>
                      <div className={cn('text-xs', statusConfig.textColor)}>
                        {statusConfig.label}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {courier.hasLocation && (
                      <MapPin className="h-3.5 w-3.5 text-emerald-500" aria-label="GPS location available" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">No active couriers</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add couriers in the Couriers section
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleViewAll}
          >
            Manage Couriers
            <ChevronRight className="h-4 w-4" />
          </Button>
          {counts.available > 0 && (
            <Button
              variant="default"
              className="flex-1 gap-2"
              onClick={handleManageDeliveries}
            >
              Assign Deliveries
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
