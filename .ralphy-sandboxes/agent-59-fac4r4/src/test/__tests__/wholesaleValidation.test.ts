/**
 * Wholesale Validation Tests
 * Tests for credit limit, payment amount, and minimum order validation
 */

import { describe, it, expect } from 'vitest';

// Helper types mirroring the actual types in the application
interface WholesaleClient {
  id: string;
  credit_limit: number;
  outstanding_balance: number;
}

interface OrderProduct {
  id: string;
  name: string;
  qty: number;
  price: number;
}

interface CreditImpact {
  newBalance: number;
  available: number;
  overLimit: boolean;
  overLimitAmount: number;
}

// Validation logic extracted from NewWholesaleOrder.tsx
function calculateCreditImpact(
  client: WholesaleClient | null,
  orderTotal: number,
  paymentTerms: 'cash' | 'credit'
): CreditImpact | null {
  if (!client) return null;

  const currentBalance = client.outstanding_balance;
  const creditLimit = client.credit_limit;

  // If paying cash, no credit impact
  if (paymentTerms === 'cash') {
    return {
      newBalance: currentBalance,
      available: creditLimit - currentBalance,
      overLimit: false,
      overLimitAmount: 0,
    };
  }

  const newBalance = currentBalance + orderTotal;
  const available = creditLimit - newBalance;
  const overLimit = newBalance > creditLimit;
  const overLimitAmount = overLimit ? newBalance - creditLimit : 0;

  return { newBalance, available, overLimit, overLimitAmount };
}

// Minimum order quantity constant
const MINIMUM_ORDER_QUANTITY_LBS = 1;

// Validation logic for order products
function validateOrderProducts(products: OrderProduct[]): string[] {
  const errors: string[] = [];

  for (const product of products) {
    if (product.qty < MINIMUM_ORDER_QUANTITY_LBS) {
      errors.push(
        `"${product.name}" quantity (${product.qty} lbs) is below minimum order of ${MINIMUM_ORDER_QUANTITY_LBS} lb`
      );
    }
  }

  return errors;
}

// Payment validation logic from PaymentDialog.tsx
function validatePaymentAmount(
  amount: number,
  outstandingBalance: number
): { valid: boolean; error: string | null } {
  if (isNaN(amount)) {
    return { valid: false, error: null };
  }

  if (amount <= 0) {
    return { valid: false, error: "Payment amount must be greater than zero" };
  }

  if (amount > outstandingBalance) {
    return {
      valid: false,
      error: `Payment amount ($${amount.toLocaleString()}) cannot exceed outstanding balance ($${outstandingBalance.toLocaleString()})`,
    };
  }

  return { valid: true, error: null };
}

describe('Credit Limit Validation', () => {
  const mockClient: WholesaleClient = {
    id: 'client-1',
    credit_limit: 10000,
    outstanding_balance: 3000,
  };

  it('should return null for null client', () => {
    expect(calculateCreditImpact(null, 1000, 'credit')).toBeNull();
  });

  it('should not flag over limit for cash payment', () => {
    const impact = calculateCreditImpact(mockClient, 20000, 'cash');
    expect(impact?.overLimit).toBe(false);
    expect(impact?.newBalance).toBe(3000); // Balance unchanged
  });

  it('should calculate correct credit impact for credit payment within limit', () => {
    const impact = calculateCreditImpact(mockClient, 5000, 'credit');
    expect(impact?.newBalance).toBe(8000); // 3000 + 5000
    expect(impact?.available).toBe(2000); // 10000 - 8000
    expect(impact?.overLimit).toBe(false);
    expect(impact?.overLimitAmount).toBe(0);
  });

  it('should detect over credit limit', () => {
    const impact = calculateCreditImpact(mockClient, 8000, 'credit');
    expect(impact?.newBalance).toBe(11000); // 3000 + 8000
    expect(impact?.overLimit).toBe(true);
    expect(impact?.overLimitAmount).toBe(1000); // 11000 - 10000
  });

  it('should handle exact credit limit', () => {
    const impact = calculateCreditImpact(mockClient, 7000, 'credit');
    expect(impact?.newBalance).toBe(10000); // Exactly at limit
    expect(impact?.overLimit).toBe(false);
    expect(impact?.available).toBe(0);
  });

  it('should handle client with zero credit limit', () => {
    const zeroCreditClient = { ...mockClient, credit_limit: 0 };
    const impact = calculateCreditImpact(zeroCreditClient, 1000, 'credit');
    expect(impact?.overLimit).toBe(true);
    expect(impact?.overLimitAmount).toBe(4000); // 3000 + 1000 - 0
  });
});

describe('Minimum Order Quantity Validation', () => {
  it('should pass for products with valid quantities', () => {
    const products: OrderProduct[] = [
      { id: '1', name: 'Product A', qty: 5, price: 100 },
      { id: '2', name: 'Product B', qty: 1, price: 200 },
    ];
    const errors = validateOrderProducts(products);
    expect(errors).toHaveLength(0);
  });

  it('should fail for product with zero quantity', () => {
    const products: OrderProduct[] = [
      { id: '1', name: 'Product A', qty: 0, price: 100 },
    ];
    const errors = validateOrderProducts(products);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Product A');
    expect(errors[0]).toContain('below minimum');
  });

  it('should fail for product with quantity below minimum', () => {
    const products: OrderProduct[] = [
      { id: '1', name: 'Test Product', qty: 0.5, price: 100 },
    ];
    const errors = validateOrderProducts(products);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Test Product');
  });

  it('should return multiple errors for multiple invalid products', () => {
    const products: OrderProduct[] = [
      { id: '1', name: 'Product A', qty: 0, price: 100 },
      { id: '2', name: 'Product B', qty: 0.5, price: 200 },
      { id: '3', name: 'Product C', qty: 2, price: 150 }, // Valid
    ];
    const errors = validateOrderProducts(products);
    expect(errors).toHaveLength(2);
  });

  it('should pass for exactly minimum quantity', () => {
    const products: OrderProduct[] = [
      { id: '1', name: 'Product A', qty: MINIMUM_ORDER_QUANTITY_LBS, price: 100 },
    ];
    const errors = validateOrderProducts(products);
    expect(errors).toHaveLength(0);
  });
});

describe('Payment Amount Validation', () => {
  const outstandingBalance = 5000;

  it('should fail for NaN amount', () => {
    const result = validatePaymentAmount(NaN, outstandingBalance);
    expect(result.valid).toBe(false);
  });

  it('should fail for zero amount', () => {
    const result = validatePaymentAmount(0, outstandingBalance);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('greater than zero');
  });

  it('should fail for negative amount', () => {
    const result = validatePaymentAmount(-100, outstandingBalance);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('greater than zero');
  });

  it('should fail for amount exceeding outstanding balance', () => {
    const result = validatePaymentAmount(6000, outstandingBalance);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot exceed outstanding balance');
  });

  it('should pass for valid amount below balance', () => {
    const result = validatePaymentAmount(3000, outstandingBalance);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should pass for exact balance amount', () => {
    const result = validatePaymentAmount(5000, outstandingBalance);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should handle small decimal amounts', () => {
    const result = validatePaymentAmount(0.01, outstandingBalance);
    expect(result.valid).toBe(true);
  });

  it('should handle zero outstanding balance', () => {
    // Edge case: if balance is zero, any positive amount exceeds it
    const result = validatePaymentAmount(1, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot exceed');
  });
});
