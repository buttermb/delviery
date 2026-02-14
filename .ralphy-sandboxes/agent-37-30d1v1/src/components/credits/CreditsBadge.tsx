/**
 * CreditsBadge
 *
 * Small badge component for the admin header showing current credit balance.
 * Displays a coin icon with the numeric balance, links to the credits analytics page,
 * pulses briefly when the balance changes, and shows a tooltip with a quick
 * breakdown of purchased vs bonus credits.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useCredits } from '@/contexts/CreditContext';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CreditsBadgeProps {
  className?: string;
}

export function CreditsBadge({ className }: CreditsBadgeProps) {
  const { credits, isFreeTier } = useCredits();
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const navigate = useNavigate();
  const [isPulsing, setIsPulsing] = useState(false);
  const prevBalanceRef = useRef<number | null>(null);

  // Pulse animation when balance changes
  useEffect(() => {
    if (prevBalanceRef.current === null) {
      prevBalanceRef.current = credits;
      return;
    }

    if (prevBalanceRef.current !== credits) {
      prevBalanceRef.current = credits;
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [credits]);

  // Fetch purchased vs bonus breakdown for tooltip
  const { data: breakdown } = useQuery({
    queryKey: ['credits-badge-breakdown', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      const { data: transactions } = await supabase
        .from('credit_transactions')
        .select('amount, transaction_type')
        .eq('tenant_id', tenant.id)
        .in('transaction_type', ['purchase', 'bonus', 'free_grant']);

      let purchased = 0;
      let bonus = 0;

      for (const tx of transactions || []) {
        if (tx.transaction_type === 'purchase') {
          purchased += tx.amount;
        } else {
          bonus += tx.amount;
        }
      }

      return { purchased, bonus };
    },
    enabled: isFreeTier && !!tenant?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Only show for free tier users
  if (!isFreeTier) {
    return null;
  }

  const getColorClass = () => {
    if (credits > 2000) return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800';
    if (credits > 1000) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/30 dark:border-yellow-800';
    if (credits > 500) return 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800';
    if (credits > 100) return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800';
    return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800';
  };

  const handleClick = () => {
    navigate(`/${tenantSlug}/admin/credits/analytics`);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            getColorClass(),
            isPulsing && 'animate-pulse ring-2 ring-offset-1 ring-current/30',
            className,
          )}
          aria-label={`${credits.toLocaleString()} credits remaining`}
        >
          <Coins className="h-3.5 w-3.5" />
          <span>{credits.toLocaleString()}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="w-48">
        <div className="space-y-1.5 text-xs">
          <div className="font-semibold text-sm">Credit Balance</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">{credits.toLocaleString()}</span>
          </div>
          {breakdown && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Purchased</span>
                <span>{breakdown.purchased.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bonus / Free</span>
                <span>{breakdown.bonus.toLocaleString()}</span>
              </div>
            </>
          )}
          <div className="pt-1 border-t text-muted-foreground">
            Click to view details
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
