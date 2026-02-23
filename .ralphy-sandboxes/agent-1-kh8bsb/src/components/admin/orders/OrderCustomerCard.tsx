/**
 * OrderCustomerCard Component
 *
 * Displays customer information within an order context, including:
 * - Customer avatar and name
 * - Contact details (email, phone)
 * - Order history count with total spent
 * - Quick actions (view profile, new order)
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import User from "lucide-react/dist/esm/icons/user";
import Mail from "lucide-react/dist/esm/icons/mail";
import Phone from "lucide-react/dist/esm/icons/phone";
import ShoppingBag from "lucide-react/dist/esm/icons/shopping-bag";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Package from "lucide-react/dist/esm/icons/package";
import { useCustomerStats } from '@/hooks/useCustomerStats';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { cn } from '@/lib/utils';

export interface OrderCustomerData {
  id?: string;
  customer_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

interface OrderCustomerCardProps {
  customer: OrderCustomerData | null | undefined;
  className?: string;
  showActions?: boolean;
  compact?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function getCustomerName(customer: OrderCustomerData): string {
  if (customer.full_name) return customer.full_name;
  if (customer.business_name) return customer.business_name;
  if (customer.first_name || customer.last_name) {
    return [customer.first_name, customer.last_name].filter(Boolean).join(' ');
  }
  return 'Unknown Customer';
}

function CustomerStatsSkeleton() {
  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <Skeleton className="h-3 w-16 mb-1" />
        <Skeleton className="h-5 w-10" />
      </div>
      <div className="flex-1">
        <Skeleton className="h-3 w-16 mb-1" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}

export function OrderCustomerCard({
  customer,
  className,
  showActions = true,
  compact = false,
}: OrderCustomerCardProps) {
  const { navigateToAdmin } = useTenantNavigation();
  const customerId = customer?.customer_id || customer?.id;

  const { data: stats, isLoading: statsLoading } = useCustomerStats(customerId);

  // Memoize formatted currency values (must be before early return)
  const formattedTotalSpent = useMemo(
    () => (stats ? formatCurrency(stats.total_spent) : null),
    [stats]
  );
  const formattedAvgOrderValue = useMemo(
    () => (stats ? formatCurrency(stats.avg_order_value) : null),
    [stats]
  );

  if (!customer) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className={compact ? 'p-4' : 'pb-3'}>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Customer
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'p-4 pt-0' : 'pt-0'}>
          <p className="text-sm text-muted-foreground">No customer information available</p>
        </CardContent>
      </Card>
    );
  }

  const displayName = getCustomerName(customer);
  const initials = getInitials(displayName);

  const handleViewProfile = () => {
    if (customerId) {
      navigateToAdmin(`/customers/${customerId}`);
    }
  };

  const handleNewOrder = () => {
    if (customerId) {
      navigateToAdmin(`/wholesale-orders/new?clientId=${customerId}`);
    }
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className={compact ? 'p-4' : 'pb-3'}>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <User className="h-4 w-4" />
          Customer
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(compact ? 'p-4 pt-0' : 'pt-0', 'space-y-4')}>
        {/* Customer Identity */}
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
            {customer.avatar_url && <AvatarImage src={customer.avatar_url} alt={displayName} />}
            <AvatarFallback className="text-sm font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold truncate">{displayName}</h4>
            {customer.business_name && customer.full_name && (
              <p className="text-xs text-muted-foreground truncate">{customer.business_name}</p>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-2">
          {customer.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              <a
                href={`mailto:${customer.email}`}
                className="truncate hover:text-foreground transition-colors"
              >
                {customer.email}
              </a>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              <a
                href={`tel:${customer.phone}`}
                className="hover:text-foreground transition-colors"
              >
                {customer.phone}
              </a>
            </div>
          )}
        </div>

        {/* Order History Stats */}
        {customerId && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Order History
              </p>
              {statsLoading ? (
                <CustomerStatsSkeleton />
              ) : stats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-blue-500/10">
                      <ShoppingBag className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Orders</p>
                      <p className="text-sm font-semibold">{stats.order_count}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-emerald-500/10">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Spent</p>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formattedTotalSpent}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>No order history</span>
                </div>
              )}
              {stats && stats.order_count > 0 && (
                <Badge variant="outline" className="text-xs w-fit">
                  Avg. order: {formattedAvgOrderValue}
                </Badge>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        {showActions && customerId && (
          <>
            <Separator />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={handleViewProfile}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Profile
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={handleNewOrder}
              >
                <Package className="h-3 w-3 mr-1" />
                New Order
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
