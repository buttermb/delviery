import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAssignDelivery } from "@/hooks/useWholesaleData";
import { useState } from "react";
import { Star } from "lucide-react";

interface AssignRunnerDialogProps {
  orderId: string;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignRunnerDialog({ orderId, orderNumber, open, onOpenChange }: AssignRunnerDialogProps) {
  const [selectedRunner, setSelectedRunner] = useState("");
  const assignDelivery = useAssignDelivery();

  const { data: runners, isLoading } = useQuery({
    queryKey: ["available-runners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_runners")
        .select("*")
        .eq("status", "available")
        .order("rating", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  const handleAssign = async () => {
    if (!selectedRunner) return;

    await assignDelivery.mutateAsync({
      order_id: orderId,
      runner_id: selectedRunner
    });

    onOpenChange(false);
    setSelectedRunner("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🚚 Assign Runner</DialogTitle>
          <DialogDescription>
            Assign a runner to deliver order {orderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="runner">Select Runner *</Label>
            <Select value={selectedRunner} onValueChange={setSelectedRunner}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a runner..." />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <SelectItem value="loading" disabled>Loading runners...</SelectItem>
                ) : runners?.length === 0 ? (
                  <SelectItem value="none" disabled>No available runners</SelectItem>
                ) : (
                  runners?.map((runner) => (
                    <SelectItem key={runner.id} value={runner.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{runner.full_name}</span>
                        <div className="ml-4 flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
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
                      <span className="font-medium">{runner.phone}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Deliveries:</span>
                      <span className="font-medium">{runner.total_deliveries}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rating:</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
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

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleAssign} 
              disabled={!selectedRunner || assignDelivery.isPending} 
              className="flex-1"
            >
              {assignDelivery.isPending ? "Assigning..." : "Assign Runner"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
