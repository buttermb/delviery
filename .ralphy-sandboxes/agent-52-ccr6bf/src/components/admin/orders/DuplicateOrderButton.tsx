/**
 * DuplicateOrderButton - Duplicate/Reorder functionality for orders
 *
 * Features:
 * - Validates current stock availability before creating
 * - Shows dialog with items that are out of stock or have insufficient quantity
 * - Creates new order with same products, quantities, and pre-filled customer
 * - Navigates to new order on creation
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Package from 'lucide-react/dist/esm/icons/package';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface StockValidationItem extends OrderItem {
  available_stock: number;
  is_available: boolean;
  is_sufficient: boolean;
}

interface DuplicateOrderButtonProps {
  orderId: string;
  orderNumber: string;
  customerId?: string | null;
  wholesaleClientId?: string | null;
  deliveryAddress?: string | null;
  deliveryNotes?: string | null;
  orderItems: OrderItem[];
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function DuplicateOrderButton({
  orderId,
  orderNumber,
  customerId,
  wholesaleClientId,
  deliveryAddress,
  deliveryNotes,
  orderItems,
  className,
  variant = 'outline',
  size = 'sm',
}: DuplicateOrderButtonProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [includeOutOfStock, setIncludeOutOfStock] = useState(false);

  // Fetch current stock levels for all products in the order
  const { data: stockValidation, isLoading: isValidating } = useQuery({
    queryKey: ['order-stock-validation', orderId, orderItems.map(i => i.product_id)],
    queryFn: async (): Promise<StockValidationItem[]> => {
      if (!tenant?.id || orderItems.length === 0) return [];

      const productIds = orderItems.map(item => item.product_id).filter(Boolean);

      if (productIds.length === 0) {
        return orderItems.map(item => ({
          ...item,
          available_stock: 0,
          is_available: false,
          is_sufficient: false,
        }));
      }

      const { data: products, error } = await supabase
        .from('products')
        .select('id, stock_quantity')
        .eq('tenant_id', tenant.id)
        .in('id', productIds);

      if (error) {
        logger.error('Failed to fetch product stock for duplication', error, {
          component: 'DuplicateOrderButton',
          orderId,
        });
        throw error;
      }

      const stockMap = new Map<string, number>();
      (products || []).forEach(p => {
        stockMap.set(p.id, p.stock_quantity ?? 0);
      });

      return orderItems.map(item => {
        const availableStock = stockMap.get(item.product_id) ?? 0;
        return {
          ...item,
          available_stock: availableStock,
          is_available: availableStock > 0,
          is_sufficient: availableStock >= item.quantity,
        };
      });
    },
    enabled: showDialog && !!tenant?.id && orderItems.length > 0,
    staleTime: 0, // Always fetch fresh stock data
  });

  const hasStockIssues = stockValidation?.some(item => !item.is_sufficient) ?? false;
  const hasOutOfStockItems = stockValidation?.some(item => !item.is_available) ?? false;
  const availableItems = stockValidation?.filter(item => item.is_available) ?? [];

  // Mutation to create duplicated order
  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant context');
      if (!stockValidation) throw new Error('Stock validation not complete');

      // Determine which items to include
      const itemsToInclude = includeOutOfStock
        ? stockValidation.filter(item => item.is_available)
        : stockValidation.filter(item => item.is_sufficient);

      if (itemsToInclude.length === 0) {
        throw new Error('No items available to duplicate');
      }

      // Calculate new totals
      const subtotal = itemsToInclude.reduce((sum, item) => {
        const qty = includeOutOfStock ? Math.min(item.quantity, item.available_stock) : item.quantity;
        return sum + (qty * item.unit_price);
      }, 0);

      // Create new order in unified_orders
      const { data: newOrder, error: orderError } = await supabase
        .from('unified_orders')
        .insert({
          tenant_id: tenant.id,
          customer_id: customerId || null,
          wholesale_client_id: wholesaleClientId || null,
          delivery_address: deliveryAddress || null,
          delivery_notes: deliveryNotes
            ? `[Reorder from #${orderNumber}] ${deliveryNotes}`
            : `[Reorder from #${orderNumber}]`,
          subtotal,
          total_amount: subtotal, // Tax can be recalculated if needed
          status: 'pending',
          payment_status: 'unpaid',
          source: 'admin',
        })
        .select('id, order_number')
        .single();

      if (orderError) {
        logger.error('Failed to create duplicated order', orderError, {
          component: 'DuplicateOrderButton',
          originalOrderId: orderId,
        });
        throw new Error(orderError.message);
      }

      // Create order items
      const newItems = itemsToInclude.map(item => {
        const qty = includeOutOfStock ? Math.min(item.quantity, item.available_stock) : item.quantity;
        return {
          order_id: newOrder.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: qty,
          unit_price: item.unit_price,
          total_price: qty * item.unit_price,
        };
      });

      const { error: itemsError } = await supabase
        .from('unified_order_items')
        .insert(newItems);

      if (itemsError) {
        logger.warn('Failed to create order items for duplicated order', {
          error: itemsError.message,
          newOrderId: newOrder.id,
          component: 'DuplicateOrderButton',
        });
        // Don't throw - order was created, items can be added manually
      }

      return {
        id: newOrder.id,
        order_number: newOrder.order_number,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Order duplicated successfully', {
        description: `New order #${result.order_number} created`,
      });
      setShowDialog(false);
      navigateToAdmin(`orders/${result.id}`);
    },
    onError: (error: Error) => {
      logger.error('Order duplication failed', error, { component: 'DuplicateOrderButton' });
      toast.error('Failed to duplicate order', {
        description: error.message,
      });
    },
  });

  const handleOpenDialog = useCallback(() => {
    setShowDialog(true);
    setIncludeOutOfStock(false);
  }, []);

  const handleDuplicate = useCallback(() => {
    duplicateMutation.mutate();
  }, [duplicateMutation]);

  const allItemsOutOfStock = stockValidation?.every(item => !item.is_available) ?? false;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleOpenDialog}
        className={className}
      >
        <Copy className="w-4 h-4 mr-1" />
        Duplicate Order
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              Duplicate Order #{orderNumber}
            </DialogTitle>
            <DialogDescription>
              Create a new order with the same products and customer information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isValidating ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Checking stock availability...</span>
              </div>
            ) : (
              <>
                {/* Stock Status Summary */}
                {!hasStockIssues && (
                  <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-700 dark:text-green-400">All items in stock</AlertTitle>
                    <AlertDescription className="text-green-600 dark:text-green-500">
                      All products have sufficient stock to fulfill this order.
                    </AlertDescription>
                  </Alert>
                )}

                {hasStockIssues && !allItemsOutOfStock && (
                  <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-700 dark:text-amber-400">Stock Warning</AlertTitle>
                    <AlertDescription className="text-amber-600 dark:text-amber-500">
                      Some items have insufficient stock. Review the table below.
                    </AlertDescription>
                  </Alert>
                )}

                {allItemsOutOfStock && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>All Items Out of Stock</AlertTitle>
                    <AlertDescription>
                      None of the products in this order are currently available.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Items Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Requested</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockValidation?.map((item) => (
                        <TableRow
                          key={item.id}
                          className={!item.is_available ? 'opacity-60' : ''}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{item.product_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            <span className={item.available_stock <= 0 ? 'text-destructive' : item.available_stock < item.quantity ? 'text-amber-600' : ''}>
                              {item.available_stock}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-center">
                            {item.is_sufficient ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                OK
                              </Badge>
                            ) : item.is_available ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Partial
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                Out of Stock
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Option to include partial stock items */}
                {hasStockIssues && !allItemsOutOfStock && availableItems.length > 0 && (
                  <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                    <Checkbox
                      id="include-partial"
                      checked={includeOutOfStock}
                      onCheckedChange={(checked) => setIncludeOutOfStock(checked === true)}
                    />
                    <Label htmlFor="include-partial" className="text-sm cursor-pointer">
                      Include items with partial stock (will use available quantity)
                    </Label>
                  </div>
                )}

                {/* Summary */}
                {stockValidation && stockValidation.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {includeOutOfStock ? (
                      <span>
                        Will create order with {availableItems.length} of {stockValidation.length} items
                        {hasOutOfStockItems && ' (out of stock items excluded)'}
                      </span>
                    ) : (
                      <span>
                        Will create order with {stockValidation.filter(i => i.is_sufficient).length} of {stockValidation.length} items
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={
                isValidating ||
                duplicateMutation.isPending ||
                allItemsOutOfStock ||
                (!includeOutOfStock && hasStockIssues && availableItems.length === stockValidation?.filter(i => i.is_sufficient).length && stockValidation?.filter(i => i.is_sufficient).length === 0)
              }
            >
              {duplicateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Create Duplicate Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DuplicateOrderButton;
