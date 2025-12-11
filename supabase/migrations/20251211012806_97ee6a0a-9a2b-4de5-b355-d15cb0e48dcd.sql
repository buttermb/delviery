-- Drop the two remaining recursive RLS policies causing infinite recursion
DROP POLICY IF EXISTS "Admins can manage tenant users" ON tenant_users;
DROP POLICY IF EXISTS "Users can view same tenant members" ON tenant_users;