/**
 * Dashboard Alerts Hook
 * Fetches and manages predictive alerts for the dashboard notification bell
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import type { PredictiveAlert, AlertSeverity, AlertCategory } from '@/hooks/usePredictiveAlerts';

interface DashboardAlert extends PredictiveAlert {
  read: boolean;
}

interface UseDashboardAlertsResult {
  alerts: DashboardAlert[];
  unreadCount: number;
  isLoading: boolean;
  dismissAlert: (id: string) => void;
  dismissAll: () => void;
  markAsRead: (id: string) => void;
}

const STORAGE_KEY_PREFIX = 'dashboard_alerts_dismissed_';

export function useDashboardAlerts(): UseDashboardAlertsResult {
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Track dismissed alert IDs in localStorage
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (!tenantId) return [];
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tenantId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Track read alert IDs (not dismissed, just marked as read)
  const [readIds, setReadIds] = useState<string[]>(() => {
    if (!tenantId) return [];
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}read_${tenantId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Fetch alerts data
  const { data: rawAlerts = [], isLoading } = useQuery({
    queryKey: queryKeys.dashboard.alerts(tenantId || ''),
    queryFn: async () => {
      if (!tenantId) return [];

      const alerts: PredictiveAlert[] = [];
      const now = new Date();

      // Fetch low stock products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock_quantity, available_quantity, low_stock_alert')
        .eq('tenant_id', tenantId);

      const DEFAULT_LOW_STOCK_THRESHOLD = 10;
      products?.forEach(item => {
        const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
        const threshold = item.low_stock_alert ?? DEFAULT_LOW_STOCK_THRESHOLD;

        if (currentQty <= 0) {
          alerts.push({
            id: `stockout-${item.id}`,
            category: 'inventory' as AlertCategory,
            severity: 'critical' as AlertSeverity,
            title: 'Out of Stock',
            message: `${item.name} is currently out of stock`,
            actionLabel: 'Reorder Now',
            actionHref: `/${tenantSlug}/admin/inventory/products?search=${encodeURIComponent(item.name || '')}`,
            daysUntil: 0,
            entityId: item.id,
            entityType: 'product',
            createdAt: now,
          });
        } else if (currentQty <= threshold) {
          alerts.push({
            id: `low-stock-${item.id}`,
            category: 'inventory' as AlertCategory,
            severity: 'warning' as AlertSeverity,
            title: 'Low Stock Alert',
            message: `${item.name} has only ${currentQty.toFixed(1)} units remaining`,
            actionLabel: 'View Product',
            actionHref: `/${tenantSlug}/admin/inventory/products?search=${encodeURIComponent(item.name || '')}`,
            entityId: item.id,
            entityType: 'product',
            createdAt: now,
          });
        }
      });

      // Fetch pending orders over 24 hours old
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: pendingOrders } = await supabase
        .from('wholesale_orders')
        .select('id, created_at, wholesale_clients(business_name)')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .lt('created_at', oneDayAgo.toISOString())
        .limit(10);

      pendingOrders?.forEach(order => {
        const ageHours = (now.getTime() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
        const ageDays = Math.floor(ageHours / 24);
        const clientName = (order.wholesale_clients as { business_name?: string } | null)?.business_name || 'Customer';

        alerts.push({
          id: `order-aging-${order.id}`,
          category: 'orders' as AlertCategory,
          severity: ageHours >= 48 ? 'critical' : 'warning',
          title: 'Order Needs Attention',
          message: `Order for ${clientName} pending for ${ageDays} day${ageDays === 1 ? '' : 's'}`,
          actionLabel: 'View Order',
          actionHref: `/${tenantSlug}/admin/wholesale-orders?id=${order.id}`,
          entityId: order.id,
          entityType: 'order',
          createdAt: now,
        });
      });

      // Fetch overdue invoices (cast to any to bypass type issues)
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, due_date, total, client_id')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'sent', 'overdue'])
        .lt('due_date', now.toISOString())
        .limit(5);

      (overdueInvoices || []).forEach((invoice: any) => {
        const daysOverdue = Math.ceil((now.getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));

        alerts.push({
          id: `invoice-overdue-${invoice.id}`,
          category: 'payments' as AlertCategory,
          severity: daysOverdue > 7 ? 'critical' : 'warning',
          title: 'Overdue Invoice',
          message: `Invoice ${invoice.invoice_number || invoice.id?.slice(0, 8)} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`,
          actionLabel: 'Follow Up',
          actionHref: `/${tenantSlug}/admin/invoices?id=${invoice.id}`,
          daysUntil: -daysOverdue,
          entityId: invoice.id,
          entityType: 'invoice',
          createdAt: now,
        });
      });

      // Sort by severity and urgency
      return alerts.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;

        const aDays = a.daysUntil ?? 999;
        const bDays = b.daysUntil ?? 999;
        return aDays - bDays;
      });
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider stale after 30 seconds
  });

  // Process alerts with read/dismissed state
  const alerts = useMemo<DashboardAlert[]>(() => {
    return rawAlerts
      .filter(alert => !dismissedIds.includes(alert.id))
      .map(alert => ({
        ...alert,
        read: readIds.includes(alert.id),
      }));
  }, [rawAlerts, dismissedIds, readIds]);

  const unreadCount = useMemo(() => {
    return alerts.filter(a => !a.read).length;
  }, [alerts]);

  const dismissAlert = useCallback((id: string) => {
    const newDismissedIds = [...dismissedIds, id];
    setDismissedIds(newDismissedIds);
    if (tenantId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantId}`, JSON.stringify(newDismissedIds));
    }
  }, [dismissedIds, tenantId]);

  const dismissAll = useCallback(() => {
    const allIds = alerts.map(a => a.id);
    const newDismissedIds = [...new Set([...dismissedIds, ...allIds])];
    setDismissedIds(newDismissedIds);
    if (tenantId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantId}`, JSON.stringify(newDismissedIds));
    }
  }, [alerts, dismissedIds, tenantId]);

  const markAsRead = useCallback((id: string) => {
    if (!readIds.includes(id)) {
      const newReadIds = [...readIds, id];
      setReadIds(newReadIds);
      if (tenantId) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}read_${tenantId}`, JSON.stringify(newReadIds));
      }
    }
  }, [readIds, tenantId]);

  return {
    alerts,
    unreadCount,
    isLoading,
    dismissAlert,
    dismissAll,
    markAsRead,
  };
}
