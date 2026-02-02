import { useState, useMemo } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import Package from "lucide-react/dist/esm/icons/package";
import ArrowUpCircle from "lucide-react/dist/esm/icons/arrow-up-circle";
import ArrowDownCircle from "lucide-react/dist/esm/icons/arrow-down-circle";
import ArrowRightLeft from "lucide-react/dist/esm/icons/arrow-right-left";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import Truck from "lucide-react/dist/esm/icons/truck";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Filter from "lucide-react/dist/esm/icons/filter";
import Search from "lucide-react/dist/esm/icons/search";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import History from "lucide-react/dist/esm/icons/history";
import FileText from "lucide-react/dist/esm/icons/file-text";
import User from "lucide-react/dist/esm/icons/user";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Skeleton } from '@/components/ui/skeleton';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface StockHistoryEntry {
  id: string;
  tenant_id: string;
  product_id: string;
  change_type: 'stock_in' | 'stock_out' | 'transfer' | 'adjustment' | 'sale' | 'return' | 'receiving' | 'disposal';
  previous_quantity: number;
  new_quantity: number;
  change_amount: number;
  reference_type: string | null;
  reference_id: string | null;
  location_id: string | null;
  batch_id: string | null;
  reason: string | null;
  notes: string | null;
  performed_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string | null;
  };
}

interface StockHistoryFilters {
  productId?: string;
  changeType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page: number;
  pageSize: number;
}

const CHANGE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Package; colorClass: string; bgClass: string }> = {
  stock_in: { label: 'Stock In', icon: ArrowUpCircle, colorClass: 'text-green-600', bgClass: 'bg-green-100 border-green-200 dark:bg-green-950 dark:border-green-800' },
  stock_out: { label: 'Stock Out', icon: ArrowDownCircle, colorClass: 'text-red-600', bgClass: 'bg-red-100 border-red-200 dark:bg-red-950 dark:border-red-800' },
  transfer: { label: 'Transfer', icon: ArrowRightLeft, colorClass: 'text-blue-600', bgClass: 'bg-blue-100 border-blue-200 dark:bg-blue-950 dark:border-blue-800' },
  adjustment: { label: 'Adjustment', icon: Wrench, colorClass: 'text-yellow-600', bgClass: 'bg-yellow-100 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800' },
  sale: { label: 'Sale', icon: ShoppingCart, colorClass: 'text-purple-600', bgClass: 'bg-purple-100 border-purple-200 dark:bg-purple-950 dark:border-purple-800' },
  return: { label: 'Return', icon: RotateCcw, colorClass: 'text-orange-600', bgClass: 'bg-orange-100 border-orange-200 dark:bg-orange-950 dark:border-orange-800' },
  receiving: { label: 'Receiving', icon: Truck, colorClass: 'text-teal-600', bgClass: 'bg-teal-100 border-teal-200 dark:bg-teal-950 dark:border-teal-800' },
  disposal: { label: 'Disposal', icon: Trash2, colorClass: 'text-gray-600', bgClass: 'bg-gray-100 border-gray-200 dark:bg-gray-800 dark:border-gray-700' },
};

const REASON_LABELS: Record<string, string> = {
  receiving: 'Receiving/Restock',
  damage: 'Damage/Loss',
  theft: 'Theft',
  quality: 'Quality Issue',
  count: 'Count Correction',
  sale: 'Sale',
  other: 'Other',
};

function getChangeTypeConfig(changeType: string) {
  return CHANGE_TYPE_CONFIG[changeType] || {
    label: changeType,
    icon: Package,
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted border-border',
  };
}

function formatChangeAmount(amount: number): string {
  if (amount > 0) return `+${amount.toFixed(2)}`;
  return amount.toFixed(2);
}

function formatReason(reason: string | null): string {
  if (!reason) return '';
  return REASON_LABELS[reason] || reason;
}

interface StockHistoryLogProps {
  productId?: string;
  className?: string;
  showHeader?: boolean;
  compact?: boolean;
}

export function StockHistoryLog({
  productId,
  className,
  showHeader = true,
  compact = false,
}: StockHistoryLogProps) {
  const { tenant } = useTenantAdminAuth();

  // Filter state
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(1);
  const pageSize = compact ? 10 : 25;

  // Build filters
  const filters: StockHistoryFilters = useMemo(() => ({
    productId,
    changeType: changeTypeFilter !== 'all' ? changeTypeFilter : undefined,
    startDate: startDate ? startOfDay(startDate).toISOString() : undefined,
    endDate: endDate ? endOfDay(endDate).toISOString() : undefined,
    search: searchTerm || undefined,
    page,
    pageSize,
  }), [productId, changeTypeFilter, startDate, endDate, searchTerm, page, pageSize]);

  // Fetch history with pagination
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.inventory.history({
      tenantId: tenant?.id,
      ...filters,
    }),
    queryFn: async () => {
      if (!tenant?.id) return { entries: [], totalCount: 0 };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('inventory_history')
        .select(`
          *,
          product:products(id, name, sku)
        `, { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (filters.productId) {
        query = query.eq('product_id', filters.productId);
      }

      if (filters.changeType) {
        query = query.eq('change_type', filters.changeType);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Calculate offset for pagination
      const offset = (filters.page - 1) * filters.pageSize;
      query = query.range(offset, offset + filters.pageSize - 1);

      const { data: entries, error: queryError, count } = await query;

      if (queryError) {
        logger.error('Failed to fetch stock history', { error: queryError, tenantId: tenant.id });
        throw queryError;
      }

      // Client-side search filter (for product name/SKU)
      let filteredEntries = (entries || []) as StockHistoryEntry[];
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredEntries = filteredEntries.filter(entry =>
          entry.product?.name?.toLowerCase().includes(searchLower) ||
          entry.product?.sku?.toLowerCase().includes(searchLower) ||
          entry.reason?.toLowerCase().includes(searchLower) ||
          entry.notes?.toLowerCase().includes(searchLower)
        );
      }

      return {
        entries: filteredEntries,
        totalCount: count || 0
      };
    },
    enabled: !!tenant?.id,
  });

  const { entries = [], totalCount = 0 } = data || {};
  const totalPages = Math.ceil(totalCount / pageSize);

  // Quick date presets
  const setDatePreset = (preset: 'today' | '7days' | '30days' | 'all') => {
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
      case 'all':
        setStartDate(undefined);
        setEndDate(undefined);
        break;
    }
    setPage(1);
  };

  const clearFilters = () => {
    setChangeTypeFilter('all');
    setSearchTerm('');
    setStartDate(undefined);
    setEndDate(undefined);
    setPage(1);
  };

  const hasActiveFilters = changeTypeFilter !== 'all' || searchTerm || startDate || endDate;

  if (error) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Stock History
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <p className="text-center text-destructive py-4">
            Failed to load stock history. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <History className="h-5 w-5" />
                Stock History Log
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Complete audit trail of all stock changes
              </CardDescription>
            </div>
            {!compact && (
              <Badge variant="outline" className="self-start sm:self-auto">
                {totalCount} records
              </Badge>
            )}
          </div>
        </CardHeader>
      )}

      <CardContent className={showHeader ? '' : 'pt-6'}>
        {/* Filters */}
        {!compact && (
          <div className="space-y-4 mb-6">
            {/* Search and Type Filter Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products, reasons, notes..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={changeTypeFilter} onValueChange={(v) => { setChangeTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="stock_in">Stock In</SelectItem>
                  <SelectItem value="stock_out">Stock Out</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="receiving">Receiving</SelectItem>
                  <SelectItem value="disposal">Disposal</SelectItem>
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
        )}

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: compact ? 5 : 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-start">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EnhancedEmptyState
            icon={History}
            title={hasActiveFilters ? 'No Matching Records' : 'No Stock History'}
            description={
              hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : 'Stock changes will appear here as inventory is adjusted.'
            }
            primaryAction={hasActiveFilters ? {
              label: 'Clear Filters',
              onClick: clearFilters,
            } : undefined}
          />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <StockHistoryRow key={entry.id} entry={entry} compact={compact} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!compact && totalPages > 1 && (
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

interface StockHistoryRowProps {
  entry: StockHistoryEntry;
  compact?: boolean;
}

function StockHistoryRow({ entry, compact = false }: StockHistoryRowProps) {
  const config = getChangeTypeConfig(entry.change_type);
  const Icon = config.icon;
  const isPositive = entry.change_amount > 0;

  return (
    <div className={cn(
      "flex gap-3 items-start p-3 rounded-lg border transition-colors hover:bg-muted/50",
      config.bgClass
    )}>
      {/* Icon */}
      <div className={cn(
        "h-10 w-10 rounded-full flex items-center justify-center shrink-0 bg-background border",
        config.colorClass
      )}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs shrink-0">
              {config.label}
            </Badge>
            {entry.product && (
              <span className="font-medium text-sm truncate max-w-[200px]">
                {entry.product.name}
              </span>
            )}
            {entry.product?.sku && (
              <span className="text-xs text-muted-foreground">
                ({entry.product.sku})
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(entry.created_at), compact ? 'MMM d, h:mm a' : 'MMM d, yyyy h:mm a')}
          </span>
        </div>

        {/* Quantity Change */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn(
            "text-sm font-semibold font-mono",
            isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            {formatChangeAmount(entry.change_amount)} lbs
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            ({entry.previous_quantity.toFixed(2)} &rarr; {entry.new_quantity.toFixed(2)})
          </span>
        </div>

        {/* Reason */}
        {entry.reason && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              <span className="font-medium">Reason:</span> {formatReason(entry.reason)}
            </span>
          </div>
        )}

        {/* Notes */}
        {entry.notes && !compact && (
          <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">
            {entry.notes}
          </p>
        )}

        {/* Reference & Meta Row */}
        {!compact && (entry.reference_type || entry.performed_by) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            {entry.reference_type && (
              <span className="flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {entry.reference_type}
                {entry.reference_id && ` #${entry.reference_id.slice(0, 8)}`}
              </span>
            )}
            {entry.performed_by && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {entry.performed_by.slice(0, 8)}...
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
