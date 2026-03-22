/**
 * FreeTierDailyLimitWarning Component
 *
 * Compact banner showing daily usage counters for free tier tenants.
 * Displays "1/1 menus today", "2/3 orders today" etc.
 * When any limit is reached, highlights it and shows upgrade CTA.
 */

import { useState, useMemo } from 'react';
import {
  FileText,
  ShoppingCart,
  MessageSquare,
  Mail,
  CreditCard,
  ArrowUpCircle,
  X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useFreeTierLimits } from '@/hooks/useFreeTierLimits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useNavigate } from 'react-router-dom';

// ============================================================================
// Types
// ============================================================================

export interface FreeTierDailyLimitWarningProps {
  className?: string;
}

interface DailyLimitItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  current: number;
  limit: number;
}

// ============================================================================
// Component
// ============================================================================

export function FreeTierDailyLimitWarning({ className }: FreeTierDailyLimitWarningProps) {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const {
    usage,
    isLoading,
    limitsApply,
    limits,
  } = useFreeTierLimits();

  const dailyItems = useMemo((): DailyLimitItem[] => {
    if (!usage) return [];
    return [
      {
        key: 'menus',
        icon: <FileText className="h-3.5 w-3.5" />,
        label: 'menus',
        current: usage.menusCreatedToday,
        limit: limits.max_menus_per_day,
      },
      {
        key: 'orders',
        icon: <ShoppingCart className="h-3.5 w-3.5" />,
        label: 'orders',
        current: usage.ordersCreatedToday,
        limit: limits.max_orders_per_day,
      },
      {
        key: 'sms',
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        label: 'SMS',
        current: usage.smsSentToday,
        limit: limits.max_sms_per_day,
      },
      {
        key: 'emails',
        icon: <Mail className="h-3.5 w-3.5" />,
        label: 'emails',
        current: usage.emailsSentToday,
        limit: limits.max_emails_per_day,
      },
      {
        key: 'pos',
        icon: <CreditCard className="h-3.5 w-3.5" />,
        label: 'POS sales',
        current: usage.posSalesToday,
        limit: limits.max_pos_sales_per_day,
      },
    ];
  }, [usage, limits]);

  const hasAnyLimitReached = useMemo(
    () => dailyItems.some((item) => item.current >= item.limit),
    [dailyItems],
  );

  const hasAnyUsage = useMemo(
    () => dailyItems.some((item) => item.current > 0),
    [dailyItems],
  );

  // Don't show if: loading, not on free tier, dismissed, or no usage to show
  if (isLoading || !limitsApply || dismissed || !usage || !hasAnyUsage) {
    return null;
  }

  const handleUpgrade = () => {
    if (tenant?.slug) {
      navigate(`/${tenant.slug}/admin/settings?tab=payments`);
    }
  };

  return (
    <Alert
      className={cn(
        'rounded-none border-x-0 border-t-0 py-2',
        hasAnyLimitReached
          ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800'
          : 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800',
        className,
      )}
      data-testid="free-tier-daily-limit-warning"
    >
      <AlertDescription>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Today:
            </span>
            {dailyItems.map((item) => {
              const isReached = item.current >= item.limit;
              const isClose = item.current >= item.limit - 1 && item.current < item.limit;
              return (
                <Badge
                  key={item.key}
                  variant="outline"
                  className={cn(
                    'gap-1 text-xs font-mono py-0 h-6',
                    isReached
                      ? 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-700'
                      : isClose
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700'
                        : 'bg-background text-muted-foreground',
                  )}
                  data-testid={`daily-limit-${item.key}`}
                >
                  {item.icon}
                  <span>
                    {item.current}/{item.limit} {item.label}
                  </span>
                </Badge>
              );
            })}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {hasAnyLimitReached && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1 text-orange-700 hover:text-orange-800 dark:text-orange-300"
                onClick={handleUpgrade}
                data-testid="daily-limit-upgrade"
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                Upgrade
              </Button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground"
              aria-label="Dismiss daily limits"
              data-testid="daily-limit-dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
