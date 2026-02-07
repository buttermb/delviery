/**
 * OrderExportButton Component
 *
 * A reusable button for exporting filtered orders to CSV.
 * Supports configurable export fields and works with any order data structure.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Download from "lucide-react/dist/esm/icons/download";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { useExport } from '@/hooks/useExport';
import { ExportOptionsDialog, type ExportField } from '@/components/admin/ExportOptionsDialog';
import { format } from 'date-fns';

// Base order fields that are always included
interface BaseOrderData {
  id: string;
  order_number?: string;
  status: string;
  total_amount?: number;
  total?: number;
  created_at: string;
  delivery_method?: string;
}

// Extended order data with optional customer info
interface OrderWithCustomer extends BaseOrderData {
  user?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
}

// Extended order data with optional line items
interface OrderWithItems extends OrderWithCustomer {
  order_items?: Array<{
    id?: string;
    product_id?: string;
    product_name?: string;
    quantity?: number;
    price?: number;
  }>;
  items?: Array<{
    name?: string;
    quantity?: number;
    price?: number;
  }>;
}

type OrderData = OrderWithItems;

interface OrderExportButtonProps {
  /** The filtered orders to export */
  orders: OrderData[];
  /** Optional custom filename prefix (default: 'orders-export') */
  filenamePrefix?: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the button label (default: true) */
  showLabel?: boolean;
  /** Available export field options */
  exportFields?: ExportField[];
  /** Whether to show export options dialog (default: true) */
  showOptionsDialog?: boolean;
}

// Default export fields configuration
const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  {
    value: 'customer_name',
    label: 'Customer Name',
    description: 'Include the customer full name for each order',
    recommended: true,
  },
  {
    value: 'customer_email',
    label: 'Customer Email',
    description: 'Include the customer email address',
    recommended: true,
  },
  {
    value: 'customer_phone',
    label: 'Customer Phone',
    description: 'Include the customer phone number',
  },
  {
    value: 'line_items',
    label: 'Line Items',
    description: 'Include product names, quantities, and prices for each order item (creates multiple rows per order)',
  },
];

export function OrderExportButton({
  orders,
  filenamePrefix = 'orders-export',
  variant = 'outline',
  size = 'default',
  className = '',
  showLabel = true,
  exportFields = DEFAULT_EXPORT_FIELDS,
  showOptionsDialog = true,
}: OrderExportButtonProps) {
  const { exportCSV, isExporting } = useExport();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Get customer name from various data structures
  const getCustomerName = useCallback((order: OrderData): string => {
    if (order.customer_name) return order.customer_name;
    if (order.user?.full_name) return order.user.full_name;
    return '';
  }, []);

  // Get customer email from various data structures
  const getCustomerEmail = useCallback((order: OrderData): string => {
    if (order.customer_email) return order.customer_email;
    if (order.user?.email) return order.user.email;
    return '';
  }, []);

  // Get customer phone from various data structures
  const getCustomerPhone = useCallback((order: OrderData): string => {
    if (order.customer_phone) return order.customer_phone;
    if (order.user?.phone) return order.user.phone;
    return '';
  }, []);

  // Get total amount from various data structures
  const getTotalAmount = useCallback((order: OrderData): number => {
    return order.total_amount ?? order.total ?? 0;
  }, []);

  // Get order items from various data structures
  const getOrderItems = useCallback((order: OrderData) => {
    // Check for order_items array
    if (order.order_items && order.order_items.length > 0) {
      return order.order_items.map(item => ({
        product_name: item.product_name || '',
        quantity: item.quantity || 0,
        price: item.price || 0,
      }));
    }
    // Check for items array (marketplace orders)
    if (order.items && order.items.length > 0) {
      return order.items.map(item => ({
        product_name: item.name || '',
        quantity: item.quantity || 0,
        price: item.price || 0,
      }));
    }
    return [];
  }, []);

  const handleExport = useCallback((selectedFields: string[]) => {
    if (!orders || orders.length === 0) return;

    const includeCustomerName = selectedFields.includes('customer_name');
    const includeCustomerEmail = selectedFields.includes('customer_email');
    const includeCustomerPhone = selectedFields.includes('customer_phone');
    const includeLineItems = selectedFields.includes('line_items');

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filename = `${filenamePrefix}-${dateStr}.csv`;

    if (includeLineItems) {
      // Flatten: one row per line item
      const flatRows = orders.flatMap(order => {
        const items = getOrderItems(order);
        const baseRow = {
          order_number: order.order_number || order.id.slice(0, 8),
          status: order.status,
          total_amount: getTotalAmount(order),
          delivery_method: order.delivery_method || '',
          created_at: order.created_at,
          ...(includeCustomerName && { customer_name: getCustomerName(order) }),
          ...(includeCustomerEmail && { customer_email: getCustomerEmail(order) }),
          ...(includeCustomerPhone && { customer_phone: getCustomerPhone(order) }),
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

      exportCSV(flatRows, { filename });
    } else {
      // Standard: one row per order
      const rows = orders.map(order => ({
        order_number: order.order_number || order.id.slice(0, 8),
        status: order.status,
        total_amount: getTotalAmount(order),
        delivery_method: order.delivery_method || '',
        created_at: order.created_at,
        ...(includeCustomerName && { customer_name: getCustomerName(order) }),
        ...(includeCustomerEmail && { customer_email: getCustomerEmail(order) }),
        ...(includeCustomerPhone && { customer_phone: getCustomerPhone(order) }),
      }));

      exportCSV(rows, { filename });
    }

    setDialogOpen(false);
  }, [orders, filenamePrefix, exportCSV, getCustomerName, getCustomerEmail, getCustomerPhone, getTotalAmount, getOrderItems]);

  // Quick export without dialog
  const handleQuickExport = useCallback(() => {
    if (!orders || orders.length === 0) return;

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filename = `${filenamePrefix}-${dateStr}.csv`;

    const rows = orders.map(order => ({
      order_number: order.order_number || order.id.slice(0, 8),
      status: order.status,
      total_amount: getTotalAmount(order),
      delivery_method: order.delivery_method || '',
      created_at: order.created_at,
      customer_name: getCustomerName(order),
      customer_email: getCustomerEmail(order),
    }));

    exportCSV(rows, { filename });
  }, [orders, filenamePrefix, exportCSV, getCustomerName, getCustomerEmail, getTotalAmount]);

  const handleClick = useCallback(() => {
    if (showOptionsDialog) {
      setDialogOpen(true);
    } else {
      handleQuickExport();
    }
  }, [showOptionsDialog, handleQuickExport]);

  const isDisabled = isExporting || !orders || orders.length === 0;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={isDisabled}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {showLabel && <span className="ml-2">Export</span>}
      </Button>

      {showOptionsDialog && (
        <ExportOptionsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onExport={handleExport}
          fields={exportFields}
          title="Export Orders"
          description="Choose which related data to include in the CSV export."
          itemCount={orders.length}
          isExporting={isExporting}
        />
      )}
    </>
  );
}
