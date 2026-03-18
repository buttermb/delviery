-- Auto-create tenant_credits for new tenants
CREATE OR REPLACE FUNCTION public.auto_create_tenant_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_credits (tenant_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create credits on tenant creation
DROP TRIGGER IF EXISTS trigger_auto_create_tenant_credits ON public.tenants;
CREATE TRIGGER trigger_auto_create_tenant_credits
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_tenant_credits();

-- Insert credits for existing tenants that don't have them
INSERT INTO public.tenant_credits (tenant_id, balance)
SELECT id, 0 FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_credits tc WHERE tc.tenant_id = t.id);

-- Auto-sync products to marketplace when store is created
CREATE OR REPLACE FUNCTION public.sync_products_to_store()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.marketplace_product_settings (store_id, product_id, is_visible, display_order)
  SELECT NEW.id, p.id, true, 0
  FROM public.products p
  WHERE p.tenant_id = NEW.tenant_id
  ON CONFLICT (store_id, product_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to sync products when store is created
DROP TRIGGER IF EXISTS trigger_sync_products_to_store ON public.marketplace_stores;
CREATE TRIGGER trigger_sync_products_to_store
  AFTER INSERT ON public.marketplace_stores
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_products_to_store();

-- Sync existing products to the willysbo store (one-time fix)
INSERT INTO public.marketplace_product_settings (store_id, product_id, is_visible, display_order)
SELECT 'dac16c6b-56b6-4a12-b3e2-fd42116fe6bb', p.id, true, 0
FROM public.products p
WHERE p.tenant_id = 'ddc490cf-5c0a-485d-a6cb-94a8cb7b43ff'
ON CONFLICT (store_id, product_id) DO NOTHING;