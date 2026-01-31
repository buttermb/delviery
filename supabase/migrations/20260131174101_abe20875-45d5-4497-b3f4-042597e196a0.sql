-- ============================================================================
-- Create roles and tenant_role_permissions tables
-- ============================================================================

-- Create the roles table for tenant-specific role definitions
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_role_per_tenant UNIQUE (tenant_id, name)
);

-- Create indexes for roles table
CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON public.roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON public.roles(is_system);

-- Enable RLS on roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for roles table using get_user_tenant_ids_safe
DROP POLICY IF EXISTS "Tenant isolation for roles" ON public.roles;
CREATE POLICY "Tenant isolation for roles"
  ON public.roles FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Create tenant_role_permissions table for role-permission mappings
CREATE TABLE IF NOT EXISTS public.tenant_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_permission_per_role UNIQUE (role_id, permission)
);

-- Create indexes for tenant_role_permissions
CREATE INDEX IF NOT EXISTS idx_tenant_role_permissions_role_id ON public.tenant_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_tenant_role_permissions_tenant_id ON public.tenant_role_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_role_permissions_permission ON public.tenant_role_permissions(permission);

-- Enable RLS on tenant_role_permissions
ALTER TABLE public.tenant_role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant_role_permissions
DROP POLICY IF EXISTS "Tenant isolation for tenant_role_permissions" ON public.tenant_role_permissions;
CREATE POLICY "Tenant isolation for tenant_role_permissions"
  ON public.tenant_role_permissions FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.tenant_users 
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Create updated_at trigger for roles
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_roles_updated_at_trigger ON public.roles;
CREATE TRIGGER update_roles_updated_at_trigger
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION update_roles_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.roles IS 'Tenant-specific custom role definitions';
COMMENT ON TABLE public.tenant_role_permissions IS 'Role-permission mappings for granular access control';
COMMENT ON COLUMN public.roles.is_system IS 'True for system-defined roles that cannot be deleted';