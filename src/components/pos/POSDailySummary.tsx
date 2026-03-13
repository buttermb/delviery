/**
 * POS Daily Summary Widget
 * Shows today's sales count, total revenue, and transaction count
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, ShoppingCart, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/formatters';
import { logger } from '@/lib/logger';

interface POSDailySummaryProps {
  tenantId: string | undefined;
  className?: string;
}

export function POSDailySummary({ tenantId, className }: POSDailySummaryProps) {
  // Get today's date range (midnight to now)
  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }, []);

  const { data: summary, isLoading } = useQuery({
    queryKey: [...queryKeys.pos.transactions(tenantId), 'daily-summary', todayStart],
    queryFn: async () => {
      if (!tenantId) return null;

      try {
        const { data, error } = await supabase
          .from('pos_transactions')
          .select('id, amount, transaction_type, payment_status')
          .eq('tenant_id', tenantId)
          .gte('created_at', todayStart)
          .eq('transaction_type', 'sale');

        if (error && error.code === '42P01') {
          return { salesCount: 0, totalRevenue: 0, transactionCount: 0 };
        }
        if (error) throw error;

        const transactions = data ?? [];
        const salesCount = transactions.length;
        const totalRevenue = transactions
          .filter((t) => t.payment_status === 'completed')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);

        return {
          salesCount,
          totalRevenue,
          transactionCount: salesCount,
        };
      } catch (error: unknown) {
        if (
          error !== null &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code: string }).code === '42P01'
        ) {
          return { salesCount: 0, totalRevenue: 0, transactionCount: 0 };
        }
        logger.error('Failed to load daily summary', error, { component: 'POSDailySummary' });
        throw error;
      }
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Today's Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { salesCount = 0, totalRevenue = 0, transactionCount = 0 } = summary ?? {};

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Today's Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Revenue</span>
          </div>
          <span className="text-lg font-bold text-green-600">
            {formatCurrency(totalRevenue)}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">Transactions</span>
          </div>
          <span className="text-lg font-bold">{transactionCount}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-purple-600" />
            <span className="text-sm text-muted-foreground">Sales</span>
          </div>
          <span className="text-lg font-bold">{salesCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}
