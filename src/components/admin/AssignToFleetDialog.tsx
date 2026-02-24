import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Truck, Star, MapPin, Phone, CheckCircle2 } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { supabase } from '@/integrations/supabase/client';
import { useAvailableRunners, type AvailableRunner } from '@/hooks/useAvailableRunners';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { formatPhoneNumber } from '@/lib/formatters';

interface AssignToFleetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Order ID to assign (from orders or wholesale_orders table) */
  orderId: string;
  /** Order number for display */
  orderNumber: string;
  /** Whether this is a wholesale order (uses wholesale_delivery_assign) or regular order */
  isWholesale?: boolean;
  /** Delivery address for context */
  deliveryAddress?: string;
}

/**
 * Dialog for assigning a pending order to an available fleet runner/vehicle.
 * This connects the Fulfillment system to the Fleet management system.
 */
export function AssignToFleetDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  isWholesale = true,
  deliveryAddress,
}: AssignToFleetDialogProps) {
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const queryClient = useQueryClient();

  const { data: runners, isLoading } = useAvailableRunners({
    enabled: open,
    onlyAvailable: true,
  });

  const handleAssign = async () => {
    if (!selectedRunnerId) {
      showErrorToast('Please select a runner');
      return;
    }

    setAssigning(true);
    try {
      if (isWholesale) {
        // Use edge function for wholesale orders
        const { data, error } = await supabase.functions.invoke(
          'wholesale-delivery-assign',
          {
            body: {
              order_id: orderId,
              runner_id: selectedRunnerId,
            },
          }
        );

        if (error) throw error;

        // Check for error in response body
        if (data && typeof data === 'object' && 'error' in data && data.error) {
          const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to assign delivery';
          throw new Error(errorMessage);
        }
      } else {
        // For regular orders, assign courier directly
        const { error } = await supabase
          .from('orders')
          .update({
            courier_id: selectedRunnerId,
            status: 'confirmed',
          })
          .eq('id', orderId);

        if (error) throw error;
      }

      const runner = runners?.find((r) => r.id === selectedRunnerId);
      showSuccessToast(
        'Delivery Assigned',
        `Order #${orderNumber} assigned to ${runner?.full_name || 'runner'}`
      );

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.active() });
      queryClient.invalidateQueries({ queryKey: queryKeys.runners.available() });
      queryClient.invalidateQueries({ queryKey: queryKeys.runners.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingOrdersForAssignment.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.liveOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.lists() });

      onOpenChange(false);
      setSelectedRunnerId(null);
    } catch (error: unknown) {
      logger.error('Failed to assign to fleet', error instanceof Error ? error : new Error(String(error)), {
        component: 'AssignToFleetDialog',
        orderId,
        runnerId: selectedRunnerId,
      });
      showErrorToast(
        'Assignment Failed',
        error instanceof Error ? error.message : 'Unable to assign delivery to runner'
      );
    } finally {
      setAssigning(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      on_delivery: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      offline: 'bg-muted text-muted-foreground border-muted',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-emerald-500" />
            Assign to Fleet
          </DialogTitle>
          <DialogDescription>
            Select an available runner to deliver order #{orderNumber}
          </DialogDescription>
        </DialogHeader>

        {deliveryAddress && (
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="text-foreground">{deliveryAddress}</span>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleAssign(); }}>
        <ScrollArea className="max-h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : runners && runners.length > 0 ? (
            <div className="space-y-3">
              {runners.map((runner: AvailableRunner) => (
                <div
                  key={runner.id}
                  onClick={() => setSelectedRunnerId(runner.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-emerald-500 ${
                    selectedRunnerId === runner.id
                      ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Truck className="h-5 w-5 text-muted-foreground" />
                        </div>
                        {selectedRunnerId === runner.id && (
                          <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{runner.full_name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {formatPhoneNumber(runner.phone)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(runner.status)}>
                      {runner.status === 'available' ? 'Available' : runner.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Vehicle</span>
                      <span className="text-foreground capitalize">{runner.vehicle_type}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Rating</span>
                      <span className="flex items-center gap-1 text-foreground">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        {Number(runner.rating).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Deliveries</span>
                      <span className="font-mono text-foreground">{runner.total_deliveries}</span>
                    </div>
                  </div>

                  {runner.vehicle_plate && (
                    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                      Plate: <span className="font-mono">{runner.vehicle_plate}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No available runners</p>
              <p className="text-xs text-muted-foreground mt-1">
                All runners are currently on delivery or offline
              </p>
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedRunnerId(null);
            }}
            disabled={assigning}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!selectedRunnerId || assigning}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
          >
            {assigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Truck className="h-4 w-4 mr-2" />
                Assign to Runner
              </>
            )}
          </Button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
