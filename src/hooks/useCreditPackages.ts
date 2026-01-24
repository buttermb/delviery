/**
 * useCreditPackages Hook
 *
 * Provides credit packages data for purchase UI.
 * Fetches packages from the database if available, falls back to static config.
 */

import { useQuery } from '@tanstack/react-query';
import { CREDIT_PACKAGES, type CreditPackage } from '@/lib/credits';
import { getAllCreditPackages, type CreditPackageDB } from '@/lib/credits';
import { logger } from '@/lib/logger';

export interface CreditPackageDisplay {
  id: string;
  name: string;
  slug: string;
  credits: number;
  priceCents: number;
  badge?: string | null;
  description: string | null;
  bonusCredits: number;
  savingsPercent: number;
  featured: boolean;
}

function calculateSavingsPercent(priceCents: number, credits: number, basePricePerCredit: number): number {
  const actualPricePerCredit = priceCents / credits;
  if (basePricePerCredit <= 0) return 0;
  const savings = ((basePricePerCredit - actualPricePerCredit) / basePricePerCredit) * 100;
  return Math.max(0, Math.round(savings));
}

function mapDbPackageToDisplay(pkg: CreditPackageDB, basePricePerCredit: number): CreditPackageDisplay {
  return {
    id: pkg.id,
    name: pkg.name,
    slug: pkg.slug,
    credits: pkg.credits,
    priceCents: pkg.priceCents,
    badge: pkg.badge,
    description: pkg.description,
    bonusCredits: 0,
    savingsPercent: calculateSavingsPercent(pkg.priceCents, pkg.credits, basePricePerCredit),
    featured: pkg.badge === 'BEST VALUE' || pkg.badge === 'POPULAR',
  };
}

function mapStaticPackageToDisplay(pkg: CreditPackage, basePricePerCredit: number): CreditPackageDisplay {
  return {
    id: pkg.id,
    name: pkg.name,
    slug: pkg.slug,
    credits: pkg.credits,
    priceCents: pkg.priceCents,
    badge: pkg.badge ?? null,
    description: pkg.description,
    bonusCredits: 0,
    savingsPercent: calculateSavingsPercent(pkg.priceCents, pkg.credits, basePricePerCredit),
    featured: pkg.badge === 'BEST VALUE' || pkg.badge === 'POPULAR',
  };
}

export interface UseCreditPackagesReturn {
  packages: CreditPackageDisplay[];
  isLoading: boolean;
  error: Error | null;
}

export function useCreditPackages(): UseCreditPackagesReturn {
  const { data: dbPackages, isLoading, error } = useQuery({
    queryKey: ['credit-packages'],
    queryFn: async () => {
      try {
        const packages = await getAllCreditPackages();
        return packages.filter(p => p.isActive);
      } catch (err) {
        logger.warn('Failed to fetch DB credit packages, using static fallback', err);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const packages: CreditPackageDisplay[] = (() => {
    // Use the cheapest package as the base price reference
    const sourcePackages = dbPackages ?? CREDIT_PACKAGES;
    if (sourcePackages.length === 0) return [];

    // Base price per credit = the most expensive (smallest package) rate
    const basePricePerCredit = Math.max(
      ...sourcePackages.map(p => p.priceCents / p.credits)
    );

    if (dbPackages && dbPackages.length > 0) {
      return dbPackages
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(pkg => mapDbPackageToDisplay(pkg, basePricePerCredit));
    }

    return CREDIT_PACKAGES.map(pkg => mapStaticPackageToDisplay(pkg, basePricePerCredit));
  })();

  return {
    packages,
    isLoading,
    error: error as Error | null,
  };
}
