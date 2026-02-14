-- ============================================================================
-- Fix Database Schema: Add Missing Columns for Disposable Menus
-- ============================================================================

-- Add missing columns to menu_access_whitelist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_access_whitelist' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE menu_access_whitelist ADD COLUMN customer_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_access_whitelist' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE menu_access_whitelist ADD COLUMN customer_email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_access_whitelist' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE menu_access_whitelist ADD COLUMN customer_phone TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_access_whitelist' AND column_name = 'unique_access_token'
  ) THEN
    ALTER TABLE menu_access_whitelist ADD COLUMN unique_access_token TEXT;
  END IF;
END $$;

-- Add missing columns to customers if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'business_name'
  ) THEN
    ALTER TABLE customers ADD COLUMN business_name TEXT;
  END IF;
END $$;

-- Add title column to disposable_menus (keeping name for backwards compatibility)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'disposable_menus' AND column_name = 'title'
  ) THEN
    ALTER TABLE disposable_menus ADD COLUMN title TEXT;
    -- Copy name to title for existing records
    UPDATE disposable_menus SET title = name WHERE title IS NULL;
  END IF;
END $$;

-- Create invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID REFERENCES public.disposable_menus(id) ON DELETE CASCADE,
  customer_id UUID,
  phone TEXT,
  email TEXT,
  method TEXT NOT NULL,
  message TEXT,
  unique_link TEXT,
  status TEXT DEFAULT 'sent',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Create policy for invitations (using simpler tenant-based access)
DROP POLICY IF EXISTS "Users can manage invitations" ON public.invitations;
CREATE POLICY "Users can manage invitations"
  ON public.invitations
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_menu_id ON public.invitations(menu_id);
CREATE INDEX IF NOT EXISTS idx_invitations_customer_id ON public.invitations(customer_id);
CREATE INDEX IF NOT EXISTS idx_menu_access_whitelist_customer_email ON public.menu_access_whitelist(customer_email);

-- Add comments
COMMENT ON COLUMN menu_access_whitelist.customer_name IS 'Customer full name for whitelist entry';
COMMENT ON COLUMN menu_access_whitelist.customer_email IS 'Customer email for whitelist entry';
COMMENT ON COLUMN menu_access_whitelist.customer_phone IS 'Customer phone for whitelist entry';
COMMENT ON COLUMN menu_access_whitelist.unique_access_token IS 'Unique token for customer-specific menu access';
COMMENT ON COLUMN customers.business_name IS 'Business name for B2B customers';
COMMENT ON COLUMN disposable_menus.title IS 'Menu title (legacy compatibility)';
COMMENT ON TABLE invitations IS 'Tracks menu invitation history and status';