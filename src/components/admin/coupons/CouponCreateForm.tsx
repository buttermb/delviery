import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { sanitizeCouponCode, sanitizeTextareaInput } from "@/lib/utils/sanitize";
import { humanizeError } from "@/lib/humanizeError";
import type { Database } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { Loader2, RefreshCw } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

type Coupon = Database['public']['Tables']['coupon_codes']['Row'];
type CouponInsert = Database['public']['Tables']['coupon_codes']['Insert'];
type CouponUpdate = Database['public']['Tables']['coupon_codes']['Update'];

const couponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(50),
  discount_type: z.enum(["percentage", "fixed", "free_shipping", "bogo"]),
  discount_value: z.number().positive("Discount value must be greater than 0"),
  description: z.string().max(500).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  end_date: z.string().optional().or(z.literal("")),
  never_expires: z.boolean(),
  min_purchase: z.string().optional().or(z.literal("")),
  max_discount: z.string().optional().or(z.literal("")),
  total_usage_limit: z.string().optional().or(z.literal("")),
  per_user_limit: z.string().optional().or(z.literal("")),
  auto_apply: z.boolean(),
});

type CouponFormValues = z.infer<typeof couponSchema>;

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
  const { admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: "",
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
      auto_apply: false,
    },
  });

  useEffect(() => {
    if (coupon && open) {
      form.reset({
        code: coupon.code || "",
        discount_type: (coupon.discount_type as CouponFormValues["discount_type"]) || "percentage",
        discount_value: coupon.discount_value ?? 0,
        description: coupon.description || "",
        start_date: coupon.start_date ? new Date(coupon.start_date).toISOString().split("T")[0] : "",
        end_date: coupon.end_date ? new Date(coupon.end_date).toISOString().split("T")[0] : "",
        never_expires: coupon.never_expires ?? false,
        min_purchase: coupon.min_purchase?.toString() || "",
        max_discount: coupon.max_discount?.toString() || "",
        total_usage_limit: coupon.total_usage_limit?.toString() || "",
        per_user_limit: coupon.per_user_limit?.toString() || "",
        auto_apply: coupon.auto_apply ?? false,
      });
    } else if (open) {
      form.reset({
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
        auto_apply: false,
      });
    }
  }, [coupon, open, form]);

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

  const onSubmit = async (values: CouponFormValues) => {
    const couponData: CouponInsert | CouponUpdate = {
      code: sanitizeCouponCode(values.code),
      discount_type: values.discount_type,
      discount_value: values.discount_value,
      description: values.description ? sanitizeTextareaInput(values.description, 500) : null,
      start_date: values.start_date || null,
      end_date: values.never_expires ? null : (values.end_date || null),
      never_expires: values.never_expires,
      min_purchase: values.min_purchase ? parseFloat(values.min_purchase) : null,
      max_discount: values.max_discount ? parseFloat(values.max_discount) : null,
      total_usage_limit: values.total_usage_limit ? parseInt(values.total_usage_limit) : null,
      per_user_limit: values.per_user_limit ? parseInt(values.per_user_limit) : null,
      auto_apply: values.auto_apply,
      status: "active" as const,
      created_by: admin?.id || null,
      updated_at: new Date().toISOString(),
    };

    if (coupon) {
      await updateMutation.mutateAsync(couponData);
    } else {
      await createMutation.mutateAsync(couponData as CouponInsert);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const watchDiscountType = form.watch("discount_type");
  const watchNeverExpires = form.watch("never_expires");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {coupon ? "Edit Coupon" : "Create New Coupon"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Coupon Code</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          placeholder="SAVE10"
                          className="min-h-[44px] touch-manipulation"
                        />
                      </FormControl>
                      {!coupon && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => form.setValue("code", generateCouponCode())}
                          className="min-h-[44px] touch-manipulation"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discount_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Discount Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px] touch-manipulation">
                          <SelectValue placeholder="Select coupon type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage Off</SelectItem>
                        <SelectItem value="fixed">Fixed Amount Off</SelectItem>
                        <SelectItem value="free_shipping">Free Shipping</SelectItem>
                        <SelectItem value="bogo">Buy One Get One</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discount_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Discount Value</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        showPrefix={watchDiscountType !== "percentage"}
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder={watchDiscountType === "percentage" ? "10" : "5.00"}
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormDescription>
                      {watchDiscountType === "percentage"
                        ? "Percentage (e.g., 10 for 10%)"
                        : "Fixed amount in dollars"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_purchase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Purchase</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        {...field}
                        placeholder="0.00"
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        disabled={watchNeverExpires}
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="total_usage_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Usage Limit</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="per_user_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Per User Limit</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe this coupon"
                        rows={2}
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <FormField
                control={form.control}
                name="never_expires"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Never Expires</FormLabel>
                      <FormDescription>
                        This coupon will not expire
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Never expires"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="auto_apply"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Auto Apply</FormLabel>
                      <FormDescription>
                        Automatically apply this coupon to eligible orders
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Auto apply"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
