-- ============================================================================
-- ROLE PERMISSIONS SYSTEM
-- ============================================================================
-- Creates permissions and role_permissions tables for fine-grained access control
-- Maps to the permission system defined in src/lib/permissions/rolePermissions.ts
-- ============================================================================

-- ============================================================================
-- PERMISSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- e.g., 'orders:create'
  resource TEXT NOT NULL, -- e.g., 'orders'
  action TEXT NOT NULL, -- e.g., 'create'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(resource, action)
);

-- ============================================================================
-- ROLE_PERMISSIONS JUNCTION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(role, permission_id)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permissions table (read-only for authenticated users)
CREATE POLICY "Authenticated users can view permissions"
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for role_permissions table (read-only for authenticated users)
CREATE POLICY "Authenticated users can view role permissions"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- SEED DEFAULT PERMISSIONS
-- ============================================================================
-- Insert all permissions from the rolePermissions.ts file

-- Orders permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('orders:view', 'orders', 'view', 'View orders'),
  ('orders:create', 'orders', 'create', 'Create new orders'),
  ('orders:edit', 'orders', 'edit', 'Edit existing orders'),
  ('orders:delete', 'orders', 'delete', 'Delete orders'),
  ('orders:cancel', 'orders', 'cancel', 'Cancel orders')
ON CONFLICT (name) DO NOTHING;

-- Inventory permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('inventory:view', 'inventory', 'view', 'View inventory'),
  ('inventory:edit', 'inventory', 'edit', 'Edit inventory'),
  ('inventory:transfer', 'inventory', 'transfer', 'Transfer inventory'),
  ('inventory:receive', 'inventory', 'receive', 'Receive inventory'),
  ('inventory:delete', 'inventory', 'delete', 'Delete inventory')
ON CONFLICT (name) DO NOTHING;

-- Products permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('products:view', 'products', 'view', 'View products'),
  ('products:create', 'products', 'create', 'Create products'),
  ('products:edit', 'products', 'edit', 'Edit products'),
  ('products:delete', 'products', 'delete', 'Delete products')
ON CONFLICT (name) DO NOTHING;

-- Customers permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('customers:view', 'customers', 'view', 'View customers'),
  ('customers:create', 'customers', 'create', 'Create customers'),
  ('customers:edit', 'customers', 'edit', 'Edit customers'),
  ('customers:delete', 'customers', 'delete', 'Delete customers')
ON CONFLICT (name) DO NOTHING;

-- Menus permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('menus:view', 'menus', 'view', 'View disposable menus'),
  ('menus:create', 'menus', 'create', 'Create disposable menus'),
  ('menus:edit', 'menus', 'edit', 'Edit disposable menus'),
  ('menus:delete', 'menus', 'delete', 'Delete disposable menus'),
  ('menus:share', 'menus', 'share', 'Share disposable menus')
ON CONFLICT (name) DO NOTHING;

-- Wholesale Orders permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('wholesale-orders:view', 'wholesale-orders', 'view', 'View wholesale orders'),
  ('wholesale-orders:create', 'wholesale-orders', 'create', 'Create wholesale orders'),
  ('wholesale-orders:edit', 'wholesale-orders', 'edit', 'Edit wholesale orders'),
  ('wholesale-orders:delete', 'wholesale-orders', 'delete', 'Delete wholesale orders')
ON CONFLICT (name) DO NOTHING;

-- Financial permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('finance:view', 'finance', 'view', 'View financial data'),
  ('finance:edit', 'finance', 'edit', 'Edit financial data'),
  ('finance:payments', 'finance', 'payments', 'Manage payments'),
  ('finance:credit', 'finance', 'credit', 'Manage credit'),
  ('finance:reports', 'finance', 'reports', 'View financial reports')
ON CONFLICT (name) DO NOTHING;

-- Team permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('team:view', 'team', 'view', 'View team members'),
  ('team:invite', 'team', 'invite', 'Invite team members'),
  ('team:edit', 'team', 'edit', 'Edit team members'),
  ('team:remove', 'team', 'remove', 'Remove team members')
ON CONFLICT (name) DO NOTHING;

-- Settings permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('settings:view', 'settings', 'view', 'View settings'),
  ('settings:edit', 'settings', 'edit', 'Edit settings'),
  ('settings:billing', 'settings', 'billing', 'Manage billing'),
  ('settings:security', 'settings', 'security', 'Manage security settings'),
  ('settings:integrations', 'settings', 'integrations', 'Manage integrations')
ON CONFLICT (name) DO NOTHING;

-- Reports permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('reports:view', 'reports', 'view', 'View reports'),
  ('reports:export', 'reports', 'export', 'Export reports')
ON CONFLICT (name) DO NOTHING;

-- Fleet permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('fleet:view', 'fleet', 'view', 'View fleet management'),
  ('fleet:manage', 'fleet', 'manage', 'Manage fleet')
ON CONFLICT (name) DO NOTHING;

-- API permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('api:view', 'api', 'view', 'View API settings'),
  ('api:manage', 'api', 'manage', 'Manage API settings')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED ROLE-PERMISSION MAPPINGS
-- ============================================================================
-- Map permissions to roles based on rolePermissions.ts

-- Owner: All permissions (wildcard - handled in application code)
-- For database, we'll explicitly grant all permissions
DO $$
DECLARE
  perm_record RECORD;
BEGIN
  FOR perm_record IN SELECT id FROM public.permissions LOOP
    INSERT INTO public.role_permissions (role, permission_id)
    VALUES ('owner', perm_record.id)
    ON CONFLICT (role, permission_id) DO NOTHING;
  END LOOP;
END $$;

-- Admin: Most permissions except critical settings
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions
WHERE name IN (
  'orders:view', 'orders:create', 'orders:edit', 'orders:delete', 'orders:cancel',
  'inventory:view', 'inventory:edit', 'inventory:transfer', 'inventory:receive', 'inventory:delete',
  'products:view', 'products:create', 'products:edit', 'products:delete',
  'customers:view', 'customers:create', 'customers:edit', 'customers:delete',
  'menus:view', 'menus:create', 'menus:edit', 'menus:delete', 'menus:share',
  'wholesale-orders:view', 'wholesale-orders:create', 'wholesale-orders:edit', 'wholesale-orders:delete',
  'finance:view', 'finance:payments', 'finance:credit', 'finance:reports',
  'team:view', 'team:invite', 'team:edit', 'team:remove',
  'settings:view',
  'reports:view', 'reports:export',
  'fleet:view', 'fleet:manage',
  'api:view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Team Member (member): Limited permissions for day-to-day operations
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'member', id FROM public.permissions
WHERE name IN (
  'orders:view', 'orders:create', 'orders:edit', 'orders:cancel',
  'inventory:view', 'inventory:edit', 'inventory:transfer', 'inventory:receive',
  'products:view',
  'customers:view',
  'menus:view',
  'wholesale-orders:view',
  'reports:view',
  'fleet:view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Viewer: Read-only access
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'viewer', id FROM public.permissions
WHERE name IN (
  'orders:view',
  'inventory:view',
  'products:view',
  'customers:view',
  'menus:view',
  'wholesale-orders:view',
  'reports:view',
  'fleet:view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON public.permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);

-- ============================================================================
-- HELPER FUNCTION: Check if role has permission
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_permission(
  user_role TEXT,
  permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner has all permissions (wildcard)
  IF user_role = 'owner' THEN
    RETURN TRUE;
  END IF;

  -- Check if role has specific permission
  RETURN EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE rp.role = user_role
      AND p.name = permission_name
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) TO authenticated;

