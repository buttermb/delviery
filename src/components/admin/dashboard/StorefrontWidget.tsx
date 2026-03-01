/**
 * Storefront Widget Component
 * Displays today's storefront stats on the admin dashboard:
 * - Active Stores count
 * - Today's Orders
 * - Today's Revenue
 * - Total Customers
 * With quick links to storefront admin pages.
 */

import { useQuery } from '@tanstack/react-query';
import Store from "lucide-react/dist/esm/icons/store";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Users from "lucide-react/dist/esm/icons/users";
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { KPICard, KPICardSkeleton } from './KPICard';

interface StorefrontStats {
  activeStores: number;
  totalStores: number;
  todayOrders: number;
  todayRevenue: number;
  totalCustomers: number;
}

export function StorefrontWidget() {
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.storefrontWidget(tenantId),
    queryFn: async (): Promise<StorefrontStats | null> => {
      if (!tenantId) return null;

      const { data: stores, error: storesError } = await supabase
        .from('marketplace_stores')
        .select('id, is_active, total_customers')
        .eq('tenant_id', tenantId);

      if (storesError) {
        logger.error('Failed to fetch marketplace stores for widget', { error: storesError });
        throw storesError;
      }

      if (!stores || stores.length === 0) {
        return null;
      }

      const storeIds = stores.map((s) => s.id);
      const activeStores = stores.filter((s) => s.is_active).length;
      const totalCustomers = stores.reduce((sum, s) => sum + (s.total_customers ?? 0), 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayOrders, error: ordersError } = await supabase
        .from('storefront_orders')
        .select('total')
        .in('store_id', storeIds)
        .gte('created_at', today.toISOString())
        .not('status', 'eq', 'cancelled');

      if (ordersError) {
        logger.error('Failed to fetch today storefront orders', { error: ordersError });
      }

      const todayRevenue = (todayOrders ?? []).reduce(
        (sum, o) => sum + (Number(o.total) || 0),
        0
      );

      return {
        activeStores,
        totalStores: stores.length,
        todayOrders: todayOrders?.length ?? 0,
        todayRevenue,
        totalCustomers,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  // Don't render if no stores exist
  if (!isLoading && !stats) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
        <Store className="h-5 w-5 text-blue-600" />
        Storefront
      </h2>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard
              title="Active Stores"
              value={`${stats?.activeStores ?? 0} / ${stats?.totalStores ?? 0}`}
              icon={<Store className="h-5 w-5" />}
              description="Stores currently live"
              variant={stats?.activeStores && stats.activeStores > 0 ? 'success' : 'default'}
              href={`/${tenantSlug}/admin/storefront`}
            />
            <KPICard
              title="Today's Orders"
              value={stats?.todayOrders ?? 0}
              icon={<ShoppingCart className="h-5 w-5" />}
              description="Storefront orders today"
              variant={stats?.todayOrders && stats.todayOrders > 0 ? 'success' : 'default'}
              href={`/${tenantSlug}/admin/storefront/orders`}
            />
            <KPICard
              title="Today's Revenue"
              value={formatCurrency(stats?.todayRevenue ?? 0)}
              icon={<DollarSign className="h-5 w-5" />}
              description="Storefront revenue today"
              variant="success"
              href={`/${tenantSlug}/admin/storefront/analytics`}
            />
            <KPICard
              title="Customers"
              value={stats?.totalCustomers ?? 0}
              icon={<Users className="h-5 w-5" />}
              description="Total storefront customers"
              variant="default"
              href={`/${tenantSlug}/admin/storefront/customers`}
            />
          </>
        )}
      </div>
    </div>
  );
}
