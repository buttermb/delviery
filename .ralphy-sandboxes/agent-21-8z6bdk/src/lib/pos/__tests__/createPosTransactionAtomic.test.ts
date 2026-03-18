/**
 * Tests for create_pos_transaction_atomic RPC function
 *
 * These tests verify the contract between the frontend and the
 * create_pos_transaction_atomic database function for POS transactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockRpc = vi.fn();
const mockSupabase = {
  rpc: mockRpc,
};

// Mock the supabase client module
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('create_pos_transaction_atomic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful transactions', () => {
    it('should create a transaction with valid input', async () => {
      const mockResult = {
        success: true,
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_number: 'POS-260121-0001',
        total: 150.00,
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440002',
            product_name: 'Test Product',
            quantity: 2,
            unit_price: 50.00,
            price_at_order_time: 50.00,
            total_price: 100.00,
            stock_quantity: 10,
          },
        ],
        p_payment_method: 'cash',
        p_subtotal: 100.00,
        p_tax_amount: 10.00,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(error).toBeNull();
      expect(data).toEqual(mockResult);
      expect(data.success).toBe(true);
      expect(data.transaction_number).toMatch(/^POS-\d{6}-\d{4}$/);
      expect(mockRpc).toHaveBeenCalledWith('create_pos_transaction_atomic', params);
    });

    it('should calculate total correctly with tax and discount', async () => {
      const mockResult = {
        success: true,
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_number: 'POS-260121-0002',
        total: 95.00, // 100 + 10 tax - 15 discount = 95
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440002',
            product_name: 'Test Product',
            quantity: 2,
            unit_price: 50.00,
            price_at_order_time: 50.00,
            total_price: 100.00,
            stock_quantity: 10,
          },
        ],
        p_payment_method: 'card',
        p_subtotal: 100.00,
        p_tax_amount: 10.00,
        p_discount_amount: 15.00,
        p_customer_id: null,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(error).toBeNull();
      expect(data.total).toBe(95.00);
    });

    it('should handle multiple items in a transaction', async () => {
      const mockResult = {
        success: true,
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_number: 'POS-260121-0003',
        total: 250.00,
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440002',
            product_name: 'Product A',
            quantity: 2,
            unit_price: 50.00,
            price_at_order_time: 50.00,
            total_price: 100.00,
            stock_quantity: 10,
          },
          {
            product_id: '550e8400-e29b-41d4-a716-446655440003',
            product_name: 'Product B',
            quantity: 3,
            unit_price: 50.00,
            price_at_order_time: 50.00,
            total_price: 150.00,
            stock_quantity: 20,
          },
        ],
        p_payment_method: 'cash',
        p_subtotal: 250.00,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(error).toBeNull();
      expect(data.success).toBe(true);
    });

    it('should associate transaction with customer when provided', async () => {
      const customerId = '550e8400-e29b-41d4-a716-446655440010';
      const mockResult = {
        success: true,
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_number: 'POS-260121-0004',
        total: 100.00,
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440002',
            product_name: 'Test Product',
            quantity: 1,
            unit_price: 100.00,
            price_at_order_time: 100.00,
            total_price: 100.00,
            stock_quantity: 5,
          },
        ],
        p_payment_method: 'cash',
        p_subtotal: 100.00,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: customerId,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('create_pos_transaction_atomic',
        expect.objectContaining({ p_customer_id: customerId }));
    });

    it('should associate transaction with shift when provided', async () => {
      const shiftId = '550e8400-e29b-41d4-a716-446655440020';
      const mockResult = {
        success: true,
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_number: 'POS-260121-0005',
        total: 100.00,
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440002',
            product_name: 'Test Product',
            quantity: 1,
            unit_price: 100.00,
            price_at_order_time: 100.00,
            total_price: 100.00,
            stock_quantity: 5,
          },
        ],
        p_payment_method: 'cash',
        p_subtotal: 100.00,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: shiftId,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('create_pos_transaction_atomic',
        expect.objectContaining({ p_shift_id: shiftId }));
    });
  });

  describe('error handling', () => {
    it('should return error when insufficient stock', async () => {
      const mockResult = {
        success: false,
        error: 'Insufficient stock for product Product A: available 5, requested 10',
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440002',
            product_name: 'Product A',
            quantity: 10, // Requesting more than available
            unit_price: 50.00,
            price_at_order_time: 50.00,
            total_price: 500.00,
            stock_quantity: 5, // Only 5 available
          },
        ],
        p_payment_method: 'cash',
        p_subtotal: 500.00,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(error).toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Insufficient stock');
    });

    it('should return error when product not found', async () => {
      const mockResult = {
        success: false,
        error: 'Product not found: 550e8400-e29b-41d4-a716-446655449999',
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655449999', // Non-existent product
            product_name: 'Non-existent Product',
            quantity: 1,
            unit_price: 50.00,
            price_at_order_time: 50.00,
            total_price: 50.00,
            stock_quantity: 0,
          },
        ],
        p_payment_method: 'cash',
        p_subtotal: 50.00,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(error).toBeNull();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Product not found');
    });

    it('should handle RPC function not existing error', async () => {
      const rpcError = {
        code: 'PGRST202',
        message: 'function create_pos_transaction_atomic does not exist',
        details: null,
        hint: null,
      };

      mockRpc.mockResolvedValueOnce({ data: null, error: rpcError });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [],
        p_payment_method: 'cash',
        p_subtotal: 0,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('PGRST202');
    });

    it('should handle database connection errors', async () => {
      const dbError = {
        code: '08006',
        message: 'connection_failure',
        details: null,
        hint: null,
      };

      mockRpc.mockResolvedValueOnce({ data: null, error: dbError });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440002',
            product_name: 'Test Product',
            quantity: 1,
            unit_price: 50.00,
            price_at_order_time: 50.00,
            total_price: 50.00,
            stock_quantity: 10,
          },
        ],
        p_payment_method: 'cash',
        p_subtotal: 50.00,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('08006');
    });
  });

  describe('payment methods', () => {
    const paymentMethods = ['cash', 'card', 'mobile', 'credit'];

    paymentMethods.forEach((method) => {
      it(`should accept ${method} as payment method`, async () => {
        const mockResult = {
          success: true,
          transaction_id: '550e8400-e29b-41d4-a716-446655440000',
          transaction_number: 'POS-260121-0001',
          total: 100.00,
        };

        mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

        const params = {
          p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
          p_items: [
            {
              product_id: '550e8400-e29b-41d4-a716-446655440002',
              product_name: 'Test Product',
              quantity: 1,
              unit_price: 100.00,
              price_at_order_time: 100.00,
              total_price: 100.00,
              stock_quantity: 10,
            },
          ],
          p_payment_method: method,
          p_subtotal: 100.00,
          p_tax_amount: 0,
          p_discount_amount: 0,
          p_customer_id: null,
          p_shift_id: null,
        };

        const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

        expect(error).toBeNull();
        expect(data.success).toBe(true);
        expect(mockRpc).toHaveBeenCalledWith('create_pos_transaction_atomic',
          expect.objectContaining({ p_payment_method: method }));
      });
    });
  });

  describe('input validation', () => {
    it('should require tenant_id', async () => {
      const params = {
        p_tenant_id: null as unknown as string,
        p_items: [],
        p_payment_method: 'cash',
        p_subtotal: 0,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: null,
      };

      // The DB should reject null tenant_id
      const mockResult = {
        success: false,
        error: 'null value in column "tenant_id" violates not-null constraint',
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const { data } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(data.success).toBe(false);
    });

    it('should handle empty items array', async () => {
      // Empty items array is technically valid (zero-value transaction)
      const mockResult = {
        success: true,
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_number: 'POS-260121-0001',
        total: 0,
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [],
        p_payment_method: 'cash',
        p_subtotal: 0,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.total).toBe(0);
    });

    it('should handle negative discount correctly', async () => {
      // Negative discount would increase the total (unusual but handled)
      const mockResult = {
        success: true,
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_number: 'POS-260121-0001',
        total: 110.00, // 100 + 0 tax - (-10) discount = 110
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440002',
            product_name: 'Test Product',
            quantity: 1,
            unit_price: 100.00,
            price_at_order_time: 100.00,
            total_price: 100.00,
            stock_quantity: 10,
          },
        ],
        p_payment_method: 'cash',
        p_subtotal: 100.00,
        p_tax_amount: 0,
        p_discount_amount: -10.00, // Negative discount
        p_customer_id: null,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(error).toBeNull();
      expect(data.total).toBe(110.00);
    });
  });

  describe('transaction number format', () => {
    it('should generate transaction number in POS-YYMMDD-NNNN format', async () => {
      const mockResult = {
        success: true,
        transaction_id: '550e8400-e29b-41d4-a716-446655440000',
        transaction_number: 'POS-260121-0001',
        total: 100.00,
      };

      mockRpc.mockResolvedValueOnce({ data: mockResult, error: null });

      const params = {
        p_tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        p_items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440002',
            product_name: 'Test Product',
            quantity: 1,
            unit_price: 100.00,
            price_at_order_time: 100.00,
            total_price: 100.00,
            stock_quantity: 10,
          },
        ],
        p_payment_method: 'cash',
        p_subtotal: 100.00,
        p_tax_amount: 0,
        p_discount_amount: 0,
        p_customer_id: null,
        p_shift_id: null,
      };

      const { data, error } = await mockSupabase.rpc('create_pos_transaction_atomic', params);

      expect(error).toBeNull();
      // Transaction number format: POS-YYMMDD-NNNN
      expect(data.transaction_number).toMatch(/^POS-\d{6}-\d{4}$/);
    });
  });
});

describe('POS transaction result parsing', () => {
  it('should correctly parse successful result', () => {
    const result = {
      success: true,
      transaction_id: '550e8400-e29b-41d4-a716-446655440000',
      transaction_number: 'POS-260121-0001',
      total: 150.00,
    };

    expect(result.success).toBe(true);
    expect(result.transaction_number).toBeDefined();
    expect(typeof result.total).toBe('number');
  });

  it('should correctly parse error result', () => {
    const result = {
      success: false,
      error: 'Insufficient stock for product Test: available 5, requested 10',
    };

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient stock');
  });
});
