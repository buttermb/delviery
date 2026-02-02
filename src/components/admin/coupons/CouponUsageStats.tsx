/**
 * Coupon Usage Stats Component
 * Displays key coupon metrics in a card layout for the Marketing Hub
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Tag from "lucide-react/dist/esm/icons/tag";
import Users from "lucide-react/dist/esm/icons/users";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Percent from "lucide-react/dist/esm/icons/percent";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import { useCouponUsageStats } from '@/hooks/useCouponUsageStats';
import { cn } from '@/lib/utils';

interface StatItemProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'green' | 'blue' | 'orange' | 'purple';
}

function StatItem({ label, value, icon, description, color = 'blue' }: StatItemProps) {
  const colorClasses = {
    green: 'text-emerald-500 bg-emerald-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    orange: 'text-orange-500 bg-orange-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  };

  return (
    <div className="flex items-center gap-3">
      <div className={cn('p-2 rounded-lg', colorClasses[color])}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold truncate">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        )}
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="space-y-1">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

interface CouponUsageStatsProps {
  className?: string;
  compact?: boolean;
}

export function CouponUsageStats({ className, compact = false }: CouponUsageStatsProps) {
  const { data: stats, isLoading, error } = useCouponUsageStats();

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Failed to load coupon statistics
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (compact) {
    return (
      <div className={cn('grid gap-4 grid-cols-2 sm:grid-cols-4', className)}>
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : stats ? (
          <>
            <StatItem
              label="Active Coupons"
              value={stats.activeCoupons}
              icon={<Tag className="h-5 w-5" />}
              color="green"
            />
            <StatItem
              label="Total Redemptions"
              value={stats.totalRedemptions}
              icon={<Users className="h-5 w-5" />}
              color="blue"
            />
            <StatItem
              label="Discount Given"
              value={formatCurrency(stats.totalDiscountGiven)}
              icon={<DollarSign className="h-5 w-5" />}
              color="orange"
            />
            <StatItem
              label="Redemption Rate"
              value={`${stats.redemptionRate.toFixed(1)}%`}
              icon={<Percent className="h-5 w-5" />}
              color="purple"
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Coupon Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Main Stats Grid */}
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <StatItem
                label="Total Coupons"
                value={stats.totalCoupons}
                icon={<Tag className="h-5 w-5" />}
                description={`${stats.activeCoupons} active`}
                color="green"
              />
              <StatItem
                label="Total Redemptions"
                value={stats.totalRedemptions}
                icon={<Users className="h-5 w-5" />}
                color="blue"
              />
              <StatItem
                label="Total Discount Given"
                value={formatCurrency(stats.totalDiscountGiven)}
                icon={<DollarSign className="h-5 w-5" />}
                color="orange"
              />
              <StatItem
                label="Avg. Discount"
                value={formatCurrency(stats.averageDiscountPerRedemption)}
                icon={<TrendingUp className="h-5 w-5" />}
                description="per redemption"
                color="purple"
              />
              <StatItem
                label="Redemption Rate"
                value={`${stats.redemptionRate.toFixed(1)}%`}
                icon={<Percent className="h-5 w-5" />}
                description="of total limit"
                color="blue"
              />
              <StatItem
                label="Active Coupons"
                value={stats.activeCoupons}
                icon={<Tag className="h-5 w-5" />}
                description={`of ${stats.totalCoupons} total`}
                color="green"
              />
            </div>

            {/* Top Performing Coupons */}
            {stats.topPerformingCoupons.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Top Performing Coupons</h4>
                <div className="space-y-2">
                  {stats.topPerformingCoupons.map((coupon, index) => (
                    <div
                      key={coupon.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5">
                          #{index + 1}
                        </span>
                        <code className="text-sm font-medium bg-background px-2 py-0.5 rounded">
                          {coupon.code}
                        </code>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {coupon.redemptions} uses
                        </span>
                        <span className="font-medium">
                          {formatCurrency(coupon.totalDiscount)}
                        </span>
                        {coupon.redemptionRate !== null && (
                          <span className="text-xs text-muted-foreground">
                            ({coupon.redemptionRate.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No coupon data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
