/**
 * CustomerExport Component
 *
 * Exports customer list with enriched data:
 * - LTV, order count, avg order value, last order date
 * - Segment, tags, total paid, outstanding balance
 *
 * Supports CSV and JSON formats with column selection.
 * Filter by segment or tags before export.
 * Logs export activity to activity_log via useExport hook.
 */

import { useState, useCallback, useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import type { ExportColumn } from '@/lib/export';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Loader2,
  FileSpreadsheet,
  FileJson,
  ChevronDown,
  Check,
  Filter,
  Tag,
} from 'lucide-react';
import { useExport } from '@/hooks/useExport';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { EntityType } from '@/hooks/useActivityLog';
import { useTags } from '@/hooks/useCustomerTags';
import { type CustomerSegment } from '@/hooks/useCustomerSegments';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

// Extended customer data with enriched information
interface CustomerWithEnrichedData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: string | null;
  created_at: string | null;
  // Enriched data
  ltv: number;
  order_count: number;
  avg_order_value: number;
  last_order_date: string | null;
  first_order_date: string | null;
  segment: CustomerSegment;
  tags: string[];
  tag_names: string;
  total_paid: number;
  outstanding_balance: number;
  days_since_last_order: number | null;
  loyalty_points: number;
  loyalty_tier: string | null;
}

// Export field configuration
interface ExportFieldOption {
  id: string;
  label: string;
  description: string;
  group: 'basic' | 'contact' | 'orders' | 'financial' | 'segmentation' | 'metadata';
  type?: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'datetime' | 'boolean';
  recommended?: boolean;
  default?: boolean;
}

// Available export fields organized by group
const EXPORT_FIELD_OPTIONS: ExportFieldOption[] = [
  // Basic Information
  { id: 'first_name', label: 'First Name', description: 'Customer first name', group: 'basic', type: 'string', recommended: true, default: true },
  { id: 'last_name', label: 'Last Name', description: 'Customer last name', group: 'basic', type: 'string', recommended: true, default: true },
  { id: 'status', label: 'Status', description: 'Customer status (active/inactive)', group: 'basic', type: 'string' },

  // Contact Information
  { id: 'email', label: 'Email', description: 'Email address', group: 'contact', type: 'string', recommended: true, default: true },
  { id: 'phone', label: 'Phone', description: 'Phone number', group: 'contact', type: 'string', recommended: true, default: true },
  { id: 'address', label: 'Address', description: 'Street address', group: 'contact', type: 'string' },
  { id: 'city', label: 'City', description: 'City', group: 'contact', type: 'string' },
  { id: 'state', label: 'State', description: 'State/Province', group: 'contact', type: 'string' },
  { id: 'zip_code', label: 'ZIP Code', description: 'Postal code', group: 'contact', type: 'string' },

  // Order Metrics
  { id: 'order_count', label: 'Order Count', description: 'Total number of orders', group: 'orders', type: 'number', recommended: true, default: true },
  { id: 'ltv', label: 'Lifetime Value (LTV)', description: 'Total value of all orders', group: 'orders', type: 'currency', recommended: true, default: true },
  { id: 'avg_order_value', label: 'Avg Order Value', description: 'Average order amount', group: 'orders', type: 'currency', recommended: true, default: true },
  { id: 'last_order_date', label: 'Last Order Date', description: 'Date of most recent order', group: 'orders', type: 'date', recommended: true, default: true },
  { id: 'first_order_date', label: 'First Order Date', description: 'Date of first order', group: 'orders', type: 'date' },
  { id: 'days_since_last_order', label: 'Days Since Last Order', description: 'Days since most recent order', group: 'orders', type: 'number' },

  // Financial
  { id: 'total_paid', label: 'Total Paid', description: 'Total amount paid', group: 'financial', type: 'currency', recommended: true, default: true },
  { id: 'outstanding_balance', label: 'Outstanding Balance', description: 'Amount still owed', group: 'financial', type: 'currency', recommended: true, default: true },

  // Segmentation
  { id: 'segment', label: 'Segment', description: 'Customer segment (VIP, Active, At Risk, etc.)', group: 'segmentation', type: 'string', recommended: true, default: true },
  { id: 'tag_names', label: 'Tags', description: 'Assigned tags (comma-separated)', group: 'segmentation', type: 'string', recommended: true, default: true },
  { id: 'loyalty_points', label: 'Loyalty Points', description: 'Current loyalty points balance', group: 'segmentation', type: 'number' },
  { id: 'loyalty_tier', label: 'Loyalty Tier', description: 'Current loyalty tier', group: 'segmentation', type: 'string' },

  // Metadata
  { id: 'id', label: 'Customer ID', description: 'Unique customer identifier', group: 'metadata', type: 'string' },
  { id: 'created_at', label: 'Created Date', description: 'When customer was created', group: 'metadata', type: 'datetime' },
];

// Field groups for UI organization
const FIELD_GROUPS = [
  { id: 'basic', label: 'Basic Information', description: 'Name and status' },
  { id: 'contact', label: 'Contact Details', description: 'Email, phone, address' },
  { id: 'orders', label: 'Order Metrics', description: 'LTV, order count, averages' },
  { id: 'financial', label: 'Financial', description: 'Payments and balances' },
  { id: 'segmentation', label: 'Segmentation', description: 'Segments and tags' },
  { id: 'metadata', label: 'Metadata', description: 'IDs and dates' },
] as const;

// Segment thresholds (matching useCustomerSegments)
const SEGMENT_THRESHOLDS = {
  NEW_DAYS: 30,
  ACTIVE_DAYS: 60,
  AT_RISK_DAYS: 90,
  VIP_PERCENTILE: 10,
};

type ExportFormat = 'csv' | 'json';

interface CustomerExportProps {
  /** Custom filename prefix */
  filenamePrefix?: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Additional CSS classes */
  className?: string;
  /** Show button label */
  showLabel?: boolean;
  /** Disable the button */
  disabled?: boolean;
}

// Flattened row type for export
type ExportRow = Record<string, string | number | boolean | null>;

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate activity segment based on order dates
 */
function calculateSegment(
  firstOrderDate: Date | null,
  lastOrderDate: Date | null,
  totalSpend: number,
  vipThreshold: number
): CustomerSegment {
  const now = new Date();

  // Check VIP first (top 10% by spend)
  if (totalSpend >= vipThreshold && totalSpend > 0) {
    return 'vip';
  }

  // No orders = new
  if (!firstOrderDate || !lastOrderDate) {
    return 'new';
  }

  const daysSinceFirst = daysBetween(now, firstOrderDate);
  const daysSinceLast = daysBetween(now, lastOrderDate);

  // New: first order within 30 days
  if (daysSinceFirst <= SEGMENT_THRESHOLDS.NEW_DAYS) {
    return 'new';
  }

  // Active: ordered within 60 days
  if (daysSinceLast <= SEGMENT_THRESHOLDS.ACTIVE_DAYS) {
    return 'active';
  }

  // At risk: no order in 60-90 days
  if (daysSinceLast <= SEGMENT_THRESHOLDS.AT_RISK_DAYS) {
    return 'at_risk';
  }

  // Churned: no order in 90+ days
  return 'churned';
}

/**
 * Calculate VIP threshold (top 10% by spend)
 */
function calculateVipThreshold(spendValues: number[]): number {
  if (spendValues.length === 0) return Infinity;
  const sorted = [...spendValues].sort((a, b) => b - a);
  const vipIndex = Math.floor(sorted.length * (SEGMENT_THRESHOLDS.VIP_PERCENTILE / 100));
  return sorted[Math.min(vipIndex, sorted.length - 1)] || 0;
}

/**
 * Hook to fetch customers with all enriched data for export
 */
function useCustomersWithEnrichedData(
  tenantId: string | undefined,
  enabled: boolean,
  filterSegment?: CustomerSegment,
  filterTagIds?: string[]
) {
  return useQuery({
    queryKey: [...queryKeys.customers.all, 'export-enriched', tenantId, filterSegment, filterTagIds],
    queryFn: async (): Promise<CustomerWithEnrichedData[]> => {
      if (!tenantId) return [];

      logger.info('[CustomerExport] Fetching customers with enriched data', {
        tenantId,
        filterSegment,
        filterTagIds,
      });

      // Fetch customers
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, address, city, state, zip_code, status, created_at, loyalty_points, loyalty_tier')
        .eq('tenant_id', tenantId);

      if (customersError) {
        logger.error('[CustomerExport] Failed to fetch customers', customersError);
        throw customersError;
      }

      if (!customers || customers.length === 0) {
        return [];
      }

      const customerIds = customers.map(c => c.id);

      // Fetch all completed orders for these customers
      const { data: orders } = await supabase
        .from('unified_orders')
        .select('id, customer_id, total_amount, amount_paid, created_at')
        .eq('tenant_id', tenantId)
        .in('customer_id', customerIds);

      // Fetch customer tags
      const { data: customerTags } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { in: (col: string, vals: string[]) => Promise<{ data: Array<{ contact_id: string; tag: { id: string; name: string; color: string } | null }> | null }> } } } })
        .from('customer_tags')
        .select('contact_id, tag:tags(id, name, color)')
        .eq('tenant_id', tenantId)
        .in('contact_id', customerIds);

      // Build lookup maps
      const ordersByCustomer = new Map<string, Array<{
        total_amount: number | null;
        amount_paid: number | null;
        created_at: string;
      }>>();

      const tagsByCustomer = new Map<string, Array<{ id: string; name: string }>>();

      // Initialize maps
      for (const customer of customers) {
        ordersByCustomer.set(customer.id, []);
        tagsByCustomer.set(customer.id, []);
      }

      // Process orders
      if (orders) {
        for (const order of orders) {
          const customerOrders = ordersByCustomer.get(order.customer_id);
          if (customerOrders) {
            customerOrders.push({
              total_amount: order.total_amount,
              amount_paid: order.amount_paid,
              created_at: order.created_at,
            });
          }
        }
      }

      // Process tags
      if (customerTags) {
        for (const ct of customerTags) {
          if (ct.tag) {
            const tags = tagsByCustomer.get(ct.contact_id);
            if (tags) {
              tags.push({ id: ct.tag.id, name: ct.tag.name });
            }
          }
        }
      }

      // Calculate spend totals for VIP threshold
      const spendByCustomer = new Map<string, number>();
      for (const [customerId, customerOrders] of ordersByCustomer) {
        const totalSpend = customerOrders.reduce(
          (sum, order) => sum + (order.total_amount ?? 0),
          0
        );
        spendByCustomer.set(customerId, totalSpend);
      }

      const vipThreshold = calculateVipThreshold(Array.from(spendByCustomer.values()));
      const now = new Date();

      // Build enriched customer data
      let enrichedCustomers: CustomerWithEnrichedData[] = customers.map(customer => {
        const customerOrders = ordersByCustomer.get(customer.id) || [];
        const customerTagList = tagsByCustomer.get(customer.id) || [];

        // Calculate order metrics
        const orderCount = customerOrders.length;
        const ltv = customerOrders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
        const totalPaid = customerOrders.reduce((sum, o) => sum + (o.amount_paid ?? 0), 0);
        const outstandingBalance = ltv - totalPaid;
        const avgOrderValue = orderCount > 0 ? ltv / orderCount : 0;

        // Get order dates
        const orderDates = customerOrders
          .map(o => new Date(o.created_at))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());

        const firstOrderDate = orderDates.length > 0 ? orderDates[0] : null;
        const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] : null;

        // Calculate segment
        const segment = calculateSegment(
          firstOrderDate,
          lastOrderDate,
          ltv,
          vipThreshold
        );

        // Days since last order
        const daysSinceLastOrder = lastOrderDate ? daysBetween(now, lastOrderDate) : null;

        return {
          id: customer.id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          zip_code: customer.zip_code,
          status: customer.status,
          created_at: customer.created_at,
          ltv: Math.round(ltv * 100) / 100,
          order_count: orderCount,
          avg_order_value: Math.round(avgOrderValue * 100) / 100,
          last_order_date: lastOrderDate?.toISOString() ?? null,
          first_order_date: firstOrderDate?.toISOString() ?? null,
          segment,
          tags: customerTagList.map(t => t.id),
          tag_names: customerTagList.map(t => t.name).join(', '),
          total_paid: Math.round(totalPaid * 100) / 100,
          outstanding_balance: Math.round(outstandingBalance * 100) / 100,
          days_since_last_order: daysSinceLastOrder,
          loyalty_points: customer.loyalty_points ?? 0,
          loyalty_tier: customer.loyalty_tier,
        };
      });

      // Apply segment filter
      if (filterSegment) {
        enrichedCustomers = enrichedCustomers.filter(c => c.segment === filterSegment);
      }

      // Apply tag filter
      if (filterTagIds && filterTagIds.length > 0) {
        enrichedCustomers = enrichedCustomers.filter(c =>
          filterTagIds.some(tagId => c.tags.includes(tagId))
        );
      }

      logger.info('[CustomerExport] Enriched data ready', {
        totalCustomers: enrichedCustomers.length,
        filterSegment,
        filterTagIds,
      });

      return enrichedCustomers;
    },
    enabled: enabled && !!tenantId,
    staleTime: 60000, // 1 minute
  });
}

export function CustomerExport({
  filenamePrefix = 'customers-export',
  variant = 'outline',
  size = 'default',
  className = '',
  showLabel = true,
  disabled = false,
}: CustomerExportProps) {
  const { tenant } = useTenantAdminAuth();
  const { exportCSV, exportJSON, isExporting, progress } = useExport();
  const { data: availableTags } = useTags();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELD_OPTIONS.filter(f => f.default).map(f => f.id)
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [filterSegment, setFilterSegment] = useState<CustomerSegment | ''>('');
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  // Fetch customers with enriched data when dialog is open
  const {
    data: customers,
    isLoading: isLoadingCustomers,
    error: fetchError,
  } = useCustomersWithEnrichedData(
    tenant?.id,
    dialogOpen,
    filterSegment || undefined,
    filterTagIds.length > 0 ? filterTagIds : undefined
  );

  const customerCount = customers?.length ?? 0;

  // Group fields by category
  const fieldsByGroup = useMemo(() => {
    const groups: Record<string, ExportFieldOption[]> = {};
    for (const field of EXPORT_FIELD_OPTIONS) {
      if (!groups[field.group]) {
        groups[field.group] = [];
      }
      groups[field.group].push(field);
    }
    return groups;
  }, []);

  // Toggle field selection
  const toggleField = useCallback((fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  }, []);

  // Toggle entire group
  const toggleGroup = useCallback((groupId: string) => {
    const groupFields = fieldsByGroup[groupId];
    if (!groupFields) return;

    const groupIds = groupFields.map(f => f.id);
    const allSelected = groupIds.every(id => selectedFields.includes(id));

    setSelectedFields(prev => {
      if (allSelected) {
        return prev.filter(id => !groupIds.includes(id));
      } else {
        const newSet = new Set([...prev, ...groupIds]);
        return Array.from(newSet);
      }
    });
  }, [fieldsByGroup, selectedFields]);

  // Quick selection actions
  const selectAll = useCallback(() => {
    setSelectedFields(EXPORT_FIELD_OPTIONS.map(f => f.id));
  }, []);

  const selectNone = useCallback(() => {
    setSelectedFields([]);
  }, []);

  const selectRecommended = useCallback(() => {
    setSelectedFields(EXPORT_FIELD_OPTIONS.filter(f => f.recommended).map(f => f.id));
  }, []);

  // Check group selection state
  const getGroupState = useCallback((groupId: string): 'all' | 'some' | 'none' => {
    const groupFields = fieldsByGroup[groupId];
    if (!groupFields) return 'none';

    const selectedCount = groupFields.filter(f => selectedFields.includes(f.id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === groupFields.length) return 'all';
    return 'some';
  }, [fieldsByGroup, selectedFields]);

  // Toggle tag filter
  const toggleTagFilter = useCallback((tagId: string) => {
    setFilterTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  // Build export data based on selected fields
  const buildExportData = useCallback((): ExportRow[] => {
    if (!customers) return [];

    return customers.map(customer => {
      const row: ExportRow = {};
      for (const fieldId of selectedFields) {
        const value = customer[fieldId as keyof CustomerWithEnrichedData];
        if (value === undefined || value === null) {
          row[fieldId] = null;
        } else if (Array.isArray(value)) {
          row[fieldId] = value.join(', ');
        } else if (typeof value === 'object') {
          row[fieldId] = JSON.stringify(value);
        } else {
          row[fieldId] = value as string | number | boolean;
        }
      }
      return row;
    });
  }, [customers, selectedFields]);

  // Build column configuration for CSV export
  const buildColumns = useCallback((): ExportColumn<ExportRow>[] => {
    return EXPORT_FIELD_OPTIONS
      .filter(f => selectedFields.includes(f.id))
      .map(f => ({
        key: f.id,
        header: f.label,
        type: f.type || 'string',
      }));
  }, [selectedFields]);

  // Handle export action
  const handleExport = useCallback(async () => {
    if (!customers || customers.length === 0) {
      logger.warn('[CustomerExport] No customers to export');
      return;
    }

    if (selectedFields.length === 0) {
      logger.warn('[CustomerExport] No fields selected');
      return;
    }

    const data = buildExportData();
    const dateStr = format(new Date(), 'yyyy-MM-dd');

    logger.info('[CustomerExport] Starting export', {
      format: exportFormat,
      customerCount: customers.length,
      fieldCount: selectedFields.length,
      filterSegment,
      filterTagIds,
      tenantId: tenant?.id,
    });

    try {
      if (exportFormat === 'csv') {
        const columns = buildColumns();
        const filename = `${filenamePrefix}-${dateStr}.csv`;
        await exportCSV(data, columns, filename, {
          entityType: EntityType.CUSTOMER,
          metadata: {
            customerCount: customers.length,
            fieldCount: selectedFields.length,
            fields: selectedFields,
            format: 'csv',
            filterSegment: filterSegment || undefined,
            filterTagCount: filterTagIds.length,
          },
        });
      } else {
        const filename = `${filenamePrefix}-${dateStr}.json`;
        await exportJSON(data, filename, {
          entityType: EntityType.CUSTOMER,
          metadata: {
            customerCount: customers.length,
            fieldCount: selectedFields.length,
            fields: selectedFields,
            format: 'json',
            filterSegment: filterSegment || undefined,
            filterTagCount: filterTagIds.length,
          },
        });
      }

      setDialogOpen(false);
    } catch (error) {
      logger.error('[CustomerExport] Export failed', error instanceof Error ? error : new Error(String(error)));
    }
  }, [
    customers,
    selectedFields,
    exportFormat,
    buildExportData,
    buildColumns,
    filenamePrefix,
    exportCSV,
    exportJSON,
    tenant?.id,
    filterSegment,
    filterTagIds,
  ]);

  const selectedCount = selectedFields.length;
  const isButtonDisabled = disabled || isExporting;

  // Segment options for filter
  const segmentOptions: Array<{ value: CustomerSegment | ''; label: string }> = [
    { value: '', label: 'All Segments' },
    { value: 'vip', label: 'VIP' },
    { value: 'active', label: 'Active' },
    { value: 'new', label: 'New' },
    { value: 'at_risk', label: 'At Risk' },
    { value: 'churned', label: 'Churned' },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={className}
            disabled={isButtonDisabled}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {showLabel && <span className="ml-2">Export Customers</span>}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export with Options...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => {
            setDialogOpen(true);
            setExportFormat('csv');
          }}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Quick Export CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            setDialogOpen(true);
            setExportFormat('json');
          }}>
            <FileJson className="mr-2 h-4 w-4" />
            Quick Export JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Export Customers with Order Data</DialogTitle>
            <DialogDescription>
              Export customers with enriched data including LTV, order metrics, segments, and tags.
              {isLoadingCustomers ? (
                <Skeleton className="h-4 w-48 mt-1" />
              ) : fetchError ? (
                <span className="block mt-1 text-destructive">
                  Error loading customers. Please try again.
                </span>
              ) : (
                <span className="block mt-1">
                  <Badge variant="secondary" className="font-mono">
                    {customerCount} {customerCount === 1 ? 'customer' : 'customers'}
                  </Badge>
                  {' will be exported with '}
                  <Badge variant="outline" className="font-mono">
                    {selectedCount} {selectedCount === 1 ? 'field' : 'fields'}
                  </Badge>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pre-export Filters</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {/* Segment filter */}
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Segment:</Label>
                <Select
                  value={filterSegment}
                  onValueChange={(val) => setFilterSegment(val as CustomerSegment | '')}
                >
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="All Segments" />
                  </SelectTrigger>
                  <SelectContent>
                    {segmentOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tag filter */}
              {availableTags && availableTags.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Tags:</Label>
                  <div className="flex flex-wrap gap-1">
                    {availableTags.slice(0, 5).map(tag => (
                      <Badge
                        key={tag.id}
                        variant={filterTagIds.includes(tag.id) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        style={filterTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                        onClick={() => toggleTagFilter(tag.id)}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag.name}
                      </Badge>
                    ))}
                    {availableTags.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{availableTags.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Quick select:</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectRecommended}
              className="h-7 text-xs"
            >
              Recommended
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="h-7 text-xs"
            >
              All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectNone}
              className="h-7 text-xs"
            >
              None
            </Button>
          </div>

          <Separator />

          {/* Field Selection */}
          <ScrollArea className="flex-1 pr-4 -mr-4">
            {isLoadingCustomers ? (
              <div className="space-y-4 py-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <div className="grid grid-cols-2 gap-2 pl-8">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {FIELD_GROUPS.map(group => {
                  const groupState = getGroupState(group.id);
                  const groupFields = fieldsByGroup[group.id] || [];

                  return (
                    <div key={group.id} className="space-y-2">
                      {/* Group Header */}
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded-md p-1.5 -mx-1.5"
                        onClick={() => toggleGroup(group.id)}
                      >
                        <Checkbox
                          checked={groupState === 'all'}
                          ref={(el) => {
                            if (el) {
                              (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = groupState === 'some';
                            }
                          }}
                          onCheckedChange={() => toggleGroup(group.id)}
                          className="mr-1"
                        />
                        <span className="font-medium text-sm">{group.label}</span>
                        <span className="text-xs text-muted-foreground">— {group.description}</span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {groupFields.filter(f => selectedFields.includes(f.id)).length}/{groupFields.length}
                        </Badge>
                      </div>

                      {/* Group Fields */}
                      <div className="grid grid-cols-2 gap-1 pl-8">
                        {groupFields.map(field => (
                          <div
                            key={field.id}
                            className={cn(
                              'flex items-center gap-2 p-1.5 rounded-md cursor-pointer',
                              'hover:bg-accent/50 transition-colors',
                              field.recommended && 'bg-primary/5'
                            )}
                            onClick={() => toggleField(field.id)}
                          >
                            <Checkbox
                              checked={selectedFields.includes(field.id)}
                              onCheckedChange={() => toggleField(field.id)}
                            />
                            <Label className="text-sm cursor-pointer flex-1 truncate" title={field.description}>
                              {field.label}
                              {field.recommended && (
                                <span className="text-xs text-primary ml-1">★</span>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* Export Format Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Export Format</Label>
            <div className="flex gap-2">
              <Button
                variant={exportFormat === 'csv' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setExportFormat('csv')}
                className="flex-1"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                CSV
                {exportFormat === 'csv' && <Check className="ml-2 h-3 w-3" />}
              </Button>
              <Button
                variant={exportFormat === 'json' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setExportFormat('json')}
                className="flex-1"
              >
                <FileJson className="mr-2 h-4 w-4" />
                JSON
                {exportFormat === 'json' && <Check className="ml-2 h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Progress indicator */}
          {progress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.phase}</span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || selectedFields.length === 0 || customerCount === 0 || isLoadingCustomers}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export {exportFormat.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CustomerExport;
