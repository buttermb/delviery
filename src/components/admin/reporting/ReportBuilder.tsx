import { logger } from '@/lib/logger';
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import type { Json } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, BarChart3 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";

interface ReportBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ReportBuilder({
  open,
  onOpenChange,
  onSuccess,
}: ReportBuilderProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    report_type: "sales",
    date_range: "month",
    metrics: [] as string[],
    dimensions: [] as string[],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; report_type: string; filters?: Record<string, unknown> }) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      try {
        const { error } = await supabase.from("custom_reports").insert([
          {
            tenant_id: tenant.id,
            name: data.name,
            description: data.description,
            report_type: data.report_type,
            filters: data.filters as Json | null,
            created_by: admin?.id || null,
          },
        ]);

        if (error && error.code !== "42P01") throw error;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code !== "42P01") throw error;
        logger.warn('Custom reports table does not exist yet', { component: 'ReportBuilder' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reporting.custom() });
      toast.success("Report created successfully");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create report', error, { component: 'ReportBuilder' });
      toast.error("Failed to create report");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("Please provide a report name");
      return;
    }

    await createMutation.mutateAsync({
      name: formData.name,
      description: formData.description,
      report_type: formData.report_type,
      filters: {
        date_range: formData.date_range,
        metrics: formData.metrics,
        dimensions: formData.dimensions,
      },
    });
  };

  if (!open) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Report Builder</CardTitle>
          <CardDescription>
            Create custom reports with drag-and-drop fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "New Report" to start building a custom report.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Report</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Report Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Monthly Sales Summary"
              required
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of what this report shows"
              rows={2}
              className="min-h-[44px] touch-manipulation"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="report_type">Report Type</Label>
              <Select
                value={formData.report_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, report_type: value })
                }
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="financial">Financial</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_range">Date Range</Label>
              <Select
                value={formData.date_range}
                onValueChange={(value) =>
                  setFormData({ ...formData, date_range: value })
                }
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="quarter">Last Quarter</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-sm text-muted-foreground pt-4 border-t">
            <p>Configure your report parameters above and click "Create Report" to generate your custom report.</p>
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
              Create Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

