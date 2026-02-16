/**
 * Setup Checklist Hook
 * Checks completion status of key setup steps for new tenants.
 * Used by the dashboard SetupCompletionWidget.
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href: string;
}

export interface SetupChecklistData {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  percentage: number;
  allComplete: boolean;
}

/** Safe count extraction from a Supabase head query result */
function extractCount(
  result: PromiseSettledResult<{ count: number | null; error: { message: string } | null }>,
  label: string,
): number {
  if (result.status === 'rejected') {
    logger.warn(`[SetupChecklist] ${label} query rejected`, { reason: result.reason });
    return 0;
  }
  const { count, error } = result.value;
  if (error) {
    // 42P01 = table doesn't exist — treat as 0, not an error
    if ((error as { code?: string }).code !== '42P01') {
      logger.warn(`[SetupChecklist] ${label} query error`, { error });
    }
    return 0;
  }
  return count ?? 0;
}

/** Safe data extraction from a Supabase maybeSingle result */
function extractData<T>(
  result: PromiseSettledResult<{ data: T | null; error: { message: string } | null }>,
  label: string,
): T | null {
  if (result.status === 'rejected') {
    logger.warn(`[SetupChecklist] ${label} query rejected`, { reason: result.reason });
    return null;
  }
  const { data, error } = result.value;
  if (error && (error as { code?: string }).code !== '42P01') {
    logger.warn(`[SetupChecklist] ${label} query error`, { error });
  }
  return data ?? null;
}

/**
 * Queries multiple tables in parallel to determine which setup steps are done.
 * Each check is a lightweight count or existence query filtered by tenant_id.
 */
export function useSetupChecklist() {
  const { tenantId, tenantSlug } = useTenantContext();

  return useQuery<SetupChecklistData>({
    queryKey: ['setup-checklist', tenantId],
    queryFn: async (): Promise<SetupChecklistData> => {
      if (!tenantId || !tenantSlug) {
        return buildChecklist('', {});
      }

      const prefix = `/${tenantSlug}/admin`;

      // All queries run in parallel — each is lightweight (head/count or maybeSingle)
      const [
        tenantResult,
        productsResult,
        zonesResult,
        couriersResult,
        ordersResult,
        storefrontResult,
        paymentResult,
      ] = await Promise.allSettled([
        // 1. Profile: tenant has business_name and phone
        supabase
          .from('tenants')
          .select('business_name, phone')
          .eq('id', tenantId)
          .maybeSingle(),

        // 2. First product added
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),

        // 3. Delivery zone set
        (supabase as any)
          .from('delivery_zones')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),

        // 4. First driver approved (active courier)
        supabase
          .from('couriers')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('is_active', true),

        // 5. First order received
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),

        // 6. Storefront customized (has logo or primary color)
        (supabase as any)
          .from('storefront_settings')
          .select('logo_url, primary_color')
          .eq('tenant_id', tenantId)
          .maybeSingle(),

        // 7. Payment configured
        (supabase as any)
          .from('tenant_payment_settings')
          .select('accept_cash, accept_zelle, accept_cashapp, accept_bitcoin')
          .eq('tenant_id', tenantId)
          .maybeSingle(),
      ]);

      // 1. Profile complete
      const tenant = extractData<{ business_name?: string; phone?: string }>(
        tenantResult as PromiseSettledResult<{ data: { business_name?: string; phone?: string } | null; error: { message: string } | null }>,
        'tenant profile',
      );
      const profileComplete = Boolean(tenant?.business_name && tenant?.phone);

      // 2-5. Count-based checks
      const hasProducts = extractCount(productsResult as PromiseSettledResult<{ count: number | null; error: { message: string } | null }>, 'products') > 0;
      const hasZones = extractCount(zonesResult as PromiseSettledResult<{ count: number | null; error: { message: string } | null }>, 'delivery zones') > 0;
      const hasDriver = extractCount(couriersResult as PromiseSettledResult<{ count: number | null; error: { message: string } | null }>, 'couriers') > 0;
      const hasOrders = extractCount(ordersResult as PromiseSettledResult<{ count: number | null; error: { message: string } | null }>, 'orders') > 0;

      // 6. Storefront customized
      const sf = extractData<{ logo_url?: string | null; primary_color?: string | null }>(
        storefrontResult as PromiseSettledResult<{ data: { logo_url?: string | null; primary_color?: string | null } | null; error: { message: string } | null }>,
        'storefront settings',
      );
      const storefrontCustomized = Boolean(sf?.logo_url || sf?.primary_color);

      // 7. Payment configured (row exists = configured)
      const pay = extractData<Record<string, unknown>>(
        paymentResult as PromiseSettledResult<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
        'payment settings',
      );
      const paymentConfigured = Boolean(pay);

      return buildChecklist(prefix, {
        profileComplete,
        hasProducts,
        hasZones,
        hasDriver,
        hasOrders,
        storefrontCustomized,
        paymentConfigured,
      });
    },
    enabled: !!tenantId && !!tenantSlug,
    staleTime: 60_000,
  });
}

interface CompletionFlags {
  profileComplete?: boolean;
  hasProducts?: boolean;
  hasZones?: boolean;
  hasDriver?: boolean;
  hasOrders?: boolean;
  storefrontCustomized?: boolean;
  paymentConfigured?: boolean;
}

function buildChecklist(prefix: string, flags: CompletionFlags): SetupChecklistData {
  const items: ChecklistItem[] = [
    {
      id: 'profile',
      label: 'Complete your profile',
      description: 'Add your business name and phone number',
      completed: flags.profileComplete ?? false,
      href: `${prefix}/settings`,
    },
    {
      id: 'product',
      label: 'Add your first product',
      description: 'Create at least one product in your catalog',
      completed: flags.hasProducts ?? false,
      href: `${prefix}/products`,
    },
    {
      id: 'delivery-zone',
      label: 'Set up a delivery zone',
      description: 'Define where you deliver',
      completed: flags.hasZones ?? false,
      href: `${prefix}/delivery-zones`,
    },
    {
      id: 'driver',
      label: 'Approve your first driver',
      description: 'Add and activate a courier',
      completed: flags.hasDriver ?? false,
      href: `${prefix}/fleet`,
    },
    {
      id: 'order',
      label: 'Receive your first order',
      description: 'Your first customer order',
      completed: flags.hasOrders ?? false,
      href: `${prefix}/orders`,
    },
    {
      id: 'storefront',
      label: 'Customize your storefront',
      description: 'Add a logo or brand colors',
      completed: flags.storefrontCustomized ?? false,
      href: `${prefix}/storefront`,
    },
    {
      id: 'payment',
      label: 'Configure payment methods',
      description: 'Set up how you accept payments',
      completed: flags.paymentConfigured ?? false,
      href: `${prefix}/storefront?tab=payments`,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;

  return {
    items,
    completedCount,
    totalCount,
    percentage: Math.round((completedCount / totalCount) * 100),
    allComplete: completedCount === totalCount,
  };
}
