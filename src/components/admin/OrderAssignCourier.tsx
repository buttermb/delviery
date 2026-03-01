import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { apiFetch } from '@/lib/utils/apiClient';
import { humanizeError } from '@/lib/humanizeError';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogFooterActions } from '@/components/ui/dialog-footer-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import Truck from "lucide-react/dist/esm/icons/truck";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Phone from "lucide-react/dist/esm/icons/phone";
import Star from "lucide-react/dist/esm/icons/star";
import Zap from "lucide-react/dist/esm/icons/zap";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import User from "lucide-react/dist/esm/icons/user";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { cn } from '@/lib/utils';

interface Courier {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  vehicle_type: string;
  vehicle_plate: string;
  is_online: boolean;
  is_active: boolean;
  rating: number | null;
  total_deliveries: number;
  current_lat: number | null;
  current_lng: number | null;
}

interface OrderAssignCourierProps {
  orderId: string;
  orderAddress: string;
  orderNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function OrderAssignCourier({
  orderId,
  orderAddress,
  orderNumber,
  open,
  onOpenChange,
  onSuccess,
}: OrderAssignCourierProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);

  // Fetch available couriers using TanStack Query
  const {
    data: couriers,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.couriers.list({ tenantId: tenant?.id, available: true }),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, phone, email, vehicle_type, vehicle_plate, is_online, is_active, rating, total_deliveries, current_lat, current_lng')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('is_online', { ascending: false })
        .order('rating', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as Courier[];
    },
    enabled: open && !!tenant?.id,
    staleTime: 30000, // 30 seconds
  });

  // Mutation for assigning courier
  const assignCourierMutation = useMutation({
    mutationFn: async ({ courierId, autoAssign: _autoAssign }: { courierId?: string; autoAssign?: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/assign-courier`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId,
          ...(courierId && { courierId }),
        }),
        skipAuth: true,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign courier');
      }

      return response.json();
    },
    onSuccess: (data) => {
      const courierName = data.courier?.name || 'Courier';
      toast.success(`${courierName} assigned successfully`);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });

      onOpenChange(false);
      setSelectedCourierId(null);
      onSuccess?.();
    },
    onError: (error) => {
      logger.error('Failed to assign courier', error, {
        component: 'OrderAssignCourier',
        orderId
      });
      toast.error(humanizeError(error, 'Failed to assign courier'));
    },
  });

  const handleAssignSelected = () => {
    if (!selectedCourierId) {
      toast.error('Please select a courier');
      return;
    }
    assignCourierMutation.mutate({ courierId: selectedCourierId });
  };

  const handleAutoAssign = () => {
    assignCourierMutation.mutate({ autoAssign: true });
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedCourierId(null);
  };

  // Separate online and offline couriers
  const onlineCouriers = couriers?.filter((c) => c.is_online) ?? [];
  const offlineCouriers = couriers?.filter((c) => !c.is_online) ?? [];
  const hasOnlineCouriers = onlineCouriers.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Assign Courier
          </DialogTitle>
          <DialogDescription>
            {orderNumber ? (
              <>Select a courier for order <strong>{orderNumber}</strong></>
            ) : (
              <>Delivery to: <strong className="break-words">{orderAddress}</strong></>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Auto-assign button */}
          {hasOnlineCouriers && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-dashed"
              onClick={handleAutoAssign}
              disabled={assignCourierMutation.isPending}
            >
              {assignCourierMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-warning" />}
              Auto-assign nearest available courier
            </Button>
          )}

          {/* Courier list */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-sm text-muted-foreground">
                Failed to load couriers. Please try again.
              </p>
            </div>
          ) : !couriers || couriers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No couriers available at the moment
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {/* Online couriers section */}
                {onlineCouriers.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                      Online ({onlineCouriers.length})
                    </div>
                    <div className="space-y-2">
                      {onlineCouriers.map((courier) => (
                        <CourierCard
                          key={courier.id}
                          courier={courier}
                          isSelected={selectedCourierId === courier.id}
                          onSelect={() => setSelectedCourierId(courier.id)}
                          disabled={assignCourierMutation.isPending}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Offline couriers section */}
                {offlineCouriers.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                      Offline ({offlineCouriers.length})
                    </div>
                    <div className="space-y-2">
                      {offlineCouriers.map((courier) => (
                        <CourierCard
                          key={courier.id}
                          courier={courier}
                          isSelected={selectedCourierId === courier.id}
                          onSelect={() => setSelectedCourierId(courier.id)}
                          disabled={assignCourierMutation.isPending}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooterActions
          primaryLabel={assignCourierMutation.isPending ? 'Assigning...' : 'Assign Selected'}
          onPrimary={handleAssignSelected}
          primaryDisabled={!selectedCourierId || assignCourierMutation.isPending}
          primaryLoading={assignCourierMutation.isPending}
          secondaryLabel="Cancel"
          onSecondary={handleClose}
        />
      </DialogContent>
    </Dialog>
  );
}

interface CourierCardProps {
  courier: Courier;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function CourierCard({ courier, isSelected, onSelect, disabled }: CourierCardProps) {
  const hasLocation = courier.current_lat !== null && courier.current_lng !== null;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full p-4 rounded-lg border text-left transition-all',
        'hover:border-primary/50 hover:bg-accent/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        isSelected && 'border-primary bg-primary/5 ring-1 ring-primary',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Avatar placeholder */}
          <div className={cn(
            'flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center',
            courier.is_online ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
          )}>
            <User className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Name and status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{courier.full_name}</span>
              <Badge
                variant={courier.is_online ? 'default' : 'secondary'}
                className={cn(
                  'text-xs',
                  courier.is_online && 'bg-success hover:bg-success/90'
                )}
              >
                {courier.is_online ? 'Online' : 'Offline'}
              </Badge>
              {hasLocation && (
                <MapPin className="h-3 w-3 text-success flex-shrink-0" />
              )}
            </div>

            {/* Vehicle info */}
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Truck className="h-3 w-3 flex-shrink-0" />
              <span className="capitalize">{courier.vehicle_type}</span>
              {courier.vehicle_plate && (
                <>
                  <span>•</span>
                  <span className="font-mono text-xs">{courier.vehicle_plate}</span>
                </>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {courier.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {courier.phone}
                </span>
              )}
              {courier.rating !== null && courier.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-warning text-warning" />
                  {courier.rating.toFixed(1)}
                </span>
              )}
              {courier.total_deliveries > 0 && (
                <span>{courier.total_deliveries} deliveries</span>
              )}
            </div>
          </div>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
        )}
      </div>
    </button>
  );
}
