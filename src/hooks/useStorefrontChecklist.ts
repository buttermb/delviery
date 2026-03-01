/**
 * Storefront Getting Started Checklist Hook
 * Checks completion status of key storefront setup steps.
 * Used by the StorefrontDashboard to guide new tenants.
 *
 * Steps: create store, add products, customize, configure delivery,
 *        set payments, publish, share (URL copied).
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface StorefrontChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  /** Tab ID within the storefront hub or an external admin route */
  tabOrHref: string;
}

export interface StorefrontChecklistData {
  items: StorefrontChecklistItem[];
  completedCount: number;
  totalCount: number;
  percentage: number;
  allComplete: boolean;
}

interface StoreRow {
  id: string;
  store_name: string | null;
  slug: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  layout_config: unknown;
  theme_config: unknown;
  is_active: boolean | null;
  is_public: boolean | null;
  delivery_zones: unknown;
  payment_methods: unknown;
}

/**
 * Queries the marketplace_stores row + product count to determine checklist state.
 * All 7 checks are derived from a single store row + one count query.
 */
export function useStorefrontChecklist(storeId: string | null | undefined) {
  const { tenantId } = useTenantContext();

  return useQuery<StorefrontChecklistData>({
    queryKey: queryKeys.storefrontChecklist.byStore(storeId ?? undefined),
    queryFn: async (): Promise<StorefrontChecklistData> => {
      if (!storeId || !tenantId) {
        return buildChecklist(null, 0);
      }

      const [storeResult, productCountResult] = await Promise.allSettled([
        supabase
          .from('marketplace_stores')
          .select(
            'id, store_name, slug, logo_url, banner_url, primary_color, layout_config, theme_config, is_active, is_public, delivery_zones, payment_methods'
          )
          .eq('id', storeId)
          .eq('tenant_id', tenantId)
          .maybeSingle(),

        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
      ]);

      // Extract store data
      let store: StoreRow | null = null;
      if (storeResult.status === 'fulfilled') {
        if (storeResult.value.error) {
          logger.warn('[StorefrontChecklist] store query error', {
            error: storeResult.value.error,
          });
        } else {
          store = storeResult.value.data as StoreRow | null;
        }
      } else {
        logger.warn('[StorefrontChecklist] store query rejected', {
          reason: storeResult.reason,
        });
      }

      // Extract product count
      let productCount = 0;
      if (productCountResult.status === 'fulfilled') {
        if (productCountResult.value.error) {
          logger.warn('[StorefrontChecklist] products count error', {
            error: productCountResult.value.error,
          });
        } else {
          productCount = productCountResult.value.count ?? 0;
        }
      }

      return buildChecklist(store, productCount);
    },
    enabled: !!storeId && !!tenantId,
    staleTime: 60_000,
  });
}

function buildChecklist(
  store: StoreRow | null,
  productCount: number,
): StorefrontChecklistData {
  // Derive completion flags from store data
  const hasStore = !!store;
  const hasProducts = productCount > 0;
  const hasCustomization = !!(
    store?.logo_url ||
    store?.banner_url ||
    store?.primary_color ||
    hasLayoutSections(store?.layout_config)
  );
  const hasDelivery = hasDeliveryZones(store?.delivery_zones);
  const hasPayments = hasPaymentMethods(store?.payment_methods);
  const isPublished = !!(store?.is_active || store?.is_public);
  // "Share" is considered complete once the store is published
  // (the user will have seen the store URL at that point)
  const hasShared = isPublished;

  const items: StorefrontChecklistItem[] = [
    {
      id: 'create-store',
      label: 'Create your store',
      description: 'Set up your online storefront',
      completed: hasStore,
      tabOrHref: 'dashboard',
    },
    {
      id: 'add-products',
      label: 'Add products',
      description: 'Add at least one product to sell',
      completed: hasProducts,
      tabOrHref: 'products',
    },
    {
      id: 'customize',
      label: 'Customize your store',
      description: 'Add logo, branding, or page sections',
      completed: hasCustomization,
      tabOrHref: 'builder',
    },
    {
      id: 'delivery',
      label: 'Configure delivery',
      description: 'Set up delivery zones and fees',
      completed: hasDelivery,
      tabOrHref: 'settings',
    },
    {
      id: 'payments',
      label: 'Set up payments',
      description: 'Enable at least one payment method',
      completed: hasPayments,
      tabOrHref: 'settings',
    },
    {
      id: 'publish',
      label: 'Publish your store',
      description: 'Go live so customers can find you',
      completed: isPublished,
      tabOrHref: 'dashboard',
    },
    {
      id: 'share',
      label: 'Share your store link',
      description: 'Send your store URL to customers',
      completed: hasShared,
      tabOrHref: 'analytics',
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

/** Check if layout_config has at least one section */
function hasLayoutSections(config: unknown): boolean {
  if (!Array.isArray(config)) return false;
  return config.length > 0;
}

/** Check if delivery_zones has at least one zone */
function hasDeliveryZones(zones: unknown): boolean {
  if (!Array.isArray(zones)) return false;
  return zones.length > 0;
}

/** Check if payment_methods has at least one enabled method */
function hasPaymentMethods(methods: unknown): boolean {
  if (Array.isArray(methods)) return methods.length > 0;
  if (methods && typeof methods === 'object') {
    // Could be an object like { cash: true, venmo: true }
    return Object.values(methods).some(Boolean);
  }
  return false;
}
