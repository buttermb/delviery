/**
 * Transaction History Page
 *
 * Protected page showing full paginated transaction list with filter tabs
 * by type (all, purchases, usage, refunds), date range picker, and
 * expandable rows for transaction details.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Gift,
  Coins,
  RotateCcw,
  Settings,
  TrendingDown,
  RefreshCw,
  Receipt,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  useCreditTransactions,
  type TransactionTypeFilter,
} from '@/hooks/useCreditTransactions';
import { formatSmartDate } from '@/lib/formatters';
import { InfiniteScrollTrigger } from '@/components/shared/InfiniteScrollTrigger';

// ============================================================================
// Types
// ============================================================================

type TabValue = 'all' | 'purchases' | 'usage' | 'refunds';

const TAB_TO_FILTER: Record<TabValue, TransactionTypeFilter> = {
  all: 'all',
  purchases: 'purchase',
  usage: 'usage',
  refunds: 'refund',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getTypeIcon(type: string) {
  switch (type) {
    case 'usage':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'purchase':
      return <CreditCard className="h-4 w-4 text-green-500" />;
    case 'free_grant':
      return <Gift className="h-4 w-4 text-blue-500" />;
    case 'bonus':
      return <Coins className="h-4 w-4 text-purple-500" />;
    case 'adjustment':
      return <Settings className="h-4 w-4 text-orange-500" />;
    case 'refund':
      return <RotateCcw className="h-4 w-4 text-cyan-500" />;
    default:
      return <Coins className="h-4 w-4 text-gray-500" />;
  }
}

function getTypeBadgeClasses(type: string): string {
  const variants: Record<string, string> = {
    usage: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    purchase: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    free_grant: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    bonus: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    adjustment: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    refund: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  };
  return variants[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}

function formatTransactionType(type: string): string {
  return type.replace(/_/g, ' ');
}

function formatDateTime(dateStr: string): string {
  return formatSmartDate(dateStr, { includeTime: true });
}

function formatDateShort(dateStr: string): string {
  return formatSmartDate(dateStr, { relative: false });
}

// ============================================================================
// Transaction Row Component
// ============================================================================

interface TransactionRowProps {
  transaction: {
    id: string;
    amount: number;
    balanceAfter: number;
    transactionType: string;
    actionType?: string;
    referenceId?: string;
    referenceType?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  };
}

function TransactionRow({ transaction }: TransactionRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tx = transaction;

  const hasDetails = tx.actionType || tx.referenceId || tx.referenceType || tx.metadata;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow
        className={cn(
          'group',
          hasDetails && 'cursor-pointer hover:bg-muted/50'
        )}
      >
        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDateShort(tx.createdAt)}
          <span className="hidden sm:inline ml-1 text-xs">
            {new Date(tx.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {getTypeIcon(tx.transactionType)}
            <Badge className={getTypeBadgeClasses(tx.transactionType)}>
              {formatTransactionType(tx.transactionType)}
            </Badge>
          </div>
        </TableCell>
        <TableCell
          className={cn(
            'text-right font-mono font-medium',
            tx.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}
        >
          {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">
          {tx.balanceAfter.toLocaleString()}
        </TableCell>
        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
          {tx.description || '-'}
        </TableCell>
        <TableCell className="w-8">
          {hasDetails && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-11 w-11 sm:h-7 sm:w-7 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          )}
        </TableCell>
      </TableRow>
      {hasDetails && (
        <CollapsibleContent asChild>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableCell colSpan={6} className="py-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm pl-2">
                {tx.actionType && (
                  <div>
                    <span className="text-muted-foreground">Action: </span>
                    <span className="font-medium">{tx.actionType.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {tx.referenceType && (
                  <div>
                    <span className="text-muted-foreground">Reference Type: </span>
                    <span className="font-medium">{tx.referenceType}</span>
                  </div>
                )}
                {tx.referenceId && (
                  <div>
                    <span className="text-muted-foreground">Reference ID: </span>
                    <span className="font-mono text-xs">{tx.referenceId}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Full Date: </span>
                  <span className="font-medium">{formatDateTime(tx.createdAt)}</span>
                </div>
                {tx.metadata && Object.keys(tx.metadata).length > 0 && (
                  <div className="col-span-full">
                    <span className="text-muted-foreground">Metadata: </span>
                    <span className="font-mono text-xs break-all">
                      {JSON.stringify(tx.metadata, null, 2)}
                    </span>
                  </div>
                )}
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export function TransactionHistoryPage() {
  const { tenantSlug } = useTenantAdminAuth();
  const navigate = useNavigate();

  // Filter state
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Map tab to filter type
  const typeFilter = TAB_TO_FILTER[activeTab];

  const {
    transactions,
    isLoading,
    isFetchingMore,
    hasMore,
    totalCount,
    loadMore,
    refetch,
  } = useCreditTransactions({
    pageSize: 20,
    filters: {
      type: typeFilter,
      dateFrom,
      dateTo,
    },
  });

  // Reset pagination when filters change
  useEffect(() => {
    refetch();
  }, [activeTab, dateFrom, dateTo, refetch]);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as TabValue);
  }, []);

  const handleClearDates = useCallback(() => {
    setDateFrom(undefined);
    setDateTo(undefined);
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/${tenantSlug}/admin`)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Transaction History</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                Complete history of your credit transactions
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full sm:w-auto">
            <TabsList className="flex w-full overflow-x-auto sm:w-auto sm:inline-flex">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
              <TabsTrigger value="refunds">Refunds</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[140px] justify-start text-left">
                  <Calendar className="h-4 w-4 mr-2" />
                  {dateFrom ? format(dateFrom, 'MMM d, yyyy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                  disabled={(date) => dateTo ? date > dateTo : false}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[140px] justify-start text-left">
                  <Calendar className="h-4 w-4 mr-2" />
                  {dateTo ? format(dateTo, 'MMM d, yyyy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                  disabled={(date) => dateFrom ? date < dateFrom : false}
                />
              </PopoverContent>
            </Popover>

            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={handleClearDates}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results Summary */}
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-4 w-48" />
          ) : (
            <span>
              Showing {transactions.length} of {totalCount} transaction{totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Transactions Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead className="w-[140px]">Type</TableHead>
                    <TableHead className="w-[100px] text-right">Amount</TableHead>
                    <TableHead className="w-[100px] text-right">Balance</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      </TableRow>
                    ))
                  ) : transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                            <Receipt className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">No transactions found</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {activeTab === 'all'
                                ? 'Your transaction history will appear here.'
                                : `No ${activeTab} transactions match your filters.`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TransactionRow key={tx.id} transaction={tx} />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Infinite Scroll Trigger */}
        {!isLoading && (
          <InfiniteScrollTrigger
            onLoadMore={loadMore}
            hasMore={hasMore}
            isFetching={isFetchingMore}
            loadingLabel={`Loading more... (${totalCount - transactions.length} remaining)`}
          />
        )}
      </div>
    </div>
  );
}
