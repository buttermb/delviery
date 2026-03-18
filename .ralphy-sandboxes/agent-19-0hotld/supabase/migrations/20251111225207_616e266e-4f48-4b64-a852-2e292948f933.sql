-- STEP 1: Add missing enum values (must be in separate transaction)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'owner';  
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'member';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'viewer';

-- Enum values are now committed and ready to use