/**
 * Live Orders Filters Component
 * Provides status, date range, search, fulfillment, and payment filters
 * for the Live Orders kanban board.
 */

import { useMemo } from 'react';

import type { FilterConfig } from '@/components/admin/shared/FilterBar';
import {
  FilterBar,
  useFilterBar,
  type ActiveFilters,
  type DateRangeValue,
} from '@/components/admin/shared/FilterBar';

/** Status options for live orders */
const LIVE_ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready_for_pickup', label: 'Ready' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
];

/** Payment status options */
const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

/** Fulfillment type options */
const FULFILLMENT_OPTIONS = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'pickup', label: 'Pickup' },
];

/** Source options */
const SOURCE_OPTIONS = [
  { value: 'app', label: 'App' },
  { value: 'menu', label: 'Menu' },
];

interface LiveOrdersFiltersProps {
  filters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  onClear: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  className?: string;
}

export function LiveOrdersFilters({
  filters,
  onFiltersChange,
  onClear,
  searchValue,
  onSearchChange,
  className,
}: LiveOrdersFiltersProps) {
  const filterConfig: FilterConfig[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: LIVE_ORDER_STATUS_OPTIONS,
        placeholder: 'All Statuses',
      },
      {
        key: 'paymentStatus',
        label: 'Payment',
        type: 'select',
        options: PAYMENT_STATUS_OPTIONS,
        placeholder: 'All Payments',
      },
      {
        key: 'fulfillment',
        label: 'Fulfillment',
        type: 'select',
        options: FULFILLMENT_OPTIONS,
        placeholder: 'All Types',
      },
      {
        key: 'source',
        label: 'Source',
        type: 'select',
        options: SOURCE_OPTIONS,
        placeholder: 'All Sources',
      },
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'dateRange',
        placeholder: 'Select dates',
      },
    ],
    []
  );

  return (
    <FilterBar
      filters={filterConfig}
      activeFilters={filters}
      onFilterChange={onFiltersChange}
      onClear={onClear}
      storageKey="live-orders-filters"
      searchPlaceholder="Search by order #..."
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      showSearch
      className={className}
    />
  );
}

/** Filter values parsed from ActiveFilters for live orders */
export interface LiveOrderFilterValues {
  status: string | null;
  paymentStatus: string | null;
  fulfillment: string | null;
  source: string | null;
  dateRange: DateRangeValue | null;
  search: string;
}

/** Parse ActiveFilters into typed filter values */
export function parseLiveOrderFilters(
  filters: ActiveFilters,
  search: string
): LiveOrderFilterValues {
  return {
    status: (filters.status as string) ?? null,
    paymentStatus: (filters.paymentStatus as string) ?? null,
    fulfillment: (filters.fulfillment as string) ?? null,
    source: (filters.source as string) ?? null,
    dateRange: (filters.dateRange as DateRangeValue) ?? null,
    search,
  };
}

/** Hook to manage live order filter state */
export function useLiveOrderFilters() {
  return useFilterBar('live-orders-filters', {});
}
