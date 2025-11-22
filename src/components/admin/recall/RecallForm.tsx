import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

interface Recall {
  id: string;
  batch_id: string;
  batch_number: string;
  reason: string;
  severity: string;
  status: string;
}

interface RecallFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recall?: Recall | null;
  onSuccess?: () => void;
}

export function RecallForm({
  open,
  onOpenChange,
  recall,
  onSuccess,
}: RecallFormProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    batch_id: "",
    batch_number: "",
    reason: "",
    severity: "medium",
    status: "draft",
    notification_message: "",
  });

  useEffect(() => {
    if (recall) {
      setFormData({
        batch_id: recall.batch_id || "",
        batch_number: recall.batch_number || "",
        reason: recall.reason,
        severity: recall.severity,
        status: recall.status,
        notification_message: "",
      });
    } else {
      setFormData({
        batch_id: "",
        batch_number: "",
        reason: "",
        severity: "medium",
        status: "draft",
        notification_message: "",
      });
    }
  }, [recall, open]);

  const createMutation = useMutation({
    mutationFn: async (data: { batch_id?: string | null; batch_number: string; product_name: string; recall_reason: string; severity: string; status: string; affected_customers?: number }) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      try {
        if (recall) {
          const { error } = await supabase
            .from("batch_recalls")
            .update(data)
            .eq("id", recall.id);

          if (error && error.code !== "42P01") throw error;
        } else {
          const { error } = await supabase.from("batch_recalls").insert([
            {
              tenant_id: tenant.id,
              batch_number: data.batch_number,
              product_name: data.product_name,
              recall_reason: data.recall_reason,
              severity: data.severity,
              status: data.status,
              affected_customers: data.affected_customers || 0,
              created_by: admin?.id || null,
            },
          ]);

          if (error && error.code !== "42P01") throw error;
        }
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code !== "42P01") throw error;
        logger.warn('Batch recalls table does not exist yet', { component: 'RecallForm' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recall.lists() });
      toast.success(recall ? "Recall updated successfully" : "Recall created successfully");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to save recall', error, { component: 'RecallForm' });
      toast.error(recall ? "Failed to update recall" : "Failed to create recall");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.batch_number || !formData.reason) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Get product name from batch if batch_id is provided
    let productName = "Unknown Product";
    if (formData.batch_id) {
      const { data: batch } = await supabase
        .from("inventory_batches")
        .select("product_id, products(name)")
        .eq("id", formData.batch_id)
        .maybeSingle();
      
      if (batch && (batch as { products?: { name: string } }).products) {
        productName = (batch as { products: { name: string } }).products.name;
      }
    }

    await createMutation.mutateAsync({
      batch_id: formData.batch_id || null,
      batch_number: formData.batch_number,
      product_name: productName,
      recall_reason: formData.reason,
      severity: formData.severity,
      status: formData.status,
      affected_customers: 0, // Would be calculated from traceability
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recall ? "Edit Recall" : "Create New Recall"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batch_number">
              Batch Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="batch_number"
              value={formData.batch_number}
              onChange={(e) =>
                setFormData({ ...formData, batch_number: e.target.value })
              }
              placeholder="e.g., BD-2024-001"
              required
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Recall Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              placeholder="Detailed reason for the recall"
              rows={4}
              required
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) =>
                  setFormData({ ...formData, severity: value })
                }
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notification_message">Customer Notification Message (Optional)</Label>
            <Textarea
              id="notification_message"
              value={formData.notification_message}
              onChange={(e) =>
                setFormData({ ...formData, notification_message: e.target.value })
              }
              placeholder="Message to send to affected customers"
              rows={3}
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {recall ? "Update Recall" : "Create Recall"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

