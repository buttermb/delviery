-- ============================================
-- AUDIT TRIGGERS FOR CRITICAL OPERATIONS
-- Automatically logs all changes to critical tables
-- ============================================

-- Function to log audit trail for critical operations
CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id_val UUID;
  actor_type_val TEXT;
  action_val TEXT;
  changes_val JSONB;
BEGIN
  -- Determine actor from auth context
  actor_id_val := auth.uid();
  
  -- Determine actor type
  IF actor_id_val IS NULL THEN
    actor_type_val := 'system';
  ELSE
    -- Check if super admin
    IF EXISTS (SELECT 1 FROM super_admin_users WHERE id = actor_id_val) THEN
      actor_type_val := 'super_admin';
    -- Check if tenant admin
    ELSIF EXISTS (SELECT 1 FROM tenant_users WHERE user_id = actor_id_val) THEN
      actor_type_val := 'tenant_admin';
    ELSE
      actor_type_val := 'system';
    END IF;
  END IF;
  
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_val := 'create';
    changes_val := jsonb_build_object('new', row_to_json(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    action_val := 'update';
    changes_val := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW),
      'changed_fields', (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(row_to_json(NEW)::jsonb)
        WHERE value IS DISTINCT FROM (row_to_json(OLD)::jsonb -> key)
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    action_val := 'delete';
    changes_val := jsonb_build_object('old', row_to_json(OLD));
  END IF;
  
  -- Get tenant_id and resource_id from the record
  DECLARE
    tenant_id_val UUID;
    resource_id_val UUID;
    record_json JSONB;
  BEGIN
    -- Convert record to JSONB for easier extraction
    IF NEW IS NOT NULL THEN
      record_json := to_jsonb(NEW);
      resource_id_val := (record_json->>'id')::uuid;
      
      -- Extract tenant_id based on table
      IF TG_TABLE_NAME = 'products' THEN
        tenant_id_val := (record_json->>'tenant_id')::uuid;
      ELSIF TG_TABLE_NAME = 'orders' THEN
        tenant_id_val := (record_json->>'tenant_id')::uuid;
      ELSIF TG_TABLE_NAME = 'wholesale_orders' THEN
        tenant_id_val := (record_json->>'tenant_id')::uuid;
      ELSIF TG_TABLE_NAME = 'tenants' THEN
        tenant_id_val := (record_json->>'id')::uuid;
      ELSIF TG_TABLE_NAME = 'tenant_users' THEN
        tenant_id_val := (record_json->>'tenant_id')::uuid;
      END IF;
    ELSIF OLD IS NOT NULL THEN
      -- For DELETE operations, use OLD
      record_json := to_jsonb(OLD);
      resource_id_val := (record_json->>'id')::uuid;
      
      IF TG_TABLE_NAME = 'products' THEN
        tenant_id_val := (record_json->>'tenant_id')::uuid;
      ELSIF TG_TABLE_NAME = 'orders' THEN
        tenant_id_val := (record_json->>'tenant_id')::uuid;
      ELSIF TG_TABLE_NAME = 'wholesale_orders' THEN
        tenant_id_val := (record_json->>'tenant_id')::uuid;
      ELSIF TG_TABLE_NAME = 'tenants' THEN
        tenant_id_val := (record_json->>'id')::uuid;
      ELSIF TG_TABLE_NAME = 'tenant_users' THEN
        tenant_id_val := (record_json->>'tenant_id')::uuid;
      END IF;
    END IF;
    
    -- Insert into audit_trail if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_trail') THEN
      INSERT INTO public.audit_trail (
        actor_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        tenant_id,
        changes,
        created_at
      )
      VALUES (
        actor_id_val,
        actor_type_val,
        action_val,
        TG_TABLE_NAME,
        resource_id_val::uuid,
        tenant_id_val::uuid,
        changes_val,
        NOW()
      );
    END IF;
    
    -- Also insert into activity_logs if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
      INSERT INTO public.activity_logs (
        user_id,
        tenant_id,
        action,
        resource,
        resource_id,
        metadata,
        created_at
      )
      VALUES (
        actor_id_val,
        tenant_id_val::uuid,
        action_val || '_' || TG_TABLE_NAME,
        TG_TABLE_NAME,
        resource_id_val::uuid,
        changes_val,
        NOW()
      );
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Silently fail if tables don't exist or other errors
      NULL;
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for critical tables (only if tables exist)
DO $$
BEGIN
  -- Products table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    DROP TRIGGER IF EXISTS trigger_audit_products ON public.products;
    CREATE TRIGGER trigger_audit_products
      AFTER INSERT OR UPDATE OR DELETE ON public.products
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
  
  -- Orders table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    DROP TRIGGER IF EXISTS trigger_audit_orders ON public.orders;
    CREATE TRIGGER trigger_audit_orders
      AFTER INSERT OR UPDATE OR DELETE ON public.orders
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
  
  -- Wholesale orders table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wholesale_orders') THEN
    DROP TRIGGER IF EXISTS trigger_audit_wholesale_orders ON public.wholesale_orders;
    CREATE TRIGGER trigger_audit_wholesale_orders
      AFTER INSERT OR UPDATE OR DELETE ON public.wholesale_orders
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
  
  -- Tenants table (only for UPDATE and DELETE, not INSERT to avoid logging signups)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
    DROP TRIGGER IF EXISTS trigger_audit_tenants ON public.tenants;
    CREATE TRIGGER trigger_audit_tenants
      AFTER UPDATE OR DELETE ON public.tenants
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
  
  -- Tenant users table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_users') THEN
    DROP TRIGGER IF EXISTS trigger_audit_tenant_users ON public.tenant_users;
    CREATE TRIGGER trigger_audit_tenant_users
      AFTER INSERT OR UPDATE OR DELETE ON public.tenant_users
      FOR EACH ROW
      EXECUTE FUNCTION public.log_audit_trail();
  END IF;
END $$;

-- Add comments
COMMENT ON FUNCTION public.log_audit_trail IS 'Automatically logs all changes to critical tables for audit purposes';

