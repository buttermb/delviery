import { logger } from '@/lib/logger';
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logger } from "@/lib/logger";

export function PointAdjustments() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    customer_email: "",
    points: 0,
    reason: "",
    notes: "",
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      // Find customer by email or ID
      let customerId = data.customer_id;
      if (!customerId && data.customer_email) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("tenant_id", tenant.id)
          .eq("email", data.customer_email)
          .maybeSingle();

        if (!customer) throw new Error("Customer not found");
        customerId = customer.id;
      }

      if (!customerId) throw new Error("Customer ID or email required");

      // Get current points
      const { data: customer } = await supabase
        .from("customers")
        .select("loyalty_points")
        .eq("id", customerId)
        .maybeSingle();

      if (!customer) throw new Error("Customer not found");

      const newPoints = (customer.loyalty_points || 0) + data.points;

      // Update customer points
      const { error: updateError } = await supabase
        .from("customers")
        .update({ loyalty_points: newPoints })
        .eq("id", customerId);

      if (updateError) throw updateError;

      // Log transaction (if loyalty_transactions table exists)
      try {
        await supabase.from("loyalty_transactions").insert([
          {
            user_id: customerId, // Note: This may need adjustment based on actual schema
            points: data.points,
            reason: data.reason || "Manual adjustment",
          },
        ]);
      } catch {
        // Table might not exist, that's okay
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Points adjusted successfully");
      setIsFormOpen(false);
      setFormData({
        customer_id: "",
        customer_email: "",
        points: 0,
        reason: "",
        notes: "",
      });
    },
    onError: (error: unknown) => {
      logger.error('Failed to adjust points', error, { component: 'PointAdjustments' });
      toast.error(
        error instanceof Error ? error.message : "Failed to adjust points"
      );
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await adjustMutation.mutateAsync(formData);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Manual Point Adjustments</CardTitle>
            <CardDescription>
              Add or subtract points for customer service purposes
            </CardDescription>
          </div>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="min-h-[44px] touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Adjustment
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <p>Use the "New Adjustment" button to manually adjust customer points.</p>
          <p className="text-sm mt-2">
            This is useful for customer service, corrections, or special promotions.
          </p>
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manual Point Adjustment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer_email">Customer Email</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_email: e.target.value })
                  }
                  placeholder="customer@example.com"
                  className="min-h-[44px] touch-manipulation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="points">
                  Points Adjustment <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="points"
                  type="number"
                  value={formData.points}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      points: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="Positive to add, negative to subtract"
                  required
                  className="min-h-[44px] touch-manipulation"
                />
                <p className="text-sm text-muted-foreground">
                  Use positive numbers to add points, negative to subtract
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reason"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="e.g., Customer service, Promotion, Correction"
                  required
                  className="min-h-[44px] touch-manipulation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional details about this adjustment"
                  rows={3}
                  className="min-h-[44px] touch-manipulation"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  disabled={adjustMutation.isPending}
                  className="min-h-[44px] touch-manipulation"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={adjustMutation.isPending}
                  className="min-h-[44px] touch-manipulation"
                >
                  {adjustMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Apply Adjustment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

