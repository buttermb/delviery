-- Seed default system roles for all existing tenants
INSERT INTO public.roles (tenant_id, name, description, is_system, permissions)
SELECT 
  t.id,
  role_def.name,
  role_def.description,
  true,
  role_def.permissions
FROM public.tenants t
CROSS JOIN (VALUES
  ('owner', 'Business Owner', '{"*": true}'::jsonb),
  ('admin', 'Administrator', '{"orders:*": true, "products:*": true, "inventory:*": true, "staff:read": true, "settings:read": true}'::jsonb),
  ('team_member', 'Team Member', '{"orders:read": true, "orders:update": true, "products:read": true, "inventory:read": true}'::jsonb),
  ('viewer', 'Viewer', '{"orders:read": true, "products:read": true, "inventory:read": true}'::jsonb)
) AS role_def(name, description, permissions)
ON CONFLICT DO NOTHING;

-- Create trigger function to auto-seed roles for new tenants
CREATE OR REPLACE FUNCTION public.seed_tenant_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.roles (tenant_id, name, description, is_system, permissions)
  VALUES 
    (NEW.id, 'owner', 'Business Owner', true, '{"*": true}'::jsonb),
    (NEW.id, 'admin', 'Administrator', true, '{"orders:*": true, "products:*": true, "inventory:*": true, "staff:read": true, "settings:read": true}'::jsonb),
    (NEW.id, 'team_member', 'Team Member', true, '{"orders:read": true, "orders:update": true, "products:read": true, "inventory:read": true}'::jsonb),
    (NEW.id, 'viewer', 'Viewer', true, '{"orders:read": true, "products:read": true, "inventory:read": true}'::jsonb);
  RETURN NEW;
END;
$$;

-- Create trigger to auto-seed roles on tenant creation
DROP TRIGGER IF EXISTS seed_roles_on_tenant_insert ON public.tenants;
CREATE TRIGGER seed_roles_on_tenant_insert
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_tenant_roles();