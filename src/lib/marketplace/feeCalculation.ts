import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
/**
 * Platform Fee Calculation Utilities
 * Calculates 2% transaction fee on marketplace orders
 */


export interface FeeCalculationResult {
  subtotal: number;
  platformFee: number;
  tax: number;
  shippingCost: number;
  totalAmount: number;
}

/**
 * Calculate platform fee (2% of subtotal)
 * @param subtotal - Order subtotal amount
 * @returns Platform fee amount
 */
export function calculatePlatformFee(subtotal: number): number {
  if (subtotal <= 0) {
    return 0;
  }
  
  // 2% platform fee
  const feePercentage = 0.02;
  const fee = subtotal * feePercentage;
  
  // Round to 2 decimal places
  return Math.round(fee * 100) / 100;
}

/**
 * Calculate total order amount including fees
 * @param subtotal - Order subtotal
 * @param tax - Tax amount (optional)
 * @param shippingCost - Shipping cost (optional)
 * @returns Total amount including platform fee
 */
export function calculateOrderTotal(
  subtotal: number,
  tax: number = 0,
  shippingCost: number = 0
): FeeCalculationResult {
  const platformFee = calculatePlatformFee(subtotal);
  const totalAmount = subtotal + platformFee + tax + shippingCost;

  return {
    subtotal,
    platformFee,
    tax,
    shippingCost,
    totalAmount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
  };
}

/**
 * Validate fee calculation
 * @param calculation - Fee calculation result
 * @returns true if calculation is valid
 */
export function validateFeeCalculation(calculation: FeeCalculationResult): boolean {
  if (calculation.subtotal < 0) {
    logger.warn('Invalid fee calculation: negative subtotal', { calculation });
    return false;
  }

  if (calculation.platformFee < 0) {
    logger.warn('Invalid fee calculation: negative platform fee', { calculation });
    return false;
  }

  const expectedTotal = calculation.subtotal + calculation.platformFee + calculation.tax + calculation.shippingCost;
  const tolerance = 0.01; // Allow 1 cent tolerance for rounding

  if (Math.abs(calculation.totalAmount - expectedTotal) > tolerance) {
    logger.warn('Invalid fee calculation: total mismatch', { 
      calculation, 
      expectedTotal,
      difference: Math.abs(calculation.totalAmount - expectedTotal)
    });
    return false;
  }

  return true;
}

/**
 * Format fee breakdown for display
 * @param calculation - Fee calculation result
 * @returns Formatted breakdown string
 */
export function formatFeeBreakdown(calculation: FeeCalculationResult): string {
  const parts: string[] = [];
  
  parts.push(`Subtotal: ${formatCurrency(calculation.subtotal)}`);

  if (calculation.platformFee > 0) {
    parts.push(`Platform Fee (2%): ${formatCurrency(calculation.platformFee)}`);
  }

  if (calculation.tax > 0) {
    parts.push(`Tax: ${formatCurrency(calculation.tax)}`);
  }

  if (calculation.shippingCost > 0) {
    parts.push(`Shipping: ${formatCurrency(calculation.shippingCost)}`);
  }

  parts.push(`Total: ${formatCurrency(calculation.totalAmount)}`);
  
  return parts.join(' | ');
}

