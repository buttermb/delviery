/**
 * useOrdersExport Hook
 * CSV export functionality for Orders Hub using papaparse
 */

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import type { UnifiedOrder, OrderType } from '@/hooks/useUnifiedOrders';

interface ExportOptions {
  orderType?: OrderType;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  includeItems?: boolean;
}

interface OrderExportRow {
  order_number: string;
  order_type: string;
  source: string;
  status: string;
  customer_name: string;
  contact_phone: string;
  delivery_address: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  items: string;
}

function formatOrderForExport(order: UnifiedOrder, includeItems: boolean): OrderExportRow {
  const customerName = order.customer
    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
    : order.client?.business_name || order.contact_name || 'N/A';

  const itemsSummary = includeItems && order.items?.length
    ? order.items
        .map((item) => `${item.product_name} x${item.quantity}`)
        .join('; ')
    : '';

  return {
    order_number: order.order_number || '',
    order_type: order.order_type || '',
    source: order.source || '',
    status: order.status || '',
    customer_name: customerName,
    contact_phone: order.contact_phone || '',
    delivery_address: order.delivery_address || '',
    subtotal: (order.subtotal || 0).toFixed(2),
    tax_amount: (order.tax_amount || 0).toFixed(2),
    discount_amount: (order.discount_amount || 0).toFixed(2),
    total_amount: (order.total_amount || 0).toFixed(2),
    payment_method: order.payment_method || 'N/A',
    payment_status: order.payment_status || '',
    created_at: order.created_at
      ? format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss')
      : '',
    updated_at: order.updated_at
      ? format(new Date(order.updated_at), 'yyyy-MM-dd HH:mm:ss')
      : '',
    items: itemsSummary,
  };
}

export function useOrdersExport() {
  const { tenant } = useTenantAdminAuth();
  const [isExporting, setIsExporting] = useState(false);

  const exportOrders = useCallback(
    async (options: ExportOptions = {}) => {
      if (!tenant?.id) {
        toast.error('Export failed', { description: 'No tenant context available' });
        return;
      }

      setIsExporting(true);

      try {
        // Build query
        let query = supabase
          .from('unified_orders')
          .select(`
            *,
            items:unified_order_items(*),
            customer:customers(id, first_name, last_name, email),
            client:wholesale_clients(id, business_name, contact_name)
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        // Apply filters
        if (options.orderType && options.orderType !== 'all') {
          query = query.eq('order_type', options.orderType);
        }
        if (options.status) {
          query = query.eq('status', options.status);
        }
        if (options.dateFrom) {
          query = query.gte('created_at', options.dateFrom.toISOString());
        }
        if (options.dateTo) {
          query = query.lte('created_at', options.dateTo.toISOString());
        }

        const { data: orders, error } = await query;

        if (error) {
          logger.error('Failed to fetch orders for export', { error });
          throw new Error('Failed to fetch orders');
        }

        if (!orders || orders.length === 0) {
          toast.info('No orders to export', {
            description: 'No orders match the current filters',
          });
          setIsExporting(false);
          return;
        }

        // Transform orders for export
        const includeItems = options.includeItems ?? true;
        const exportData = (orders as UnifiedOrder[]).map((order) =>
          formatOrderForExport(order, includeItems)
        );

        // Generate CSV using papaparse
        const csv = Papa.unparse(exportData, {
          header: true,
          columns: [
            'order_number',
            'order_type',
            'source',
            'status',
            'customer_name',
            'contact_phone',
            'delivery_address',
            'subtotal',
            'tax_amount',
            'discount_amount',
            'total_amount',
            'payment_method',
            'payment_status',
            'created_at',
            'updated_at',
            'items',
          ],
        });

        // Create and download file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
        const orderTypeLabel = options.orderType && options.orderType !== 'all'
          ? `-${options.orderType}`
          : '';

        link.setAttribute('href', url);
        link.setAttribute('download', `orders${orderTypeLabel}-${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('Export complete', {
          description: `Exported ${orders.length} order${orders.length !== 1 ? 's' : ''} to CSV`,
        });

        logger.info('Orders exported successfully', {
          count: orders.length,
          orderType: options.orderType,
        });
      } catch (error) {
        logger.error('Export failed', { error });
        toast.error('Export failed', {
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      } finally {
        setIsExporting(false);
      }
    },
    [tenant?.id]
  );

  return {
    exportOrders,
    isExporting,
  };
}
