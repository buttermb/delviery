/**
 * useEventToasts Hook
 *
 * Subscribes to eventBus events and shows subtle toast notifications
 * with clickable navigation to relevant admin pages.
 *
 * This hook is ONLY for user-facing toasts — it does NOT duplicate
 * the query invalidation from useRealtimeSync or the notification center.
 * It is designed to be mounted once in AdminLayout so toasts appear
 * regardless of which admin page the user is viewing.
 *
 * Phase 2: Replaced 6 Supabase realtime channels with eventBus subscriptions.
 * Events flow: DB → useRealtimeSync → eventBus → this hook.
 */

import { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { sendBrowserNotification } from '@/utils/browserNotifications';
import { eventBus } from '@/lib/eventBus';

// ============================================================================
// Types
// ============================================================================

interface UseEventToastsOptions {
  enabled?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

// Debounce tracker to prevent notification floods
const recentToasts = new Map<string, number>();
const DEBOUNCE_MS = 3000;

function shouldShowToast(key: string): boolean {
  const now = Date.now();
  const last = recentToasts.get(key);
  if (last && now - last < DEBOUNCE_MS) {
    return false;
  }
  recentToasts.set(key, now);

  // Clean up old entries periodically
  if (recentToasts.size > 100) {
    const cutoff = now - DEBOUNCE_MS * 2;
    for (const [k, v] of recentToasts) {
      if (v < cutoff) recentToasts.delete(k);
    }
  }

  return true;
}

// ============================================================================
// Hook
// ============================================================================

export function useEventToasts({ enabled = true }: UseEventToastsOptions = {}) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const adminLink = useCallback(
    (path: string) => (tenantSlug ? `/${tenantSlug}/admin/${path}` : `/admin/${path}`),
    [tenantSlug]
  );

  useEffect(() => {
    if (!enabled || !tenantId) return;

    const unsubscribers: Array<() => void> = [];

    // --- New orders toast (replaces 3 realtime channels: orders, menu_orders, storefront_orders) ---
    unsubscribers.push(
      eventBus.subscribe('order_created', (payload) => {
        if (payload.tenantId !== tenantId) return;
        const key = `order-${payload.orderId}`;
        if (!shouldShowToast(key)) return;

        const orderNum = payload.orderId.slice(0, 8);
        const link = adminLink('orders');
        toast.info(`New order #${orderNum} received`, {
          action: { label: 'View', onClick: () => navigate(link) },
          duration: 6000,
        });

        sendBrowserNotification('New Order Received', `Order #${orderNum}`, link);
      })
    );

    // --- Menu order toast ---
    unsubscribers.push(
      eventBus.subscribe('menu_order_created', (payload) => {
        if (payload.tenantId !== tenantId) return;
        const key = `order-${payload.orderId}`;
        if (!shouldShowToast(key)) return;

        const orderNum = payload.orderId.slice(0, 8);
        const link = adminLink('orders');
        toast.info(`New menu order #${orderNum} received`, {
          action: { label: 'View', onClick: () => navigate(link) },
          duration: 6000,
        });

        sendBrowserNotification('New Menu Order', `Order #${orderNum}`, link);
      })
    );

    // --- Low stock toast (replaces products realtime channel) ---
    unsubscribers.push(
      eventBus.subscribe('inventory_changed', (payload) => {
        if (payload.tenantId !== tenantId) return;
        // Only show warning when stock is critically low
        if (payload.newQuantity > 10) return;
        if (payload.newQuantity < 0) return;

        const key = `stock-${payload.productId}`;
        if (!shouldShowToast(key)) return;

        const link = adminLink('inventory');
        toast.warning(`Low stock alert (${payload.newQuantity} remaining)`, {
          action: { label: 'View Inventory', onClick: () => navigate(link) },
          duration: 8000,
        });

        sendBrowserNotification(
          'Low Stock Alert',
          `Product has only ${payload.newQuantity} units left`,
          link
        );
      })
    );

    // --- Payment received toast (replaces wholesale_payments realtime channel) ---
    unsubscribers.push(
      eventBus.subscribe('payment_received', (payload) => {
        if (payload.tenantId !== tenantId) return;
        const key = `payment-${payload.paymentId}`;
        if (!shouldShowToast(key)) return;

        const link = adminLink('finance');
        toast.success(`Payment ${formatCurrency(payload.amount)} received`, {
          action: { label: 'View', onClick: () => navigate(link) },
          duration: 5000,
        });

        // Browser notification for large payments
        if (payload.amount >= 500) {
          sendBrowserNotification(
            'Large Payment Received',
            `${formatCurrency(payload.amount)} payment processed`,
            link
          );
        }
      })
    );

    // --- New customer toast (replaces customers realtime channel) ---
    unsubscribers.push(
      eventBus.subscribe('customer_updated', (payload) => {
        if (payload.tenantId !== tenantId) return;
        // Only show for new customer inserts (changes.type === 'insert')
        if (payload.changes?.type !== 'insert') return;
        const key = `customer-${payload.customerId}`;
        if (!shouldShowToast(key)) return;

        const link = adminLink('customers');
        toast.info('New customer registered', {
          action: { label: 'View', onClick: () => navigate(link) },
          duration: 5000,
        });
      })
    );

    logger.info('Event toasts initialized (eventBus mode)', {
      tenantId,
      subscriptionCount: unsubscribers.length,
      component: 'useEventToasts',
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [enabled, tenantId, adminLink, navigate]);
}
