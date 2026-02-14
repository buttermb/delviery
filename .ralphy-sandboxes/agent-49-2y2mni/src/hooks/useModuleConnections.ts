/**
 * Module Connection Health Checker
 *
 * Verifies interconnections between modules are working correctly.
 * Checks: orders→products, deliveries→orders, storefront→admin products,
 * notifications→events, inventory sync.
 *
 * Run on demand from system health page. Returns pass/fail per connection.
 */

import { useState, useCallback } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { getSubscriberCount } from '@/lib/eventBus';
import { logger } from '@/lib/logger';

export type ConnectionStatus = 'pass' | 'fail' | 'warn' | 'pending';

export interface ConnectionCheck {
  id: string;
  label: string;
  description: string;
  status: ConnectionStatus;
  detail?: string;
  checkedAt: Date | null;
}

export interface ModuleConnectionsResult {
  checks: ConnectionCheck[];
  isRunning: boolean;
  runAll: () => Promise<void>;
  runCheck: (checkId: string) => Promise<void>;
  passCount: number;
  failCount: number;
  warnCount: number;
}

const CONNECTION_CHECK_IDS = [
  'orders-products',
  'deliveries-orders',
  'storefront-products',
  'notifications-events',
  'inventory-sync',
] as const;

type CheckId = (typeof CONNECTION_CHECK_IDS)[number];

function createInitialChecks(): ConnectionCheck[] {
  return [
    {
      id: 'orders-products',
      label: 'Orders → Products',
      description: 'Order items reference valid products',
      status: 'pending',
      checkedAt: null,
    },
    {
      id: 'deliveries-orders',
      label: 'Deliveries → Orders',
      description: 'Deliveries link to existing orders',
      status: 'pending',
      checkedAt: null,
    },
    {
      id: 'storefront-products',
      label: 'Storefront → Admin Products',
      description: 'Marketplace products reference valid admin products',
      status: 'pending',
      checkedAt: null,
    },
    {
      id: 'notifications-events',
      label: 'Notifications → Event Bus',
      description: 'Event bus has active subscribers for key events',
      status: 'pending',
      checkedAt: null,
    },
    {
      id: 'inventory-sync',
      label: 'Inventory → Products',
      description: 'Products have inventory tracking fields populated',
      status: 'pending',
      checkedAt: null,
    },
  ];
}

/**
 * Check that order_items reference valid products for this tenant
 */
async function checkOrdersProducts(tenantId: string): Promise<Pick<ConnectionCheck, 'status' | 'detail'>> {
  // Check if there are any order items with null or invalid product references
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('id, product_id, order_id')
    .eq('tenant_id', tenantId)
    .limit(100);

  if (itemsError) {
    // Table may not exist or no access
    if (itemsError.code === '42P01') {
      return { status: 'warn', detail: 'order_items table not found' };
    }
    return { status: 'fail', detail: itemsError.message };
  }

  if (!orderItems || orderItems.length === 0) {
    return { status: 'pass', detail: 'No order items to validate (empty dataset)' };
  }

  // Check a sample of product_ids exist
  const productIds = [...new Set(orderItems.map((i: Record<string, unknown>) => i.product_id).filter(Boolean))];
  if (productIds.length === 0) {
    return { status: 'warn', detail: 'Order items exist but have no product references' };
  }

  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', productIds.slice(0, 50));

  if (prodError) {
    return { status: 'fail', detail: `Product lookup failed: ${prodError.message}` };
  }

  const foundIds = new Set((products ?? []).map((p: Record<string, unknown>) => p.id));
  const missingCount = productIds.slice(0, 50).filter((id) => !foundIds.has(id)).length;

  if (missingCount > 0) {
    return { status: 'warn', detail: `${missingCount} order item(s) reference missing products` };
  }

  return { status: 'pass', detail: `${orderItems.length} items checked, all products valid` };
}

/**
 * Check that deliveries reference valid orders for this tenant
 */
async function checkDeliveriesOrders(tenantId: string): Promise<Pick<ConnectionCheck, 'status' | 'detail'>> {
  const { data: deliveries, error: delError } = await supabase
    .from('deliveries')
    .select('id, order_id')
    .eq('tenant_id', tenantId)
    .limit(50);

  if (delError) {
    if (delError.code === '42P01') {
      return { status: 'warn', detail: 'deliveries table not found' };
    }
    return { status: 'fail', detail: delError.message };
  }

  if (!deliveries || deliveries.length === 0) {
    return { status: 'pass', detail: 'No deliveries to validate (empty dataset)' };
  }

  const orderIds = [...new Set(deliveries.map((d: Record<string, unknown>) => d.order_id).filter(Boolean))];
  if (orderIds.length === 0) {
    return { status: 'warn', detail: 'Deliveries exist but have no order references' };
  }

  // Check in orders table
  const { data: orders, error: ordError } = await supabase
    .from('orders')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', orderIds.slice(0, 50));

  if (ordError) {
    return { status: 'fail', detail: `Order lookup failed: ${ordError.message}` };
  }

  const foundIds = new Set((orders ?? []).map((o: Record<string, unknown>) => o.id));
  const missingCount = orderIds.slice(0, 50).filter((id) => !foundIds.has(id)).length;

  if (missingCount > 0) {
    return { status: 'warn', detail: `${missingCount} delivery(ies) reference missing orders` };
  }

  return { status: 'pass', detail: `${deliveries.length} deliveries checked, all orders valid` };
}

/**
 * Check that marketplace_products reference valid admin products
 */
async function checkStorefrontProducts(tenantId: string): Promise<Pick<ConnectionCheck, 'status' | 'detail'>> {
  const { data: mpProducts, error: mpError } = await supabase
    .from('marketplace_products')
    .select('id, product_id')
    .eq('tenant_id', tenantId)
    .limit(100);

  if (mpError) {
    if (mpError.code === '42P01') {
      return { status: 'warn', detail: 'marketplace_products table not found' };
    }
    return { status: 'fail', detail: mpError.message };
  }

  if (!mpProducts || mpProducts.length === 0) {
    return { status: 'pass', detail: 'No storefront products to validate (empty dataset)' };
  }

  const productIds = [...new Set(mpProducts.map((mp: Record<string, unknown>) => mp.product_id).filter(Boolean))];
  if (productIds.length === 0) {
    return { status: 'warn', detail: 'Storefront products exist but have no admin product references' };
  }

  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', productIds.slice(0, 50));

  if (prodError) {
    return { status: 'fail', detail: `Product lookup failed: ${prodError.message}` };
  }

  const foundIds = new Set((products ?? []).map((p: Record<string, unknown>) => p.id));
  const missingCount = productIds.slice(0, 50).filter((id) => !foundIds.has(id)).length;

  if (missingCount > 0) {
    return { status: 'warn', detail: `${missingCount} storefront product(s) reference missing admin products` };
  }

  return { status: 'pass', detail: `${mpProducts.length} storefront products checked, all match admin catalog` };
}

/**
 * Check that event bus has active subscribers for key events
 */
function checkNotificationEvents(): Pick<ConnectionCheck, 'status' | 'detail'> {
  const keyEvents = [
    'order_created',
    'order_updated',
    'inventory_changed',
    'delivery_status_changed',
    'notification_sent',
  ] as const;

  const results = keyEvents.map((event) => ({
    event,
    subscribers: getSubscriberCount(event),
  }));

  const withSubscribers = results.filter((r) => r.subscribers > 0);
  const totalSubscribers = results.reduce((sum, r) => sum + r.subscribers, 0);

  if (withSubscribers.length === 0) {
    return {
      status: 'warn',
      detail: 'No active event bus subscribers (modules may not be mounted)',
    };
  }

  if (withSubscribers.length < keyEvents.length) {
    const missing = results.filter((r) => r.subscribers === 0).map((r) => r.event);
    return {
      status: 'warn',
      detail: `${withSubscribers.length}/${keyEvents.length} events have listeners. Missing: ${missing.join(', ')}`,
    };
  }

  return {
    status: 'pass',
    detail: `All ${keyEvents.length} key events have active subscribers (${totalSubscribers} total)`,
  };
}

/**
 * Check that products have inventory tracking populated
 */
async function checkInventorySync(tenantId: string): Promise<Pick<ConnectionCheck, 'status' | 'detail'>> {
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, in_stock')
    .eq('tenant_id', tenantId)
    .limit(50);

  if (prodError) {
    if (prodError.code === '42P01') {
      return { status: 'warn', detail: 'products table not found' };
    }
    return { status: 'fail', detail: prodError.message };
  }

  if (!products || products.length === 0) {
    return { status: 'pass', detail: 'No products to validate (empty dataset)' };
  }

  // Check if in_stock field is populated (not null)
  const withStock = products.filter((p: Record<string, unknown>) => p.in_stock !== null && p.in_stock !== undefined);
  const ratio = withStock.length / products.length;

  if (ratio < 0.5) {
    return {
      status: 'warn',
      detail: `Only ${withStock.length}/${products.length} products have inventory status set`,
    };
  }

  return {
    status: 'pass',
    detail: `${withStock.length}/${products.length} products have inventory status tracked`,
  };
}

/**
 * Hook to verify all module interconnections are working.
 *
 * Returns a report of each connection as pass/fail/warn.
 * Intended to be run on demand from the system health page.
 */
export function useModuleConnections(): ModuleConnectionsResult {
  const { tenant } = useTenantAdminAuth();
  const [checks, setChecks] = useState<ConnectionCheck[]>(createInitialChecks);
  const [isRunning, setIsRunning] = useState(false);

  const updateCheck = useCallback((id: string, update: Partial<ConnectionCheck>) => {
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...update } : c))
    );
  }, []);

  const runSingleCheck = useCallback(
    async (checkId: CheckId) => {
      if (!tenant?.id) {
        logger.warn('[ModuleConnections] Cannot run check — no tenant context');
        return;
      }

      updateCheck(checkId, { status: 'pending', detail: undefined, checkedAt: null });

      try {
        let result: Pick<ConnectionCheck, 'status' | 'detail'>;

        switch (checkId) {
          case 'orders-products':
            result = await checkOrdersProducts(tenant.id);
            break;
          case 'deliveries-orders':
            result = await checkDeliveriesOrders(tenant.id);
            break;
          case 'storefront-products':
            result = await checkStorefrontProducts(tenant.id);
            break;
          case 'notifications-events':
            result = checkNotificationEvents();
            break;
          case 'inventory-sync':
            result = await checkInventorySync(tenant.id);
            break;
          default:
            result = { status: 'fail', detail: 'Unknown check' };
        }

        updateCheck(checkId, {
          status: result.status,
          detail: result.detail,
          checkedAt: new Date(),
        });

        logger.debug(`[ModuleConnections] Check ${checkId}: ${result.status}`, {
          detail: result.detail,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`[ModuleConnections] Check ${checkId} threw`, err);
        updateCheck(checkId, {
          status: 'fail',
          detail: message,
          checkedAt: new Date(),
        });
      }
    },
    [tenant?.id, updateCheck]
  );

  const runCheck = useCallback(
    async (checkId: string) => {
      if (!CONNECTION_CHECK_IDS.includes(checkId as CheckId)) {
        logger.warn(`[ModuleConnections] Unknown check id: ${checkId}`);
        return;
      }
      setIsRunning(true);
      try {
        await runSingleCheck(checkId as CheckId);
      } finally {
        setIsRunning(false);
      }
    },
    [runSingleCheck]
  );

  const runAll = useCallback(async () => {
    if (!tenant?.id) {
      logger.warn('[ModuleConnections] Cannot run checks — no tenant context');
      return;
    }

    setIsRunning(true);
    logger.info('[ModuleConnections] Running all connection checks', { tenantId: tenant.id });

    try {
      // Run checks sequentially to avoid overwhelming the DB
      for (const checkId of CONNECTION_CHECK_IDS) {
        await runSingleCheck(checkId);
      }

      logger.info('[ModuleConnections] All connection checks complete');
    } finally {
      setIsRunning(false);
    }
  }, [tenant?.id, runSingleCheck]);

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;

  return {
    checks,
    isRunning,
    runAll,
    runCheck,
    passCount,
    failCount,
    warnCount,
  };
}
