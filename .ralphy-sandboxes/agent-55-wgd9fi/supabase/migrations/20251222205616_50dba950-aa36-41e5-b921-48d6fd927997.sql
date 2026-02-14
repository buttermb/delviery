-- Create trigger to sync is_free_tier from tenants to tenant_credits
CREATE OR REPLACE FUNCTION public.sync_tenant_credits_free_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When tenant's is_free_tier changes, sync it to tenant_credits
  IF NEW.is_free_tier IS DISTINCT FROM OLD.is_free_tier THEN
    UPDATE tenant_credits
    SET is_free_tier = NEW.is_free_tier
    WHERE tenant_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on tenants table
DROP TRIGGER IF EXISTS sync_tenant_credits_free_tier_trigger ON tenants;
CREATE TRIGGER sync_tenant_credits_free_tier_trigger
  AFTER UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION sync_tenant_credits_free_tier();