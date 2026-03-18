/**
 * AssignToFleetDialog
 * Dialog for assigning orders to fleet/couriers for delivery
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { Truck, MapPin, User, Check, Loader2 } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';

interface Courier {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  is_online: boolean;
  is_active: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
}

interface AssignToFleetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  isWholesale?: boolean;
  deliveryAddress?: string;
}

export function AssignToFleetDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  isWholesale = false,
  deliveryAddress,
}: AssignToFleetDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);

  // Fetch available couriers
  const { data: couriers = [], isLoading } = useQuery({
    queryKey: queryKeys.fleetCouriers.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, phone, vehicle_type, is_online, is_active, current_lat, current_lng')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('is_online', { ascending: false })
        .order('full_name');

      if (error) throw error;
      return (data ?? []) as Courier[];
    },
    enabled: open && !!tenant?.id,
  });

  // Assign courier mutation
  const assignMutation = useMutation({
    mutationFn: async (courierId: string) => {
      if (!tenant?.id) throw new Error('No tenant context');

      const table = isWholesale ? 'wholesale_orders' : 'orders';
      const { error } = await supabase
        .from(table)
        .update({
          courier_id: courierId,
          status: 'out_for_delivery',
          courier_assigned_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      return { courierId };
    },
    onSuccess: () => {
      toast.success('Courier assigned successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error('Failed to assign courier', error instanceof Error ? error : new Error(String(error)));
      toast.error('Failed to assign courier', { description: humanizeError(error) });
    },
  });

  const handleAssign = () => {
    if (selectedCourierId) {
      assignMutation.mutate(selectedCourierId);
    }
  };

  const availableCouriers = couriers.filter(c => c.is_online);
  const offlineCouriers = couriers.filter(c => !c.is_online);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Assign to Fleet
          </DialogTitle>
          <DialogDescription>
            Select a courier to deliver order #{orderNumber}
          </DialogDescription>
        </DialogHeader>

        {deliveryAddress && (
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="text-muted-foreground">{deliveryAddress}</span>
          </div>
        )}

        <ScrollArea className="max-h-[300px]">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : couriers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No couriers available</p>
              <p className="text-sm">Add couriers in the Couriers section</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableCouriers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase px-1">Available Now</p>
                  {availableCouriers.map((courier) => (
                    <button
                      key={courier.id}
                      onClick={() => setSelectedCourierId(courier.id)}
                      className={`w-full p-3 rounded-lg border transition-colors flex items-center gap-3 ${
                        selectedCourierId === courier.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {courier.full_name?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{courier.full_name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {courier.vehicle_type} • {courier.phone}
                        </p>
                      </div>
                      <Badge variant="default" className="bg-green-600">Online</Badge>
                      {selectedCourierId === courier.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {offlineCouriers.length > 0 && (
                <div className="space-y-1 mt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase px-1">Offline</p>
                  {offlineCouriers.map((courier) => (
                    <button
                      key={courier.id}
                      onClick={() => setSelectedCourierId(courier.id)}
                      className={`w-full p-3 rounded-lg border transition-colors flex items-center gap-3 opacity-60 ${
                        selectedCourierId === courier.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {courier.full_name?.charAt(0) || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{courier.full_name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {courier.vehicle_type} • {courier.phone}
                        </p>
                      </div>
                      <Badge variant="secondary">Offline</Badge>
                      {selectedCourierId === courier.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedCourierId || assignMutation.isPending}
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign Courier'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
