/**
 * CourierAvailabilityPanel
 * Shows courier availability status for order assignment in the fulfillment workflow.
 * Displays online/offline couriers with quick actions for dispatching.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import {
  Users,
  UserCheck,
  MapPin,
  Truck,
  Star,
  ChevronRight,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';

interface Courier {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  is_online: boolean;
  is_active: boolean;
  age_verified: boolean;
  current_lat: number | null;
  current_lng: number | null;
  rating: number | null;
  total_deliveries: number | null;
}

interface CourierAvailabilityPanelProps {
  /**
   * Maximum number of couriers to display
   * @default 6
   */
  maxCouriers?: number;
  /**
   * Whether to show only available (online + active + verified) couriers
   * @default false
   */
  availableOnly?: boolean;
  /**
   * Callback when a courier is selected for assignment
   */
  onSelectCourier?: (courier: Courier) => void;
  /**
   * Custom class name for the panel
   */
  className?: string;
}

type AvailabilityStatus = 'available' | 'offline' | 'inactive' | 'unverified';

function getAvailabilityStatus(courier: Courier): AvailabilityStatus {
  if (!courier.is_active) return 'inactive';
  if (!courier.age_verified) return 'unverified';
  if (!courier.is_online) return 'offline';
  return 'available';
}

function getStatusBadge(status: AvailabilityStatus) {
  switch (status) {
    case 'available':
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-600">
          <span className="relative flex h-2 w-2 mr-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-200"></span>
          </span>
          Available
        </Badge>
      );
    case 'offline':
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Offline
        </Badge>
      );
    case 'inactive':
      return (
        <Badge variant="destructive">
          <UserX className="h-3 w-3 mr-1" />
          Inactive
        </Badge>
      );
    case 'unverified':
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-600">
          Unverified
        </Badge>
      );
  }
}

function CourierCard({
  courier,
  onSelect,
}: {
  courier: Courier;
  onSelect?: (courier: Courier) => void;
}) {
  const status = getAvailabilityStatus(courier);
  const isAvailable = status === 'available';
  const hasLocation = courier.current_lat !== null && courier.current_lng !== null;

  return (
    <div
      className={cn(
        'p-3 border rounded-lg transition-all',
        isAvailable
          ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800 hover:border-green-400'
          : 'bg-muted/30 border-border hover:border-muted-foreground/30'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm truncate">{courier.full_name}</h4>
            {getStatusBadge(status)}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {courier.vehicle_type || 'N/A'}
            </span>
            {courier.rating !== null && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                {courier.rating.toFixed(1)}
              </span>
            )}
            {hasLocation && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <MapPin className="h-3 w-3" />
                GPS
              </span>
            )}
            {courier.total_deliveries !== null && courier.total_deliveries > 0 && (
              <span className="text-muted-foreground">
                {courier.total_deliveries} deliveries
              </span>
            )}
          </div>
        </div>

        {onSelect && isAvailable && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 h-8"
            onClick={() => onSelect(courier)}
          >
            Assign
          </Button>
        )}
      </div>
    </div>
  );
}

function CourierCardSkeleton() {
  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CourierAvailabilityPanel({
  maxCouriers = 6,
  availableOnly = false,
  onSelectCourier,
  className,
}: CourierAvailabilityPanelProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();

  const {
    data: couriers = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryKeys.couriers.list({ tenantId: tenant?.id }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('couriers')
        .select(
          'id, full_name, email, phone, vehicle_type, is_online, is_active, age_verified, current_lat, current_lng, rating, total_deliveries'
        )
        .eq('tenant_id', tenant.id)
        .order('is_online', { ascending: false })
        .order('is_active', { ascending: false })
        .order('rating', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as Courier[];
    },
    enabled: !!tenant?.id,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time availability
  });

  // Filter and sort couriers
  const filteredCouriers = availableOnly
    ? couriers.filter(
        (c) => c.is_online && c.is_active && c.age_verified
      )
    : couriers;

  const displayedCouriers = filteredCouriers.slice(0, maxCouriers);

  // Calculate stats
  const availableCount = couriers.filter(
    (c) => c.is_online && c.is_active && c.age_verified
  ).length;
  const totalCount = couriers.length;
  const offlineCount = couriers.filter((c) => c.is_active && !c.is_online).length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            Courier Availability
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw
                className={cn('h-4 w-4', isRefetching && 'animate-spin')}
              />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => navigateToAdmin('fulfillment-hub?tab=couriers')}
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Stats Summary */}
        <div className="flex items-center gap-4 mb-4 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30">
              <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{availableCount}</p>
              <p className="text-xs text-muted-foreground">Available</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{offlineCount}</p>
              <p className="text-xs text-muted-foreground">Offline</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{totalCount}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </div>

        {/* Courier List */}
        {isLoading ? (
          <div className="space-y-2">
            <CourierCardSkeleton />
            <CourierCardSkeleton />
            <CourierCardSkeleton />
          </div>
        ) : displayedCouriers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {availableOnly
                ? 'No couriers available for assignment'
                : 'No couriers found'}
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-2"
              onClick={() => navigateToAdmin('fulfillment-hub?tab=couriers')}
            >
              Add Couriers
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedCouriers.map((courier) => (
              <CourierCard
                key={courier.id}
                courier={courier}
                onSelect={onSelectCourier}
              />
            ))}

            {filteredCouriers.length > maxCouriers && (
              <Button
                variant="ghost"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => navigateToAdmin('fulfillment-hub?tab=couriers')}
              >
                +{filteredCouriers.length - maxCouriers} more couriers
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
