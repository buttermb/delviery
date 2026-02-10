/**
 * OrderExportButton Component
 *
 * Enhanced export button for orders with full related data support.
 * Uses useExport hook with proper column configuration.
 * Supports CSV and JSON export formats.
 * Includes customer info, product names, payment status, delivery status.
 * Logs export actions to activity_log.
 */

import { useState, useCallback } from 'react';

import { format } from 'date-fns';

import type { ExportColumn } from '@/lib/export';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, FileSpreadsheet, FileJson, ChevronDown, Check } from 'lucide-react';
import { useExport, type UseExportOptions } from '@/hooks/useExport';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { EntityType } from '@/hooks/useActivityLog';
import { logger } from '@/lib/logger';

// Base order data structure
interface BaseOrderData {
  id: string;
  order_number?: string;
  status: string;
  total_amount?: number;
  total?: number;
  created_at: string;
  delivery_method?: string;
  delivery_status?: string;
  payment_status?: string;
  order_source?: string;
}

// Order with customer information
interface OrderWithCustomer extends BaseOrderData {
  user_id?: string;
  user?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
}

// Order with line items
interface OrderWithItems extends OrderWithCustomer {
  order_items?: Array<{
    id?: string;
    product_id?: string;
    product_name?: string;
    quantity?: number;
    price?: number;
    unit_price?: number;
  }>;
  items?: Array<{
    name?: string;
    quantity?: number;
    price?: number;
  }>;
}

type OrderData = OrderWithItems;

// Export field option
interface ExportFieldOption {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
  default?: boolean;
}

// Available export fields
const EXPORT_FIELD_OPTIONS: ExportFieldOption[] = [
  {
    id: 'customer_name',
    label: 'Customer Name',
    description: 'Full name of the customer',
    recommended: true,
    default: true,
  },
  {
    id: 'customer_email',
    label: 'Customer Email',
    description: 'Email address of the customer',
    recommended: true,
    default: true,
  },
  {
    id: 'customer_phone',
    label: 'Customer Phone',
    description: 'Phone number of the customer',
  },
  {
    id: 'product_names',
    label: 'Product Names',
    description: 'Names of products in the order (comma-separated)',
    recommended: true,
    default: true,
  },
  {
    id: 'line_items_detail',
    label: 'Line Items (Detailed)',
    description: 'Full line item details with quantities and prices (creates multiple rows)',
  },
  {
    id: 'payment_status',
    label: 'Payment Status',
    description: 'Current payment status of the order',
    recommended: true,
    default: true,
  },
  {
    id: 'delivery_status',
    label: 'Delivery Status',
    description: 'Current delivery/fulfillment status',
    recommended: true,
    default: true,
  },
  {
    id: 'order_source',
    label: 'Order Source',
    description: 'Where the order originated (storefront, admin, POS, etc.)',
  },
];

interface OrderExportButtonProps {
  /** Orders to export */
  orders: OrderData[];
  /** Custom filename prefix */
  filenamePrefix?: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
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
interface ExportRow {
  order_number: string;
  status: string;
  total_amount: number;
  delivery_method: string;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  product_names?: string;
  payment_status?: string;
  delivery_status?: string;
  order_source?: string;
  item_product_name?: string;
  item_quantity?: number;
  item_price?: number;
}

export function OrderExportButton({
  orders,
  filenamePrefix = 'orders-export',
  variant = 'outline',
  size = 'default',
  className = '',
  showLabel = true,
  disabled = false,
}: OrderExportButtonProps) {
  const { tenant } = useTenantAdminAuth();
  const { exportCSV, exportJSON, isExporting, progress } = useExport();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELD_OPTIONS.filter(f => f.default).map(f => f.id)
  );
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  // Helper: Get customer name from order
  const getCustomerName = useCallback((order: OrderData): string => {
    if (order.customer_name) return order.customer_name;
    if (order.user?.full_name) return order.user.full_name;
    return '';
  }, []);

  // Helper: Get customer email from order
  const getCustomerEmail = useCallback((order: OrderData): string => {
    if (order.customer_email) return order.customer_email;
    if (order.user?.email) return order.user.email;
    return '';
  }, []);

  // Helper: Get customer phone from order
  const getCustomerPhone = useCallback((order: OrderData): string => {
    if (order.customer_phone) return order.customer_phone;
    if (order.user?.phone) return order.user.phone;
    return '';
  }, []);

  // Helper: Get total amount from order
  const getTotalAmount = useCallback((order: OrderData): number => {
    return order.total_amount ?? order.total ?? 0;
  }, []);

  // Helper: Get order items from order
  const getOrderItems = useCallback((order: OrderData) => {
    if (order.order_items && order.order_items.length > 0) {
      return order.order_items.map(item => ({
        product_name: item.product_name || '',
        quantity: item.quantity || 0,
        price: item.unit_price ?? item.price ?? 0,
      }));
    }
    if (order.items && order.items.length > 0) {
      return order.items.map(item => ({
        product_name: item.name || '',
        quantity: item.quantity || 0,
        price: item.price || 0,
      }));
    }
    return [];
  }, []);

  // Helper: Get product names as comma-separated string
  const getProductNames = useCallback((order: OrderData): string => {
    const items = getOrderItems(order);
    return items.map(item => item.product_name).filter(Boolean).join(', ');
  }, [getOrderItems]);

  // Helper: Get payment status
  const getPaymentStatus = useCallback((order: OrderData): string => {
    if (order.payment_status) return order.payment_status;
    // Infer from status if not explicit
    if (order.status === 'delivered' || order.status === 'completed') return 'paid';
    if (order.status === 'cancelled') return 'refunded';
    return 'pending';
  }, []);

  // Helper: Get delivery status
  const getDeliveryStatus = useCallback((order: OrderData): string => {
    if (order.delivery_status) return order.delivery_status;
    // Map order status to delivery status
    const statusMap: Record<string, string> = {
      pending: 'pending',
      confirmed: 'processing',
      preparing: 'preparing',
      ready: 'ready_for_pickup',
      in_transit: 'in_transit',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };
    return statusMap[order.status] || order.status;
  }, []);

  // Build export data based on selected fields
  const buildExportData = useCallback((includeLineItems: boolean): ExportRow[] => {
    const includeCustomerName = selectedFields.includes('customer_name');
    const includeCustomerEmail = selectedFields.includes('customer_email');
    const includeCustomerPhone = selectedFields.includes('customer_phone');
    const includeProductNames = selectedFields.includes('product_names');
    const includePaymentStatus = selectedFields.includes('payment_status');
    const includeDeliveryStatus = selectedFields.includes('delivery_status');
    const includeOrderSource = selectedFields.includes('order_source');

    if (includeLineItems) {
      // Flatten: one row per line item
      return orders.flatMap(order => {
        const items = getOrderItems(order);
        const baseRow: ExportRow = {
          order_number: order.order_number || order.id.slice(0, 8),
          status: order.status,
          total_amount: getTotalAmount(order),
          delivery_method: order.delivery_method || '',
          created_at: order.created_at,
          ...(includeCustomerName && { customer_name: getCustomerName(order) }),
          ...(includeCustomerEmail && { customer_email: getCustomerEmail(order) }),
          ...(includeCustomerPhone && { customer_phone: getCustomerPhone(order) }),
          ...(includeProductNames && { product_names: getProductNames(order) }),
          ...(includePaymentStatus && { payment_status: getPaymentStatus(order) }),
          ...(includeDeliveryStatus && { delivery_status: getDeliveryStatus(order) }),
          ...(includeOrderSource && { order_source: order.order_source || 'admin' }),
        };

        if (items.length === 0) {
          return [{
            ...baseRow,
            item_product_name: '',
            item_quantity: 0,
            item_price: 0,
          }];
        }

        return items.map(item => ({
          ...baseRow,
          item_product_name: item.product_name,
          item_quantity: item.quantity,
          item_price: item.price,
        }));
      });
    } else {
      // Standard: one row per order
      return orders.map(order => ({
        order_number: order.order_number || order.id.slice(0, 8),
        status: order.status,
        total_amount: getTotalAmount(order),
        delivery_method: order.delivery_method || '',
        created_at: order.created_at,
        ...(includeCustomerName && { customer_name: getCustomerName(order) }),
        ...(includeCustomerEmail && { customer_email: getCustomerEmail(order) }),
        ...(includeCustomerPhone && { customer_phone: getCustomerPhone(order) }),
        ...(includeProductNames && { product_names: getProductNames(order) }),
        ...(includePaymentStatus && { payment_status: getPaymentStatus(order) }),
        ...(includeDeliveryStatus && { delivery_status: getDeliveryStatus(order) }),
        ...(includeOrderSource && { order_source: order.order_source || 'admin' }),
      }));
    }
  }, [
    orders,
    selectedFields,
    getCustomerName,
    getCustomerEmail,
    getCustomerPhone,
    getTotalAmount,
    getOrderItems,
    getProductNames,
    getPaymentStatus,
    getDeliveryStatus,
  ]);

  // Build column configuration for CSV export
  const buildColumns = useCallback((includeLineItems: boolean): ExportColumn<ExportRow>[] => {
    const columns: ExportColumn<ExportRow>[] = [
      { key: 'order_number', header: 'Order Number', type: 'string' },
      { key: 'status', header: 'Status', type: 'string' },
      { key: 'total_amount', header: 'Total Amount', type: 'currency' },
      { key: 'delivery_method', header: 'Delivery Method', type: 'string' },
      { key: 'created_at', header: 'Created Date', type: 'datetime' },
    ];

    if (selectedFields.includes('customer_name')) {
      columns.push({ key: 'customer_name', header: 'Customer Name', type: 'string' });
    }
    if (selectedFields.includes('customer_email')) {
      columns.push({ key: 'customer_email', header: 'Customer Email', type: 'string' });
    }
    if (selectedFields.includes('customer_phone')) {
      columns.push({ key: 'customer_phone', header: 'Customer Phone', type: 'string' });
    }
    if (selectedFields.includes('product_names') && !includeLineItems) {
      columns.push({ key: 'product_names', header: 'Product Names', type: 'string' });
    }
    if (selectedFields.includes('payment_status')) {
      columns.push({ key: 'payment_status', header: 'Payment Status', type: 'string' });
    }
    if (selectedFields.includes('delivery_status')) {
      columns.push({ key: 'delivery_status', header: 'Delivery Status', type: 'string' });
    }
    if (selectedFields.includes('order_source')) {
      columns.push({ key: 'order_source', header: 'Order Source', type: 'string' });
    }

    if (includeLineItems) {
      columns.push(
        { key: 'item_product_name', header: 'Item Product Name', type: 'string' },
        { key: 'item_quantity', header: 'Item Quantity', type: 'number' },
        { key: 'item_price', header: 'Item Price', type: 'currency' }
      );
    }

    return columns;
  }, [selectedFields]);

  // Handle export action
  const handleExport = useCallback(async () => {
    if (!orders || orders.length === 0) {
      logger.warn('[OrderExportButton] No orders to export');
      return;
    }

    const includeLineItems = selectedFields.includes('line_items_detail');
    const data = buildExportData(includeLineItems);
    const dateStr = format(new Date(), 'yyyy-MM-dd');

    const exportOptions: UseExportOptions = {
      entityType: EntityType.ORDER,
      metadata: {
        orderCount: orders.length,
        rowCount: data.length,
        fields: selectedFields,
        format: exportFormat,
        includeLineItems,
      },
    };

    logger.info('[OrderExportButton] Starting export', {
      format: exportFormat,
      orderCount: orders.length,
      rowCount: data.length,
      selectedFields,
      tenantId: tenant?.id,
    });

    try {
      if (exportFormat === 'csv') {
        const columns = buildColumns(includeLineItems);
        const filename = `${filenamePrefix}-${dateStr}.csv`;
        await exportCSV(data, columns, filename, exportOptions);
      } else {
        // JSON export includes all selected fields
        const filename = `${filenamePrefix}-${dateStr}.json`;
        await exportJSON(data, filename, exportOptions);
      }

      setDialogOpen(false);
    } catch (error) {
      logger.error('[OrderExportButton] Export failed', error instanceof Error ? error : new Error(String(error)));
    }
  }, [
    orders,
    selectedFields,
    exportFormat,
    buildExportData,
    buildColumns,
    filenamePrefix,
    exportCSV,
    exportJSON,
    tenant?.id,
  ]);

  // Toggle field selection
  const toggleField = useCallback((fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  }, []);

  // Select all recommended fields
  const selectRecommended = useCallback(() => {
    setSelectedFields(EXPORT_FIELD_OPTIONS.filter(f => f.recommended).map(f => f.id));
  }, []);

  // Count of selected fields
  const selectedCount = selectedFields.length;
  const totalFields = EXPORT_FIELD_OPTIONS.length;

  const isButtonDisabled = disabled || isExporting || !orders || orders.length === 0;

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
            {showLabel && <span className="ml-2">Export</span>}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export with Options...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => {
            setExportFormat('csv');
            handleExport();
          }}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Quick Export CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => {
            setExportFormat('json');
            handleExport();
          }}>
            <FileJson className="mr-2 h-4 w-4" />
            Quick Export JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Export Orders</DialogTitle>
            <DialogDescription>
              Choose which related data to include and select the export format.
              <span className="block mt-1 text-xs">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'} will be exported.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Format Selection */}
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

            {/* Field Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Include Related Data</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {selectedCount}/{totalFields}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectRecommended}
                    className="text-xs h-6 px-2"
                  >
                    Recommended
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                {EXPORT_FIELD_OPTIONS.map(field => (
                  <div
                    key={field.id}
                    className="flex items-start space-x-3 py-1"
                  >
                    <Checkbox
                      id={field.id}
                      checked={selectedFields.includes(field.id)}
                      onCheckedChange={() => toggleField(field.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={field.id}
                        className="text-sm font-medium cursor-pointer flex items-center gap-2"
                      >
                        {field.label}
                        {field.recommended && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Recommended
                          </Badge>
                        )}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {field.description}
                      </p>
                    </div>
                  </div>
                ))}
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
          </div>

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
              disabled={isExporting || selectedFields.length === 0}
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

export default OrderExportButton;
