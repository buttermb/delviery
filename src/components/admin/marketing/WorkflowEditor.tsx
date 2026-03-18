import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { MarketingWorkflow } from "@/components/admin/marketing/types";
import { logger } from "@/lib/logger";
import { humanizeError } from "@/lib/humanizeError";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { Plus, Zap, MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const workflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional(),
  trigger_type: z.string().min(1, "Trigger type is required"),
});

type WorkflowFormData = z.infer<typeof workflowSchema>;

const TRIGGER_TYPES = [
  { value: "customer_signup", label: "Customer Signup" },
  { value: "first_purchase", label: "First Purchase" },
  { value: "repeat_purchase", label: "Repeat Purchase" },
  { value: "cart_abandoned", label: "Cart Abandoned" },
  { value: "inactivity", label: "Customer Inactivity (30 days)" },
  { value: "birthday", label: "Customer Birthday" },
] as const;

export function WorkflowEditor() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: queryKeys.marketing.workflows(),
    queryFn: async () => {
      if (!tenant?.id) return [];
      try {
        const { data, error } = await supabase
          .from("marketing_workflows")
          .select("id, name, description, trigger_type, trigger_conditions, actions, status, run_count, last_run_at, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data as MarketingWorkflow[]) ?? [];
      } catch (error) {
        logger.error("Failed to fetch workflows", error, { component: "WorkflowEditor" });
        return [];
      }
    },
    enabled: !!tenant?.id,
    staleTime: 120_000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<WorkflowFormData>({
    resolver: zodResolver(workflowSchema),
    defaultValues: { name: "", description: "", trigger_type: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: WorkflowFormData) => {
      if (!tenant?.id) throw new Error("Tenant ID required");
      const { error } = await supabase.from("marketing_workflows").insert({
        tenant_id: tenant.id,
        name: data.name,
        description: data.description || null,
        trigger_type: data.trigger_type,
        status: "draft",
        created_by: admin?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketing.workflows() });
      toast.success("Workflow created");
      setIsCreating(false);
      reset();
    },
    onError: (error: unknown) => {
      logger.error("Failed to create workflow", error, { component: "WorkflowEditor" });
      toast.error("Failed to create workflow", { description: humanizeError(error) });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      if (!tenant?.id) throw new Error("No tenant");
      const { error } = await supabase
        .from("marketing_workflows")
        .update({ status: newStatus })
        .eq("id", id)
        .eq("tenant_id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketing.workflows() });
      toast.success("Workflow status updated");
    },
    onError: (error) => {
      toast.error(humanizeError(error, "Failed to update workflow"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant?.id) throw new Error("No tenant");
      const { error } = await supabase
        .from("marketing_workflows")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketing.workflows() });
      toast.success("Workflow deleted");
    },
    onError: (error) => {
      toast.error(humanizeError(error, "Failed to delete workflow"));
    },
  });

  const onSubmit = (data: WorkflowFormData) => {
    createMutation.mutate(data);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active": return "default" as const;
      case "paused": return "secondary" as const;
      default: return "outline" as const;
    }
  };

  const getTriggerLabel = (triggerType: string) =>
    TRIGGER_TYPES.find((t) => t.value === triggerType)?.label ?? triggerType;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Automated Workflows</CardTitle>
            <CardDescription>
              Set up automated email/SMS sequences triggered by customer actions
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreating(true)} className="min-h-[44px] touch-manipulation">
            <Plus className="h-4 w-4 mr-2" />
            New Workflow
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={`skeleton-${i}`} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No workflows configured.</p>
            <p className="text-sm mt-2">
              Create workflows for welcome series, win-back campaigns, and reorder reminders.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{workflow.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Trigger: {getTriggerLabel(workflow.trigger_type)}
                    {workflow.run_count ? ` · ${workflow.run_count} runs` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(workflow.status)}>
                    {workflow.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Workflow actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {workflow.status === "active" ? (
                        <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ id: workflow.id, newStatus: "paused" })}>
                          Pause
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ id: workflow.id, newStatus: "active" })}>
                          Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => { setWorkflowToDelete(workflow.id); setDeleteDialogOpen(true); }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Workflow Dialog */}
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wf-name">
                  Workflow Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wf-name"
                  {...register("name")}
                  placeholder="e.g., Welcome Series"
                  className="min-h-[44px] touch-manipulation"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="wf-trigger">
                  Trigger <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch("trigger_type")}
                  onValueChange={(v) => setValue("trigger_type", v)}
                >
                  <SelectTrigger className="min-h-[44px] touch-manipulation">
                    <SelectValue placeholder="Select a trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.trigger_type && (
                  <p className="text-xs text-destructive">{errors.trigger_type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="wf-description">Description (Optional)</Label>
                <Textarea
                  id="wf-description"
                  {...register("description")}
                  placeholder="Describe what this workflow does..."
                  rows={3}
                  className="min-h-[44px] touch-manipulation"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsCreating(false); reset(); }}
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
                  Create Workflow
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={() => {
            if (workflowToDelete) {
              deleteMutation.mutate(workflowToDelete);
              setDeleteDialogOpen(false);
              setWorkflowToDelete(null);
            }
          }}
          itemType="workflow"
          isLoading={deleteMutation.isPending}
        />
      </CardContent>
    </Card>
  );
}
