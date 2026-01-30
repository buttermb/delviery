/**
 * OrderFilters
 * Filter controls for the orders management page.
 * Provides status, date range, customer, and product filtering.
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { Search, X, RefreshCw, Filter } from 'lucide-react';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'in_transit' | 'delivered' | 'cancelled';

export interface OrderFiltersState {
  status: OrderStatus | 'all';
  dateRange: { from: Date | undefined; to: Date | undefined };
  customerSearch: string;
  productSearch: string;
}

interface OrderFiltersProps {
  filters: OrderFiltersState;
  onFilterChange: (filters: Partial<OrderFiltersState>) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  totalCount?: number;
  filteredCount?: number;
}

const STATUS_OPTIONS: Array<{ value: OrderStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function OrderFilters({
  filters,
  onFilterChange,
  onRefresh,
  isLoading,
  totalCount,
  filteredCount,
}: OrderFiltersProps) {
  const hasActiveFilters =
    (filters.status && filters.status !== 'all') ||
    filters.dateRange.from ||
    filters.dateRange.to ||
    (filters.customerSearch && filters.customerSearch.length > 0) ||
    (filters.productSearch && filters.productSearch.length > 0);

  const activeFilterCount = [
    filters.status !== 'all',
    filters.dateRange.from || filters.dateRange.to,
    filters.customerSearch && filters.customerSearch.length > 0,
    filters.productSearch && filters.productSearch.length > 0,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFilterChange({
      status: 'all',
      dateRange: { from: undefined, to: undefined },
      customerSearch: '',
      productSearch: '',
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Customer Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={filters.customerSearch || ''}
            onChange={(e) => onFilterChange({ customerSearch: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Product Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={filters.productSearch || ''}
            onChange={(e) => onFilterChange({ productSearch: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => onFilterChange({ status: value as OrderStatus | 'all' })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range */}
        <DateRangePickerWithPresets
          dateRange={filters.dateRange}
          onDateRangeChange={(range) => onFilterChange({ dateRange: range })}
          placeholder="Filter by date"
          className="w-[220px]"
        />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          )}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {hasActiveFilters && (
          <Filter className="h-3 w-3" />
        )}
        {totalCount !== undefined && filteredCount !== undefined ? (
          <span>
            {filteredCount === 0
              ? 'No orders'
              : filteredCount === totalCount
              ? `${totalCount} ${totalCount === 1 ? 'order' : 'orders'}`
              : `${filteredCount} of ${totalCount} orders`}
            {hasActiveFilters && ' (filtered)'}
          </span>
        ) : totalCount !== undefined ? (
          <span>
            {totalCount === 0 ? 'No orders' : `${totalCount} ${totalCount === 1 ? 'order' : 'orders'} found`}
            {hasActiveFilters && ' (filtered)'}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Helper function to create default filter state
 */
export function createDefaultOrderFilters(): OrderFiltersState {
  return {
    status: 'all',
    dateRange: { from: undefined, to: undefined },
    customerSearch: '',
    productSearch: '',
  };
}
