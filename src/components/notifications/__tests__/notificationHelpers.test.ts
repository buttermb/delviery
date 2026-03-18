import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the module
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        error: null,
      })),
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  notifyOrderStatusChange,
  notifyLowStock,
  notifyDeliveryAlert,
  notifyPaymentReceived,
  notifyDriverStatusChange,
  notifyMenuExpiring,
  notifyNewCustomer,
  notifyInvoiceOverdue,
  notifyMention,
} from '../notificationHelpers';
import { supabase } from '@/integrations/supabase/client';

describe('notificationHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  describe('action URL format', () => {
    it('notifyOrderStatusChange uses relative admin path', async () => {
      await notifyOrderStatusChange('t1', 'u1', 'order-123', '#1001', 'confirmed');

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.action_url).toBe('admin/orders/order-123');
      expect(insertedData.action_url).not.toMatch(/^\//);
    });

    it('notifyLowStock uses relative admin path', async () => {
      await notifyLowStock('t1', ['u1'], 'prod-1', 'OG Kush', 5, 10);

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.action_url).toBe('admin/products/prod-1');
    });

    it('notifyDeliveryAlert uses relative admin path', async () => {
      await notifyDeliveryAlert('t1', 'u1', 'del-1', '#D100', 'late', 'Running late');

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.action_url).toBe('admin/deliveries/del-1');
    });

    it('notifyPaymentReceived uses relative admin path', async () => {
      await notifyPaymentReceived('t1', 'u1', 'order-1', '#1001', 99.99, 'cash');

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.action_url).toBe('admin/orders/order-1');
    });

    it('notifyDriverStatusChange uses relative admin path', async () => {
      await notifyDriverStatusChange('t1', 'u1', 'driver-1', 'John', 'online');

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.action_url).toBe('admin/drivers/driver-1');
    });

    it('notifyMenuExpiring uses relative admin path', async () => {
      await notifyMenuExpiring('t1', ['u1'], 'menu-1', 'Daily Special', 'tomorrow');

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.action_url).toBe('admin/menus/menu-1');
    });

    it('notifyNewCustomer uses relative admin path', async () => {
      await notifyNewCustomer('t1', ['u1'], 'cust-1', 'Jane Doe', 'jane@example.com');

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.action_url).toBe('admin/customers/cust-1');
    });

    it('notifyInvoiceOverdue uses relative admin path', async () => {
      await notifyInvoiceOverdue('t1', 'u1', 'inv-1', '#INV-001', '2024-01-01', 500);

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.action_url).toBe('admin/invoices/inv-1');
    });

    it('notifyMention passes actionUrl as-is', async () => {
      await notifyMention('t1', 'u1', 'mentioner-1', 'Bob', 'mentioned you in a note', 'admin/orders/123');

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.action_url).toBe('admin/orders/123');
    });
  });

  describe('notification content', () => {
    it('notifyOrderStatusChange includes correct metadata', async () => {
      await notifyOrderStatusChange('t1', 'u1', 'order-1', '#1001', 'confirmed');

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.type).toBe('order_status');
      expect(insertedData.tenant_id).toBe('t1');
      expect(insertedData.user_id).toBe('u1');
      expect(insertedData.metadata).toEqual({
        orderId: 'order-1',
        orderNumber: '#1001',
        status: 'confirmed',
      });
    });

    it('notifyLowStock sends to multiple users', async () => {
      await notifyLowStock('t1', ['u1', 'u2', 'u3'], 'prod-1', 'OG Kush', 5, 10);

      expect(supabase.from).toHaveBeenCalledTimes(3);
    });

    it('notifyPaymentReceived formats amount with 2 decimals', async () => {
      await notifyPaymentReceived('t1', 'u1', 'order-1', '#1001', 99.9, 'card');

      const insertCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results[0].value.insert;
      const insertedData = insertCall.mock.calls[0][0];

      expect(insertedData.message).toContain('$99.90');
    });
  });
});
