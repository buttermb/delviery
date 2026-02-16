/**
 * ProductExport Component
 *
 * Exports all products with related data:
 * - Category name, vendor name, current stock
 * - Total orders, revenue generated
 * - Compliance status, active menu count
 *
 * Supports CSV and JSON formats with column selection.
 * Logs export activity to activity_log.
 */

import { useState, useCallback, useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import type { ExportColumn } from '@/lib/export';
import type { Database } from '@/integrations/supabase/types';
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
  Download,
  Loader2,
  FileSpreadsheet,
  FileJson,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useExport } from '@/hooks/useExport';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { EntityType } from '@/hooks/useActivityLog';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

type ProductRow = Database['public']['Tables']['products']['Row'];

// Extended product data with related information
interface ProductWithRelatedData extends ProductRow {
  category_name: string;
  vendor_display_name: string;
  current_stock: number;
  total_orders: number;
  revenue_generated: number;
  compliance_status: string;
  active_menu_count: number;
}

// Export field configuration
interface ExportFieldOption {
  id: string;
  label: string;
  description: string;
  group: 'basic' | 'pricing' | 'inventory' | 'cannabis' | 'lab' | 'related' | 'metadata' | 'shipping';
  type?: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'datetime' | 'boolean';
  recommended?: boolean;
  default?: boolean;
}

// Available export fields organized by group
const EXPORT_FIELD_OPTIONS: ExportFieldOption[] = [
  // Basic Information
  { id: 'name', label: 'Product Name', description: 'Name of the product', group: 'basic', type: 'string', recommended: true, default: true },
  { id: 'sku', label: 'SKU', description: 'Stock keeping unit', group: 'basic', type: 'string', recommended: true, default: true },
  { id: 'barcode', label: 'Barcode', description: 'Product barcode', group: 'basic', type: 'string' },
  { id: 'category', label: 'Category Code', description: 'Category identifier', group: 'basic', type: 'string' },
  { id: 'category_name', label: 'Category Name', description: 'Display name of category', group: 'related', type: 'string', recommended: true, default: true },
  { id: 'description', label: 'Description', description: 'Product description', group: 'basic', type: 'string' },

  // Vendor & Sourcing
  { id: 'vendor_name', label: 'Vendor Code', description: 'Vendor identifier', group: 'basic', type: 'string' },
  { id: 'vendor_display_name', label: 'Vendor Name', description: 'Display name of vendor/grower', group: 'related', type: 'string', recommended: true, default: true },
  { id: 'batch_number', label: 'Batch Number', description: 'Production batch number', group: 'basic', type: 'string' },

  // Pricing
  { id: 'price', label: 'Base Price', description: 'Standard selling price', group: 'pricing', type: 'currency', recommended: true, default: true },
  { id: 'cost_per_unit', label: 'Cost Per Unit', description: 'Purchase cost per unit', group: 'pricing', type: 'currency' },
  { id: 'wholesale_price', label: 'Wholesale Price', description: 'Wholesale/bulk price', group: 'pricing', type: 'currency', recommended: true },
  { id: 'retail_price', label: 'Retail Price', description: 'Suggested retail price', group: 'pricing', type: 'currency' },
  { id: 'sale_price', label: 'Sale Price', description: 'Current sale/discount price', group: 'pricing', type: 'currency' },
  { id: 'price_per_lb', label: 'Price Per Pound', description: 'Price per pound (bulk)', group: 'pricing', type: 'currency' },

  // Inventory
  { id: 'current_stock', label: 'Current Stock', description: 'Available quantity in stock', group: 'inventory', type: 'number', recommended: true, default: true },
  { id: 'available_quantity', label: 'Available Quantity', description: 'Quantity available for sale', group: 'inventory', type: 'number' },
  { id: 'reserved_quantity', label: 'Reserved Quantity', description: 'Quantity reserved for orders', group: 'inventory', type: 'number' },
  { id: 'fronted_quantity', label: 'Fronted Quantity', description: 'Quantity given on credit', group: 'inventory', type: 'number' },
  { id: 'total_quantity', label: 'Total Quantity', description: 'Total inventory quantity', group: 'inventory', type: 'number' },
  { id: 'low_stock_alert', label: 'Low Stock Threshold', description: 'Alert when below this quantity', group: 'inventory', type: 'number' },
  { id: 'in_stock', label: 'In Stock', description: 'Whether product is in stock', group: 'inventory', type: 'boolean' },

  // Order & Revenue (Related Data)
  { id: 'total_orders', label: 'Total Orders', description: 'Number of orders containing this product', group: 'related', type: 'number', recommended: true, default: true },
  { id: 'revenue_generated', label: 'Revenue Generated', description: 'Total revenue from this product', group: 'related', type: 'currency', recommended: true, default: true },

  // Compliance & Menu
  { id: 'compliance_status', label: 'Compliance Status', description: 'Regulatory compliance status', group: 'related', type: 'string', recommended: true, default: true },
  { id: 'active_menu_count', label: 'Active Menu Count', description: 'Number of menus featuring this product', group: 'related', type: 'number', recommended: true, default: true },
  { id: 'menu_visibility', label: 'Menu Visibility', description: 'Whether shown on menus', group: 'related', type: 'boolean' },

  // Cannabis-Specific
  { id: 'strain_name', label: 'Strain Name', description: 'Cannabis strain name', group: 'cannabis', type: 'string', recommended: true },
  { id: 'strain_type', label: 'Strain Type', description: 'Indica/Sativa/Hybrid', group: 'cannabis', type: 'string' },
  { id: 'strain_info', label: 'Strain Info', description: 'Additional strain information', group: 'cannabis', type: 'string' },
  { id: 'strain_lineage', label: 'Strain Lineage', description: 'Genetic lineage', group: 'cannabis', type: 'string' },
  { id: 'is_concentrate', label: 'Is Concentrate', description: 'Whether product is a concentrate', group: 'cannabis', type: 'boolean' },
  { id: 'weight_grams', label: 'Weight (Grams)', description: 'Weight in grams', group: 'cannabis', type: 'number' },

  // Lab & Potency
  { id: 'thc_percent', label: 'THC %', description: 'THC percentage', group: 'lab', type: 'number', recommended: true },
  { id: 'thc_content', label: 'THC Content', description: 'THC content amount', group: 'lab', type: 'number' },
  { id: 'thca_percentage', label: 'THCA %', description: 'THCA percentage', group: 'lab', type: 'number' },
  { id: 'cbd_percent', label: 'CBD %', description: 'CBD percentage', group: 'lab', type: 'number' },
  { id: 'cbd_content', label: 'CBD Content', description: 'CBD content amount', group: 'lab', type: 'number' },
  { id: 'test_date', label: 'Test Date', description: 'Lab test date', group: 'lab', type: 'date' },
  { id: 'lab_name', label: 'Lab Name', description: 'Testing laboratory name', group: 'lab', type: 'string' },
  { id: 'coa_url', label: 'COA URL', description: 'Certificate of Analysis URL', group: 'lab', type: 'string' },

  // Metadata
  { id: 'id', label: 'Product ID', description: 'Unique product identifier', group: 'metadata', type: 'string' },
  { id: 'created_at', label: 'Created Date', description: 'When product was created', group: 'metadata', type: 'datetime' },
  { id: 'image_url', label: 'Image URL', description: 'Primary product image URL', group: 'metadata', type: 'string' },
  { id: 'average_rating', label: 'Average Rating', description: 'Average customer rating', group: 'metadata', type: 'number' },
  { id: 'review_count', label: 'Review Count', description: 'Number of reviews', group: 'metadata', type: 'number' },

  // Shipping Dimensions
  { id: 'weight_kg', label: 'Shipping Weight (kg)', description: 'Shipping weight in kilograms', group: 'shipping', type: 'number' },
  { id: 'length_cm', label: 'Length (cm)', description: 'Package length in centimeters', group: 'shipping', type: 'number' },
  { id: 'width_cm', label: 'Width (cm)', description: 'Package width in centimeters', group: 'shipping', type: 'number' },
  { id: 'height_cm', label: 'Height (cm)', description: 'Package height in centimeters', group: 'shipping', type: 'number' },
];

// Field groups for UI organization
const FIELD_GROUPS = [
  { id: 'basic', label: 'Basic Information', description: 'Core product details' },
  { id: 'related', label: 'Related Data', description: 'Category, vendor, orders, menus' },
  { id: 'pricing', label: 'Pricing', description: 'Prices and costs' },
  { id: 'inventory', label: 'Inventory', description: 'Stock levels and quantities' },
  { id: 'shipping', label: 'Shipping Dimensions', description: 'Weight and package dimensions' },
  { id: 'cannabis', label: 'Cannabis Details', description: 'Strain and product info' },
  { id: 'lab', label: 'Lab & Potency', description: 'Test results and compliance' },
  { id: 'metadata', label: 'Metadata', description: 'IDs, dates, and URLs' },
] as const;

type ExportFormat = 'csv' | 'json';

interface ProductExportProps {
  /** Optional: Pre-selected products to export (if not provided, exports all) */
  products?: ProductRow[];
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
 * Hook to fetch products with all related data for export
 */
function useProductsWithRelatedData(tenantId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.products.all, 'export-full', tenantId],
    queryFn: async (): Promise<ProductWithRelatedData[]> => {
      if (!tenantId) return [];

      // Fetch products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId);

      if (productsError) {
        logger.error('[ProductExport] Failed to fetch products', productsError);
        throw productsError;
      }

      if (!products || products.length === 0) {
        return [];
      }

      const productIds = products.map(p => p.id);

      // Fetch order items for these products to calculate orders and revenue
      const { data: orderItems } = await supabase
        .from('unified_order_items')
        .select('product_id, quantity, unit_price, total_price')
        .in('product_id', productIds);

      // Fetch menu products to count active menus
      const { data: menuProducts } = await supabase
        .from('disposable_menu_products')
        .select('product_id, menu:disposable_menus!inner(id, is_active, tenant_id)')
        .in('product_id', productIds);

      // Build lookup maps
      const orderStats = new Map<string, { totalOrders: number; revenue: number }>();
      const menuCounts = new Map<string, number>();

      // Process order items
      if (orderItems) {
        for (const item of orderItems) {
          if (!item.product_id) continue;
          const existing = orderStats.get(item.product_id) || { totalOrders: 0, revenue: 0 };
          existing.totalOrders += 1;
          existing.revenue += Number(item.total_price || item.unit_price || 0) * Number(item.quantity || 1);
          orderStats.set(item.product_id, existing);
        }
      }

      // Process menu products (only count active menus for this tenant)
      if (menuProducts) {
        for (const mp of menuProducts) {
          if (!mp.product_id) continue;
          const menu = mp.menu as unknown as { id: string; is_active: boolean; tenant_id: string };
          if (menu?.is_active && menu?.tenant_id === tenantId) {
            menuCounts.set(mp.product_id, (menuCounts.get(mp.product_id) || 0) + 1);
          }
        }
      }

      // Enrich products with related data
      return products.map(product => {
        const stats = orderStats.get(product.id) || { totalOrders: 0, revenue: 0 };
        const menuCount = menuCounts.get(product.id) || 0;

        // Determine compliance status based on available data
        let complianceStatus = 'unknown';
        if (product.coa_url || product.coa_pdf_url || product.lab_results_url) {
          if (product.test_date) {
            const testDate = new Date(product.test_date);
            const daysSinceTest = Math.floor((Date.now() - testDate.getTime()) / (1000 * 60 * 60 * 24));
            complianceStatus = daysSinceTest <= 365 ? 'compliant' : 'expired';
          } else {
            complianceStatus = 'compliant';
          }
        } else if (product.thc_percent || product.cbd_percent) {
          complianceStatus = 'partial';
        } else {
          complianceStatus = 'missing';
        }

        // Current stock calculation
        const currentStock = product.available_quantity ?? product.stock_quantity ?? product.total_quantity ?? 0;

        return {
          ...product,
          category_name: product.category || 'Uncategorized',
          vendor_display_name: product.vendor_name || 'Unknown Vendor',
          current_stock: currentStock,
          total_orders: stats.totalOrders,
          revenue_generated: stats.revenue,
          compliance_status: complianceStatus,
          active_menu_count: menuCount,
        };
      });
    },
    enabled: enabled && !!tenantId,
    staleTime: 60000, // 1 minute
  });
}

export function ProductExport({
  products: preSelectedProducts,
  filenamePrefix = 'products-export',
  variant = 'outline',
  size = 'default',
  className = '',
  showLabel = true,
  disabled = false,
}: ProductExportProps) {
  const { tenant } = useTenantAdminAuth();
  const { exportCSV, exportJSON, isExporting, progress } = useExport();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELD_OPTIONS.filter(f => f.default).map(f => f.id)
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');

  // Fetch products with related data when dialog is open
  const {
    data: fetchedProducts,
    isLoading: isLoadingProducts,
    error: fetchError,
  } = useProductsWithRelatedData(tenant?.id, dialogOpen && !preSelectedProducts);

  // Use pre-selected products or fetched products
  const productsToExport = useMemo(() => {
    if (preSelectedProducts) {
      // Enrich pre-selected products with default related data
      return preSelectedProducts.map(p => ({
        ...p,
        category_name: p.category || 'Uncategorized',
        vendor_display_name: p.vendor_name || 'Unknown Vendor',
        current_stock: p.available_quantity ?? p.stock_quantity ?? 0,
        total_orders: 0,
        revenue_generated: 0,
        compliance_status: 'unknown',
        active_menu_count: 0,
      })) as ProductWithRelatedData[];
    }
    return fetchedProducts || [];
  }, [preSelectedProducts, fetchedProducts]);

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

  // Build export data based on selected fields
  const buildExportData = useCallback((): ExportRow[] => {
    return productsToExport.map(product => {
      const row: ExportRow = {};
      for (const fieldId of selectedFields) {
        const value = (product as unknown as Record<string, unknown>)[fieldId];
        if (value === undefined || value === null) {
          row[fieldId] = null;
        } else if (typeof value === 'object') {
          row[fieldId] = JSON.stringify(value);
        } else {
          row[fieldId] = value as string | number | boolean;
        }
      }
      return row;
    });
  }, [productsToExport, selectedFields]);

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
    if (productsToExport.length === 0) {
      logger.warn('[ProductExport] No products to export');
      return;
    }

    if (selectedFields.length === 0) {
      logger.warn('[ProductExport] No fields selected');
      return;
    }

    const data = buildExportData();
    const dateStr = format(new Date(), 'yyyy-MM-dd');

    logger.info('[ProductExport] Starting export', {
      format: exportFormat,
      productCount: productsToExport.length,
      fieldCount: selectedFields.length,
      tenantId: tenant?.id,
    });

    try {
      if (exportFormat === 'csv') {
        const columns = buildColumns();
        const filename = `${filenamePrefix}-${dateStr}.csv`;
        await exportCSV(data, columns, filename, {
          entityType: EntityType.PRODUCT,
          metadata: {
            productCount: productsToExport.length,
            fieldCount: selectedFields.length,
            fields: selectedFields,
            format: 'csv',
          },
        });
      } else {
        const filename = `${filenamePrefix}-${dateStr}.json`;
        await exportJSON(data, filename, {
          entityType: EntityType.PRODUCT,
          metadata: {
            productCount: productsToExport.length,
            fieldCount: selectedFields.length,
            fields: selectedFields,
            format: 'json',
          },
        });
      }

      setDialogOpen(false);
    } catch (error) {
      logger.error('[ProductExport] Export failed', error instanceof Error ? error : new Error(String(error)));
    }
  }, [
    productsToExport,
    selectedFields,
    exportFormat,
    buildExportData,
    buildColumns,
    filenamePrefix,
    exportCSV,
    exportJSON,
    tenant?.id,
  ]);

  // Quick export with current/default settings
  const handleQuickExport = useCallback(async (format: ExportFormat) => {
    setExportFormat(format);
    if (productsToExport.length > 0 && selectedFields.length > 0) {
      const data = buildExportData();
      const dateStr = format === 'csv' ? format : exportFormat; // Avoid shadowing
      const dateStrFormatted = new Date().toISOString().slice(0, 10);

      try {
        if (format === 'csv') {
          const columns = buildColumns();
          const filename = `${filenamePrefix}-${dateStrFormatted}.csv`;
          await exportCSV(data, columns, filename, {
            entityType: EntityType.PRODUCT,
            metadata: {
              productCount: productsToExport.length,
              format: 'csv',
              quickExport: true,
            },
          });
        } else {
          const filename = `${filenamePrefix}-${dateStrFormatted}.json`;
          await exportJSON(data, filename, {
            entityType: EntityType.PRODUCT,
            metadata: {
              productCount: productsToExport.length,
              format: 'json',
              quickExport: true,
            },
          });
        }
      } catch (error) {
        logger.error('[ProductExport] Quick export failed', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }, [productsToExport, selectedFields, buildExportData, buildColumns, filenamePrefix, exportCSV, exportJSON, exportFormat]);

  const selectedCount = selectedFields.length;
  const totalFields = EXPORT_FIELD_OPTIONS.length;
  const productCount = productsToExport.length;
  const isButtonDisabled = disabled || isExporting;

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
            {showLabel && <span className="ml-2">Export Products</span>}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export with Options...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleQuickExport('csv')}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Quick Export CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQuickExport('json')}>
            <FileJson className="mr-2 h-4 w-4" />
            Quick Export JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Export Products with Full Data</DialogTitle>
            <DialogDescription>
              Export products with related data including orders, revenue, and menu information.
              {isLoadingProducts ? (
                <Skeleton className="h-4 w-48 mt-1" />
              ) : fetchError ? (
                <span className="block mt-1 text-destructive">
                  Error loading products. Please try again.
                </span>
              ) : (
                <span className="block mt-1">
                  <Badge variant="secondary" className="font-mono">
                    {productCount} {productCount === 1 ? 'product' : 'products'}
                  </Badge>
                  {' will be exported with '}
                  <Badge variant="outline" className="font-mono">
                    {selectedCount} {selectedCount === 1 ? 'field' : 'fields'}
                  </Badge>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

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
            {isLoadingProducts ? (
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
              disabled={isExporting || selectedFields.length === 0 || productCount === 0 || isLoadingProducts}
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

export default ProductExport;
