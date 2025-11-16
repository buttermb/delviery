import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

interface Batch {
  id: string;
  batch_number: string;
}

interface QuarantineManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch;
  onSuccess?: () => void;
}

export function QuarantineManager({
  open,
  onOpenChange,
  batch,
  onSuccess,
}: QuarantineManagerProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const quarantineMutation = useMutation({
    mutationFn: async (data: { status: string; notes?: string }) => {
      const { error } = await supabase
        .from("inventory_batches")
        .update(data)
        .eq("id", batch.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.lists() });
      toast.success("Batch quarantined successfully");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to quarantine batch', error, { component: 'QuarantineManager' });
      toast.error("Failed to quarantine batch");
    },
  });

  const handleQuarantine = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for quarantine");
      return;
    }

    await quarantineMutation.mutateAsync({
      status: "quarantined",
      notes: reason,
    });
  };

  const handleRelease = async () => {
    await quarantineMutation.mutateAsync({
      status: "active",
      notes: "Released from quarantine",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Quarantine Management - {batch.batch_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Quarantine Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this batch is being quarantined..."
              rows={4}
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={quarantineMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleRelease}
              disabled={quarantineMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              Release from Quarantine
            </Button>
            <Button
              onClick={handleQuarantine}
              disabled={quarantineMutation.isPending}
              variant="destructive"
              className="min-h-[44px] touch-manipulation"
            >
              {quarantineMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Quarantine Batch
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

