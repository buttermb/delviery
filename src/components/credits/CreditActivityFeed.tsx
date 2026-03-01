/**
 * CreditActivityFeed Component
 * 
 * Real-time log of credit transactions in Settings > Credits.
 * Shows deductions, grants, and purchases with timestamps.
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingDown,
  Gift,
  CreditCard,
  RefreshCw,
  Coins,
  ChevronDown,
  ChevronUp,
  Calendar,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { getCreditCostInfo } from '@/lib/credits';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

export interface CreditActivityFeedProps {
  className?: string;
  limit?: number;
  showHeader?: boolean;
  compact?: boolean;
}

interface CreditTransaction {
  id: string;
  tenant_id: string;
  amount: number;
  balance_after: number;
  transaction_type: 'free_grant' | 'purchase' | 'usage' | 'refund' | 'bonus' | 'promo';
  action_type?: string;
  reference_id?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

type FilterType = 'all' | 'usage' | 'grants' | 'purchases';

interface GroupedTransactions {
  date: string;
  displayDate: string;
  transactions: CreditTransaction[];
  totalSpent: number;
  totalEarned: number;
}

export function CreditActivityFeed({
  className,
  limit = 50,
  showHeader = true,
  compact = false,
}: CreditActivityFeedProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set(['today']));

  const tenantId = tenant?.id;

  // Fetch credit transactions
  const {
    data: transactions,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.creditWidgets.activity(tenantId, limit),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('credit_transactions')
        .select('id, tenant_id, amount, balance_after, transaction_type, action_type, reference_id, description, metadata, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch credit transactions', { error });
        throw error;
      }

      return (data ?? []) as CreditTransaction[];
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`credit-activity:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credit_transactions',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.creditWidgets.activity(tenantId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    switch (filter) {
      case 'usage':
        return transactions.filter((t) => t.transaction_type === 'usage');
      case 'grants':
        return transactions.filter((t) =>
          ['free_grant', 'bonus', 'promo', 'refund'].includes(t.transaction_type)
        );
      case 'purchases':
        return transactions.filter((t) => t.transaction_type === 'purchase');
      default:
        return transactions;
    }
  }, [transactions, filter]);

  // Group transactions by day
  const groupedTransactions = useMemo<GroupedTransactions[]>(() => {
    if (!filteredTransactions.length) return [];

    const groups: Record<string, CreditTransaction[]> = {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    filteredTransactions.forEach((transaction) => {
      const date = new Date(transaction.created_at).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
    });

    return Object.entries(groups).map(([date, txs]) => {
      const displayDate =
        date === today
          ? 'Today'
          : date === yesterday
          ? 'Yesterday'
          : formatSmartDate(date);

      const totalSpent = txs
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const totalEarned = txs
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        date: date === today ? 'today' : date === yesterday ? 'yesterday' : date,
        displayDate,
        transactions: txs,
        totalSpent,
        totalEarned,
      };
    });
  }, [filteredTransactions]);

  // Toggle day expansion
  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  // Get icon for transaction type
  const getTransactionIcon = (transaction: CreditTransaction) => {
    switch (transaction.transaction_type) {
      case 'usage':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'free_grant':
        return <Gift className="h-4 w-4 text-emerald-500" />;
      case 'purchase':
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      case 'refund':
        return <RefreshCw className="h-4 w-4 text-amber-500" />;
      case 'bonus':
      case 'promo':
        return <Gift className="h-4 w-4 text-purple-500" />;
      default:
        return <Coins className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Get action name
  const getActionName = (transaction: CreditTransaction): string => {
    if (transaction.action_type) {
      const info = getCreditCostInfo(transaction.action_type);
      return info?.actionName || transaction.action_type.replace(/_/g, ' ');
    }

    switch (transaction.transaction_type) {
      case 'free_grant':
        return 'Monthly Credit Grant';
      case 'purchase':
        return 'Credit Purchase';
      case 'refund':
        return 'Credit Refund';
      case 'bonus':
        return 'Bonus Credits';
      case 'promo':
        return 'Promo Code Applied';
      default:
        return transaction.description || 'Credit Transaction';
    }
  };

  // Format time
  const formatTime = (dateString: string): string => {
    return formatSmartDate(dateString, { includeTime: true });
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {showHeader && (
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-28" />
          </div>
        )}
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-destructive">Failed to load activity</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with Filter */}
      {showHeader && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Credit Activity
          </h3>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-[140px] h-9">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activity</SelectItem>
                <SelectItem value="usage">Usage Only</SelectItem>
                <SelectItem value="grants">Grants & Bonuses</SelectItem>
                <SelectItem value="purchases">Purchases</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 w-9"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Groups */}
      {groupedTransactions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No credit activity yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your credit transactions will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedTransactions.map((group) => {
            const isExpanded = expandedDays.has(group.date);

            return (
              <Collapsible
                key={group.date}
                open={isExpanded}
                onOpenChange={() => toggleDay(group.date)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader
                      className={cn(
                        'p-4 cursor-pointer hover:bg-muted/50 transition-colors',
                        compact && 'p-3'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <CardTitle className="text-base font-medium">
                            {group.displayDate}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {group.transactions.length} transaction
                            {group.transactions.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          {group.totalSpent > 0 && (
                            <span className="text-red-600 font-medium">
                              -{group.totalSpent.toLocaleString()}
                            </span>
                          )}
                          {group.totalEarned > 0 && (
                            <span className="text-emerald-600 font-medium">
                              +{group.totalEarned.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className={cn('pt-0 pb-4 px-4', compact && 'px-3 pb-3')}>
                      <div className="space-y-2 divide-y">
                        {group.transactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className={cn(
                              'flex items-center justify-between py-2 first:pt-0',
                              compact && 'py-1.5'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                                {getTransactionIcon(transaction)}
                              </div>
                              <div>
                                <p className={cn('font-medium', compact && 'text-sm')}>
                                  {getActionName(transaction)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatTime(transaction.created_at)}
                                  {transaction.reference_id && (
                                    <span className="ml-1">
                                      • #{transaction.reference_id.slice(0, 8)}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className={cn(
                                  'font-semibold',
                                  transaction.amount < 0 ? 'text-red-600' : 'text-emerald-600',
                                  compact && 'text-sm'
                                )}
                              >
                                {transaction.amount > 0 ? '+' : ''}
                                {transaction.amount.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Balance: {transaction.balance_after.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {transactions && transactions.length >= limit && (
        <div className="text-center">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Showing last {limit} transactions
          </Button>
        </div>
      )}
    </div>
  );
}







