import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateDeliveryStatus } from "@/hooks/useWholesaleData";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "assigned", label: "Assigned", variant: "secondary" as const },
  { value: "picked_up", label: "Picked Up", variant: "default" as const },
  { value: "in_transit", label: "In Transit", variant: "default" as const },
  { value: "delivered", label: "Delivered", variant: "default" as const },
  { value: "failed", label: "Failed", variant: "destructive" as const }
] as const;

type StatusValue = typeof STATUS_OPTIONS[number]['value'];

interface DeliveryStatusDialogProps {
  deliveryId: string;
  currentStatus: string;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Validate and normalize status value
function getValidStatus(status: string): StatusValue {
  const validValues = STATUS_OPTIONS.map(s => s.value);
  if (validValues.includes(status as StatusValue)) {
    return status as StatusValue;
  }
  return "assigned"; // Default to assigned if invalid
}

export function DeliveryStatusDialog({
  deliveryId,
  currentStatus,
  orderNumber,
  open,
  onOpenChange
}: DeliveryStatusDialogProps) {
  const validCurrentStatus = getValidStatus(currentStatus);
  const [newStatus, setNewStatus] = useState<StatusValue>(validCurrentStatus);
  const [notes, setNotes] = useState("");
  const updateStatus = useUpdateDeliveryStatus();

  // Sync status when dialog opens or currentStatus changes
  useEffect(() => {
    if (open) {
      setNewStatus(getValidStatus(currentStatus));
      setNotes("");
    }
  }, [open, currentStatus]);

  const handleSubmit = async () => {
    try {
      await updateStatus.mutateAsync({
        delivery_id: deliveryId,
        status: newStatus,
        notes: notes || undefined
      });

      onOpenChange(false);
      setNotes("");
    } catch {
      toast.error('Failed to update delivery status');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Delivery Status</DialogTitle>
          <DialogDescription>
            Update status for order {orderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Current Status</Label>
            <div className="mt-2">
              <Badge variant={STATUS_OPTIONS.find(s => s.value === validCurrentStatus)?.variant ?? "secondary"}>
                {STATUS_OPTIONS.find(s => s.value === validCurrentStatus)?.label ?? currentStatus}
              </Badge>
            </div>
          </div>

          <div>
            <Label htmlFor="status">New Status *</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as StatusValue)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this status update..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={newStatus === validCurrentStatus || updateStatus.isPending}
              className="flex-1"
            >
              {updateStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {updateStatus.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
