-- ============================================================================
-- TENANT ROLES SYSTEM
-- ============================================================================
-- Creates tenant-specific custom roles table and updates role_permissions
-- to support both system roles and custom tenant roles.
-- This enables the Operations Hub > Roles tab to create and manage roles.
-- ============================================================================

-- ============================================================================
-- ROLES TABLE (Tenant-specific custom roles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE, -- System roles cannot be deleted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Role name must be unique within a tenant
  UNIQUE(tenant_id, name)
);

-- ============================================================================
-- TENANT_ROLE_PERMISSIONS TABLE
-- ============================================================================
-- Junction table for tenant-specific role permissions
-- This links custom roles to permissions within a tenant context
CREATE TABLE IF NOT EXISTS public.tenant_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL, -- e.g., 'products.read', 'orders.write'
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each permission can only be assigned once per role
  UNIQUE(role_id, permission_key)
);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_role_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR ROLES TABLE
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tenant users can view their tenant roles" ON public.roles;
DROP POLICY IF EXISTS "Tenant owners and admins can manage roles" ON public.roles;
DROP POLICY IF EXISTS "Tenant owners and admins can create roles" ON public.roles;
DROP POLICY IF EXISTS "Tenant owners and admins can update roles" ON public.roles;
DROP POLICY IF EXISTS "Tenant owners and admins can delete non-system roles" ON public.roles;

-- Read policy: Users can view roles in their tenant
CREATE POLICY "Tenant users can view their tenant roles"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.email = auth.jwt()->>'email'
    )
  );

-- Insert policy: Only owners and admins can create roles
CREATE POLICY "Tenant owners and admins can create roles"
  ON public.roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.email = auth.jwt()->>'email'
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Update policy: Only owners and admins can update roles
CREATE POLICY "Tenant owners and admins can update roles"
  ON public.roles
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.email = auth.jwt()->>'email'
        AND tu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.email = auth.jwt()->>'email'
        AND tu.role IN ('owner', 'admin')
    )
  );

-- Delete policy: Only owners and admins can delete non-system roles
CREATE POLICY "Tenant owners and admins can delete non-system roles"
  ON public.roles
  FOR DELETE
  TO authenticated
  USING (
    is_system = FALSE
    AND tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.email = auth.jwt()->>'email'
        AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- RLS POLICIES FOR TENANT_ROLE_PERMISSIONS TABLE
-- ============================================================================

DROP POLICY IF EXISTS "Tenant users can view their role permissions" ON public.tenant_role_permissions;
DROP POLICY IF EXISTS "Tenant owners and admins can manage role permissions" ON public.tenant_role_permissions;

-- Read policy: Users can view permissions for roles in their tenant
CREATE POLICY "Tenant users can view their role permissions"
  ON public.tenant_role_permissions
  FOR SELECT
  TO authenticated
  USING (
    role_id IN (
      SELECT r.id FROM public.roles r
      WHERE r.tenant_id IN (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.email = auth.jwt()->>'email'
      )
    )
  );

-- Insert policy: Owners and admins can add permissions to roles
CREATE POLICY "Tenant owners and admins can create role permissions"
  ON public.tenant_role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role_id IN (
      SELECT r.id FROM public.roles r
      WHERE r.tenant_id IN (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.email = auth.jwt()->>'email'
          AND tu.role IN ('owner', 'admin')
      )
    )
  );

-- Delete policy: Owners and admins can remove permissions from roles
CREATE POLICY "Tenant owners and admins can delete role permissions"
  ON public.tenant_role_permissions
  FOR DELETE
  TO authenticated
  USING (
    role_id IN (
      SELECT r.id FROM public.roles r
      WHERE r.tenant_id IN (
        SELECT tu.tenant_id FROM public.tenant_users tu
        WHERE tu.email = auth.jwt()->>'email'
          AND tu.role IN ('owner', 'admin')
      )
    )
  );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON public.roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_tenant_role_permissions_role_id ON public.tenant_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_tenant_role_permissions_permission_key ON public.tenant_role_permissions(permission_key);

-- ============================================================================
-- TRIGGER: Update updated_at on roles
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_roles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_roles_updated_at ON public.roles;
CREATE TRIGGER trigger_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_roles_updated_at();

-- ============================================================================
-- HELPER FUNCTION: Check if user has permission via custom role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tenant_has_role_permission(
  p_tenant_id UUID,
  p_role_id UUID,
  p_permission_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.tenant_role_permissions trp
    JOIN public.roles r ON trp.role_id = r.id
    WHERE r.id = p_role_id
      AND r.tenant_id = p_tenant_id
      AND trp.permission_key = p_permission_key
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.tenant_has_role_permission(UUID, UUID, TEXT) TO authenticated;

-- ============================================================================
-- SEED DEFAULT SYSTEM ROLES FOR EXISTING TENANTS (Optional)
-- ============================================================================
-- This creates default system roles for each tenant based on the existing
-- permission matrix defined in rolePermissions.ts

-- Note: We're NOT seeding default roles here as this should be done
-- per-tenant when they first access Role Management. The UI will handle
-- showing "no roles" state and allow creating from scratch.

