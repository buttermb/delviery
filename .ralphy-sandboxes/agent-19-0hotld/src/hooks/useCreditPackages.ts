/**
 * useCreditPackages Hook
 *
 * Fetches available credit packages, sorts by featured then price,
 * calculates savings percentage for bulk packages, and checks
 * purchase eligibility for each package.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import type { Tables } from '@/integrations/supabase/types';

// ============================================================================
// Types
// ============================================================================

type CreditPackageRow = Tables<'credit_packages'> & {
  /** Badge field exists in DB but may not be in generated types yet */
  badge?: string | null;
};

export interface CreditPackage extends CreditPackageRow {
  /** Total credits including bonus */
  totalCredits: number;
  /** Price per credit in cents */
  pricePerCredit: number;
  /** Savings percentage compared to the base (most expensive per-credit) package */
  savingsPercent: number;
  /** Whether this package is featured (has a badge like POPULAR or BEST VALUE) */
  isFeatured: boolean;
  /** Whether the current user is eligible to purchase this package */
  isEligible: boolean;
  /** Reason if not eligible */
  ineligibleReason: string | null;
}

export interface UseCreditPackagesOptions {
  /** Only fetch packages for a specific tenant (if table supports tenant filtering) */
  tenantId?: string;
  /** Whether to include inactive packages (admin use) */
  includeInactive?: boolean;
}

export interface UseCreditPackagesReturn {
  packages: CreditPackage[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  /** The cheapest package (lowest total price) */
  cheapestPackage: CreditPackage | null;
  /** The best value package (lowest price per credit) */
  bestValuePackage: CreditPackage | null;
  /** The featured/popular package */
  featuredPackage: CreditPackage | null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate the savings percentage compared to the base price per credit.
 * The base is the most expensive per-credit package (typically the smallest).
 */
function calculateSavingsPercent(
  pricePerCredit: number,
  baselinePricePerCredit: number
): number {
  if (baselinePricePerCredit <= 0 || pricePerCredit >= baselinePricePerCredit) {
    return 0;
  }
  return Math.round(
    ((baselinePricePerCredit - pricePerCredit) / baselinePricePerCredit) * 100
  );
}

/**
 * Sort packages: featured (has badge) first, then by price ascending
 */
function sortPackages(a: CreditPackage, b: CreditPackage): number {
  // Featured packages first
  if (a.isFeatured && !b.isFeatured) return -1;
  if (!a.isFeatured && b.isFeatured) return 1;

  // Then by sort_order if available
  const aOrder = a.sort_order ?? 999;
  const bOrder = b.sort_order ?? 999;
  if (aOrder !== bOrder) return aOrder - bOrder;

  // Finally by price ascending
  return a.price_cents - b.price_cents;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCreditPackages(
  options: UseCreditPackagesOptions = {}
): UseCreditPackagesReturn {
  const { tenant } = useTenantAdminAuth();
  const tenantId = options.tenantId ?? tenant?.id;

  const {
    data: rawPackages,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.creditPackages.list(tenantId),
    queryFn: async (): Promise<CreditPackageRow[]> => {
      let query = supabase
        .from('credit_packages')
        .select('id, name, description, credits, bonus_credits, price_cents, stripe_price_id, is_active, sort_order, slug, badge, created_at, updated_at');

      if (!options.includeInactive) {
        query = query.eq('is_active', true);
      }

      query = query.order('sort_order', { ascending: true });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logger.error('Failed to fetch credit packages', { error: fetchError });
        throw fetchError;
      }

      return (data ?? []) as CreditPackageRow[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - packages change infrequently
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });

  // Transform raw packages into enriched CreditPackage objects
  const packages = useMemo((): CreditPackage[] => {
    if (!rawPackages || rawPackages.length === 0) return [];

    // Calculate price per credit for each package
    const withPricing = rawPackages.map((pkg) => {
      const bonusCredits = pkg.bonus_credits ?? 0;
      const totalCredits = pkg.credits + bonusCredits;
      const pricePerCredit = totalCredits > 0
        ? pkg.price_cents / totalCredits
        : 0;

      return {
        ...pkg,
        totalCredits,
        pricePerCredit,
        isFeatured: Boolean(pkg.badge),
        savingsPercent: 0,
        isEligible: true,
        ineligibleReason: null,
      } as CreditPackage;
    });

    // Find the highest price per credit (baseline for savings calculation)
    // This is typically the smallest package
    const baselinePricePerCredit = Math.max(
      ...withPricing.map((p) => p.pricePerCredit)
    );

    // Calculate savings and eligibility for each package
    const enriched = withPricing.map((pkg): CreditPackage => {
      const savingsPercent = calculateSavingsPercent(
        pkg.pricePerCredit,
        baselinePricePerCredit
      );

      // Check purchase eligibility
      let isEligible = true;
      let ineligibleReason: string | null = null;

      if (!pkg.is_active) {
        isEligible = false;
        ineligibleReason = 'This package is currently unavailable';
      } else if (!pkg.stripe_price_id) {
        // Package exists but has no Stripe price configured
        isEligible = false;
        ineligibleReason = 'Payment not configured for this package';
      }

      return {
        ...pkg,
        savingsPercent,
        isEligible,
        ineligibleReason,
      };
    });

    // Sort: featured first, then by sort_order/price
    return enriched.sort(sortPackages);
  }, [rawPackages]);

  // Derived convenience values
  const cheapestPackage = useMemo(
    () =>
      packages.length > 0
        ? packages.reduce((min, pkg) =>
            pkg.price_cents < min.price_cents ? pkg : min
          )
        : null,
    [packages]
  );

  const bestValuePackage = useMemo(
    () =>
      packages.length > 0
        ? packages.reduce((best, pkg) =>
            pkg.pricePerCredit < best.pricePerCredit ? pkg : best
          )
        : null,
    [packages]
  );

  const featuredPackage = useMemo(
    () => packages.find((pkg) => pkg.isFeatured) ?? null,
    [packages]
  );

  return {
    packages,
    isLoading,
    error: error as Error | null,
    refetch,
    cheapestPackage,
    bestValuePackage,
    featuredPackage,
  };
}
