import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { sanitizeCouponCode, sanitizeTextareaInput } from "@/lib/utils/sanitize";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { humanizeError } from '@/lib/humanizeError';
import { Loader2, RefreshCw } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import type { Database } from "@/integrations/supabase/types";

type Coupon = Database['public']['Tables']['coupon_codes']['Row'];
type CouponInsert = Database['public']['Tables']['coupon_codes']['Insert'];
type CouponUpdate = Database['public']['Tables']['coupon_codes']['Update'];

interface CouponCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon?: Coupon | null;
  onSuccess?: () => void;
}

const generateCouponCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export function CouponCreateForm({ open, onOpenChange, coupon, onSuccess }: CouponCreateFormProps) {
  const { tenant: _tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed" | "free_shipping" | "bogo",
    discount_value: 10,
    description: "",
    start_date: "",
    end_date: "",
    never_expires: false,
    min_purchase: "",
    max_discount: "",
    total_usage_limit: "",
    per_user_limit: "",
    first_time_only: false,
    auto_apply: false,
  });

  useEffect(() => {
    if (coupon && open) {
      setFormData({
        code: coupon.code || "",
        discount_type: (coupon.discount_type as "percentage" | "fixed") || "percentage",
        discount_value: coupon.discount_value ?? 0,
        description: coupon.description || "",
        start_date: coupon.start_date ? new Date(coupon.start_date).toISOString().split("T")[0] : "",
        end_date: coupon.end_date ? new Date(coupon.end_date).toISOString().split("T")[0] : "",
        never_expires: coupon.never_expires ?? false,
        min_purchase: coupon.min_purchase?.toString() || "",
        max_discount: coupon.max_discount?.toString() || "",
        total_usage_limit: coupon.total_usage_limit?.toString() || "",
        per_user_limit: coupon.per_user_limit?.toString() || "",
        first_time_only: false, // Add this field if needed
        auto_apply: coupon.auto_apply ?? false,
      });
    } else if (open) {
      setFormData({
        code: generateCouponCode(),
        discount_type: "percentage",
        discount_value: 10,
        description: "",
        start_date: "",
        end_date: "",
        never_expires: false,
        min_purchase: "",
        max_discount: "",
        total_usage_limit: "",
        per_user_limit: "",
        first_time_only: false,
        auto_apply: false,
      });
    }
  }, [coupon, open]);

  const createMutation = useMutation({
    mutationFn: async (data: CouponInsert) => {
      const { error } = await supabase.from("coupon_codes").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coupons.lists() });
      toast.success("Coupon created successfully");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to create coupon', error, { component: 'CouponCreateForm' });
      toast.error("Failed to create coupon", { description: humanizeError(error) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CouponUpdate) => {
      if (!coupon?.id) throw new Error("Coupon ID is required");

      const { error } = await supabase
        .from("coupon_codes")
        .update(data)
        .eq("id", coupon.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coupons.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.coupons.detail(coupon!.id) });
      toast.success("Coupon updated successfully");
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to update coupon', error, { component: 'CouponCreateForm' });
      toast.error("Failed to update coupon", { description: humanizeError(error) });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }

    if (formData.discount_value <= 0) {
      toast.error("Discount value must be greater than 0");
      return;
    }

    const isEditing = !!coupon;

    const couponData: CouponInsert | CouponUpdate = {
      code: sanitizeCouponCode(formData.code),
      discount_type: formData.discount_type,
      discount_value: formData.discount_value,
      description: formData.description ? sanitizeTextareaInput(formData.description, 500) : null,
      start_date: formData.start_date || null,
      end_date: formData.never_expires ? null : (formData.end_date || null),
      never_expires: formData.never_expires,
      min_purchase: formData.min_purchase ? parseFloat(formData.min_purchase) : null,
      max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
      total_usage_limit: formData.total_usage_limit ? parseInt(formData.total_usage_limit) : null,
      per_user_limit: formData.per_user_limit ? parseInt(formData.per_user_limit) : null,
      auto_apply: formData.auto_apply,
      status: "active" as const,
      created_by: admin?.id || null,
      updated_at: new Date().toISOString(),
    };

    if (isEditing) {
      await updateMutation.mutateAsync(couponData);
    } else {
      await createMutation.mutateAsync(couponData as Database['public']['Tables']['coupon_codes']['Insert']);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {coupon ? "Edit Coupon" : "Create New Coupon"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">
                Coupon Code <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="SAVE10"
                  required
                  className="min-h-[44px] touch-manipulation"
                />
                {!coupon && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormData({ ...formData, code: generateCouponCode() })}
                    className="min-h-[44px] touch-manipulation"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount_type">
                Discount Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.discount_type}
                onValueChange={(value: typeof formData.discount_type) =>
                  setFormData({ ...formData, discount_type: value })
                }
              >
                <SelectTrigger className="min-h-[44px] touch-manipulation">
                  <SelectValue placeholder="Select coupon type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage Off</SelectItem>
                  <SelectItem value="fixed">Fixed Amount Off</SelectItem>
                  <SelectItem value="free_shipping">Free Shipping</SelectItem>
                  <SelectItem value="bogo">Buy One Get One</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount_value">
                Discount Value <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput
                id="discount_value"
                showPrefix={formData.discount_type !== "percentage"}
                value={formData.discount_value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    discount_value: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder={formData.discount_type === "percentage" ? "10" : "5.00"}
                required
                className="min-h-[44px] touch-manipulation"
              />
              <p className="text-xs text-muted-foreground">
                {formData.discount_type === "percentage"
                  ? "Percentage (e.g., 10 for 10%)"
                  : "Fixed amount in dollars"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_purchase">Minimum Purchase</Label>
              <CurrencyInput
                id="min_purchase"
                value={formData.min_purchase}
                onChange={(e) =>
                  setFormData({ ...formData, min_purchase: e.target.value })
                }
                placeholder="0.00"
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
                disabled={formData.never_expires}
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_usage_limit">Total Usage Limit</Label>
              <Input
                id="total_usage_limit"
                type="number"
                min="1"
                value={formData.total_usage_limit}
                onChange={(e) =>
                  setFormData({ ...formData, total_usage_limit: e.target.value })
                }
                placeholder="Unlimited"
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="per_user_limit">Per User Limit</Label>
              <Input
                id="per_user_limit"
                type="number"
                min="1"
                value={formData.per_user_limit}
                onChange={(e) =>
                  setFormData({ ...formData, per_user_limit: e.target.value })
                }
                placeholder="Unlimited"
                className="min-h-[44px] touch-manipulation"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe this coupon"
                rows={2}
                className="min-h-[44px] touch-manipulation"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Never Expires</Label>
                <p className="text-sm text-muted-foreground">
                  This coupon will not expire
                </p>
              </div>
              <Switch
                checked={formData.never_expires}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, never_expires: checked })
                }
                aria-label="Never expires"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto Apply</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically apply this coupon to eligible orders
                </p>
              </div>
              <Switch
                checked={formData.auto_apply}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, auto_apply: checked })
                }
                aria-label="Auto apply"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="min-h-[44px] touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] touch-manipulation"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {coupon ? "Update Coupon" : "Create Coupon"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

