-- STEP 2 (correct approach): Migrate ONLY tenant user roles
-- Super admins use separate authentication system and don't need user_roles

-- 1. Insert owner role for tenant owners
INSERT INTO user_roles (user_id, role)
SELECT DISTINCT tu.user_id, 'owner'::app_role
FROM tenants t
JOIN tenant_users tu ON t.owner_email = tu.email AND t.id = tu.tenant_id
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = tu.user_id AND ur.role = 'owner'::app_role
)
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Migrate other tenant user roles
INSERT INTO user_roles (user_id, role)
SELECT DISTINCT tu.user_id, 
  CASE 
    WHEN tu.role = 'owner' THEN 'owner'::app_role
    WHEN tu.role = 'admin' THEN 'admin'::app_role
    WHEN tu.role = 'member' THEN 'member'::app_role
    WHEN tu.role = 'viewer' THEN 'viewer'::app_role
    ELSE 'member'::app_role
  END
FROM tenant_users tu
WHERE tu.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = tu.user_id
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- Note: Super admins remain in super_admin_users table with separate auth