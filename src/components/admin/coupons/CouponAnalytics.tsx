import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { logger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign, Users, Tag } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Coupon = Database['public']['Tables']['coupon_codes']['Row'];

interface CouponAnalyticsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupons: Coupon[];
}

export function CouponAnalytics({ open, onOpenChange, coupons }: CouponAnalyticsProps) {
  const { tenant } = useTenantAdminAuth();

  const { data: usageStats, isLoading } = useQuery({
    queryKey: queryKeys.couponAnalyticsData.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return null;

      try {
        const { data: usage, error } = await supabase
          .from("coupon_usage")
          .select("coupon_id, discount_amount");

        if (error) {
          logger.error('Failed to fetch coupon usage', error, { component: 'CouponAnalytics' });
          return null;
        }

        if (!usage) return null;

        const totalRedemptions = usage.length;
        const totalDiscountGiven = usage.reduce(
          (sum, u) => sum + (u.discount_amount ?? 0),
          0
        );

        const couponStats = coupons.map((coupon) => {
          const couponUsage = usage.filter((u) => u.coupon_id === coupon.id);
          return {
            coupon_id: coupon.id,
            code: coupon.code,
            redemptions: couponUsage.length,
            total_discount: couponUsage.reduce(
              (sum, u) => sum + (u.discount_amount ?? 0),
              0
            ),
            redemption_rate:
              coupon.total_usage_limit && coupon.total_usage_limit > 0
                ? (couponUsage.length / coupon.total_usage_limit) * 100
                : null,
          };
        });

        return {
          totalRedemptions,
          totalDiscountGiven,
          couponStats,
        };
      } catch {
        return null;
      }
    },
    enabled: open && !!tenant?.id,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Coupon Analytics</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : usageStats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Redemptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {usageStats.totalRedemptions}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Discount Given</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {usageStats.totalDiscountGiven.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Active Coupons</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    {coupons.filter((c) => c.status === "active").length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Coupon Performance</CardTitle>
                <CardDescription>
                  Individual coupon redemption statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usageStats.couponStats.length > 0 ? (
                  <div className="space-y-2">
                    {usageStats.couponStats
                      .sort((a, b) => b.redemptions - a.redemptions)
                      .map((stat) => (
                        <div
                          key={stat.coupon_id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <div className="font-medium">{stat.code}</div>
                            <div className="text-sm text-muted-foreground">
                              {stat.redemptions} redemptions
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">
                              ${stat.total_discount.toFixed(2)}
                            </div>
                            {stat.redemption_rate !== null && (
                              <div className="text-xs text-muted-foreground">
                                {stat.redemption_rate.toFixed(1)}% used
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No redemption data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No analytics data available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

