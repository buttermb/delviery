import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { sanitizeFormInput, sanitizeTextareaInput } from "@/lib/utils/sanitize";
import { humanizeError } from "@/lib/humanizeError";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const recallSchema = z.object({
  batch_id: z.string().optional().or(z.literal("")),
  batch_number: z.string().min(1, "Batch number is required").max(100),
  reason: z.string().min(1, "Recall reason is required").max(2000),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["draft", "active", "resolved", "closed"]),
  notification_message: z.string().max(2000).optional().or(z.literal("")),
});

type RecallFormValues = z.infer<typeof recallSchema>;

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

  const form = useForm<RecallFormValues>({
    resolver: zodResolver(recallSchema),
    defaultValues: {
      batch_id: "",
      batch_number: "",
      reason: "",
      severity: "medium",
      status: "draft",
      notification_message: "",
    },
  });

  useEffect(() => {
    if (recall) {
      form.reset({
        batch_id: recall.batch_id || "",
        batch_number: recall.batch_number || "",
        reason: recall.reason,
        severity: recall.severity as RecallFormValues["severity"],
        status: recall.status as RecallFormValues["status"],
        notification_message: "",
      });
    } else {
      form.reset({
        batch_id: "",
        batch_number: "",
        reason: "",
        severity: "medium",
        status: "draft",
        notification_message: "",
      });
    }
  }, [recall, open, form]);

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
              affected_customers: data.affected_customers ?? 0,
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
      toast.error(recall ? "Failed to update recall" : "Failed to create recall", { description: humanizeError(error) });
    },
  });

  const onSubmit = async (values: RecallFormValues) => {
    let productName = "Unknown Product";
    if (values.batch_id) {
      const { data: batch } = await supabase
        .from("inventory_batches")
        .select("product_id, products(name)")
        .eq("id", values.batch_id)
        .maybeSingle();

      if (batch && (batch as { products?: { name: string } }).products) {
        productName = (batch as { products: { name: string } }).products.name;
      }
    }

    await createMutation.mutateAsync({
      batch_id: values.batch_id || null,
      batch_number: sanitizeFormInput(values.batch_number, 100),
      product_name: sanitizeFormInput(productName, 200),
      recall_reason: sanitizeTextareaInput(values.reason, 2000),
      severity: values.severity,
      status: values.status,
      affected_customers: 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recall ? "Edit Recall" : "Create New Recall"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="batch_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Batch Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., BD-2024-001"
                      className="min-h-[44px] touch-manipulation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Recall Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Detailed reason for the recall"
                      rows={4}
                      className="min-h-[44px] touch-manipulation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px] touch-manipulation">
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px] touch-manipulation">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notification_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Notification Message (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Message to send to affected customers"
                      rows={3}
                      className="min-h-[44px] touch-manipulation"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
