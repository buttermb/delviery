import { logger } from '@/lib/logger';
import { useState } from "react";
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
import { toast } from "sonner";
import { humanizeError } from '@/lib/humanizeError';
import { Loader2 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";

interface BulkCouponGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const generateCouponCode = (prefix: string, index: number) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = prefix.toUpperCase();
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${code}${index.toString().padStart(2, "0")}`;
};

export function BulkCouponGenerator({ open, onOpenChange }: BulkCouponGeneratorProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    count: 10,
    prefix: "BULK",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: 10,
    start_date: "",
    end_date: "",
    min_purchase: "",
  });

  const generateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      const coupons = [];
      for (let i = 0; i < data.count; i++) {
        coupons.push({
          code: generateCouponCode(data.prefix, i + 1),
          discount_type: data.discount_type,
          discount_value: data.discount_value,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          min_purchase: data.min_purchase ? parseFloat(data.min_purchase) : null,
          status: "active",
          created_by: admin?.id || null,
        });
      }

      const { error } = await (supabase as any).from("coupon_codes").insert(coupons);
      if (error) throw error;

      return coupons.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coupons.lists() });
      toast.success(`Successfully generated ${count} coupons`);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      logger.error('Failed to generate bulk coupons', error, { component: 'BulkCouponGenerator' });
      toast.error("Failed to generate coupons", { description: humanizeError(error) });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await generateMutation.mutateAsync(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Coupon Generator</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="count">
                Number of Coupons <span className="text-destructive">*</span>
              </Label>
              <Input
                id="count"
                type="number"
                min="1"
                max="100"
                value={formData.count}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    count: parseInt(e.target.value) || 1,
                  })
                }
                required
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prefix">Code Prefix</Label>
              <Input
                id="prefix"
                value={formData.prefix}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    prefix: e.target.value.toUpperCase().slice(0, 4),
                  })
                }
                placeholder="BULK"
                maxLength={4}
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount_type">Discount Type</Label>
              <select
                id="discount_type"
                value={formData.discount_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    discount_type: e.target.value as typeof formData.discount_type,
                  })
                }
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount_value">Discount Value</Label>
              <Input
                id="discount_value"
                type="number"
                min="0"
                step="0.01"
                value={formData.discount_value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    discount_value: parseFloat(e.target.value) || 0,
                  })
                }
                required
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="min_purchase">Minimum Purchase</Label>
              <Input
                id="min_purchase"
                type="number"
                min="0"
                step="0.01"
                value={formData.min_purchase}
                onChange={(e) =>
                  setFormData({ ...formData, min_purchase: e.target.value })
                }
                placeholder="Optional"
                className="min-h-[44px] touch-manipulation"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={generateMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={generateMutation.isPending}
              className="min-h-[44px] touch-manipulation"
            >
              {generateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Generate {formData.count} Coupons
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

