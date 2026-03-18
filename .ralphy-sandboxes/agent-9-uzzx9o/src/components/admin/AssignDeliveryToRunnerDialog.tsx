import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, DollarSign, Package, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";
import { formatSmartDate } from "@/lib/formatters";
import { humanizeError } from '@/lib/humanizeError';

interface AssignDeliveryToRunnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runnerId: string;
  runnerName: string;
}

export const AssignDeliveryToRunnerDialog = ({
  open,
  onOpenChange,
  runnerId,
  runnerName,
}: AssignDeliveryToRunnerDialogProps) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Fetch pending orders (orders without delivery assignments)
  const { data: pendingOrders, isLoading } = useQuery({
    queryKey: [...queryKeys.wholesaleOrders.lists(), 'pending-unassigned', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');
      const { data, error } = await supabase
        .from("wholesale_orders")
        .select('id, order_number, total_amount, created_at, delivery_address, delivery_notes')
        .eq("tenant_id", tenant.id)
        .eq("status", "pending")
        .is("assigned_runner_id", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        logger.error('Failed to load pending orders', error, { component: 'AssignDeliveryToRunnerDialog' });
        throw error;
      }
      return data ?? [];
    },
    enabled: open && !!tenant?.id,
  });

  const assignMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "wholesale-delivery-assign",
        {
          body: {
            order_id: orderId,
            runner_id: runnerId,
          },
        }
      );

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to assign delivery';
        throw new Error(errorMessage);
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Delivery Assigned", {
        description: `Order has been assigned to ${runnerName}`,
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleDeliveries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.runners.all });

      onOpenChange(false);
      setSelectedOrderId("");
    },
    onError: (error: unknown) => {
      logger.error("Assignment error", error instanceof Error ? error : new Error(String(error)), { component: 'AssignDeliveryToRunnerDialog', runnerId, orderId: selectedOrderId });
      toast.error("Assignment Failed", { description: humanizeError(error) });
    },
  });

  const handleAssign = () => {
    if (!selectedOrderId) {
      toast.error("Please select an order");
      return;
    }
    assignMutation.mutate(selectedOrderId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Delivery to {runnerName}</DialogTitle>
          <DialogDescription>
            Select a pending order to assign to this runner
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleAssign(); }}>
        <ScrollArea className="max-h-[500px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingOrders && pendingOrders.length > 0 ? (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                    selectedOrderId === order.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-foreground mb-1">
                        Order #{order.order_number}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        <Package className="h-3 w-3 mr-1" />
                        Pending Assignment
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-emerald-500 font-semibold">
                        <DollarSign className="h-4 w-4" />
                        {Number(order.total_amount).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatSmartDate(order.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">
                      {order.delivery_address || "Address not provided"}
                    </span>
                  </div>

                  {order.delivery_notes && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                      {order.delivery_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No pending orders available</p>
              <p className="text-xs text-muted-foreground mt-1">
                All orders are either assigned or completed
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
              setSelectedOrderId("");
            }}
            disabled={assignMutation.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!selectedOrderId || assignMutation.isPending}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign to Runner"
            )}
          </Button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
