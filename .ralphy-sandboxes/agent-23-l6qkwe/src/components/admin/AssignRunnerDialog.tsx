import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DialogFooterActions } from "@/components/ui/dialog-footer-actions";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAssignDelivery } from "@/hooks/useWholesaleData";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";
import { humanizeError } from "@/lib/humanizeError";
import { formatPhoneNumber } from "@/lib/formatters";
import { toast } from "sonner";

interface AssignRunnerDialogProps {
  orderId: string;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignRunnerDialog({ orderId, orderNumber, open, onOpenChange }: AssignRunnerDialogProps) {
  const [selectedRunner, setSelectedRunner] = useState("");
  const { tenant } = useTenantAdminAuth();
  const assignDelivery = useAssignDelivery();

  const { data: runners, isLoading, isError } = useQuery({
    queryKey: queryKeys.runners.available(),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');
      const { data, error } = await supabase
        .from("wholesale_runners")
        .select('id, full_name, rating, phone, total_deliveries, vehicle_type')
        .eq("tenant_id", tenant.id)
        .eq("status", "available")
        .order("rating", { ascending: false });

      if (error) {
        logger.error('Failed to load available runners', error, { component: 'AssignRunnerDialog' });
        throw error;
      }
      return data;
    },
    enabled: open && !!tenant?.id
  });

  const handleAssign = async () => {
    if (!selectedRunner) return;

    try {
      await assignDelivery.mutateAsync({
        order_id: orderId,
        runner_id: selectedRunner
      });

      onOpenChange(false);
      setSelectedRunner("");
    } catch (error) {
      logger.error('Failed to assign runner', error instanceof Error ? error : new Error(String(error)), { component: 'AssignRunnerDialog' });
      toast.error('Failed to assign runner', {
        description: humanizeError(error),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Runner</DialogTitle>
          <DialogDescription>
            Assign a runner to deliver order {orderNumber}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleAssign(); }} className="space-y-4">
          <div>
            <Label htmlFor="runner">Select Runner <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
            <Select value={selectedRunner} onValueChange={setSelectedRunner}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a runner..." />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <SelectItem value="loading" disabled>Loading runners...</SelectItem>
                ) : isError ? (
                  <SelectItem value="error" disabled>
                    <span className="flex items-center gap-1.5 text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Failed to load runners
                    </span>
                  </SelectItem>
                ) : runners?.length === 0 ? (
                  <SelectItem value="none" disabled>No available runners</SelectItem>
                ) : (
                  runners?.map((runner) => (
                    <SelectItem key={runner.id} value={runner.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{runner.full_name}</span>
                        <div className="ml-4 flex items-center gap-1">
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          <span className="text-xs">{runner.rating?.toFixed(1) || 'N/A'}</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedRunner && runners && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              {(() => {
                const runner = runners.find(r => r.id === selectedRunner);
                return runner ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-medium">{formatPhoneNumber(runner.phone)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Deliveries:</span>
                      <span className="font-medium">{runner.total_deliveries}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rating:</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        <span className="font-medium">{runner.rating?.toFixed(1) || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Vehicle:</span>
                      <span className="font-medium">{runner.vehicle_type}</span>
                    </div>
                  </>
                ) : null;
              })()}
            </div>
          )}

          <DialogFooterActions
            primaryLabel={assignDelivery.isPending ? "Assigning..." : "Assign Runner"}
            onPrimary={handleAssign}
            primaryDisabled={!selectedRunner}
            primaryLoading={assignDelivery.isPending}
            secondaryLabel="Cancel"
            onSecondary={() => onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
