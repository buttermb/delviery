/**
 * Order Items Table Component
 * Displays order line items with quantity, price, and discount columns
 */

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { Package } from 'lucide-react';

/**
 * Order item data structure
 */
export interface OrderItemData {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  total_price: number;
  sku?: string | null;
  quantity_unit?: string;
  product_id?: string | null;
  inventory_id?: string | null;
}

interface OrderItemsTableProps {
  /** Array of order items to display */
  items: OrderItemData[];
  /** Whether the table is in a loading state */
  isLoading?: boolean;
  /** Whether to show the discount column */
  showDiscount?: boolean;
  /** Whether to show the SKU column */
  showSku?: boolean;
  /** Whether to show a footer with totals */
  showTotals?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Custom empty state message */
  emptyMessage?: string;
}

/**
 * Displays order items in a table format with quantity, price, and optional discount columns.
 * Supports loading states, empty states, and optional footer totals.
 */
export function OrderItemsTable({
  items,
  isLoading = false,
  showDiscount = true,
  showSku = false,
  showTotals = true,
  className,
  emptyMessage = 'No items in this order',
}: OrderItemsTableProps) {
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const totalDiscount = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
  const grandTotal = items.reduce((sum, item) => sum + item.total_price, 0);

  // Determine if any items have discounts
  const hasDiscounts = items.some((item) => item.discount_amount && item.discount_amount > 0);

  // Only show discount column if showDiscount is true AND there are actual discounts
  const displayDiscount = showDiscount && hasDiscounts;

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            {showSku && <TableHead>SKU</TableHead>}
            <TableHead className="text-center">Quantity</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            {displayDiscount && <TableHead className="text-right">Discount</TableHead>}
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col">
                  <span>{item.product_name}</span>
                  {item.quantity_unit && item.quantity_unit !== 'unit' && (
                    <span className="text-xs text-muted-foreground">
                      per {item.quantity_unit}
                    </span>
                  )}
                </div>
              </TableCell>
              {showSku && (
                <TableCell>
                  {item.sku ? (
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {item.sku}
                    </code>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-center">
                <Badge variant="secondary" className="font-mono">
                  {item.quantity}
                  {item.quantity_unit && item.quantity_unit !== 'unit' && (
                    <span className="ml-1 text-xs opacity-70">{item.quantity_unit}</span>
                  )}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(item.unit_price)}
              </TableCell>
              {displayDiscount && (
                <TableCell className="text-right">
                  {item.discount_amount && item.discount_amount > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      -{formatCurrency(item.discount_amount)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right font-medium font-mono">
                {formatCurrency(item.total_price)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {showTotals && (
          <TableFooter>
            {displayDiscount && totalDiscount > 0 && (
              <>
                <TableRow>
                  <TableCell
                    colSpan={showSku ? 4 : 3}
                    className="text-right text-muted-foreground"
                  >
                    Subtotal
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(subtotal)}
                  </TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell
                    colSpan={showSku ? 4 : 3}
                    className="text-right text-emerald-600 dark:text-emerald-400"
                  >
                    Total Discount
                  </TableCell>
                  <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                    -{formatCurrency(totalDiscount)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </>
            )}
            <TableRow>
              <TableCell
                colSpan={displayDiscount ? (showSku ? 5 : 4) : (showSku ? 4 : 3)}
                className="text-right font-semibold"
              >
                Grand Total
              </TableCell>
              <TableCell className="text-right font-bold font-mono text-lg">
                {formatCurrency(grandTotal)}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
