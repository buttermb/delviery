/**
 * Customer Profile Card
 *
 * Displays unified customer profile information on the storefront dashboard.
 * Shows loyalty points, tier, order stats, and links to admin for business owners.
 */

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User,
  Trophy,
  ShoppingBag,
  Star,
  TrendingUp,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStorefrontCustomerProfile } from '@/hooks/useStorefrontCustomerProfile';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';

const TIER_COLORS: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-700 border-amber-200',
  silver: 'bg-gray-100 text-gray-700 border-gray-200',
  gold: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  platinum: 'bg-purple-100 text-purple-700 border-purple-200',
};

const TIER_ICONS: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
};

interface CustomerProfileCardProps {
  showSettings?: boolean;
  compact?: boolean;
}

function CustomerProfileCardComponent({
  showSettings = true,
  compact = false,
}: CustomerProfileCardProps) {
  const { tenant } = useCustomerAuth();
  const {
    profile,
    isLoadingProfile,
    fullName,
    hasProfile,
  } = useStorefrontCustomerProfile();

  if (isLoadingProfile) {
    return (
      <Card className="bg-white border-[hsl(var(--customer-border))]">
        <CardHeader className={compact ? 'pb-2' : ''}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const tierClass = profile?.loyalty_tier
    ? TIER_COLORS[profile.loyalty_tier.toLowerCase()] || TIER_COLORS.bronze
    : TIER_COLORS.bronze;
  const tierIcon = profile?.loyalty_tier
    ? TIER_ICONS[profile.loyalty_tier.toLowerCase()] || TIER_ICONS.bronze
    : TIER_ICONS.bronze;

  return (
    <Card className="bg-white border-[hsl(var(--customer-border))] shadow-sm">
      <CardHeader className={compact ? 'pb-2' : ''}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] flex items-center justify-center text-white text-lg font-semibold">
              {fullName?.[0]?.toUpperCase() || <User className="h-6 w-6" />}
            </div>
            <div>
              <CardTitle className="text-lg text-[hsl(var(--customer-text))]">
                {fullName}
              </CardTitle>
              {profile && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={tierClass}>
                    {tierIcon} {profile.loyalty_tier || 'Bronze'}
                  </Badge>
                  {profile.loyalty_points > 0 && (
                    <span className="text-sm text-[hsl(var(--customer-text-light))]">
                      {profile.loyalty_points.toLocaleString()} pts
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {showSettings && (
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-[hsl(var(--customer-text-light))] hover:text-[hsl(var(--customer-text))]"
            >
              <Link to={`/${tenant?.slug}/shop/settings`}>
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!compact && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-[hsl(var(--customer-surface))]">
                <ShoppingBag className="h-5 w-5 mx-auto mb-1 text-[hsl(var(--customer-primary))]" />
                <p className="text-lg font-semibold text-[hsl(var(--customer-text))]">
                  {profile?.order_count ?? 0}
                </p>
                <p className="text-xs text-[hsl(var(--customer-text-light))]">Orders</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-[hsl(var(--customer-surface))]">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <p className="text-lg font-semibold text-[hsl(var(--customer-text))]">
                  {formatCurrency(profile?.total_spent ?? 0)}
                </p>
                <p className="text-xs text-[hsl(var(--customer-text-light))]">Total Spent</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-[hsl(var(--customer-surface))]">
                <Trophy className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                <p className="text-lg font-semibold text-[hsl(var(--customer-text))]">
                  {profile?.loyalty_points ?? 0}
                </p>
                <p className="text-xs text-[hsl(var(--customer-text-light))]">Points</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-[hsl(var(--customer-surface))]">
                <Star className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                <p className="text-lg font-semibold text-[hsl(var(--customer-text))]">
                  {formatCurrency(profile?.average_order_value ?? 0)}
                </p>
                <p className="text-xs text-[hsl(var(--customer-text-light))]">Avg Order</p>
              </div>
            </div>

            {/* Last Purchase */}
            {profile?.last_purchase_at && (
              <div className="text-sm text-[hsl(var(--customer-text-light))] mb-4">
                Last order: {formatSmartDate(profile.last_purchase_at)}
              </div>
            )}

            {/* Quick Links */}
            <div className="space-y-2">
              <Link
                to={`/${tenant?.slug}/shop/orders`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-[hsl(var(--customer-surface))] transition-colors"
              >
                <span className="text-sm font-medium text-[hsl(var(--customer-text))]">
                  View Order History
                </span>
                <ChevronRight className="h-4 w-4 text-[hsl(var(--customer-text-light))]" />
              </Link>
              <Link
                to={`/${tenant?.slug}/shop/wishlist`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-[hsl(var(--customer-surface))] transition-colors"
              >
                <span className="text-sm font-medium text-[hsl(var(--customer-text))]">
                  My Wishlist
                </span>
                <ChevronRight className="h-4 w-4 text-[hsl(var(--customer-text-light))]" />
              </Link>
            </div>
          </>
        )}

        {compact && hasProfile && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[hsl(var(--customer-text-light))]">
              {profile?.order_count ?? 0} orders · {formatCurrency(profile?.total_spent ?? 0)} spent
            </span>
            <Link
              to={`/${tenant?.slug}/shop/orders`}
              className="text-[hsl(var(--customer-primary))] hover:underline"
            >
              View all
            </Link>
          </div>
        )}

        {!hasProfile && !isLoadingProfile && (
          <div className="text-center py-4">
            <p className="text-sm text-[hsl(var(--customer-text-light))]">
              Complete your first order to start earning rewards!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const CustomerProfileCard = memo(CustomerProfileCardComponent);
