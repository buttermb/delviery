/**
 * useCustomerNotificationPreferences Hook Tests
 *
 * Tests for the customer notification preferences hook:
 * 1. Default preferences values
 * 2. Fetch function behavior
 * 3. Upsert function behavior
 * 4. Query key structure
 * 5. Type correctness
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchCustomerNotificationPreferences,
  upsertCustomerNotificationPreferences,
} from '@/hooks/useCustomerNotificationPreferences';
import { queryKeys } from '@/lib/queryKeys';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ eq: mockEq, maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useCustomerNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DEFAULT_NOTIFICATION_PREFERENCES', () => {
    it('should have email enabled by default', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.email_enabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.email_order_updates).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.email_promotions).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.email_delivery_updates).toBe(true);
    });

    it('should have SMS disabled by default', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.sms_enabled).toBe(false);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.sms_order_updates).toBe(false);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.sms_delivery_updates).toBe(false);
    });

    it('should have push partially enabled by default', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.push_enabled).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.push_order_updates).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.push_promotions).toBe(false);
    });

    it('should have quiet hours disabled by default', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_enabled).toBe(false);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_start).toBe('22:00');
      expect(DEFAULT_NOTIFICATION_PREFERENCES.quiet_hours_end).toBe('08:00');
    });

    it('should not include id, tenant_id, customer_id, or timestamps', () => {
      const keys = Object.keys(DEFAULT_NOTIFICATION_PREFERENCES);
      expect(keys).not.toContain('id');
      expect(keys).not.toContain('tenant_id');
      expect(keys).not.toContain('customer_id');
      expect(keys).not.toContain('created_at');
      expect(keys).not.toContain('updated_at');
    });
  });

  describe('fetchCustomerNotificationPreferences', () => {
    const tenantId = 'tenant-123';
    const customerId = 'customer-456';

    it('should query customer_notification_preferences table with tenant and customer filters', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      await fetchCustomerNotificationPreferences(tenantId, customerId);

      expect(mockFrom).toHaveBeenCalledWith('customer_notification_preferences');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockEq).toHaveBeenCalledWith('customer_id', customerId);
      expect(mockMaybeSingle).toHaveBeenCalled();
    });

    it('should return null when no preferences exist', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await fetchCustomerNotificationPreferences(tenantId, customerId);
      expect(result).toBeNull();
    });

    it('should return preferences when they exist', async () => {
      const mockPrefs = {
        id: 'pref-1',
        tenant_id: tenantId,
        customer_id: customerId,
        email_enabled: true,
        email_order_updates: true,
        email_promotions: false,
        email_delivery_updates: true,
        sms_enabled: true,
        sms_order_updates: true,
        sms_delivery_updates: false,
        push_enabled: true,
        push_order_updates: true,
        push_promotions: false,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      mockMaybeSingle.mockResolvedValue({ data: mockPrefs, error: null });

      const result = await fetchCustomerNotificationPreferences(tenantId, customerId);
      expect(result).toEqual(mockPrefs);
    });

    it('should throw on error', async () => {
      const dbError = { message: 'Connection refused', code: 'PGRST' };
      mockMaybeSingle.mockResolvedValue({ data: null, error: dbError });

      await expect(
        fetchCustomerNotificationPreferences(tenantId, customerId)
      ).rejects.toEqual(dbError);
    });
  });

  describe('upsertCustomerNotificationPreferences', () => {
    const tenantId = 'tenant-123';
    const customerId = 'customer-456';

    it('should call the upsert RPC with correct parameters', async () => {
      const mockResult = { id: 'pref-1', email_enabled: false };
      mockRpc.mockResolvedValue({ data: mockResult, error: null });

      await upsertCustomerNotificationPreferences(tenantId, customerId, {
        email_enabled: false,
        sms_enabled: true,
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'upsert_customer_notification_preferences',
        expect.objectContaining({
          p_tenant_id: tenantId,
          p_customer_id: customerId,
          p_email_enabled: false,
          p_sms_enabled: true,
        })
      );
    });

    it('should pass null for omitted fields', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null });

      await upsertCustomerNotificationPreferences(tenantId, customerId, {
        email_enabled: true,
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'upsert_customer_notification_preferences',
        expect.objectContaining({
          p_tenant_id: tenantId,
          p_customer_id: customerId,
          p_email_enabled: true,
          p_sms_enabled: null,
          p_sms_order_updates: null,
          p_push_enabled: null,
          p_quiet_hours_enabled: null,
        })
      );
    });

    it('should throw on error', async () => {
      const dbError = { message: 'Customer not found in tenant', code: 'P0001' };
      mockRpc.mockResolvedValue({ data: null, error: dbError });

      await expect(
        upsertCustomerNotificationPreferences(tenantId, customerId, { email_enabled: false })
      ).rejects.toEqual(dbError);
    });
  });

  describe('Query Keys', () => {
    it('should have correct base key', () => {
      expect(queryKeys.customerNotificationPreferences.all).toEqual([
        'customer-notification-preferences',
      ]);
    });

    it('should generate correct byCustomer key', () => {
      const key = queryKeys.customerNotificationPreferences.byCustomer('t1', 'c1');
      expect(key).toEqual(['customer-notification-preferences', 't1', 'c1']);
    });

    it('should generate correct byTenant key', () => {
      const key = queryKeys.customerNotificationPreferences.byTenant('t1');
      expect(key).toEqual(['customer-notification-preferences', 'tenant', 't1']);
    });

    it('should handle undefined parameters', () => {
      const key = queryKeys.customerNotificationPreferences.byCustomer(undefined, undefined);
      expect(key).toEqual(['customer-notification-preferences', undefined, undefined]);
    });
  });
});
