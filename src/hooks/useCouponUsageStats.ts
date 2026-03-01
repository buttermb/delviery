/**
 * Hook for fetching coupon usage statistics
 * Used by Marketing Hub to display coupon performance metrics
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { Database } from '@/integrations/supabase/types';

type Coupon = Database['public']['Tables']['coupon_codes']['Row'];
type CouponUsage = Database['public']['Tables']['coupon_usage']['Row'];

export interface CouponUsageStatsData {
  totalCoupons: number;
  activeCoupons: number;
  totalRedemptions: number;
  totalDiscountGiven: number;
  averageDiscountPerRedemption: number;
  redemptionRate: number;
  topPerformingCoupons: Array<{
    id: string;
    code: string;
    redemptions: number;
    totalDiscount: number;
    redemptionRate: number | null;
  }>;
  recentRedemptions: Array<{
    id: string;
    couponCode: string;
    discountAmount: number;
    usedAt: string;
    orderId: string | null;
  }>;
  dailyRedemptions: Array<{
    date: string;
    count: number;
    totalDiscount: number;
  }>;
}

export function useCouponUsageStats() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: [...queryKeys.coupons.all, 'usage-stats', tenant?.id],
    queryFn: async (): Promise<CouponUsageStatsData> => {
      if (!tenant?.id) {
        throw new Error('No tenant');
      }

      try {
        // Fetch all coupons for this tenant
        const couponsResult = await supabase
          .from('coupon_codes')
          .select('id, code, status, total_usage_limit')
          .eq('tenant_id', tenant.id);
        
        const { data: coupons, error: couponsError } = couponsResult;

        if (couponsError) {
          logger.error('Failed to fetch coupons', couponsError, { component: 'useCouponUsageStats' });
          throw couponsError;
        }

        const couponList = (coupons ?? []) as Coupon[];
        const couponIds = couponList.map(c => c.id);

        // Fetch usage data for these coupons
        let usageData: CouponUsage[] = [];
        if (couponIds.length > 0) {
          const { data: usage, error: usageError } = await supabase
            .from('coupon_usage')
            .select('id, coupon_id, discount_amount, used_at, order_id')
            .in('coupon_id', couponIds)
            .order('used_at', { ascending: false });

          if (usageError) {
            logger.error('Failed to fetch coupon usage', usageError, { component: 'useCouponUsageStats' });
          } else {
            usageData = (usage ?? []) as CouponUsage[];
          }
        }

        // Calculate statistics
        const totalCoupons = couponList.length;
        const activeCoupons = couponList.filter(c => c.status === 'active').length;
        const totalRedemptions = usageData.length;
        const totalDiscountGiven = usageData.reduce((sum, u) => sum + (u.discount_amount ?? 0), 0);
        const averageDiscountPerRedemption = totalRedemptions > 0 ? totalDiscountGiven / totalRedemptions : 0;

        // Calculate overall redemption rate (redeemed / total possible)
        const totalPossibleRedemptions = couponList.reduce(
          (sum, c) => sum + (c.total_usage_limit ?? 0),
          0
        );
        const redemptionRate = totalPossibleRedemptions > 0
          ? (totalRedemptions / totalPossibleRedemptions) * 100
          : 0;

        // Get top performing coupons
        const couponPerformance = couponList.map(coupon => {
          const couponUsage = usageData.filter(u => u.coupon_id === coupon.id);
          const redemptions = couponUsage.length;
          const totalDiscount = couponUsage.reduce((sum, u) => sum + (u.discount_amount ?? 0), 0);
          const couponRedemptionRate = coupon.total_usage_limit && coupon.total_usage_limit > 0
            ? (redemptions / coupon.total_usage_limit) * 100
            : null;

          return {
            id: coupon.id,
            code: coupon.code,
            redemptions,
            totalDiscount,
            redemptionRate: couponRedemptionRate,
          };
        });

        const topPerformingCoupons = couponPerformance
          .sort((a, b) => b.redemptions - a.redemptions)
          .slice(0, 5);

        // Get recent redemptions with coupon codes
        const recentRedemptions = usageData.slice(0, 10).map(usage => {
          const coupon = couponList.find(c => c.id === usage.coupon_id);
          return {
            id: usage.id,
            couponCode: coupon?.code || 'Unknown',
            discountAmount: usage.discount_amount,
            usedAt: usage.used_at || new Date().toISOString(),
            orderId: usage.order_id,
          };
        });

        // Calculate daily redemptions for the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const dailyMap = new Map<string, { count: number; totalDiscount: number }>();

        // Initialize all days
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          dailyMap.set(dateStr, { count: 0, totalDiscount: 0 });
        }

        // Aggregate usage by day
        usageData.forEach(usage => {
          if (usage.used_at) {
            const usedDate = new Date(usage.used_at);
            if (usedDate >= sevenDaysAgo) {
              const dateStr = usedDate.toISOString().split('T')[0];
              const existing = dailyMap.get(dateStr) || { count: 0, totalDiscount: 0 };
              dailyMap.set(dateStr, {
                count: existing.count + 1,
                totalDiscount: existing.totalDiscount + (usage.discount_amount ?? 0),
              });
            }
          }
        });

        const dailyRedemptions = Array.from(dailyMap.entries())
          .map(([date, data]) => ({
            date,
            count: data.count,
            totalDiscount: data.totalDiscount,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        return {
          totalCoupons,
          activeCoupons,
          totalRedemptions,
          totalDiscountGiven,
          averageDiscountPerRedemption,
          redemptionRate,
          topPerformingCoupons,
          recentRedemptions,
          dailyRedemptions,
        };
      } catch (error) {
        logger.error('Error fetching coupon usage stats', error, { component: 'useCouponUsageStats' });
        throw error;
      }
    },
    enabled: !!tenant?.id,
    staleTime: 30000, // 30 seconds
  });
}
