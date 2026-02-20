import { useState, useMemo, useCallback } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import Download from 'lucide-react/dist/esm/icons/download';
import Filter from 'lucide-react/dist/esm/icons/filter';
import Search from 'lucide-react/dist/esm/icons/search';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down';
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up';
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down';
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet';
import Package from 'lucide-react/dist/esm/icons/package';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface MovementEntry {
  id: string;
  tenant_id: string;
  product_id: string;
  change_type: string;
  previous_quantity: number;
  new_quantity: number;
  change_amount: number;
  reference_type: string | null;
  reference_id: string | null;
  location_id: string | null;
  reason: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string | null;
  };
  order?: {
    id: string;
    order_number: string | null;
  } | null;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
}

interface MovementFilters {
  productId?: string;
  reason?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page: number;
  pageSize: number;
}

type SortDirection = 'asc' | 'desc';
type SortField = 'created_at' | 'product_name' | 'change_amount' | 'reason' | 'user';

const REASON_OPTIONS = [
  { value: 'all', label: 'All Reasons' },
  { value: 'receiving', label: 'Receiving/Restock' },
  { value: 'sale', label: 'Sale' },
  { value: 'return', label: 'Return' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'damage', label: 'Damage/Loss' },
  { value: 'theft', label: 'Theft' },
  { value: 'quality', label: 'Quality Issue' },
  { value: 'count', label: 'Count Correction' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'disposal', label: 'Disposal' },
  { value: 'audit', label: 'Audit' },
  { value: 'other', label: 'Other' },
];

const REASON_LABELS: Record<string, string> = {
  receiving: 'Receiving/Restock',
  sale: 'Sale',
  return: 'Return',
  adjustment: 'Adjustment',
  damage: 'Damage/Loss',
  theft: 'Theft',
  quality: 'Quality Issue',
  count: 'Count Correction',
  transfer: 'Transfer',
  disposal: 'Disposal',
  audit: 'Audit',
  other: 'Other',
};

function formatChangeAmount(amount: number): string {
  if (amount > 0) return `+${amount.toFixed(2)}`;
  return amount.toFixed(2);
}

function formatReason(reason: string | null): string {
  if (!reason) return '-';
  return REASON_LABELS[reason] || reason;
}

interface MovementReportProps {
  className?: string;
}

export function MovementReport({ className }: MovementReportProps) {
  const { tenant } = useTenantAdminAuth();

  // Filter state
  const [productFilter, setProductFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Sort state
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Build filters
  const filters: MovementFilters = useMemo(() => ({
    productId: productFilter !== 'all' ? productFilter : undefined,
    reason: reasonFilter !== 'all' ? reasonFilter : undefined,
    userId: userFilter !== 'all' ? userFilter : undefined,
    startDate: startDate ? startOfDay(startDate).toISOString() : undefined,
    endDate: endDate ? endOfDay(endDate).toISOString() : undefined,
    search: searchTerm || undefined,
    page,
    pageSize,
  }), [productFilter, reasonFilter, userFilter, startDate, endDate, searchTerm, page, pageSize]);

  // Fetch products for filter dropdown
  const { data: productsData } = useQuery({
    queryKey: queryKeys.products.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for filter', { error, tenantId: tenant.id });
        return [];
      }
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch users for filter dropdown
  const { data: usersData } = useQuery({
    queryKey: ['tenant-users', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('tenant_users')
        .select('user_id, email')
        .eq('tenant_id', tenant.id)
        .order('email');

      if (error) {
        logger.error('Failed to fetch users for filter', { error, tenantId: tenant.id });
        return [];
      }
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch movement data
  const { data, isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.inventory.history({
      tenantId: tenant?.id,
      type: 'movement-report',
      ...filters,
      sortField,
      sortDirection,
    }),
    queryFn: async () => {
      if (!tenant?.id) return { entries: [], totalCount: 0 };

      // Build base query for inventory_history
      // Using type assertion for dynamic query building
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('inventory_history')
        .select(`
          *,
          product:products(id, name, sku)
        `, { count: 'exact' })
        .eq('tenant_id', tenant.id);

      if (filters.productId) {
        query = query.eq('product_id', filters.productId);
      }

      if (filters.reason) {
        query = query.eq('reason', filters.reason);
      }

      if (filters.userId) {
        query = query.eq('performed_by', filters.userId);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Apply sorting
      const ascending = sortDirection === 'asc';
      if (sortField === 'created_at') {
        query = query.order('created_at', { ascending });
      } else if (sortField === 'change_amount') {
        query = query.order('change_amount', { ascending });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Calculate offset for pagination
      const offset = (filters.page - 1) * filters.pageSize;
      query = query.range(offset, offset + filters.pageSize - 1);

      const { data: entries, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch movement report', { error, tenantId: tenant.id });
        throw error;
      }

      // Fetch related orders for entries with reference_id pointing to orders
      const entriesWithReferences = (entries || []) as MovementEntry[];
      const orderIds = entriesWithReferences
        .filter(e => e.reference_type === 'order' && e.reference_id)
        .map(e => e.reference_id as string);

      let ordersMap: Record<string, { id: string; order_number: string | null }> = {};
      if (orderIds.length > 0) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('id, order_number')
          .in('id', orderIds);

        if (ordersData) {
          ordersMap = ordersData.reduce((acc, order) => {
            acc[order.id] = order;
            return acc;
          }, {} as Record<string, { id: string; order_number: string | null }>);
        }
      }

      // Fetch related user info
      const userIds = [...new Set(entriesWithReferences.filter(e => e.performed_by).map(e => e.performed_by as string))];
      let usersMap: Record<string, { id: string; email: string; full_name: string | null }> = {};
      if (userIds.length > 0) {
        const { data: userData } = await supabase
          .from('tenant_users')
          .select('user_id, email')
          .in('user_id', userIds);

        if (userData) {
          usersMap = userData.reduce((acc, user) => {
            acc[user.user_id] = { id: user.user_id, email: user.email, full_name: null };
            return acc;
          }, {} as Record<string, { id: string; email: string; full_name: string | null }>);
        }
      }

      // Merge data
      const enrichedEntries = entriesWithReferences.map(entry => ({
        ...entry,
        order: entry.reference_type === 'order' && entry.reference_id ? ordersMap[entry.reference_id] || null : null,
        user: entry.performed_by ? usersMap[entry.performed_by] || null : null,
      }));

      return {
        entries: enrichedEntries,
        totalCount: count || 0,
      };
    },
    enabled: !!tenant?.id,
  });

  const { entries = [], totalCount = 0 } = data || {};

  // Client-side search filter (for product name/SKU)
  const filteredEntries = useMemo(() => {
    if (!filters.search) return entries;
    const searchLower = filters.search.toLowerCase();
    return entries.filter(entry =>
      entry.product?.name?.toLowerCase().includes(searchLower) ||
      entry.product?.sku?.toLowerCase().includes(searchLower) ||
      entry.reason?.toLowerCase().includes(searchLower) ||
      entry.notes?.toLowerCase().includes(searchLower)
    );
  }, [entries, filters.search]);

  // Client-side sorting for non-database fields
  const sortedEntries = useMemo(() => {
    if (sortField === 'product_name') {
      return [...filteredEntries].sort((a, b) => {
        const nameA = a.product?.name || '';
        const nameB = b.product?.name || '';
        return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    }
    if (sortField === 'reason') {
      return [...filteredEntries].sort((a, b) => {
        const reasonA = a.reason || '';
        const reasonB = b.reason || '';
        return sortDirection === 'asc' ? reasonA.localeCompare(reasonB) : reasonB.localeCompare(reasonA);
      });
    }
    if (sortField === 'user') {
      return [...filteredEntries].sort((a, b) => {
        const userA = a.user?.email || '';
        const userB = b.user?.email || '';
        return sortDirection === 'asc' ? userA.localeCompare(userB) : userB.localeCompare(userA);
      });
    }
    return filteredEntries;
  }, [filteredEntries, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalIncrease = 0;
    let totalDecrease = 0;
    for (const entry of sortedEntries) {
      if (entry.change_amount > 0) {
        totalIncrease += entry.change_amount;
      } else {
        totalDecrease += Math.abs(entry.change_amount);
      }
    }
    return {
      count: sortedEntries.length,
      totalIncrease,
      totalDecrease,
      netChange: totalIncrease - totalDecrease,
    };
  }, [sortedEntries]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Quick date presets
  const setDatePreset = (preset: 'today' | '7days' | '30days' | '90days' | 'all') => {
    switch (preset) {
      case 'today':
        setStartDate(startOfDay(new Date()));
        setEndDate(new Date());
        break;
      case '7days':
        setStartDate(subDays(new Date(), 7));
        setEndDate(new Date());
        break;
      case '30days':
        setStartDate(subDays(new Date(), 30));
        setEndDate(new Date());
        break;
      case '90days':
        setStartDate(subDays(new Date(), 90));
        setEndDate(new Date());
        break;
      case 'all':
        setStartDate(undefined);
        setEndDate(undefined);
        break;
    }
    setPage(1);
  };

  const clearFilters = () => {
    setProductFilter('all');
    setReasonFilter('all');
    setUserFilter('all');
    setSearchTerm('');
    setStartDate(subDays(new Date(), 30));
    setEndDate(new Date());
    setPage(1);
  };

  const hasActiveFilters = productFilter !== 'all' || reasonFilter !== 'all' || userFilter !== 'all' || searchTerm;

  // Handle column sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Export to CSV
  const exportToCSV = useCallback(() => {
    if (sortedEntries.length === 0) return;

    const headers = ['Date', 'Product', 'SKU', 'Change', 'Previous Qty', 'New Qty', 'Reason', 'Order Reference', 'User', 'Notes'];
    const rows = sortedEntries.map(entry => [
      format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss'),
      entry.product?.name || '',
      entry.product?.sku || '',
      entry.change_amount.toFixed(2),
      entry.previous_quantity.toFixed(2),
      entry.new_quantity.toFixed(2),
      formatReason(entry.reason),
      entry.order?.order_number || (entry.reference_id ? entry.reference_id.slice(0, 8) : ''),
      entry.user?.email || entry.performed_by?.slice(0, 8) || '',
      entry.notes || '',
    ]);

    // Add totals row
    rows.push([]);
    rows.push(['TOTALS', '', '', '', '', '', '', '', '', '']);
    rows.push(['Total Movements', String(totals.count), '', '', '', '', '', '', '', '']);
    rows.push(['Total Increase', '', '', `+${totals.totalIncrease.toFixed(2)}`, '', '', '', '', '', '']);
    rows.push(['Total Decrease', '', '', `-${totals.totalDecrease.toFixed(2)}`, '', '', '', '', '', '']);
    rows.push(['Net Change', '', '', totals.netChange.toFixed(2), '', '', '', '', '', '']);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    link.setAttribute('download', `inventory-movement-report-${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('Exported movement report to CSV', {
      tenantId: tenant?.id,
      entryCount: sortedEntries.length,
    });
  }, [sortedEntries, totals, tenant?.id]);

  if (queryError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Inventory Movement Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-destructive py-4">
            Failed to load movement report. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <FileSpreadsheet className="h-5 w-5" />
              Inventory Movement Report
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Detailed report of all inventory movements
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="self-start sm:self-auto">
              {totalCount} records
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={sortedEntries.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="space-y-4 mb-6">
          {/* Search and Filter Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products, reasons, notes..."
                aria-label="Search products, reasons, notes"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Package className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {productsData?.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={reasonFilter} onValueChange={(v) => { setReasonFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {usersData?.map(user => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDatePreset('today')}
                className="text-xs"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDatePreset('7days')}
                className="text-xs"
              >
                Last 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDatePreset('30days')}
                className="text-xs"
              >
                Last 30 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDatePreset('90days')}
                className="text-xs"
              >
                Last 90 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDatePreset('all')}
                className="text-xs"
              >
                All Time
              </Button>
            </div>

            <div className="flex gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs gap-2">
                    <Calendar className="h-3 w-3" />
                    {startDate ? format(startDate, 'MMM d') : 'Start'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => { setStartDate(date); setPage(1); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-xs">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs gap-2">
                    <Calendar className="h-3 w-3" />
                    {endDate ? format(endDate, 'MMM d') : 'End'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => { setEndDate(date); setPage(1); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-center">
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : sortedEntries.length === 0 ? (
          <EnhancedEmptyState
            icon={FileSpreadsheet}
            title={hasActiveFilters ? 'No Matching Records' : 'No Movement History'}
            description={
              hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : 'Inventory movements will appear here as stock changes occur.'
            }
            primaryAction={hasActiveFilters ? {
              label: 'Clear Filters',
              onClick: clearFilters,
            } : undefined}
          />
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center">
                      Date
                      {getSortIcon('created_at')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                    onClick={() => handleSort('product_name')}
                  >
                    <div className="flex items-center">
                      Product
                      {getSortIcon('product_name')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap"
                    onClick={() => handleSort('change_amount')}
                  >
                    <div className="flex items-center justify-end">
                      Change
                      {getSortIcon('change_amount')}
                    </div>
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">Prev Qty</TableHead>
                  <TableHead className="text-right whitespace-nowrap">New Qty</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                    onClick={() => handleSort('reason')}
                  >
                    <div className="flex items-center">
                      Reason
                      {getSortIcon('reason')}
                    </div>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Order Ref</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 whitespace-nowrap"
                    onClick={() => handleSort('user')}
                  >
                    <div className="flex items-center">
                      User
                      {getSortIcon('user')}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm truncate max-w-[200px]">
                          {entry.product?.name || 'Unknown Product'}
                        </span>
                        {entry.product?.sku && (
                          <span className="text-xs text-muted-foreground">
                            {entry.product.sku}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        'font-semibold font-mono text-sm',
                        entry.change_amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      )}>
                        {formatChangeAmount(entry.change_amount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {entry.previous_quantity.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {entry.new_quantity.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {formatReason(entry.reason)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.order?.order_number ? (
                        <span className="text-primary font-medium">
                          #{entry.order.order_number}
                        </span>
                      ) : entry.reference_id ? (
                        <span className="text-muted-foreground text-xs">
                          {entry.reference_id.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.user?.email ? (
                        <span className="truncate max-w-[150px] block">
                          {entry.user.email}
                        </span>
                      ) : entry.performed_by ? (
                        <span className="text-muted-foreground text-xs">
                          {entry.performed_by.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={2}>Totals ({totals.count} movements)</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col gap-1">
                      <span className="text-green-600 dark:text-green-400 font-mono text-sm">
                        +{totals.totalIncrease.toFixed(2)}
                      </span>
                      <span className="text-red-600 dark:text-red-400 font-mono text-sm">
                        -{totals.totalDecrease.toFixed(2)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      'font-semibold font-mono',
                      totals.netChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      Net: {totals.netChange >= 0 ? '+' : ''}{totals.netChange.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell colSpan={3}></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Page {page} of {totalPages} ({totalCount} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
