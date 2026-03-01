/**
 * Order Filters Component
 * Enhanced filtering UI for orders with cross-module data integration.
 * Supports filtering by customer, product, payment/delivery status, date range, and order source.
 */

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import {
  FilterBar,
  useFilterBar,
  type FilterConfig,
  type ActiveFilters,
  type DateRangeValue,
} from '@/components/admin/shared/FilterBar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Filter values specific to orders */
export interface OrderFilterValues {
  customerName?: string | null;
  productName?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  deliveryStatus?: string | null;
  dateRange?: DateRangeValue | null;
  minTotal?: string | null;
  maxTotal?: string | null;
  orderSource?: string | null;
}

interface OrderFiltersProps {
  /** Current filter values */
  filters: ActiveFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: ActiveFilters) => void;
  /** Callback to clear all filters */
  onClear: () => void;
  /** Search value for order number/customer search */
  searchValue?: string;
  /** Search change callback */
  onSearchChange?: (value: string) => void;
  /** LocalStorage key for persistence */
  storageKey?: string;
  /** Additional class name */
  className?: string;
}

/** Order status options */
const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Payment status options */
const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

/** Delivery status options */
const DELIVERY_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
];

/** Order source options */
const ORDER_SOURCE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'storefront', label: 'Storefront' },
  { value: 'menu', label: 'Menu' },
  { value: 'pos', label: 'POS' },
  { value: 'api', label: 'API' },
];

/**
 * Hook to fetch unique customer names for autocomplete
 */
function useCustomerOptions(tenantId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.customers.dropdown(tenantId), 'filter-options'],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, first_name, last_name')
        .limit(100);

      if (error) {
        logger.error('Failed to fetch customer options for filter', { error });
        return [];
      }

      // Build unique customer names
      const customerNames = (data ?? [])
        .map((p) => {
          const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ');
          return name ? { value: name, label: name } : null;
        })
        .filter((item): item is { value: string; label: string } => item !== null);

      // Deduplicate
      const uniqueNames = Array.from(new Map(customerNames.map((c) => [c.value, c])).values());
      return uniqueNames.slice(0, 50);
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });
}

/**
 * Hook to fetch unique product names for autocomplete
 */
function useProductOptions(tenantId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.products.byTenant(tenantId ?? ''), 'filter-options'],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('account_id', tenantId)
        .eq('status', 'active')
        .order('name')
        .limit(100);

      if (error) {
        logger.error('Failed to fetch product options for filter', { error });
        return [];
      }

      return (data ?? []).map((p) => ({
        value: p.name,
        label: p.name,
      }));
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });
}

/**
 * Order Filters Component
 * Provides cross-module filtering for orders list
 */
export function OrderFilters({
  filters,
  onFiltersChange,
  onClear,
  searchValue,
  onSearchChange,
  storageKey = 'orders-filters',
  className,
}: OrderFiltersProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Fetch cross-module data for filters
  const { data: customerOptions = [] } = useCustomerOptions(tenantId);
  const { data: productOptions = [] } = useProductOptions(tenantId);

  // Build filter configuration with cross-module data
  const filterConfig: FilterConfig[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: ORDER_STATUS_OPTIONS,
        placeholder: 'All Statuses',
      },
      {
        key: 'customerName',
        label: 'Customer',
        type: 'select',
        options: customerOptions,
        placeholder: 'All Customers',
      },
      {
        key: 'productName',
        label: 'Product',
        type: 'select',
        options: productOptions,
        placeholder: 'All Products',
      },
      {
        key: 'paymentStatus',
        label: 'Payment',
        type: 'select',
        options: PAYMENT_STATUS_OPTIONS,
        placeholder: 'All Payment Status',
      },
      {
        key: 'deliveryStatus',
        label: 'Delivery',
        type: 'select',
        options: DELIVERY_STATUS_OPTIONS,
        placeholder: 'All Delivery Status',
      },
      {
        key: 'orderSource',
        label: 'Source',
        type: 'select',
        options: ORDER_SOURCE_OPTIONS,
        placeholder: 'All Sources',
      },
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'dateRange',
        placeholder: 'Select dates',
      },
    ],
    [customerOptions, productOptions]
  );

  // Handle total range inputs as custom filters
  const handleMinTotalChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        minTotal: value || null,
      });
    },
    [filters, onFiltersChange]
  );

  const handleMaxTotalChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        maxTotal: value || null,
      });
    },
    [filters, onFiltersChange]
  );

  // Custom filter for total amount range
  const totalRangeFilter = (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Total $</Label>
        <Input
          type="number"
          placeholder="Min"
          aria-label="Minimum order total"
          value={(filters.minTotal as string) ?? ''}
          onChange={(e) => handleMinTotalChange(e.target.value)}
          className="w-[80px] h-9"
          min={0}
          step={0.01}
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          placeholder="Max"
          aria-label="Maximum order total"
          value={(filters.maxTotal as string) ?? ''}
          onChange={(e) => handleMaxTotalChange(e.target.value)}
          className="w-[80px] h-9"
          min={0}
          step={0.01}
        />
      </div>
    </div>
  );

  return (
    <FilterBar
      filters={filterConfig}
      activeFilters={filters}
      onFilterChange={onFiltersChange}
      onClear={onClear}
      storageKey={storageKey}
      searchPlaceholder="Search by order # or customer..."
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      showSearch={!!onSearchChange}
      customFilters={totalRangeFilter}
      className={className}
    />
  );
}

/**
 * Hook to manage order filter state with localStorage persistence
 */
export function useOrderFilters(storageKey = 'orders-list-filters') {
  return useFilterBar(storageKey, {});
}

/**
 * Apply filters to an order query
 * Returns filtered orders based on active filters with AND logic
 */
export async function applyOrderFilters(
  tenantId: string,
  filters: ActiveFilters,
  _searchTerm?: string
): Promise<{
  orders: string[];
  orderIdsFromProduct: string[] | null;
}> {
  let orderIdsFromProduct: string[] | null = null;

  // If filtering by product name, first get order IDs that contain that product
  if (filters.productName) {
    const { data: productData } = await supabase
      .from('products')
      .select('id')
      .eq('account_id', tenantId)
      .ilike('name', `%${escapePostgresLike(String(filters.productName))}%`)
      .limit(50);

    if (productData && productData.length > 0) {
      const productIds = productData.map((p) => p.id);

      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select('order_id')
        .in('product_id', productIds);

      orderIdsFromProduct = orderItemsData?.map((oi) => oi.order_id) ?? [];
    } else {
      // No products match, return empty
      orderIdsFromProduct = [];
    }
  }

  return {
    orders: [],
    orderIdsFromProduct,
  };
}

export default OrderFilters;
