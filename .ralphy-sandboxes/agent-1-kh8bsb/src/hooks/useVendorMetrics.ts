/**
 * Vendor Performance Metrics Hook
 *
 * Calculates vendor performance metrics including:
 * - On-time delivery rate
 * - Order accuracy rate
 * - Average lead time
 * - Total spend
 * - Product quality (based on receiving discrepancies)
 * - Response time
 *
 * Used on vendor detail page for stats cards and vendor analytics for comparison.
 */

import { useQuery } from '@tanstack/react-query';
import { differenceInDays, subDays, format } from 'date-fns';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface VendorPerformanceMetrics {
  // Delivery metrics
  onTimeDeliveryRate: number;
  lateDeliveries: number;
  totalDeliveries: number;

  // Order accuracy metrics
  orderAccuracyRate: number;
  accurateOrders: number;
  ordersWithDiscrepancies: number;

  // Lead time metrics
  averageLeadTimeDays: number;
  minLeadTimeDays: number;
  maxLeadTimeDays: number;

  // Financial metrics
  totalSpend: number;
  averageOrderValue: number;
  totalOrders: number;
  pendingOrders: number;

  // Payment metrics
  outstandingBalance: number;
  paidAmount: number;
  paymentRate: number;

  // Quality metrics (based on receiving discrepancies)
  qualityScore: number;
  itemsReceived: number;
  itemsWithIssues: number;

  // Response time (based on PO submission to approval)
  averageResponseTimeDays: number;

  // Trend data
  monthlySpend: Array<{ month: string; spend: number; orders: number }>;

  // Status breakdown
  ordersByStatus: Record<string, number>;
}

export interface VendorMetricsFilters {
  vendorId: string;
  startDate?: Date;
  endDate?: Date;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useVendorMetrics(filters: VendorMetricsFilters) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const {
    vendorId,
    startDate = subDays(new Date(), 365), // Default to last year
    endDate = new Date(),
  } = filters;

  return useQuery({
    queryKey: queryKeys.vendors.metrics(tenantId || '', vendorId, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }),
    queryFn: async (): Promise<VendorPerformanceMetrics> => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      if (!vendorId) {
        throw new Error('No vendor ID provided');
      }

      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      // Fetch all data in parallel
      const [purchaseOrdersResult, paymentsResult, poItemsResult] = await Promise.allSettled([
        fetchPurchaseOrders(tenantId, vendorId, startDateStr, endDateStr),
        fetchVendorPayments(tenantId, vendorId, startDateStr, endDateStr),
        fetchPurchaseOrderItems(tenantId, vendorId),
      ]);

      // Process purchase orders
      const purchaseOrders = purchaseOrdersResult.status === 'fulfilled'
        ? purchaseOrdersResult.value
        : [];

      // Process payments
      const payments = paymentsResult.status === 'fulfilled'
        ? paymentsResult.value
        : [];

      // Process PO items
      const poItems = poItemsResult.status === 'fulfilled'
        ? poItemsResult.value
        : [];

      // Calculate metrics
      return calculateMetrics(purchaseOrders, payments, poItems);
    },
    enabled: !!tenantId && !!vendorId,
    staleTime: 60_000, // 1 minute
    gcTime: 300_000, // 5 minutes
  });
}

/**
 * Hook for comparing multiple vendors' metrics
 */
export function useVendorsComparison(vendorIds: string[]) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: ['vendors', 'comparison', tenantId, vendorIds.sort().join(',')],
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      const startDate = subDays(new Date(), 365).toISOString();
      const endDate = new Date().toISOString();

      // Fetch all vendors' POs
      const { data: allPOs, error } = await (supabase as any)
        .from('purchase_orders')
        .select(`
          id,
          vendor_id,
          status,
          total,
          expected_delivery_date,
          received_date,
          payment_status,
          paid_amount,
          created_at
        `)
        .eq('tenant_id', tenantId)
        .in('vendor_id', vendorIds)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) {
        logger.error('Failed to fetch vendors comparison data', error, {
          component: 'useVendorsComparison'
        });
        throw error;
      }

      // Group by vendor and calculate metrics
      const vendorMetrics: Record<string, {
        vendorId: string;
        totalSpend: number;
        totalOrders: number;
        onTimeRate: number;
        averageOrderValue: number;
      }> = {};

      for (const vendorId of vendorIds) {
        const vendorPOs = (allPOs ?? []).filter(po => po.vendor_id === vendorId);
        const receivedPOs = vendorPOs.filter(po => po.status === 'received' && po.received_date);

        const onTimePOs = receivedPOs.filter(po => {
          if (!po.expected_delivery_date || !po.received_date) return true;
          return new Date(po.received_date) <= new Date(po.expected_delivery_date);
        });

        const totalSpend = vendorPOs
          .filter(po => po.status !== 'cancelled')
          .reduce((sum, po) => sum + (po.total ?? 0), 0);

        vendorMetrics[vendorId] = {
          vendorId,
          totalSpend,
          totalOrders: vendorPOs.filter(po => po.status !== 'cancelled').length,
          onTimeRate: receivedPOs.length > 0
            ? Math.round((onTimePOs.length / receivedPOs.length) * 100)
            : 100,
          averageOrderValue: vendorPOs.length > 0
            ? Math.round((totalSpend / vendorPOs.filter(po => po.status !== 'cancelled').length) * 100) / 100
            : 0,
        };
      }

      return vendorMetrics;
    },
    enabled: !!tenantId && vendorIds.length > 0,
    staleTime: 120_000,
  });
}

// ============================================================================
// Data Fetchers
// ============================================================================

interface PurchaseOrderRow {
  id: string;
  po_number: string;
  status: string;
  total: number;
  subtotal: number;
  expected_delivery_date: string | null;
  received_date: string | null;
  payment_status: string | null;
  paid_amount: number | null;
  created_at: string;
  updated_at: string | null;
}

async function fetchPurchaseOrders(
  tenantId: string,
  vendorId: string,
  startDate: string,
  endDate: string
): Promise<PurchaseOrderRow[]> {
  const { data, error } = await (supabase as any)
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      status,
      total,
      subtotal,
      expected_delivery_date,
      received_date,
      payment_status,
      paid_amount,
      created_at,
      updated_at
    `)
    .eq('tenant_id', tenantId)
    .eq('vendor_id', vendorId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch vendor purchase orders', error, {
      component: 'useVendorMetrics',
      tenantId,
      vendorId,
    });
    throw error;
  }

  return (data ?? []) as PurchaseOrderRow[];
}

interface VendorPaymentRow {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  purchase_order_id: string | null;
}

async function fetchVendorPayments(
  tenantId: string,
  vendorId: string,
  startDate: string,
  endDate: string
): Promise<VendorPaymentRow[]> {
  const { data, error } = await (supabase as any)
    .from('vendor_payments')
    .select(`
      id,
      amount,
      payment_date,
      payment_method,
      purchase_order_id
    `)
    .eq('tenant_id', tenantId)
    .eq('vendor_id', vendorId)
    .gte('payment_date', startDate.split('T')[0])
    .lte('payment_date', endDate.split('T')[0])
    .order('payment_date', { ascending: false });

  if (error) {
    logger.error('Failed to fetch vendor payments', error, {
      component: 'useVendorMetrics',
      tenantId,
      vendorId,
    });
    throw error;
  }

  return (data ?? []) as VendorPaymentRow[];
}

interface POItemRow {
  id: string;
  purchase_order_id: string;
  quantity: number;
  received_quantity: number | null;
}

async function fetchPurchaseOrderItems(
  tenantId: string,
  vendorId: string
): Promise<POItemRow[]> {
  // First get all PO IDs for this vendor
  const { data: poIds, error: poError } = await (supabase as any)
    .from('purchase_orders')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('vendor_id', vendorId)
    .eq('status', 'received');

  if (poError) {
    logger.error('Failed to fetch PO IDs for items', poError, {
      component: 'useVendorMetrics',
      tenantId,
      vendorId,
    });
    throw poError;
  }

  if (!poIds || poIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('purchase_order_items')
    .select(`
      id,
      purchase_order_id,
      quantity,
      received_quantity
    `)
    .in('purchase_order_id', poIds.map(po => po.id));

  if (error) {
    logger.error('Failed to fetch purchase order items', error, {
      component: 'useVendorMetrics',
      tenantId,
      vendorId,
    });
    throw error;
  }

  return (data ?? []) as POItemRow[];
}

// ============================================================================
// Metric Calculations
// ============================================================================

function calculateMetrics(
  purchaseOrders: PurchaseOrderRow[],
  payments: VendorPaymentRow[],
  poItems: POItemRow[]
): VendorPerformanceMetrics {
  // Filter by status
  const receivedPOs = purchaseOrders.filter(po => po.status === 'received');
  const activePOs = purchaseOrders.filter(po => !['cancelled', 'draft'].includes(po.status));
  const pendingPOs = purchaseOrders.filter(po => ['submitted', 'approved'].includes(po.status));
  const cancelledPOs = purchaseOrders.filter(po => po.status === 'cancelled');

  // On-time delivery calculation
  const posWithDeliveryDates = receivedPOs.filter(
    po => po.expected_delivery_date && po.received_date
  );
  const onTimePOs = posWithDeliveryDates.filter(po => {
    const expected = new Date(po.expected_delivery_date!);
    const received = new Date(po.received_date!);
    return received <= expected;
  });
  const lateDeliveries = posWithDeliveryDates.length - onTimePOs.length;
  const onTimeDeliveryRate = posWithDeliveryDates.length > 0
    ? Math.round((onTimePOs.length / posWithDeliveryDates.length) * 100)
    : 100;

  // Lead time calculation (days between created and received)
  const leadTimes = receivedPOs
    .filter(po => po.received_date && po.created_at)
    .map(po => differenceInDays(new Date(po.received_date!), new Date(po.created_at)));

  const averageLeadTimeDays = leadTimes.length > 0
    ? Math.round(leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length)
    : 0;
  const minLeadTimeDays = leadTimes.length > 0 ? Math.min(...leadTimes) : 0;
  const maxLeadTimeDays = leadTimes.length > 0 ? Math.max(...leadTimes) : 0;

  // Financial metrics
  const totalSpend = activePOs.reduce((sum, po) => sum + (po.total ?? 0), 0);
  const averageOrderValue = activePOs.length > 0
    ? Math.round((totalSpend / activePOs.length) * 100) / 100
    : 0;

  // Payment metrics
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const outstandingBalance = totalSpend - totalPaid;
  const paymentRate = totalSpend > 0
    ? Math.round((totalPaid / totalSpend) * 100)
    : 100;

  // Order accuracy / Quality metrics (based on received quantity vs ordered)
  const totalItemsOrdered = poItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const totalItemsReceived = poItems.reduce((sum, item) => sum + (item.received_quantity ?? 0), 0);
  const itemsWithDiscrepancy = poItems.filter(
    item => item.received_quantity !== null && item.received_quantity !== item.quantity
  ).length;

  // Calculate order accuracy by checking if all items in a PO were received correctly
  const poItemsByPoId = new Map<string, POItemRow[]>();
  poItems.forEach(item => {
    const existing = poItemsByPoId.get(item.purchase_order_id) ?? [];
    existing.push(item);
    poItemsByPoId.set(item.purchase_order_id, existing);
  });

  let accurateOrders = 0;
  let ordersWithDiscrepancies = 0;
  poItemsByPoId.forEach(items => {
    const hasDiscrepancy = items.some(
      item => item.received_quantity !== null && item.received_quantity !== item.quantity
    );
    if (hasDiscrepancy) {
      ordersWithDiscrepancies++;
    } else {
      accurateOrders++;
    }
  });

  const orderAccuracyRate = (accurateOrders + ordersWithDiscrepancies) > 0
    ? Math.round((accurateOrders / (accurateOrders + ordersWithDiscrepancies)) * 100)
    : 100;

  // Quality score (percentage of items received correctly)
  const qualityScore = totalItemsOrdered > 0
    ? Math.round((Math.min(totalItemsReceived, totalItemsOrdered) / totalItemsOrdered) * 100)
    : 100;

  // Response time (time from created to updated for approved POs)
  const approvedPOs = purchaseOrders.filter(
    po => po.status !== 'draft' && po.updated_at && po.created_at
  );
  const responseTimes = approvedPOs.map(po =>
    differenceInDays(new Date(po.updated_at!), new Date(po.created_at))
  ).filter(rt => rt >= 0);
  const averageResponseTimeDays = responseTimes.length > 0
    ? Math.round((responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length) * 10) / 10
    : 0;

  // Monthly spend trend
  const monthlySpendMap = new Map<string, { spend: number; orders: number }>();
  activePOs.forEach(po => {
    const month = format(new Date(po.created_at), 'yyyy-MM');
    const existing = monthlySpendMap.get(month) ?? { spend: 0, orders: 0 };
    monthlySpendMap.set(month, {
      spend: existing.spend + (po.total ?? 0),
      orders: existing.orders + 1,
    });
  });
  const monthlySpend = Array.from(monthlySpendMap.entries())
    .map(([month, data]) => ({
      month,
      spend: Math.round(data.spend * 100) / 100,
      orders: data.orders,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Orders by status
  const ordersByStatus: Record<string, number> = {
    draft: purchaseOrders.filter(po => po.status === 'draft').length,
    submitted: purchaseOrders.filter(po => po.status === 'submitted').length,
    approved: purchaseOrders.filter(po => po.status === 'approved').length,
    received: receivedPOs.length,
    cancelled: cancelledPOs.length,
  };

  return {
    // Delivery metrics
    onTimeDeliveryRate,
    lateDeliveries,
    totalDeliveries: posWithDeliveryDates.length,

    // Order accuracy metrics
    orderAccuracyRate,
    accurateOrders,
    ordersWithDiscrepancies,

    // Lead time metrics
    averageLeadTimeDays,
    minLeadTimeDays,
    maxLeadTimeDays,

    // Financial metrics
    totalSpend: Math.round(totalSpend * 100) / 100,
    averageOrderValue,
    totalOrders: activePOs.length,
    pendingOrders: pendingPOs.length,

    // Payment metrics
    outstandingBalance: Math.round(Math.max(0, outstandingBalance) * 100) / 100,
    paidAmount: Math.round(totalPaid * 100) / 100,
    paymentRate,

    // Quality metrics
    qualityScore,
    itemsReceived: totalItemsReceived,
    itemsWithIssues: itemsWithDiscrepancy,

    // Response time
    averageResponseTimeDays,

    // Trends
    monthlySpend,

    // Status breakdown
    ordersByStatus,
  };
}

// ============================================================================
// Default Data
// ============================================================================

export function getDefaultVendorMetrics(): VendorPerformanceMetrics {
  return {
    onTimeDeliveryRate: 100,
    lateDeliveries: 0,
    totalDeliveries: 0,
    orderAccuracyRate: 100,
    accurateOrders: 0,
    ordersWithDiscrepancies: 0,
    averageLeadTimeDays: 0,
    minLeadTimeDays: 0,
    maxLeadTimeDays: 0,
    totalSpend: 0,
    averageOrderValue: 0,
    totalOrders: 0,
    pendingOrders: 0,
    outstandingBalance: 0,
    paidAmount: 0,
    paymentRate: 100,
    qualityScore: 100,
    itemsReceived: 0,
    itemsWithIssues: 0,
    averageResponseTimeDays: 0,
    monthlySpend: [],
    ordersByStatus: {
      draft: 0,
      submitted: 0,
      approved: 0,
      received: 0,
      cancelled: 0,
    },
  };
}
