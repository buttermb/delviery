/**
 * Delivery Fee Calculation Hook
 *
 * Calculates delivery fee based on zone, order total, distance, and promotions.
 * - Free delivery above configurable threshold
 * - Zone-based flat rates
 * - Distance-based variable rates
 * - Apply promo codes for free delivery
 * - Fee breakdown for order summary and storefront checkout
 */

import { useMemo } from 'react';

import type { DeliveryZone } from '@/types/delivery-zone';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the delivery fee calculation */
export interface DeliveryFeeConfig {
  /** Dollar amount above which delivery is free (store-level setting) */
  freeDeliveryThreshold: number;
  /** Default flat-rate fee when no zone matches */
  defaultFee: number;
  /** Per-mile rate for distance-based surcharges (0 to disable) */
  perMileRate: number;
  /** Miles included in the zone flat rate before surcharge applies */
  includedMiles: number;
}

/** Inputs consumed by the fee calculator */
export interface DeliveryFeeInput {
  /** Cart / order subtotal before delivery fees */
  orderTotal: number;
  /** Matched delivery zone (null when no zone applies) */
  zone?: DeliveryZone | null;
  /** Delivery distance in miles (null when unknown) */
  distanceMiles?: number | null;
  /** Whether an applied promo grants free delivery */
  promoFreeDelivery?: boolean;
}

/** Itemised breakdown returned by the hook */
export interface DeliveryFeeBreakdown {
  /** Zone flat rate (or default when no zone) */
  baseFee: number;
  /** Distance surcharge beyond included miles */
  distanceSurcharge: number;
  /** baseFee + distanceSurcharge before any waivers */
  subtotalFee: number;
  /** Whether delivery is free (threshold / promo) */
  freeDeliveryApplied: boolean;
  /** Human-readable reason when delivery is free */
  freeDeliveryReason: string | null;
  /** The fee the customer actually pays */
  finalFee: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: DeliveryFeeConfig = {
  freeDeliveryThreshold: 100,
  defaultFee: 5,
  perMileRate: 0,
  includedMiles: 0,
};

// ---------------------------------------------------------------------------
// Pure calculation (exported for testing / reuse outside React)
// ---------------------------------------------------------------------------

/**
 * Compute a full delivery-fee breakdown.
 *
 * Pure function – no side-effects, safe to call from any context.
 */
export function calculateDeliveryFee(
  input: DeliveryFeeInput,
  config: DeliveryFeeConfig = DEFAULT_CONFIG,
): DeliveryFeeBreakdown {
  const { orderTotal, zone, distanceMiles, promoFreeDelivery } = input;
  const {
    freeDeliveryThreshold,
    defaultFee,
    perMileRate,
    includedMiles,
  } = config;

  // 1. Zone-based flat rate (fall back to store default)
  const baseFee = zone?.delivery_fee ?? defaultFee;

  // 2. Distance-based variable surcharge
  let distanceSurcharge = 0;
  if (
    perMileRate > 0 &&
    typeof distanceMiles === 'number' &&
    distanceMiles > includedMiles
  ) {
    distanceSurcharge = Math.round(
      (distanceMiles - includedMiles) * perMileRate * 100,
    ) / 100; // cents-safe rounding
  }

  const subtotalFee = Math.round((baseFee + distanceSurcharge) * 100) / 100;

  // 3. Free-delivery checks
  let freeDeliveryApplied = false;
  let freeDeliveryReason: string | null = null;

  if (promoFreeDelivery) {
    freeDeliveryApplied = true;
    freeDeliveryReason = 'Promo code applied';
  } else if (freeDeliveryThreshold > 0 && orderTotal >= freeDeliveryThreshold) {
    freeDeliveryApplied = true;
    freeDeliveryReason = `Free delivery on orders over $${freeDeliveryThreshold}`;
  }

  const finalFee = freeDeliveryApplied ? 0 : subtotalFee;

  return {
    baseFee,
    distanceSurcharge,
    subtotalFee,
    freeDeliveryApplied,
    freeDeliveryReason,
    finalFee,
  };
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * React hook that memoises the delivery-fee calculation.
 *
 * @example
 * ```tsx
 * const { finalFee, freeDeliveryApplied, freeDeliveryReason } = useDeliveryFee(
 *   { orderTotal: 85, zone: matchedZone, distanceMiles: 4.2 },
 *   { freeDeliveryThreshold: 100, defaultFee: 5, perMileRate: 1.5, includedMiles: 3 },
 * );
 * ```
 */
export function useDeliveryFee(
  input: DeliveryFeeInput,
  config?: Partial<DeliveryFeeConfig>,
): DeliveryFeeBreakdown {
  const mergedConfig: DeliveryFeeConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [
      config?.freeDeliveryThreshold,
      config?.defaultFee,
      config?.perMileRate,
      config?.includedMiles,
    ],
  );

  const breakdown = useMemo(() => {
    try {
      return calculateDeliveryFee(input, mergedConfig);
    } catch (err) {
      logger.error('Delivery fee calculation failed', err as Error);
      // Safe fallback – charge nothing rather than crash checkout
      return {
        baseFee: 0,
        distanceSurcharge: 0,
        subtotalFee: 0,
        freeDeliveryApplied: false,
        freeDeliveryReason: null,
        finalFee: 0,
      } satisfies DeliveryFeeBreakdown;
    }
  }, [
    input.orderTotal,
    input.zone?.id,
    input.zone?.delivery_fee,
    input.distanceMiles,
    input.promoFreeDelivery,
    mergedConfig,
  ]);

  return breakdown;
}

export default useDeliveryFee;
