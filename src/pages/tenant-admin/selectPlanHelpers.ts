/**
 * Pure helpers for SelectPlanPage tier comparison logic.
 * Extracted so they can be unit-tested without importing Supabase.
 */

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  features: string[];
  popular?: boolean;
}

/** Tier ordering for upgrade/downgrade comparison. Higher = more premium. */
export const TIER_ORDER: Record<string, number> = { starter: 1, professional: 2, enterprise: 3 };

/** Check if selecting a plan is an upgrade from the current tier. */
export function isPlanUpgrade(plan: Plan, currentTier: string, isFreeTier: boolean): boolean {
  if (isFreeTier) return true; // All paid plans are upgrades from free
  const currentOrder = TIER_ORDER[currentTier] ?? 0;
  const planOrder = TIER_ORDER[plan.id] ?? 0;
  return planOrder > currentOrder;
}

/** Check if a plan matches the current subscription tier. */
export function isPlanCurrent(plan: Plan, currentTier: string, isFreeTier: boolean): boolean {
  if (isFreeTier) return false;
  return plan.id === currentTier;
}
