/**
 * Credit Audit Log Page - Super Admin
 * 
 * Searchable, filterable log of all credit transactions
 * across the platform.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  TrendingDown,
  Coins,
  Gift,
  CreditCard,
  RotateCcw,
  Settings,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { getAllTransactions } from '@/lib/credits';
import { queryKeys } from '@/lib/queryKeys';
import { formatSmartDate } from '@/lib/formatters';

type TransactionType = 'all' | 'usage' | 'purchase' | 'free_grant' | 'bonus' | 'adjustment' | 'refund';

export default function CreditAuditLogPage() {
  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Fetch transactions
  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.superAdminTools.creditAuditLog(typeFilter, dateFrom?.toISOString(), dateTo?.toISOString(), page),
    queryFn: () => getAllTransactions({
      transactionType: typeFilter === 'all' ? undefined : typeFilter,
      startDate: dateFrom?.toISOString(),
      endDate: dateTo?.toISOString(),
      limit: pageSize,
      offset: page * pageSize,
    }),
  });

  // Filter by search (client-side for now)
  const filteredTransactions = data?.transactions.filter(tx => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      (tx.metadata?.tenantName as string)?.toLowerCase().includes(searchLower) ||
      (tx.metadata?.tenantSlug as string)?.toLowerCase().includes(searchLower) ||
      tx.actionType?.toLowerCase().includes(searchLower) ||
      tx.description?.toLowerCase().includes(searchLower)
    );
  }) ?? [];

  // Transaction type icon
  const getTypeIcon = (type: string) => {
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
  };

  // Transaction type badge
  const getTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      usage: 'bg-red-100 text-red-800',
      purchase: 'bg-green-100 text-green-800',
      free_grant: 'bg-blue-100 text-blue-800',
      bonus: 'bg-purple-100 text-purple-800',
      adjustment: 'bg-orange-100 text-orange-800',
      refund: 'bg-cyan-100 text-cyan-800',
    };
    return (
      <Badge className={variants[type] || 'bg-gray-100 text-gray-800'}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  // Format date/time
  const formatDateTime = (dateStr: string) => {
    return formatSmartDate(dateStr, { includeTime: true });
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!data?.transactions.length) return;

    const headers = ['Date', 'Tenant', 'Type', 'Action', 'Amount', 'Balance After', 'Description'];
    const rows = data.transactions.map(tx => [
      new Date(tx.createdAt).toISOString(),
      tx.metadata?.tenantName ?? '',
      tx.transactionType,
      tx.actionType ?? '',
      tx.amount.toString(),
      tx.balanceAfter.toString(),
      tx.description ?? '',
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credit-audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credit Transaction Audit Log</h1>
          <p className="text-muted-foreground">
            Complete history of all credit transactions across the platform
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} disabled={!data?.transactions.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tenant, action..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search credit audit logs"
              />
            </div>

            {/* Type Filter */}
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as TransactionType)}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Transaction type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="usage">Usage</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="free_grant">Free Grant</SelectItem>
                <SelectItem value="bonus">Bonus</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
              </SelectContent>
            </Select>

            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[150px] justify-start text-left">
                  <Calendar className="h-4 w-4 mr-2" />
                  {dateFrom ? format(dateFrom, 'MMM d, yyyy') : 'From date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[150px] justify-start text-left">
                  <Calendar className="h-4 w-4 mr-2" />
                  {dateTo ? format(dateTo, 'MMM d, yyyy') : 'To date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Clear Filters */}
            {(dateFrom || dateTo || typeFilter !== 'all') && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                  setTypeFilter('all');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredTransactions.length} of {data?.total ?? 0} transactions
        </span>
        <span>
          Page {page + 1} of {Math.ceil((data?.total ?? 0) / pageSize)}
        </span>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance After</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(tx.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{String(tx.metadata?.tenantName || 'Unknown')}</p>
                        <p className="text-xs text-muted-foreground">
                          @{String(tx.metadata?.tenantSlug || '')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(tx.transactionType)}
                        {getTypeBadge(tx.transactionType)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {tx.actionType || '-'}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${
                      tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {tx.balanceAfter.toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {tx.description || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.ceil(data.total / pageSize)}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * pageSize >= data.total}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}







