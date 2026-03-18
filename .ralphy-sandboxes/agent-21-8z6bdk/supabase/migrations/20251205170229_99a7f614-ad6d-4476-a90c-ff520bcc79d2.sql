-- Add clerk_user_id columns for Clerk hybrid auth integration

-- Add clerk_user_id to tenant_users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenant_users' 
    AND column_name = 'clerk_user_id'
  ) THEN
    ALTER TABLE public.tenant_users ADD COLUMN clerk_user_id TEXT;
    CREATE INDEX idx_tenant_users_clerk_id ON public.tenant_users(clerk_user_id);
  END IF;
END $$;

-- Add clerk_user_id to super_admin_users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'super_admin_users' 
    AND column_name = 'clerk_user_id'
  ) THEN
    ALTER TABLE public.super_admin_users ADD COLUMN clerk_user_id TEXT;
    CREATE INDEX idx_super_admin_users_clerk_id ON public.super_admin_users(clerk_user_id);
  END IF;
END $$;

-- Add clerk_user_id to customer_users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'customer_users' 
    AND column_name = 'clerk_user_id'
  ) THEN
    ALTER TABLE public.customer_users ADD COLUMN clerk_user_id TEXT;
    CREATE INDEX idx_customer_users_clerk_id ON public.customer_users(clerk_user_id);
  END IF;
END $$;

-- Add avatar_url and last_login_at to tenant_users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenant_users' 
    AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.tenant_users ADD COLUMN avatar_url TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tenant_users' 
    AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE public.tenant_users ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
END $$;