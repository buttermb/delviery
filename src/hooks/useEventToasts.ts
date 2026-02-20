/**
 * useEventToasts Hook
 *
 * Subscribes to Supabase realtime for key tables and shows subtle
 * toast notifications with clickable navigation to relevant admin pages.
 *
 * This hook is ONLY for user-facing toasts — it does NOT duplicate
 * the query invalidation from useRealtimeSync or the notification center.
 * It is designed to be mounted once in AdminLayout so toasts appear
 * regardless of which admin page the user is viewing.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { sendBrowserNotification } from '@/utils/browserNotifications';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

interface UseEventToastsOptions {
  enabled?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function getField(obj: unknown, field: string, fallback: string = ''): string {
  if (typeof obj === 'object' && obj !== null && field in obj) {
    return String((obj as Record<string, unknown>)[field] ?? fallback);
  }
  return fallback;
}

function getNumField(obj: unknown, field: string, fallback: number = 0): number {
  if (typeof obj === 'object' && obj !== null && field in obj) {
    return Number((obj as Record<string, unknown>)[field] ?? fallback);
  }
  return fallback;
}

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
  const channelsRef = useRef<RealtimeChannel[]>([]);

  const adminLink = useCallback(
    (path: string) => (tenantSlug ? `/${tenantSlug}/admin/${path}` : `/admin/${path}`),
    [tenantSlug]
  );

  useEffect(() => {
    if (!enabled || !tenantId) return;

    // Clean up existing channels
    channelsRef.current.forEach((ch) => {
      supabase.removeChannel(ch).catch((err) => logger.warn('Error removing channel', { error: err, component: 'useEventToasts' }));
    });
    channelsRef.current = [];

    // --- New orders toast ---
    const orderTables = ['orders', 'menu_orders', 'storefront_orders'];
    orderTables.forEach((table) => {
      const channel = supabase
        .channel(`event-toast-${table}-${tenantId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            if (!payload.new) return;
            const orderNum = getField(payload.new, 'order_number') ||
              getField(payload.new, 'id', '').slice(0, 8);
            const key = `order-${getField(payload.new, 'id')}`;
            if (!shouldShowToast(key)) return;

            const link = adminLink('orders');
            toast.info(`New order #${orderNum} received`, {
              action: {
                label: 'View',
                onClick: () => navigate(link),
              },
              duration: 6000,
            });

            // Browser notification for new orders (high priority)
            sendBrowserNotification(
              'New Order Received',
              `Order #${orderNum}`,
              link
            );
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.debug(`Event toast subscribed: ${table}`, { component: 'useEventToasts' });
          }
        });
      channelsRef.current.push(channel);
    });

    // --- Low stock toast ---
    const productsChannel = supabase
      .channel(`event-toast-products-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (!payload.new || !payload.old) return;
          const name = getField(payload.new, 'name', 'Unknown Product');
          const available = getNumField(payload.new, 'available_quantity',
            getNumField(payload.new, 'stock_quantity'));
          const threshold = getNumField(payload.new, 'low_stock_alert', 10);
          const oldAvailable = getNumField(payload.old, 'available_quantity',
            getNumField(payload.old, 'stock_quantity'));

          // Only alert when stock drops below threshold
          if (available <= threshold && oldAvailable > threshold) {
            const key = `stock-${getField(payload.new, 'id')}`;
            if (!shouldShowToast(key)) return;

            const link = adminLink('inventory');
            toast.warning(`Low stock: ${name} (${available} remaining)`, {
              action: {
                label: 'View Inventory',
                onClick: () => navigate(link),
              },
              duration: 8000,
            });

            // Browser notification for low stock
            sendBrowserNotification(
              'Low Stock Alert',
              `${name} has only ${available} units left`,
              link
            );
          }
        }
      )
      .subscribe();
    channelsRef.current.push(productsChannel);

    // --- Payment received toast ---
    const paymentsChannel = supabase
      .channel(`event-toast-payments-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payments' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (!payload.new) return;
          const amount = getNumField(payload.new, 'amount');
          const key = `payment-${getField(payload.new, 'id')}`;
          if (!shouldShowToast(key)) return;

          const link = adminLink('finance');
          toast.success(`Payment $${amount.toFixed(2)} received`, {
            action: {
              label: 'View',
              onClick: () => navigate(link),
            },
            duration: 5000,
          });

          // Browser notification for large payments
          if (amount >= 500) {
            sendBrowserNotification(
              'Large Payment Received',
              `$${amount.toFixed(2)} payment processed`,
              link
            );
          }
        }
      )
      .subscribe();
    channelsRef.current.push(paymentsChannel);

    // --- New customer toast ---
    const customersChannel = supabase
      .channel(`event-toast-customers-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'customers' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (!payload.new) return;
          const name = getField(payload.new, 'name') ||
            getField(payload.new, 'full_name') ||
            getField(payload.new, 'email', 'New Customer');
          const key = `customer-${getField(payload.new, 'id')}`;
          if (!shouldShowToast(key)) return;

          const link = adminLink('customers');
          toast.info(`New customer registered: ${name}`, {
            action: {
              label: 'View',
              onClick: () => navigate(link),
            },
            duration: 5000,
          });
        }
      )
      .subscribe();
    channelsRef.current.push(customersChannel);

    logger.info('Event toasts initialized', {
      tenantId,
      channelCount: channelsRef.current.length,
      component: 'useEventToasts',
    });

    const channels = channelsRef.current;
    return () => {
      channels.forEach((ch) => {
        supabase.removeChannel(ch).catch((err) => logger.warn('Error removing channel', { error: err, component: 'useEventToasts' }));
      });
      channelsRef.current = [];
    };
  }, [enabled, tenantId, adminLink, navigate]);

  return {
    isActive: channelsRef.current.length > 0,
  };
}
