-- ============================================================================
-- Migration: Products Auto-Sync Trigger (Clean, de-duplicated)
-- Description: Automatically syncs products to marketplace_product_settings
--              when products are created or updated
-- ============================================================================

-- Remove any previous trigger and function versions
DROP TRIGGER IF EXISTS trigger_auto_sync_product_on_insert ON public.products;
DROP TRIGGER IF EXISTS trigger_auto_sync_product_on_update ON public.products;
DROP FUNCTION IF EXISTS public.auto_sync_product_to_marketplace();

-- Single, final function
CREATE OR REPLACE FUNCTION public.auto_sync_product_to_marketplace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_store_id UUID;
BEGIN
    -- Find the marketplace store for the current user's tenant
    -- (products table does not have tenant_id)
    SELECT ms.id INTO v_store_id
    FROM public.marketplace_stores ms
    JOIN public.tenant_users tu ON tu.tenant_id = ms.tenant_id
    WHERE tu.user_id = auth.uid()
    LIMIT 1;

    IF v_store_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.marketplace_product_settings (
        store_id,
        product_id,
        is_visible,
        display_order
    )
    VALUES (
        v_store_id,
        NEW.id,
        COALESCE(NEW.menu_visibility, true),
        0
    )
    ON CONFLICT (store_id, product_id) DO UPDATE SET
        is_visible = COALESCE(EXCLUDED.is_visible, marketplace_product_settings.is_visible),
        updated_at = NOW();

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_sync_product_to_marketplace failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Re-create triggers
CREATE TRIGGER trigger_auto_sync_product_on_insert
    AFTER INSERT ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_sync_product_to_marketplace();

CREATE TRIGGER trigger_auto_sync_product_on_update
    AFTER UPDATE ON public.products
    FOR EACH ROW
    WHEN (
        OLD.in_stock IS DISTINCT FROM NEW.in_stock
        OR OLD.menu_visibility IS DISTINCT FROM NEW.menu_visibility
        OR OLD.name IS DISTINCT FROM NEW.name
    )
    EXECUTE FUNCTION public.auto_sync_product_to_marketplace();

GRANT EXECUTE ON FUNCTION public.auto_sync_product_to_marketplace() TO authenticated;

-- One-time backfill (skipped: products table has no tenant_id, cannot reliably map to stores)
-- Use sync_all_products_to_marketplace RPC manually if needed.

COMMENT ON FUNCTION public.auto_sync_product_to_marketplace IS
'Automatically syncs products to marketplace_product_settings when products are created or updated.';
