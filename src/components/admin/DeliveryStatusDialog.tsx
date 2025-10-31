import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateDeliveryStatus } from "@/hooks/useWholesaleData";
import { Badge } from "@/components/ui/badge";

interface DeliveryStatusDialogProps {
  deliveryId: string;
  currentStatus: string;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "assigned", label: "📋 Assigned", variant: "secondary" as const },
  { value: "picked_up", label: "📦 Picked Up", variant: "default" as const },
  { value: "in_transit", label: "🚚 In Transit", variant: "default" as const },
  { value: "delivered", label: "✅ Delivered", variant: "default" as const },
  { value: "failed", label: "❌ Failed", variant: "destructive" as const }
];

export function DeliveryStatusDialog({ 
  deliveryId, 
  currentStatus, 
  orderNumber, 
  open, 
  onOpenChange 
}: DeliveryStatusDialogProps) {
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [notes, setNotes] = useState("");
  const updateStatus = useUpdateDeliveryStatus();

  const handleSubmit = async () => {
    await updateStatus.mutateAsync({
      delivery_id: deliveryId,
      status: newStatus,
      notes: notes || undefined
    });

    onOpenChange(false);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>📍 Update Delivery Status</DialogTitle>
          <DialogDescription>
            Update status for order {orderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Current Status</Label>
            <div className="mt-2">
              <Badge variant={statusOptions.find(s => s.value === currentStatus)?.variant}>
                {statusOptions.find(s => s.value === currentStatus)?.label}
              </Badge>
            </div>
          </div>

          <div>
            <Label htmlFor="status">New Status *</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
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

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={newStatus === currentStatus || updateStatus.isPending} 
              className="flex-1"
            >
              {updateStatus.isPending ? "Updating..." : "Update Status"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
