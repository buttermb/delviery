/**
 * Marketing Overview Component
 * Displays a summary of marketing metrics including coupon performance
 * Can be used on the Marketing Hub page or dashboard
 */

import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Tag from "lucide-react/dist/esm/icons/tag";
import Users from "lucide-react/dist/esm/icons/users";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import Percent from "lucide-react/dist/esm/icons/percent";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import { useCouponUsageStats } from '@/hooks/useCouponUsageStats';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  color: 'green' | 'blue' | 'orange' | 'purple';
  onClick?: () => void;
}

function MetricCard({ title, value, subtitle, icon, trend, color, onClick }: MetricCardProps) {
  const colorClasses = {
    green: 'border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20',
    blue: 'border-blue-500/30 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20',
    orange: 'border-orange-500/30 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20',
    purple: 'border-purple-500/30 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20',
  };

  const iconColors = {
    green: 'text-emerald-500 bg-emerald-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    orange: 'text-orange-500 bg-orange-500/10',
    purple: 'text-purple-500 bg-purple-500/10',
  };

  return (
    <Card
      className={cn(
        'border-2 transition-all hover:shadow-lg',
        colorClasses[color],
        onClick && 'cursor-pointer hover:scale-[1.02]'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={cn('p-2 rounded-lg', iconColors[color])}>
            {icon}
          </div>
          {trend && (
            <span
              className={cn(
                'text-xs font-medium flex items-center gap-1',
                trend.direction === 'up' ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              {trend.direction === 'up' ? '+' : '-'}{trend.value}%
            </span>
          )}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{title}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricSkeleton() {
  return (
    <Card className="border-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-20 mb-1" />
        <Skeleton className="h-4 w-24" />
      </CardContent>
    </Card>
  );
}

interface MarketingOverviewProps {
  className?: string;
  showViewAll?: boolean;
}

export function MarketingOverview({ className, showViewAll = true }: MarketingOverviewProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data: stats, isLoading, error } = useCouponUsageStats();

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleViewCoupons = () => {
    if (tenantSlug) {
      navigate(`/${tenantSlug}/admin/marketing-hub?tab=coupons`);
    }
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Failed to load marketing overview
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Coupon Performance</h3>
        </div>
        {showViewAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewCoupons}
            className="text-primary"
          >
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : stats ? (
          <>
            <MetricCard
              title="Active Coupons"
              value={stats.activeCoupons}
              subtitle={`of ${stats.totalCoupons} total`}
              icon={<Tag className="h-5 w-5" />}
              color="green"
              onClick={handleViewCoupons}
            />
            <MetricCard
              title="Total Redemptions"
              value={stats.totalRedemptions}
              icon={<Users className="h-5 w-5" />}
              color="blue"
              onClick={handleViewCoupons}
            />
            <MetricCard
              title="Discount Given"
              value={formatCurrency(stats.totalDiscountGiven)}
              subtitle={`Avg: ${formatCurrency(stats.averageDiscountPerRedemption)}`}
              icon={<DollarSign className="h-5 w-5" />}
              color="orange"
              onClick={handleViewCoupons}
            />
            <MetricCard
              title="Redemption Rate"
              value={`${stats.redemptionRate.toFixed(1)}%`}
              icon={<Percent className="h-5 w-5" />}
              color="purple"
              onClick={handleViewCoupons}
            />
          </>
        ) : null}
      </div>

      {/* Top Coupons Quick View */}
      {stats && stats.topPerformingCoupons.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Top Performing Coupons
            </CardTitle>
            <CardDescription>
              Most redeemed coupons in your store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topPerformingCoupons.slice(0, 3).map((coupon, index) => (
                <div
                  key={coupon.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-5">
                      #{index + 1}
                    </span>
                    <code className="text-sm font-medium bg-muted px-2 py-0.5 rounded">
                      {coupon.code}
                    </code>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {coupon.redemptions} uses
                    </span>
                    <span className="text-sm font-medium text-emerald-600">
                      {formatCurrency(coupon.totalDiscount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {stats && stats.recentRedemptions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Recent Redemptions
            </CardTitle>
            <CardDescription>
              Latest coupon usage activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentRedemptions.slice(0, 5).map((redemption) => (
                <div
                  key={redemption.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <code className="text-sm font-medium bg-muted px-2 py-0.5 rounded">
                      {redemption.couponCode}
                    </code>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-emerald-600">
                      -{formatCurrency(redemption.discountAmount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(redemption.usedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
