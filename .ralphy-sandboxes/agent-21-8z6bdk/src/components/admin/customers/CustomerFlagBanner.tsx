/**
 * CustomerFlagBanner Component
 *
 * Warning banner displayed when creating orders for flagged/blocked customers.
 * Shows in order creation forms and POS when a customer is selected.
 */

import { AlertTriangle, Ban, CreditCard, FileWarning, ShieldBan, UserX, AlertCircle, ExternalLink } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
  useCustomerFlags,
  FLAG_REASON_LABELS,
  type FlagReason,
} from '@/hooks/useCustomerFlags';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';

interface CustomerFlagBannerProps {
  customerId: string | undefined;
  customerName?: string;
  className?: string;
  compact?: boolean;
  showViewDetails?: boolean;
}

// Flag reason icons
const FLAG_REASON_ICONS: Record<FlagReason, typeof AlertCircle> = {
  payment_issues: CreditCard,
  compliance: FileWarning,
  fraud: ShieldBan,
  abuse: UserX,
  other: AlertCircle,
};

export function CustomerFlagBanner({
  customerId,
  customerName,
  className,
  compact = false,
  showViewDetails = true,
}: CustomerFlagBannerProps) {
  const { navigateToAdmin } = useTenantNavigation();
  const {
    status,
    flags,
    isLoading,
  } = useCustomerFlags(customerId);

  // Don't render anything if no customer selected or no flags
  if (!customerId || (!isLoading && !status.isFlagged && !status.isBlocked)) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Skeleton className={cn('h-16 w-full', className)} />
    );
  }

  const isBlocked = status.isBlocked;
  const activeFlags = flags.filter(f => f.is_active);

  // Compact version for inline displays
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
          isBlocked
            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
          className
        )}
      >
        {isBlocked ? (
          <Ban className="h-4 w-4 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        )}
        <span className="font-medium">
          {isBlocked ? 'Customer Blocked' : 'Customer Flagged'}
        </span>
        {activeFlags.length > 0 && (
          <Badge variant="secondary" className="text-xs ml-auto">
            {activeFlags.length} {activeFlags.length === 1 ? 'flag' : 'flags'}
          </Badge>
        )}
      </div>
    );
  }

  // Full banner version
  return (
    <Alert
      variant="destructive"
      className={cn(
        isBlocked
          ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
          : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
        className
      )}
    >
      {isBlocked ? (
        <Ban className="h-5 w-5" />
      ) : (
        <AlertTriangle className="h-5 w-5" />
      )}
      <AlertTitle className="font-semibold">
        {isBlocked ? (
          <>
            {customerName ? `${customerName} is ` : 'Customer is '}
            <span className="text-red-700 dark:text-red-300">Blocked</span>
          </>
        ) : (
          <>
            {customerName ? `${customerName} has ` : 'Customer has '}
            <span className="text-amber-700 dark:text-amber-300">
              {activeFlags.length} Active {activeFlags.length === 1 ? 'Flag' : 'Flags'}
            </span>
          </>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {isBlocked ? (
          <p>
            This customer is blocked from placing orders. Review their account
            before proceeding with any transactions.
          </p>
        ) : (
          <p>
            Review the following concerns before creating an order for this customer.
          </p>
        )}

        {/* Flag Details */}
        {activeFlags.length > 0 && (
          <div className="mt-3 space-y-2">
            {activeFlags.map((flag) => {
              const ReasonIcon = FLAG_REASON_ICONS[flag.flag_reason];
              return (
                <div
                  key={flag.id}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-md',
                    isBlocked
                      ? 'bg-red-100/50 dark:bg-red-900/30'
                      : 'bg-amber-100/50 dark:bg-amber-900/30'
                  )}
                >
                  <ReasonIcon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          isBlocked
                            ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/50'
                            : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/50'
                        )}
                      >
                        {FLAG_REASON_LABELS[flag.flag_reason]}
                      </Badge>
                    </div>
                    {flag.reason_details && (
                      <p className="text-sm mt-1 opacity-90">{flag.reason_details}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View Details Button */}
        {showViewDetails && customerId && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateToAdmin(`customers/${customerId}`)}
              className={cn(
                isBlocked
                  ? 'border-red-300 hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/50'
                  : 'border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50'
              )}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Customer Details
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Inline badge for customer flag status
 * Use in tables, lists, and compact displays
 */
export function CustomerFlagStatusBadge({
  customerId,
  className,
}: {
  customerId: string | undefined;
  className?: string;
}) {
  const { status, isLoading } = useCustomerFlags(customerId);

  if (!customerId || isLoading || (!status.isFlagged && !status.isBlocked)) {
    return null;
  }

  if (status.isBlocked) {
    return (
      <Badge
        variant="destructive"
        className={cn('text-xs', className)}
      >
        <Ban className="h-3 w-3 mr-1" />
        Blocked
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
        className
      )}
    >
      <AlertTriangle className="h-3 w-3 mr-1" />
      Flagged
    </Badge>
  );
}
