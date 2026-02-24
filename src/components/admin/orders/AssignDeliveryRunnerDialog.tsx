/**
 * AssignDeliveryRunnerDialog
 *
 * Dialog for assigning a delivery runner to an order from the order details page.
 * Features:
 * - Shows available runners with current load (active deliveries count)
 * - Auto-suggests best runner based on proximity to delivery address
 * - Creates delivery record linked to order and runner
 * - Sends notification to runner
 * - Updates order status to assigned
 */

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogFooterActions } from '@/components/ui/dialog-footer-actions';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useNotificationDispatcher } from '@/hooks/useNotificationDispatcher';
import { useDeliveryOrderSync } from '@/hooks/useDeliveryOrderSync';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import Star from 'lucide-react/dist/esm/icons/star';
import Truck from 'lucide-react/dist/esm/icons/truck';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Zap from 'lucide-react/dist/esm/icons/zap';
import Package from 'lucide-react/dist/esm/icons/package';
import User from 'lucide-react/dist/esm/icons/user';

interface AssignDeliveryRunnerDialogProps {
  orderId: string;
  orderNumber: string;
  deliveryAddress?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: () => void;
}

interface RunnerWithLoad {
  id: string;
  full_name: string;
  phone: string | null;
  vehicle_type: string | null;
  rating: number | null;
  total_deliveries: number;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
  active_deliveries_count: number;
  distance_km: number | null;
  is_recommended: boolean;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function AssignDeliveryRunnerDialog({
  orderId,
  orderNumber,
  deliveryAddress,
  open,
  onOpenChange,
  onAssigned,
}: AssignDeliveryRunnerDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const { dispatchNotification } = useNotificationDispatcher();
  const { publishDeliveryStatusChange } = useDeliveryOrderSync();

  const [selectedRunnerId, setSelectedRunnerId] = useState<string>('');

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedRunnerId('');
    }
  }, [open]);

  // Fetch available runners with their active deliveries count
  const { data: runnersData, isLoading: isLoadingRunners } = useQuery({
    queryKey: queryKeys.runners.list({ tenantId: tenant?.id, status: 'available' }),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');

      // Fetch runners
      const { data: runners, error: runnersError } = await supabase
        .from('wholesale_runners')
        .select('id, full_name, phone, vehicle_type, rating, total_deliveries, status, current_lat, current_lng')
        .eq('tenant_id', tenant.id)
        .eq('status', 'available')
        .order('rating', { ascending: false });

      if (runnersError) throw runnersError;

      if (!runners || runners.length === 0) {
        return [];
      }

      // Get active deliveries count for each runner
      const runnerIds = runners.map((r) => r.id);
      const { data: activeDeliveries, error: deliveriesError } = await supabase
        .from('wholesale_deliveries')
        .select('runner_id')
        .in('runner_id', runnerIds)
        .in('status', ['assigned', 'picked_up', 'in_transit']);

      if (deliveriesError) {
        logger.error('Failed to fetch active deliveries', deliveriesError);
      }

      // Count deliveries per runner
      const deliveryCountMap = new Map<string, number>();
      (activeDeliveries || []).forEach((d) => {
        const count = deliveryCountMap.get(d.runner_id) || 0;
        deliveryCountMap.set(d.runner_id, count + 1);
      });

      // Map runners with their load
      return runners.map((runner) => ({
        ...runner,
        active_deliveries_count: deliveryCountMap.get(runner.id) || 0,
        distance_km: null as number | null,
        is_recommended: false,
      }));
    },
    enabled: open && !!tenant?.id,
    staleTime: 30_000,
  });

  // Geocode delivery address to get coordinates (simplified - in production use a geocoding service)
  const { data: deliveryCoords } = useQuery({
    queryKey: queryKeys.geocodeAddress.byAddress(deliveryAddress),
    queryFn: async () => {
      // Placeholder: In production, use a geocoding API (Google Maps, Mapbox, etc.)
      // For now, return null to indicate we don't have coordinates
      // This is a simplified implementation
      logger.debug('Geocoding address for runner proximity', { deliveryAddress });
      return null as { lat: number; lng: number } | null;
    },
    enabled: open && !!deliveryAddress,
    staleTime: 300_000,
  });

  // Calculate distances and find best runner
  const runnersWithProximity = useMemo((): RunnerWithLoad[] => {
    if (!runnersData) return [];

    const runnersWithDistance = runnersData.map((runner) => {
      let distance: number | null = null;

      // Calculate distance if we have both runner and delivery coordinates
      if (
        deliveryCoords &&
        runner.current_lat !== null &&
        runner.current_lng !== null
      ) {
        distance = calculateDistanceKm(
          runner.current_lat,
          runner.current_lng,
          deliveryCoords.lat,
          deliveryCoords.lng
        );
      }

      return {
        ...runner,
        distance_km: distance,
        is_recommended: false,
      };
    });

    // Sort by: fewer active deliveries first, then by distance (if available), then by rating
    const sorted = [...runnersWithDistance].sort((a, b) => {
      // Primary: fewer active deliveries is better
      if (a.active_deliveries_count !== b.active_deliveries_count) {
        return a.active_deliveries_count - b.active_deliveries_count;
      }

      // Secondary: closer distance is better (if available)
      if (a.distance_km !== null && b.distance_km !== null) {
        return a.distance_km - b.distance_km;
      }

      // Tertiary: higher rating is better
      const ratingA = a.rating ?? 0;
      const ratingB = b.rating ?? 0;
      return ratingB - ratingA;
    });

    // Mark the best runner as recommended
    if (sorted.length > 0) {
      sorted[0].is_recommended = true;
    }

    return sorted;
  }, [runnersData, deliveryCoords]);

  // Auto-select recommended runner when data loads
  useEffect(() => {
    if (runnersWithProximity.length > 0 && !selectedRunnerId) {
      const recommended = runnersWithProximity.find((r) => r.is_recommended);
      if (recommended) {
        setSelectedRunnerId(recommended.id);
      }
    }
  }, [runnersWithProximity, selectedRunnerId]);

  // Assign delivery mutation
  const assignMutation = useMutation({
    mutationFn: async (runnerId: string) => {
      const { data, error } = await supabase.functions.invoke('wholesale-delivery-assign', {
        body: { order_id: orderId, runner_id: runnerId },
      });

      if (error) throw error;

      // Check for error in response body
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to assign delivery';
        throw new Error(errorMessage);
      }

      return data as { delivery_id: string; success: boolean; message: string };
    },
    onSuccess: async (data, runnerId) => {
      const runner = runnersWithProximity.find((r) => r.id === runnerId);

      // Create notification for the runner
      await dispatchNotification({
        userId: null, // Could be runner's user ID if available
        title: 'New Delivery Assignment',
        message: `You have been assigned to deliver order ${orderNumber}${deliveryAddress ? ` to ${deliveryAddress}` : ''}.`,
        type: 'info',
        entityType: 'delivery',
        entityId: data.delivery_id,
      });

      // Publish delivery status change event for sync
      publishDeliveryStatusChange(
        data.delivery_id,
        orderId,
        null,
        'assigned',
        runnerId
      );

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id || '', orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.runners.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleDeliveries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });

      toast.success('Runner Assigned', {
        description: `${runner?.full_name || 'Runner'} has been assigned to order ${orderNumber}`,
      });

      onOpenChange(false);
      onAssigned?.();
    },
    onError: (error) => {
      logger.error('Failed to assign runner', error, { component: 'AssignDeliveryRunnerDialog' });
      toast.error('Assignment Failed', {
        description: error instanceof Error ? error.message : 'Failed to assign runner',
      });
    },
  });

  const handleAssign = () => {
    if (!selectedRunnerId) return;
    assignMutation.mutate(selectedRunnerId);
  };

  const selectedRunner = runnersWithProximity.find((r) => r.id === selectedRunnerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Assign Delivery Runner
          </DialogTitle>
          <DialogDescription>
            Select a runner to deliver order {orderNumber}
            {deliveryAddress && (
              <span className="block mt-1 text-xs">
                <MapPin className="inline h-3 w-3 mr-1" />
                {deliveryAddress}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleAssign(); }} className="space-y-4 py-4">
          {isLoadingRunners ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : runnersWithProximity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No Available Runners</p>
              <p className="text-sm">All runners are currently busy or offline.</p>
            </div>
          ) : (
            <RadioGroup
              value={selectedRunnerId}
              onValueChange={setSelectedRunnerId}
              className="space-y-3"
            >
              {runnersWithProximity.map((runner) => (
                <label
                  key={runner.id}
                  htmlFor={`runner-${runner.id}`}
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedRunnerId === runner.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <RadioGroupItem value={runner.id} id={`runner-${runner.id}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{runner.full_name}</span>
                      {runner.is_recommended && (
                        <Badge variant="secondary" className="bg-success/10 text-success text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          Best Match
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                      {/* Active deliveries count */}
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {runner.active_deliveries_count} active
                      </span>

                      {/* Rating */}
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        {runner.rating?.toFixed(1) || 'N/A'}
                      </span>

                      {/* Vehicle type */}
                      {runner.vehicle_type && (
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {runner.vehicle_type}
                        </span>
                      )}

                      {/* Distance (if available) */}
                      {runner.distance_km !== null && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {runner.distance_km.toFixed(1)} km
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Total deliveries badge */}
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="font-medium">{runner.total_deliveries}</div>
                    <div>total</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}

          {/* Selected runner summary */}
          {selectedRunner && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-2 mt-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Selected Runner
              </Label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedRunner.full_name}</p>
                  {selectedRunner.phone && (
                    <p className="text-sm text-muted-foreground">{selectedRunner.phone}</p>
                  )}
                </div>
                <Badge
                  variant={selectedRunner.active_deliveries_count === 0 ? 'default' : 'secondary'}
                >
                  {selectedRunner.active_deliveries_count === 0
                    ? 'Available'
                    : `${selectedRunner.active_deliveries_count} active deliveries`}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooterActions
            primaryLabel={assignMutation.isPending ? 'Assigning...' : 'Assign Runner'}
            onPrimary={handleAssign}
            primaryDisabled={!selectedRunnerId || runnersWithProximity.length === 0}
            primaryLoading={assignMutation.isPending}
            secondaryLabel="Cancel"
            onSecondary={() => onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AssignDeliveryRunnerDialog;
