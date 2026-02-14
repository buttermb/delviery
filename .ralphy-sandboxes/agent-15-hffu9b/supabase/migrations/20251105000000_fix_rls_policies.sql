-- ============================================================================
-- CRITICAL SECURITY FIX: Add RLS Policies for All Tables
-- ============================================================================
-- This migration adds RLS policies to all tables that have RLS enabled
-- but were missing policies (complete data exposure risk)
-- ============================================================================

-- ============================================================================
-- Activity Logs
-- ============================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
    -- Enable RLS if not already
    ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view own activity" ON activity_logs;
    DROP POLICY IF EXISTS "Admins can view all activity" ON activity_logs;
    
    -- Create policies
    CREATE POLICY "Users can view own activity"
      ON activity_logs FOR SELECT
      USING (auth.uid()::text = user_id::text);
    
    CREATE POLICY "Admins can view all activity"
      ON activity_logs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
    
    -- System can insert
    CREATE POLICY "System can insert activity logs"
      ON activity_logs FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- Appointments
-- ============================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
    ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own appointments" ON appointments;
    DROP POLICY IF EXISTS "Users can manage own appointments" ON appointments;
    DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;
    
    CREATE POLICY "Users can view own appointments"
      ON appointments FOR SELECT
      USING (auth.uid()::text = user_id::text OR auth.uid()::text = customer_id::text);
    
    CREATE POLICY "Users can manage own appointments"
      ON appointments FOR ALL
      USING (auth.uid()::text = user_id::text);
    
    CREATE POLICY "Admins can view all appointments"
      ON appointments FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- Customer Balances
-- ============================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_balances') THEN
    ALTER TABLE customer_balances ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own balance" ON customer_balances;
    DROP POLICY IF EXISTS "Admins can view all balances" ON customer_balances;
    DROP POLICY IF EXISTS "System can update balances" ON customer_balances;
    
    CREATE POLICY "Users can view own balance"
      ON customer_balances FOR SELECT
      USING (auth.uid()::text = customer_id::text);
    
    CREATE POLICY "Admins can view all balances"
      ON customer_balances FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
    
    CREATE POLICY "System can update balances"
      ON customer_balances FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- Medical Patient Info
-- ============================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medical_patient_info') THEN
    ALTER TABLE medical_patient_info ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can view own medical info" ON medical_patient_info;
    DROP POLICY IF EXISTS "Users can manage own medical info" ON medical_patient_info;
    DROP POLICY IF EXISTS "Admins can view all medical info" ON medical_patient_info;
    
    CREATE POLICY "Users can view own medical info"
      ON medical_patient_info FOR SELECT
      USING (auth.uid()::text = patient_id::text);
    
    CREATE POLICY "Users can manage own medical info"
      ON medical_patient_info FOR ALL
      USING (auth.uid()::text = patient_id::text);
    
    CREATE POLICY "Admins can view all medical info"
      ON medical_patient_info FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- Platform Invoices
-- ============================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_invoices') THEN
    ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Tenants can view own invoices" ON platform_invoices;
    DROP POLICY IF EXISTS "Super admins can view all invoices" ON platform_invoices;
    
    CREATE POLICY "Tenants can view own invoices"
      ON platform_invoices FOR SELECT
      USING (
        tenant_id = (current_setting('app.current_tenant_id', true))::uuid
        OR tenant_id IN (
          SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
      );
    
    CREATE POLICY "Super admins can view all invoices"
      ON platform_invoices FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM super_admin_users
          WHERE id = auth.uid()::uuid AND status = 'active'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- Generic RLS Policy Template for Other Tables
-- ============================================================================
-- This will create basic RLS policies for any remaining tables with RLS enabled
-- but no policies. Uses a generic pattern based on common column names.
DO $$ 
DECLARE
    table_record RECORD;
    policy_exists BOOLEAN;
    has_user_id BOOLEAN;
    has_tenant_id BOOLEAN;
    has_account_id BOOLEAN;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE '_%'
        AND EXISTS (
            SELECT 1 
            FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = pg_tables.tablename
            GROUP BY tablename
            HAVING COUNT(*) = 0
        )
        AND EXISTS (
            SELECT 1 
            FROM pg_tables t
            JOIN pg_class c ON c.relname = t.tablename
            WHERE c.relrowsecurity = true
            AND t.tablename = pg_tables.tablename
        )
    LOOP
        -- Check which columns exist
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = table_record.tablename
            AND column_name = 'user_id'
        ) INTO has_user_id;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = table_record.tablename
            AND column_name = 'tenant_id'
        ) INTO has_tenant_id;
        
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = table_record.tablename
            AND column_name = 'account_id'
        ) INTO has_account_id;
        
        -- Create policy based on available columns
        IF has_tenant_id THEN
            EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON %I', 
                table_record.tablename, table_record.tablename);
            EXECUTE format(
                'CREATE POLICY tenant_isolation_%I ON %I FOR ALL ' ||
                'USING (tenant_id = (current_setting(''app.current_tenant_id'', true))::uuid)',
                table_record.tablename, table_record.tablename
            );
        ELSIF has_user_id THEN
            EXECUTE format('DROP POLICY IF EXISTS user_isolation_%I ON %I', 
                table_record.tablename, table_record.tablename);
            EXECUTE format(
                'CREATE POLICY user_isolation_%I ON %I FOR SELECT ' ||
                'USING (auth.uid()::text = user_id::text)',
                table_record.tablename, table_record.tablename
            );
            EXECUTE format(
                'CREATE POLICY admin_access_%I ON %I FOR SELECT ' ||
                'USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ''admin''))',
                table_record.tablename, table_record.tablename
            );
        ELSIF has_account_id THEN
            EXECUTE format('DROP POLICY IF EXISTS account_isolation_%I ON %I', 
                table_record.tablename, table_record.tablename);
            EXECUTE format(
                'CREATE POLICY account_isolation_%I ON %I FOR SELECT ' ||
                'USING (account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid()))',
                table_record.tablename, table_record.tablename
            );
        ELSE
            -- Generic admin-only policy for tables without user/tenant/account columns
            EXECUTE format('DROP POLICY IF EXISTS admin_only_%I ON %I', 
                table_record.tablename, table_record.tablename);
            EXECUTE format(
                'CREATE POLICY admin_only_%I ON %I FOR ALL ' ||
                'USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ''admin''))',
                table_record.tablename, table_record.tablename
            );
        END IF;
        
        RAISE NOTICE 'Created RLS policy for table: %', table_record.tablename;
    END LOOP;
END $$;

-- ============================================================================
-- Add Super Admin Audit Logging
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'super_admin_actions') THEN
    CREATE TABLE IF NOT EXISTS super_admin_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      super_admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
      action_type TEXT NOT NULL,
      resource_type TEXT,
      resource_id UUID,
      details JSONB,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX idx_super_admin_actions_admin ON super_admin_actions(super_admin_id);
    CREATE INDEX idx_super_admin_actions_type ON super_admin_actions(action_type);
    CREATE INDEX idx_super_admin_actions_created ON super_admin_actions(created_at DESC);
    
    ALTER TABLE super_admin_actions ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Super admins can view all actions"
      ON super_admin_actions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM super_admin_users
          WHERE id = auth.uid()::uuid AND status = 'active'
        )
      );
    
    CREATE POLICY "System can insert super admin actions"
      ON super_admin_actions FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

