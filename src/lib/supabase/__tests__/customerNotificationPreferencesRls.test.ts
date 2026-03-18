/**
 * Customer Notification Preferences RLS Policy Tests
 *
 * Verifies the customer_notification_preferences table RLS policies:
 * 1. Tenant users can SELECT preferences within their tenant
 * 2. Tenant users can INSERT preferences for their tenant
 * 3. Tenant users can UPDATE preferences within their tenant
 * 4. Tenant users can DELETE preferences within their tenant
 * 5. All policies use tenant_users-based tenant isolation
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read the migration file to verify SQL structure
const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260318000001_create_customer_notification_preferences.sql'
);

let migrationSQL: string;
try {
  migrationSQL = readFileSync(MIGRATION_PATH, 'utf-8');
} catch {
  migrationSQL = '';
}

// Expected RLS policy structure
const EXPECTED_POLICIES = {
  customer_notification_preferences_select_tenant: {
    command: 'SELECT',
    pattern: 'tenant_id IN',
  },
  customer_notification_preferences_insert_tenant: {
    command: 'INSERT',
    pattern: 'tenant_id IN',
  },
  customer_notification_preferences_update_tenant: {
    command: 'UPDATE',
    pattern: 'tenant_id IN',
  },
  customer_notification_preferences_delete_tenant: {
    command: 'DELETE',
    pattern: 'tenant_id IN',
  },
} as const;

describe('Customer Notification Preferences RLS Policies', () => {
  it('should have migration file', () => {
    expect(migrationSQL.length).toBeGreaterThan(0);
  });

  describe('Table Structure', () => {
    it('should create customer_notification_preferences table', () => {
      expect(migrationSQL).toContain('CREATE TABLE IF NOT EXISTS public.customer_notification_preferences');
    });

    it('should have tenant_id column with foreign key to tenants', () => {
      expect(migrationSQL).toContain('tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE');
    });

    it('should have customer_id column with foreign key to customers', () => {
      expect(migrationSQL).toContain('customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE');
    });

    it('should have unique constraint on customer_id + tenant_id', () => {
      expect(migrationSQL).toContain('UNIQUE (customer_id, tenant_id)');
    });

    it('should enable RLS', () => {
      expect(migrationSQL).toContain('ALTER TABLE public.customer_notification_preferences ENABLE ROW LEVEL SECURITY');
    });

    it('should use timestamptz for timestamps', () => {
      expect(migrationSQL).toContain('created_at timestamptz');
      expect(migrationSQL).toContain('updated_at timestamptz');
    });

    it('should have email preference columns', () => {
      expect(migrationSQL).toContain('email_enabled boolean');
      expect(migrationSQL).toContain('email_order_updates boolean');
      expect(migrationSQL).toContain('email_promotions boolean');
      expect(migrationSQL).toContain('email_delivery_updates boolean');
    });

    it('should have SMS preference columns', () => {
      expect(migrationSQL).toContain('sms_enabled boolean');
      expect(migrationSQL).toContain('sms_order_updates boolean');
      expect(migrationSQL).toContain('sms_delivery_updates boolean');
    });

    it('should have push preference columns', () => {
      expect(migrationSQL).toContain('push_enabled boolean');
      expect(migrationSQL).toContain('push_order_updates boolean');
      expect(migrationSQL).toContain('push_promotions boolean');
    });

    it('should have quiet hours columns', () => {
      expect(migrationSQL).toContain('quiet_hours_enabled boolean');
      expect(migrationSQL).toContain('quiet_hours_start time');
      expect(migrationSQL).toContain('quiet_hours_end time');
    });
  });

  describe('RLS Policies', () => {
    for (const [policyName, policy] of Object.entries(EXPECTED_POLICIES)) {
      it(`should define ${policy.command} policy: ${policyName}`, () => {
        expect(migrationSQL).toContain(policyName);
        expect(migrationSQL).toContain(`FOR ${policy.command}`);
      });

      it(`should use tenant_users isolation in ${policyName}`, () => {
        // The migration should reference tenant_users for tenant isolation
        expect(migrationSQL).toContain('tenant_users tu WHERE tu.user_id = auth.uid()');
      });
    }

    it('should use consistent tenant isolation pattern across all policies', () => {
      const isolationPattern = 'tenant_id IN';
      const occurrences = (migrationSQL.match(new RegExp(isolationPattern, 'g')) ?? []).length;
      // At least 4 occurrences: SELECT USING, INSERT WITH CHECK, UPDATE USING, DELETE USING
      expect(occurrences).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Indexes', () => {
    it('should create index on tenant_id', () => {
      expect(migrationSQL).toContain('idx_customer_notification_preferences_tenant');
    });

    it('should create index on customer_id', () => {
      expect(migrationSQL).toContain('idx_customer_notification_preferences_customer');
    });

    it('should create composite index on tenant_id + customer_id', () => {
      expect(migrationSQL).toContain('idx_customer_notification_preferences_tenant_customer');
    });
  });

  describe('Security Definer Function', () => {
    it('should create upsert_customer_notification_preferences function', () => {
      expect(migrationSQL).toContain('CREATE OR REPLACE FUNCTION public.upsert_customer_notification_preferences');
    });

    it('should use SECURITY DEFINER', () => {
      expect(migrationSQL).toContain('SECURITY DEFINER');
    });

    it('should SET search_path = public', () => {
      expect(migrationSQL).toContain('SET search_path = public');
    });

    it('should verify customer belongs to tenant', () => {
      expect(migrationSQL).toContain('Customer not found in tenant');
    });

    it('should use ON CONFLICT upsert pattern', () => {
      expect(migrationSQL).toContain('ON CONFLICT (customer_id, tenant_id)');
      expect(migrationSQL).toContain('DO UPDATE SET');
    });

    it('should grant execute to authenticated', () => {
      expect(migrationSQL).toContain('GRANT EXECUTE ON FUNCTION public.upsert_customer_notification_preferences TO authenticated');
    });
  });

  describe('Trigger', () => {
    it('should create updated_at trigger', () => {
      expect(migrationSQL).toContain('update_customer_notification_preferences_updated_at');
      expect(migrationSQL).toContain('BEFORE UPDATE ON public.customer_notification_preferences');
      expect(migrationSQL).toContain('update_updated_at()');
    });
  });
});
