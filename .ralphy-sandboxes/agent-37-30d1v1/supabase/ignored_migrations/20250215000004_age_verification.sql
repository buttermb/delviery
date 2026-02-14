-- ============================================
-- AGE VERIFICATION SYSTEM FOR CUSTOMERS
-- Phase 2: Enhanced Security
-- ============================================

-- Add age verification fields to customer_users
ALTER TABLE public.customer_users 
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS age_verification_method TEXT, -- 'dob', 'id_scan', 'manual'
ADD COLUMN IF NOT EXISTS minimum_age_required INTEGER DEFAULT 21; -- Configurable per tenant/region

-- Add age verification settings to tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS age_verification_required BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS minimum_age INTEGER DEFAULT 21,
ADD COLUMN IF NOT EXISTS age_verification_method TEXT DEFAULT 'dob'; -- 'dob', 'id_scan', 'both'

-- Create age_verification_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.age_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  verification_method TEXT NOT NULL, -- 'dob', 'id_scan', 'manual'
  date_of_birth DATE,
  calculated_age INTEGER,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by UUID, -- If manual verification by admin
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_age_verification_logs_customer_user ON public.age_verification_logs(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_age_verification_logs_tenant ON public.age_verification_logs(tenant_id);

-- Add RLS policies
ALTER TABLE public.age_verification_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all logs (for edge functions)
CREATE POLICY "age_verification_logs_service_role"
  ON public.age_verification_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to calculate age from date of birth
CREATE OR REPLACE FUNCTION public.calculate_age(birth_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(birth_date));
END;
$$;

-- Function to verify age meets minimum requirement
CREATE OR REPLACE FUNCTION public.verify_age_requirement(
  birth_date DATE,
  minimum_age INTEGER DEFAULT 21
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF birth_date IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN calculate_age(birth_date) >= minimum_age;
END;
$$;

-- Trigger to auto-verify age when DOB is set (if tenant allows auto-verification)
CREATE OR REPLACE FUNCTION public.auto_verify_age_on_dob_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_min_age INTEGER;
  calculated_age_val INTEGER;
  meets_requirement BOOLEAN;
BEGIN
  -- Only process if DOB was just set or changed
  IF NEW.date_of_birth IS NOT NULL AND (OLD.date_of_birth IS NULL OR NEW.date_of_birth != OLD.date_of_birth) THEN
    -- Get tenant minimum age requirement
    SELECT COALESCE(minimum_age, 21) INTO tenant_min_age
    FROM tenants
    WHERE id = NEW.tenant_id;
    
    -- Calculate age
    calculated_age_val := calculate_age(NEW.date_of_birth);
    
    -- Check if meets requirement
    meets_requirement := verify_age_requirement(NEW.date_of_birth, tenant_min_age);
    
    -- Auto-verify if meets requirement and tenant allows auto-verification
    IF meets_requirement THEN
      NEW.age_verified_at := NOW();
      NEW.age_verification_method := 'dob';
      NEW.minimum_age_required := tenant_min_age;
      
      -- Log verification
      INSERT INTO public.age_verification_logs (
        customer_user_id,
        tenant_id,
        verification_method,
        date_of_birth,
        calculated_age,
        verified_at
      )
      VALUES (
        NEW.id,
        NEW.tenant_id,
        'dob',
        NEW.date_of_birth,
        calculated_age_val,
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger
DROP TRIGGER IF EXISTS trigger_auto_verify_age ON public.customer_users;

CREATE TRIGGER trigger_auto_verify_age
  BEFORE UPDATE OF date_of_birth ON public.customer_users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_verify_age_on_dob_update();

-- Add comments
COMMENT ON COLUMN public.customer_users.date_of_birth IS 'Customer date of birth for age verification';
COMMENT ON COLUMN public.customer_users.age_verified_at IS 'Timestamp when age was verified';
COMMENT ON COLUMN public.customer_users.age_verification_method IS 'Method used to verify age: dob, id_scan, or manual';
COMMENT ON COLUMN public.tenants.minimum_age IS 'Minimum age requirement for customers (default 21)';
COMMENT ON FUNCTION public.calculate_age IS 'Calculates age in years from date of birth';
COMMENT ON FUNCTION public.verify_age_requirement IS 'Verifies if customer meets minimum age requirement';

