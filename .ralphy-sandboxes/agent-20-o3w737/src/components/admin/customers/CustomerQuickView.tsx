/**
 * CustomerQuickView Component
 *
 * Quick view card for customer information during order creation.
 * Shows key customer data to help staff understand customer context.
 *
 * Features:
 * - Customer name, phone, email
 * - LTV (lifetime value) and order count
 * - Last order date
 * - Segment badge (VIP, Active, New, At Risk, Churned)
 * - Customer tags
 * - Preferred delivery address
 * - Clickable name to open full detail in DetailPanel
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import User from 'lucide-react/dist/esm/icons/user';
import Mail from 'lucide-react/dist/esm/icons/mail';
import Phone from 'lucide-react/dist/esm/icons/phone';
import ShoppingBag from 'lucide-react/dist/esm/icons/shopping-bag';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';

import { DetailPanel } from '@/components/admin/shared/DetailPanel';
import CustomerSegmentBadge from '@/components/admin/customers/CustomerSegmentBadge';
import { CustomerTagBadges } from '@/components/admin/customers/CustomerTagBadges';
import { useCustomerStats } from '@/hooks/useCustomerStats';
import { useCustomerSegment } from '@/hooks/useCustomerSegments';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface CustomerData {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

interface CustomerQuickViewProps {
  /** Customer data object */
  customer: CustomerData | null | undefined;
  /** Additional class names */
  className?: string;
  /** Show compact version without some details */
  compact?: boolean;
  /** Callback when view full detail is requested */
  onViewFullDetail?: (customerId: string) => void;
  /** Show the view full detail button */
  showViewDetailButton?: boolean;
}

interface DeliveryAddress {
  id: string;
  label: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  is_primary: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function getCustomerName(customer: CustomerData): string {
  if (customer.full_name) return customer.full_name;
  if (customer.business_name) return customer.business_name;
  if (customer.first_name || customer.last_name) {
    return [customer.first_name, customer.last_name].filter(Boolean).join(' ');
  }
  return 'Unknown Customer';
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAddress(address: DeliveryAddress): string {
  return `${address.street_address}, ${address.city}, ${address.state} ${address.zip_code}`;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function CustomerQuickViewSkeleton({ compact }: { compact?: boolean }) {
  return (
    <Card className={cn('w-full', compact ? 'p-3' : 'p-4')}>
      <CardContent className="p-0 space-y-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        {!compact && <Skeleton className="h-10 w-full" />}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Customer Detail Panel Content
// ============================================================================

interface CustomerDetailPanelContentProps {
  customer: CustomerData;
  stats: { total_spent: number; order_count: number; avg_order_value: number } | null | undefined;
  lastOrderDate: string | null;
  preferredAddress: DeliveryAddress | null;
}

function CustomerDetailPanelContent({
  customer,
  stats,
  lastOrderDate,
  preferredAddress,
}: CustomerDetailPanelContentProps) {
  const displayName = getCustomerName(customer);

  return (
    <div className="space-y-6">
      {/* Customer Identity */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-background shadow-md">
          {customer.avatar_url && (
            <AvatarImage src={customer.avatar_url} alt={displayName} />
          )}
          <AvatarFallback className="text-lg font-semibold">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-xl font-semibold">{displayName}</h3>
          {customer.business_name && customer.full_name && (
            <p className="text-sm text-muted-foreground">{customer.business_name}</p>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Contact Information
        </h4>
        <div className="space-y-2">
          {customer.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a
                href={`mailto:${customer.email}`}
                className="text-primary hover:underline"
              >
                {customer.email}
              </a>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a
                href={`tel:${customer.phone}`}
                className="text-primary hover:underline"
              >
                {customer.phone}
              </a>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Order Statistics */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Order History
        </h4>
        {stats ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{stats.order_count}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Lifetime Value</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(stats.total_spent)}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Avg Order</p>
              <p className="text-lg font-semibold">
                {formatCurrency(stats.avg_order_value)}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Last Order</p>
              <p className="text-lg font-semibold">{formatDate(lastOrderDate)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No order history</p>
        )}
      </div>

      <Separator />

      {/* Tags */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Tags
        </h4>
        <CustomerTagBadges customerId={customer.id} maxVisible={10} size="md" />
      </div>

      {/* Preferred Address */}
      {preferredAddress && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Preferred Address
            </h4>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">{preferredAddress.label}</p>
                <p className="text-sm text-muted-foreground">
                  {formatAddress(preferredAddress)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomerQuickView({
  customer,
  className,
  compact = false,
  onViewFullDetail,
  showViewDetailButton = true,
}: CustomerQuickViewProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Fetch customer stats (LTV, order count, avg order value)
  const { data: stats, isLoading: statsLoading } = useCustomerStats(customer?.id);

  // Fetch customer segment
  const { segment: segmentData, isLoading: segmentLoading } = useCustomerSegment({
    customerId: customer?.id,
    enabled: !!customer?.id,
  });

  // Fetch preferred address
  const { data: preferredAddress, isLoading: addressLoading } = useQuery({
    queryKey: ['customer-preferred-address', customer?.id, tenant?.id],
    queryFn: async () => {
      if (!tenant?.id || !customer?.id) return null;

      const { data, error } = await supabase
        .from('customer_delivery_addresses')
        .select('id, label, street_address, city, state, zip_code, is_primary')
        .eq('customer_id', customer.id)
        .eq('tenant_id', tenant.id)
        .eq('is_primary', true)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch preferred address', error, {
          component: 'CustomerQuickView',
          customerId: customer.id,
        });
        return null;
      }

      return data as DeliveryAddress | null;
    },
    enabled: !!tenant?.id && !!customer?.id,
    staleTime: 60000,
  });

  // Memoize formatted currency values
  const formattedLTV = useMemo(
    () => (stats ? formatCurrency(stats.total_spent) : '$0.00'),
    [stats]
  );

  // Handle loading state
  const isLoading = statsLoading || segmentLoading || addressLoading;

  // No customer selected
  if (!customer) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className={cn('p-0', compact ? 'p-3' : 'p-4')}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="text-sm">No customer selected</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <CustomerQuickViewSkeleton compact={compact} />;
  }

  const displayName = getCustomerName(customer);
  const initials = getInitials(displayName);

  const handleNameClick = () => {
    if (onViewFullDetail) {
      onViewFullDetail(customer.id);
    } else {
      setDetailPanelOpen(true);
    }
  };

  const handleViewFullPage = () => {
    navigateToAdmin(`customers/${customer.id}`);
    setDetailPanelOpen(false);
  };

  return (
    <>
      <Card className={cn('w-full', className)}>
        <CardContent className={cn('p-0', compact ? 'p-3' : 'p-4')}>
          {/* Customer Header */}
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 border-2 border-background shadow-sm flex-shrink-0">
              {customer.avatar_url && (
                <AvatarImage src={customer.avatar_url} alt={displayName} />
              )}
              <AvatarFallback className="text-sm font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleNameClick}
                  className="text-sm font-semibold hover:text-primary hover:underline transition-colors truncate text-left"
                >
                  {displayName}
                </button>
                {segmentData && (
                  <CustomerSegmentBadge
                    segment={segmentData.segment}
                    size="sm"
                    showIcon={true}
                    showTooltip={true}
                  />
                )}
              </div>
              {customer.business_name && customer.full_name && (
                <p className="text-xs text-muted-foreground truncate">
                  {customer.business_name}
                </p>
              )}
              {/* Contact info row */}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {customer.phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    <Mail className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {/* LTV */}
            <div className="flex items-center gap-1.5 p-2 bg-emerald-500/10 rounded-md">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground leading-tight">LTV</p>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                  {formattedLTV}
                </p>
              </div>
            </div>

            {/* Order Count */}
            <div className="flex items-center gap-1.5 p-2 bg-blue-500/10 rounded-md">
              <ShoppingBag className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground leading-tight">Orders</p>
                <p className="text-xs font-semibold truncate">
                  {stats?.order_count ?? 0}
                </p>
              </div>
            </div>

            {/* Last Order */}
            <div className="flex items-center gap-1.5 p-2 bg-purple-500/10 rounded-md">
              <Calendar className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground leading-tight">Last</p>
                <p className="text-xs font-semibold truncate">
                  {formatDate(segmentData?.lastOrderDate ?? null)}
                </p>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="mt-3">
            <CustomerTagBadges
              customerId={customer.id}
              maxVisible={compact ? 2 : 3}
              size="sm"
              showLoading={false}
            />
          </div>

          {/* Preferred Address */}
          {preferredAddress && !compact && (
            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-medium">{preferredAddress.label}:</span>{' '}
                <span className="truncate">{formatAddress(preferredAddress)}</span>
              </div>
            </div>
          )}

          {/* View Full Detail Button */}
          {showViewDetailButton && !compact && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleNameClick}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Full Detail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Panel */}
      <DetailPanel
        isOpen={detailPanelOpen}
        onClose={() => setDetailPanelOpen(false)}
        title={displayName}
        entityType="CUSTOMER"
        entityId={customer.id}
        width="md"
        actions={[
          {
            label: 'View Full Page',
            icon: ExternalLink,
            onClick: handleViewFullPage,
            variant: 'outline',
          },
        ]}
      >
        <CustomerDetailPanelContent
          customer={customer}
          stats={stats}
          lastOrderDate={segmentData?.lastOrderDate ?? null}
          preferredAddress={preferredAddress}
        />
      </DetailPanel>
    </>
  );
}

export default CustomerQuickView;
